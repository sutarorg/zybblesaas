-- ============================================================================
-- Zybble · 0013 · normalise the engine's status string before it is stored
-- ============================================================================
-- What went wrong:
--
--   Google Maps reports a place's state as a display string — "Open", "CLOSED",
--   "Permanently closed", "Temporarily closed", "Geöffnet", "Öffnet um 9 Uhr",
--   etc. — in the language the scrape ran in. The worker forwards that string
--   verbatim (worker/internal/engine/engine.go → PayloadFromEntry, key
--   `status`).
--
--   public.leads stores a small normalized enum instead:
--   `leads_status_check check (status in ('open', 'closed', 'unknown'))`.
--   Handing the display string straight to that column made every insert raise
--   23514 (check_violation), so public.lead_upsert failed for *every single
--   place*, the worker's result writer logged "flush failed", and the search
--   finished with zero leads.
--
-- The fix:
--
--   normalize_lead_status() is the one place that turns what the engine saw
--   into the stored enum. It never guesses: a value it does not recognise (or
--   an empty one) becomes NULL, which means "unknown" on insert and "keep what
--   we already know" on update. The verbatim string is still kept in
--   leads.raw_data, so nothing the scraper saw is lost.
create or replace function public.normalize_lead_status(p_status text)
returns text
language plpgsql
immutable
as $$
declare
  v text := lower(btrim(coalesce(p_status, '')));
  -- Phrases that mean "closed right now". They are matched anywhere in the
  -- string, so the localized *and* the prefixed forms all resolve
  -- ("permanently closed", "dauerhaft geschlossen", "définitivement fermé").
  -- None of them occurs inside a phrase that means the place is open.
  v_closed_markers text[] := array[
    'closed', 'geschlossen', 'fermé', 'ferme', 'cerrado', 'chiuso', 'fechado', 'gesloten',
    'закрыто', 'закрыт', 'зачинено', 'zamknięte', 'zamkniete', 'kapalı', 'kapali',
    'stängt', 'stangt', 'lukket', 'stengt', 'suljettu', 'zavřeno', 'zavreno',
    'סגור', 'مغلق', 'κλειστ', 'बंद', '已打烊', '已关闭', '已關閉', '休息', '영업 종료'
  ];
  -- "it will open later" — the place is closed *now*.
  v_closed_prefixes text[] := array['opens ', 'öffnet ', 'offnet ', 'ouvre ', 'abre ', 'abre a '];
  -- Phrases that mean "open right now".
  v_open_markers text[] := array[
    'open', 'open now', 'closing soon', 'closing in',
    'geöffnet', 'geoffnet', 'offen', 'ouvert', 'ouverte',
    'abierto', 'abierta', 'aperto', 'aberta', 'aberto', 'открыто', 'открыт', 'відчинено',
    'otwarte', 'açık', 'acik', 'öppet', 'oppet', 'åbent', 'abent', 'åpent', 'avoinna',
    'otevřeno', 'otevreno', 'פתוח', 'مفتوح', 'ανοιχτ', 'खुला', '营业中', '營業中', '영업 중'
  ];
  marker text;
begin
  if v = '' then
    return null;
  end if;

  -- 1. closed wins over open: "Open ⋅ Closes 10 PM" says open, but
  --    "Permanently closed" and "Opens 9 AM" must never be read as open.
  foreach marker in array v_closed_markers loop
    if position(marker in v) > 0 then
      return 'closed';
    end if;
  end loop;

  foreach marker in array v_closed_prefixes loop
    if position(marker in v) = 1 or v = btrim(marker) then
      return 'closed';
    end if;
  end loop;

  -- 2. open markers must be a whole word: "opens 9 am" (matched above) is not
  --    "open", and "opening hours" is not a status at all.
  foreach marker in array v_open_markers loop
    if v = marker or v ~ ('^' || marker || '($|[^a-z])') then
      return 'open';
    end if;
  end loop;

  -- 3. Anything else is honestly unknown — never a guess.
  return null;
end;
$$;

comment on function public.normalize_lead_status(text) is
  'Maps the source-reported status string (any language/casing) to the stored enum open|closed|unknown. NULL means "not recognised".';

revoke all on function public.normalize_lead_status(text) from public, anon, authenticated;
grant execute on function public.normalize_lead_status(text) to service_role;

create or replace function public.lead_upsert(
  p_payload jsonb,
  p_engine_version text default null
)
returns table (lead_id uuid, created boolean, matched_by text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text := nullif(btrim(coalesce(p_payload ->> 'business_name', '')), '');
  v_city text := nullif(btrim(coalesce(p_payload ->> 'city', '')), '');
  v_domain text := nullif(coalesce(p_payload ->> 'domain', public.normalize_domain(p_payload ->> 'website')), '');
  v_phone text := nullif(coalesce(p_payload ->> 'normalized_phone', public.normalize_phone(p_payload ->> 'phone')), '');
  v_place_id text := nullif(btrim(coalesce(p_payload ->> 'place_id', '')), '');
  v_cid text := nullif(btrim(coalesce(p_payload ->> 'cid', '')), '');
  v_data_id text := nullif(btrim(coalesce(p_payload ->> 'data_id', '')), '');
  v_map_url text := nullif(btrim(coalesce(p_payload ->> 'map_url', '')), '');
  v_match_id uuid;
  v_matched_by text;
  v_created boolean := false;
  v_slug text;
begin
  if v_name is null then
    raise exception 'lead_upsert: business_name is required' using errcode = '22023';
  end if;

  select m.lead_id, m.matched_by into v_match_id, v_matched_by
    from public.lead_find_match(
      v_place_id, v_cid, v_data_id, v_map_url, v_domain, v_phone, v_name, v_city,
      p_payload ->> 'postal_code', p_payload ->> 'address'
    ) m
   limit 1;

  if v_match_id is not null then
    update public.leads l
       set business_name = coalesce(v_name, l.business_name),
           category = coalesce(nullif(p_payload ->> 'category', ''), l.category),
           categories = case when jsonb_typeof(coalesce(p_payload -> 'categories', 'null'::jsonb)) = 'array'
                             and jsonb_array_length(p_payload -> 'categories') > 0
                             then (select array_agg(x) from jsonb_array_elements_text(p_payload -> 'categories') x)
                             else l.categories end,
           website = coalesce(nullif(p_payload ->> 'website', ''), l.website),
           domain = coalesce(v_domain, l.domain),
           phone = coalesce(nullif(p_payload ->> 'phone', ''), l.phone),
           normalized_phone = coalesce(v_phone, l.normalized_phone),
           address = coalesce(nullif(p_payload ->> 'address', ''), l.address),
           complete_address = coalesce(nullif(p_payload ->> 'complete_address', ''), l.complete_address),
           street = coalesce(nullif(p_payload ->> 'street', ''), l.street),
           city = coalesce(v_city, l.city),
           state = coalesce(nullif(p_payload ->> 'state', ''), l.state),
           country = coalesce(nullif(p_payload ->> 'country', ''), l.country),
           country_code = coalesce(nullif(p_payload ->> 'country_code', ''), l.country_code),
           postal_code = coalesce(nullif(p_payload ->> 'postal_code', ''), l.postal_code),
           latitude = coalesce((p_payload ->> 'latitude')::double precision, l.latitude),
           longitude = coalesce((p_payload ->> 'longitude')::double precision, l.longitude),
           rating = coalesce((p_payload ->> 'rating')::numeric, l.rating),
           review_count = coalesce((p_payload ->> 'review_count')::int, l.review_count),
           reviews_per_rating = coalesce(p_payload -> 'reviews_per_rating', l.reviews_per_rating),
           status = coalesce(public.normalize_lead_status(p_payload ->> 'status'), l.status),
           open_hours = coalesce(p_payload -> 'open_hours', l.open_hours),
           popular_times = coalesce(p_payload -> 'popular_times', l.popular_times),
           plus_code = coalesce(nullif(p_payload ->> 'plus_code', ''), l.plus_code),
           timezone = coalesce(nullif(p_payload ->> 'timezone', ''), l.timezone),
           price_range = coalesce(nullif(p_payload ->> 'price_range', ''), l.price_range),
           map_url = coalesce(v_map_url, l.map_url),
           reviews_url = coalesce(nullif(p_payload ->> 'reviews_url', ''), l.reviews_url),
           place_id = coalesce(v_place_id, l.place_id),
           cid = coalesce(v_cid, l.cid),
           data_id = coalesce(v_data_id, l.data_id),
           thumbnail_url = coalesce(nullif(p_payload ->> 'thumbnail_url', ''), l.thumbnail_url),
           street_view_url = coalesce(nullif(p_payload ->> 'street_view_url', ''), l.street_view_url),
           images = coalesce(p_payload -> 'images', l.images),
           reservations_url = coalesce(nullif(p_payload ->> 'reservations_url', ''), l.reservations_url),
           order_online_url = coalesce(nullif(p_payload ->> 'order_online_url', ''), l.order_online_url),
           menu_url = coalesce(nullif(p_payload ->> 'menu_url', ''), l.menu_url),
           owner_data = coalesce(p_payload -> 'owner_data', l.owner_data),
           description = coalesce(nullif(p_payload ->> 'description', ''), l.description),
           about = case when coalesce(p_payload -> 'about', '{}'::jsonb) <> '{}'::jsonb then p_payload -> 'about' else l.about end,
           raw_data = coalesce(p_payload -> 'raw_data', l.raw_data),
           source_engine = coalesce(nullif(p_payload ->> 'source_engine', ''), l.source_engine),
           engine_version = coalesce(p_engine_version, l.engine_version),
           last_seen_at = now()
     where l.id = v_match_id;

    v_matched_by := coalesce(v_matched_by, 'existing');
  else
    v_slug := public.unique_slug('leads', 'slug',
      concat_ws('-', v_name, coalesce(v_city, p_payload ->> 'postal_code', '')));

    begin
      insert into public.leads (
        slug, business_name, category, categories, website, domain, phone, normalized_phone,
        address, complete_address, street, city, state, country, country_code, postal_code,
        latitude, longitude, rating, review_count, reviews_per_rating, status, open_hours, popular_times,
        plus_code, timezone, price_range, map_url, reviews_url, place_id, cid, data_id,
        thumbnail_url, street_view_url, images, reservations_url, order_online_url, menu_url,
        owner_data, description, about, raw_data, source, source_engine, engine_version
      ) values (
        v_slug, v_name,
        nullif(p_payload ->> 'category', ''),
        coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_payload -> 'categories', '[]'::jsonb)) x), '{}'),
        nullif(p_payload ->> 'website', ''), v_domain,
        nullif(p_payload ->> 'phone', ''), v_phone,
        nullif(p_payload ->> 'address', ''), nullif(p_payload ->> 'complete_address', ''),
        nullif(p_payload ->> 'street', ''), v_city, nullif(p_payload ->> 'state', ''),
        nullif(p_payload ->> 'country', ''), nullif(p_payload ->> 'country_code', ''),
        nullif(p_payload ->> 'postal_code', ''),
        (p_payload ->> 'latitude')::double precision, (p_payload ->> 'longitude')::double precision,
        (p_payload ->> 'rating')::numeric, (p_payload ->> 'review_count')::int,
        p_payload -> 'reviews_per_rating',
        coalesce(public.normalize_lead_status(p_payload ->> 'status'), 'unknown'),
        p_payload -> 'open_hours', p_payload -> 'popular_times',
        nullif(p_payload ->> 'plus_code', ''), nullif(p_payload ->> 'timezone', ''),
        nullif(p_payload ->> 'price_range', ''), v_map_url, nullif(p_payload ->> 'reviews_url', ''),
        v_place_id, v_cid, v_data_id,
        nullif(p_payload ->> 'thumbnail_url', ''), nullif(p_payload ->> 'street_view_url', ''),
        coalesce(p_payload -> 'images', '[]'::jsonb),
        nullif(p_payload ->> 'reservations_url', ''), nullif(p_payload ->> 'order_online_url', ''),
        nullif(p_payload ->> 'menu_url', ''), p_payload -> 'owner_data',
        nullif(p_payload ->> 'description', ''), coalesce(p_payload -> 'about', '{}'::jsonb),
        coalesce(p_payload -> 'raw_data', '{}'::jsonb),
        coalesce(nullif(p_payload ->> 'source', ''), 'google_maps'),
        coalesce(nullif(p_payload ->> 'source_engine', ''), 'gosom'),
        p_engine_version
      )
      returning id into v_match_id;

      v_created := true;
      v_matched_by := 'new';
    exception when unique_violation then
      -- concurrent writer inserted the same identity first: adopt their row
      select m.lead_id, m.matched_by into v_match_id, v_matched_by
        from public.lead_find_match(v_place_id, v_cid, v_data_id, v_map_url, v_domain, v_phone, v_name, v_city,
              p_payload ->> 'postal_code', p_payload ->> 'address') m
       limit 1;
    end;
  end if;

  perform public.lead_sync_children(v_match_id, p_payload);

  return query select v_match_id, v_created, coalesce(v_matched_by, 'unknown');
end;
$$;


comment on function public.lead_upsert(jsonb, text) is
  'Canonical lead ingest: deduplicates by provider identity and stores the normalized row (status via normalize_lead_status).';

notify pgrst, 'reload schema';
