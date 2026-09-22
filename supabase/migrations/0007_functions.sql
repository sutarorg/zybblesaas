-- ============================================================================
-- Zybble · 0007 · SQL functions: queue, dedupe/upsert, metering, progress
--
-- Every function here is called by the TypeScript API layer (through PostgREST
-- RPC with the secret key) or by the Go worker (through pgx). Keeping the
-- atomic operations in SQL is what makes concurrency safe without extra
-- infrastructure: a single round trip, one transaction, row locks.
-- ============================================================================

-- ###########################################################################
-- # QUEUE
-- ###########################################################################

create or replace function ops.queue_enqueue(
  p_job_type text,
  p_payload jsonb default '{}'::jsonb,
  p_workspace_id uuid default null,
  p_priority int default 50,
  p_dedupe_key text default null,
  p_available_at timestamptz default now(),
  p_max_attempts int default 3,
  p_scheduled_by text default 'api'
)
returns uuid
language plpgsql
security definer
set search_path = ops, public, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_dedupe_key is not null then
    select id into v_id
      from ops.job_queue
     where job_type = p_job_type
       and dedupe_key = p_dedupe_key
       and status in ('pending', 'running')
     limit 1;

    if v_id is not null then
      return v_id;
    end if;
  end if;

  insert into ops.job_queue (job_type, workspace_id, priority, payload, dedupe_key, available_at, max_attempts, scheduled_by)
  values (p_job_type, p_workspace_id, p_priority, coalesce(p_payload, '{}'::jsonb), p_dedupe_key, coalesce(p_available_at, now()), greatest(1, p_max_attempts), p_scheduled_by)
  returning id into v_id;

  return v_id;
end;
$$;

-- Claim up to p_max_jobs jobs atomically. Safe with any number of workers.
create or replace function ops.queue_claim(
  p_worker_id text,
  p_job_types text[],
  p_max_jobs int default 1,
  p_lease_seconds int default 300
)
returns setof ops.job_queue
language sql
security definer
set search_path = ops, public, pg_temp
as $$
  with claimed as (
    select j.id
      from ops.job_queue j
     where j.status = 'pending'
       and j.job_type = any (p_job_types)
       and j.available_at <= now()
     order by j.priority desc, j.available_at asc, j.created_at asc
     limit greatest(1, p_max_jobs)
     for update skip locked
  )
  update ops.job_queue j
     set status = 'running',
         locked_by = p_worker_id,
         locked_at = now(),
         locked_until = now() + make_interval(secs => greatest(30, p_lease_seconds)),
         attempts = j.attempts + 1,
         started_at = coalesce(j.started_at, now()),
         updated_at = now()
    from claimed c
   where j.id = c.id
  returning j.*;
$$;

-- Extend a lease while a long job is still healthy.
create or replace function ops.queue_heartbeat(
  p_job_id uuid,
  p_worker_id text,
  p_lease_seconds int default 300
)
returns boolean
language plpgsql
security definer
set search_path = ops, public, pg_temp
as $$
declare
  v_ok boolean := false;
begin
  update ops.job_queue
     set locked_until = now() + make_interval(secs => greatest(30, p_lease_seconds)),
         updated_at = now()
   where id = p_job_id
     and locked_by = p_worker_id
     and status = 'running'
  returning true into v_ok;

  return coalesce(v_ok, false);
end;
$$;

create or replace function ops.queue_complete(
  p_job_id uuid,
  p_worker_id text,
  p_result jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ops, public, pg_temp
as $$
declare
  v_ok boolean := false;
begin
  update ops.job_queue
     set status = 'succeeded',
         finished_at = now(),
         result = coalesce(p_result, '{}'::jsonb),
         locked_by = null,
         locked_until = null,
         locked_at = null,
         updated_at = now()
   where id = p_job_id
     and locked_by = p_worker_id
  returning true into v_ok;

  return coalesce(v_ok, false);
end;
$$;

-- Fail a job: retry with exponential backoff + jitter until max_attempts.
create or replace function ops.queue_fail(
  p_job_id uuid,
  p_worker_id text,
  p_error text,
  p_retry_delay_seconds int default 30
)
returns text
language plpgsql
security definer
set search_path = ops, public, pg_temp
as $$
declare
  v_job ops.job_queue;
  v_delay numeric;
  v_status text;
begin
  select * into v_job from ops.job_queue where id = p_job_id and locked_by = p_worker_id for update;

  if v_job.id is null then
    return 'not_owned';
  end if;

  if v_job.attempts >= v_job.max_attempts then
    update ops.job_queue
       set status = 'failed',
           finished_at = now(),
           last_error = left(coalesce(p_error, 'unknown error'), 4000),
           last_error_at = now(),
           locked_by = null, locked_until = null, locked_at = null,
           updated_at = now()
     where id = p_job_id;

    return 'failed';
  end if;

  v_delay := greatest(1, p_retry_delay_seconds) * power(2, v_job.attempts - 1);
  v_delay := least(v_delay, 3600) * (0.75 + random() * 0.5);   -- jitter

  update ops.job_queue
     set status = 'pending',
         available_at = now() + make_interval(secs => v_delay),
         last_error = left(coalesce(p_error, 'unknown error'), 4000),
         last_error_at = now(),
         locked_by = null, locked_until = null, locked_at = null,
         updated_at = now()
   where id = p_job_id
  returning status into v_status;

  return v_status;
end;
$$;

-- Startup recovery: expired leases become claimable again (or failed).
create or replace function ops.queue_reclaim_expired(p_limit int default 500)
returns table (reclaimed int, failed int)
language plpgsql
security definer
set search_path = ops, public, pg_temp
as $$
declare
  v_reclaimed int := 0;
  v_failed int := 0;
begin
  with expired as (
    select id, (attempts >= max_attempts) as exhausted
      from ops.job_queue
     where status = 'running'
       and locked_until < now()
     order by locked_until asc
     limit greatest(1, p_limit)
     for update skip locked
  ), upd as (
    update ops.job_queue j
       set status = case when e.exhausted then 'failed' else 'pending' end,
           available_at = now(),
           finished_at = case when e.exhausted then now() else j.finished_at end,
           last_error = coalesce(j.last_error, 'lease expired (worker restart)'),
           locked_by = null, locked_until = null, locked_at = null,
           updated_at = now()
      from expired e
     where j.id = e.id
    returning e.exhausted
  )
  select count(*) filter (where not exhausted)::int, count(*) filter (where exhausted)::int
    into v_reclaimed, v_failed
    from upd;

  return query select v_reclaimed, v_failed;
end;
$$;

-- Cancellation: drop still-pending work for a search (running work is flagged
-- through searches.status = 'cancelled' and stops cooperatively).
create or replace function ops.queue_cancel_search(p_search_id uuid, p_job_types text[] default null)
returns int
language plpgsql
security definer
set search_path = ops, public, pg_temp
as $$
declare
  v_count int;
begin
  update ops.job_queue
     set status = 'cancelled',
         finished_at = now(),
         last_error = 'cancelled by user',
         locked_by = null, locked_until = null, locked_at = null,
         updated_at = now()
   where status = 'pending'
     and payload ->> 'search_id' = p_search_id::text
     and (p_job_types is null or job_type = any (p_job_types));

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function ops.queue_stats()
returns jsonb
language sql
security definer
set search_path = ops, public, pg_temp
as $$
  select jsonb_build_object(
    'pending', count(*) filter (where status = 'pending'),
    'running', count(*) filter (where status = 'running'),
    'failed_last_hour', count(*) filter (where status = 'failed' and finished_at > now() - interval '1 hour'),
    'expired_leases', count(*) filter (where status = 'running' and locked_until < now()),
    'oldest_pending_age_seconds', coalesce(extract(epoch from (now() - min(created_at) filter (where status = 'pending')))::int, 0)
  )
  from ops.job_queue;
$$;

-- ###########################################################################
-- # WORKER REGISTRY
-- ###########################################################################

create or replace function ops.worker_register(
  p_worker_id text,
  p_version text,
  p_engine_version text default null,
  p_hostname text default null,
  p_region text default null,
  p_concurrency jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ops, public, pg_temp
as $$
  insert into ops.workers (worker_id, status, version, engine_version, hostname, region, concurrency, started_at, last_heartbeat_at)
  values (p_worker_id, 'starting', p_version, p_engine_version, p_hostname, p_region, coalesce(p_concurrency, '{}'::jsonb), now(), now())
  on conflict (worker_id) do update
     set status = 'starting',
         version = excluded.version,
         engine_version = excluded.engine_version,
         hostname = excluded.hostname,
         region = excluded.region,
         concurrency = excluded.concurrency,
         started_at = now(),
         last_heartbeat_at = now();
$$;

create or replace function ops.worker_heartbeat(
  p_worker_id text,
  p_status text,
  p_active_jobs int,
  p_queued_jobs int,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ops, public, pg_temp
as $$
  insert into ops.workers (worker_id, status, version, active_jobs, queued_jobs, metadata, started_at, last_heartbeat_at)
  values (p_worker_id, p_status, 'unknown', p_active_jobs, p_queued_jobs, coalesce(p_metadata, '{}'::jsonb), now(), now())
  on conflict (worker_id) do update
     set status = excluded.status,
         active_jobs = excluded.active_jobs,
         queued_jobs = excluded.queued_jobs,
         metadata = ops.workers.metadata || excluded.metadata,
         last_heartbeat_at = now();
$$;

-- ###########################################################################
-- # USAGE / ENTITLEMENTS
-- ###########################################################################

create or replace function public.usage_period_start(p_at timestamptz default now())
returns timestamptz
language sql
immutable
as $$
  select date_trunc('month', p_at);
$$;

-- Idempotent usage recording (no limit check). Used for lead accrual, which
-- must never be lost once a lead is associated with a workspace.
create or replace function public.usage_record(
  p_workspace_id uuid,
  p_kind text,
  p_quantity int default 1,
  p_dedupe_key text default null,
  p_ref_type text default null,
  p_ref_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inserted boolean := false;
begin
  if p_workspace_id is null then
    return false;
  end if;

  insert into public.usage_events (workspace_id, kind, quantity, dedupe_key, ref_type, ref_id, metadata)
  values (
    p_workspace_id,
    p_kind,
    greatest(1, coalesce(p_quantity, 1)),
    coalesce(p_dedupe_key, p_kind || ':' || gen_random_uuid()::text),
    p_ref_type,
    p_ref_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (workspace_id, dedupe_key) do nothing
  returning true into v_inserted;

  return coalesce(v_inserted, false);
end;
$$;

-- Atomic check-and-record. Returns false when the limit would be exceeded, so
-- the caller can refuse the operation before doing any work.
create or replace function public.usage_reserve(
  p_workspace_id uuid,
  p_kind text,
  p_limit int,
  p_quantity int default 1,
  p_dedupe_key text default null,
  p_ref_type text default null,
  p_ref_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_period_start timestamptz := date_trunc('month', now());
  v_period_end timestamptz := date_trunc('month', now()) + interval '1 month';
  v_used int := 0;
  v_already boolean := false;
begin
  -- idempotent replay: identical dedupe key already recorded -> allowed
  if p_dedupe_key is not null then
    select true into v_already
      from public.usage_events
     where workspace_id = p_workspace_id and dedupe_key = p_dedupe_key
     limit 1;

    if coalesce(v_already, false) then
      return true;
    end if;
  end if;

  insert into public.usage_counters (workspace_id, period_start, period_end)
  values (p_workspace_id, v_period_start, v_period_end)
  on conflict (workspace_id, period_start) do nothing;

  select case p_kind
           when 'lead_generated' then leads_generated
           when 'search_created' then searches_created
           when 'ai_run' then ai_runs
           when 'export_created' then exports_created
           when 'email_found' then emails_found
           else 0
         end
    into v_used
    from public.usage_counters
   where workspace_id = p_workspace_id and period_start = v_period_start
     for update;

  if p_limit is not null and p_limit >= 0 and (v_used + greatest(1, p_quantity)) > p_limit then
    return false;
  end if;

  perform public.usage_record(p_workspace_id, p_kind, p_quantity, p_dedupe_key, p_ref_type, p_ref_id, p_metadata);

  return true;
end;
$$;

-- One call returning plan + subscription + current period usage for the API
-- layer (used by every entitlement check and by /setting and /billing).
create or replace function public.workspace_entitlements(p_workspace_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'workspace', jsonb_build_object(
      'id', w.id,
      'name', w.name,
      'slug', w.slug,
      'created_at', w.created_at
    ),
    'plan', jsonb_build_object(
      'id', p.id,
      'code', p.code,
      'name', p.name,
      'price_minor', p.price_minor,
      'currency', p.currency,
      'leads_per_period', p.leads_per_period,
      'ai_runs_per_period', p.ai_runs_per_period,
      'seats', p.seats,
      'concurrent_searches', p.concurrent_searches,
      'max_search_depth', p.max_search_depth,
      'max_radius_km', p.max_radius_km,
      'queue_priority', p.queue_priority,
      'ai_enabled', p.ai_enabled,
      'api_access', p.api_access,
      'grid_coverage', p.grid_coverage,
      'priority_queue', p.priority_queue,
      'export_formats', p.export_formats,
      'export_retention_days', p.export_retention_days,
      'trial_days', p.trial_days,
      'features', p.features
    ),
    'subscription', (
      select to_jsonb(s) - 'provider_payload'
        from public.subscriptions s
       where s.workspace_id = w.id
         and s.status in ('created', 'pending', 'authenticated', 'active', 'paused', 'halted')
       order by s.created_at desc
       limit 1
    ),
    'usage', coalesce((
      select jsonb_build_object(
        'period_start', uc.period_start,
        'period_end', uc.period_end,
        'leads_generated', uc.leads_generated,
        'searches_created', uc.searches_created,
        'ai_runs', uc.ai_runs,
        'exports_created', uc.exports_created,
        'emails_found', uc.emails_found
      )
      from public.usage_counters uc
      where uc.workspace_id = w.id
        and uc.period_start = date_trunc('month', now())
    ), jsonb_build_object(
      'period_start', date_trunc('month', now()),
      'period_end', date_trunc('month', now()) + interval '1 month',
      'leads_generated', 0, 'searches_created', 0, 'ai_runs', 0, 'exports_created', 0, 'emails_found', 0
    )),
    'seats_used', (
      select count(*) from public.workspace_members m
       where m.workspace_id = w.id and m.status = 'active'
    ),
    'active_searches', (
      select count(*) from public.searches s
       where s.workspace_id = w.id
         and s.status in ('queued', 'running', 'enriching')
         and s.deleted_at is null
    )
  )
  into v_result
  from public.workspaces w
  left join public.plans p on p.id = w.plan_id
  where w.id = p_workspace_id;

  return v_result;
end;
$$;

-- ###########################################################################
-- # LEAD DEDUPE + UPSERT
-- ###########################################################################

-- Identity hierarchy: strong provider identifiers first, then multi-signal
-- fallbacks. Never matches on business name alone (task §35).
create or replace function public.lead_find_match(
  p_place_id text,
  p_cid text,
  p_data_id text,
  p_map_url text,
  p_domain text,
  p_phone text,
  p_name text,
  p_city text,
  p_postal text,
  p_address text
)
returns table (lead_id uuid, matched_by text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_name_norm text := nullif(lower(btrim(coalesce(p_name, ''))), '');
  v_city_norm text := nullif(lower(btrim(coalesce(p_city, ''))), '');
begin
  -- Tier 1 — provider identifiers (exact)
  if coalesce(btrim(p_place_id), '') <> '' then
    return query select l.id, 'place_id'::text from public.leads l
      where l.place_id = p_place_id and l.deleted_at is null limit 1;
    if found then return; end if;
  end if;

  if coalesce(btrim(p_cid), '') <> '' then
    return query select l.id, 'cid'::text from public.leads l
      where l.cid = p_cid and l.deleted_at is null limit 1;
    if found then return; end if;
  end if;

  if coalesce(btrim(p_data_id), '') <> '' then
    return query select l.id, 'data_id'::text from public.leads l
      where l.data_id = p_data_id and l.deleted_at is null limit 1;
    if found then return; end if;
  end if;

  if coalesce(btrim(p_map_url), '') <> '' then
    return query select l.id, 'map_url'::text from public.leads l
      where l.map_url = p_map_url and l.deleted_at is null limit 1;
    if found then return; end if;
  end if;

  -- Tier 2 — domain + phone (strong composite signal)
  if coalesce(p_domain, '') <> '' and coalesce(p_phone, '') <> '' then
    return query select l.id, 'domain_phone'::text from public.leads l
      where l.domain = p_domain and l.normalized_phone = p_phone and l.deleted_at is null limit 1;
    if found then return; end if;
  end if;

  -- Tier 3 — phone + city
  if coalesce(p_phone, '') <> '' and v_city_norm is not null then
    return query select l.id, 'phone_city'::text from public.leads l
      where l.normalized_phone = p_phone
        and lower(coalesce(l.city, '')) = v_city_norm
        and l.deleted_at is null limit 1;
    if found then return; end if;
  end if;

  -- Tier 4 — domain + similar name in the same city
  if coalesce(p_domain, '') <> '' and v_name_norm is not null and v_city_norm is not null then
    return query select l.id, 'domain_name_city'::text from public.leads l
      where l.domain = p_domain
        and lower(coalesce(l.city, '')) = v_city_norm
        and similarity(lower(l.business_name), v_name_norm) >= 0.7
        and l.deleted_at is null
      order by similarity(lower(l.business_name), v_name_norm) desc
      limit 1;
    if found then return; end if;
  end if;

  -- Tier 5 — name similarity + city + (postal or address agreement)
  if v_name_norm is not null and v_city_norm is not null then
    return query select l.id, 'name_city_address'::text from public.leads l
      where lower(coalesce(l.city, '')) = v_city_norm
        and similarity(lower(l.business_name), v_name_norm) >= 0.9
        and (
          (coalesce(btrim(p_postal), '') <> '' and lower(coalesce(l.postal_code, '')) = lower(btrim(p_postal)))
          or (coalesce(btrim(p_address), '') <> '' and similarity(lower(coalesce(l.address, '')), lower(btrim(p_address))) >= 0.7)
          or (coalesce(p_domain, '') <> '' and l.domain = p_domain)
        )
        and l.deleted_at is null
      order by similarity(lower(l.business_name), v_name_norm) desc
      limit 1;
    if found then return; end if;
  end if;
end;
$$;

-- Stores the full canonical row and all child records for one scraped entry.
-- The payload is the normalized Zybble lead shape (see worker/leadwriter.go).
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
           status = coalesce(nullif(p_payload ->> 'status', ''), l.status),
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
        coalesce(nullif(p_payload ->> 'status', ''), 'unknown'),
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

-- Emails, social profiles and (bounded) reviews from the same payload.
create or replace function public.lead_sync_children(p_lead_id uuid, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_primary text;
  v_email_count int := 0;
  v_email_rec record;
  v_review jsonb;
begin
  -- e-mails (never marked "valid" without a recorded verification).
  -- Accepts both shapes: Gosom's `emails: ["a@b.c"]` and Zybble's enriched
  -- `emails: [{email, source, is_primary}]`.
  for v_email_rec in
    with parsed as (
      select public.normalize_email(
               case jsonb_typeof(t.el)
                 when 'string' then t.el #>> '{}'
                 when 'object' then t.el ->> 'email'
                 else null
               end) as email,
             case
               when coalesce(nullif(t.el ->> 'source', ''), nullif(p_payload ->> 'email_source', ''))
                    in ('website_scrape', 'manual', 'import', 'ai', 'provider')
                 then coalesce(nullif(t.el ->> 'source', ''), nullif(p_payload ->> 'email_source', ''))
               else 'website_scrape'
             end as source,
             coalesce((t.el ->> 'is_primary')::boolean, false) as wants_primary
        from jsonb_array_elements(coalesce(p_payload -> 'emails', '[]'::jsonb)) as t(el)
    )
    select p.email, p.source, bool_or(p.wants_primary) as is_primary
      from parsed p
     where p.email is not null
     group by p.email, p.source
     limit 25
  loop
    insert into public.lead_emails (lead_id, email, source, status, confidence, is_primary)
    values (p_lead_id, v_email_rec.email, v_email_rec.source, 'unknown', 50, v_email_rec.is_primary)
    on conflict (lead_id, email) do update
       set last_seen_at = now(),
           is_primary = public.lead_emails.is_primary or excluded.is_primary;

    v_email_count := v_email_count + 1;
  end loop;

  -- exactly one primary e-mail per lead: best verified/known address wins
  update public.lead_emails set is_primary = false where lead_id = p_lead_id and is_primary;

  update public.lead_emails
     set is_primary = true
   where id = (
     select id from public.lead_emails
      where lead_id = p_lead_id
      order by (status = 'valid') desc, confidence desc nulls last, created_at asc
      limit 1
   );

  update public.leads l
     set email_primary = (select email from public.lead_emails where lead_id = p_lead_id and is_primary = true limit 1),
         emails_discovered = (select count(*) from public.lead_emails where lead_id = p_lead_id)
   where l.id = p_lead_id;

  -- social profiles
  insert into public.lead_social_profiles (lead_id, platform, url, handle, source)
  select p_lead_id,
         t.platform,
         t.url,
         t.handle,
         coalesce(nullif(p_payload ->> 'social_source', ''), 'website_scrape')
    from jsonb_to_recordset(coalesce(p_payload -> 'social_profiles', '[]'::jsonb))
      as t(platform text, url text, handle text)
   where t.url is not null and coalesce(t.platform, 'other') in
         ('linkedin', 'instagram', 'facebook', 'x', 'youtube', 'tiktok', 'pinterest', 'other')
  on conflict do nothing;

  -- reviews (real rows only; bounded per batch)
  for v_review in select value from jsonb_array_elements(coalesce(p_payload -> 'reviews', '[]'::jsonb)) limit 25
  loop
    insert into public.lead_reviews (lead_id, review_id, author_name, author_url, rating, text_original, text_translated, language, published_at)
    values (
      p_lead_id,
      v_review ->> 'review_id',
      v_review ->> 'author_name',
      v_review ->> 'author_url',
      (v_review ->> 'rating')::int,
      v_review ->> 'text_original',
      v_review ->> 'text_translated',
      v_review ->> 'language',
      (v_review ->> 'published_at')::timestamptz
    )
    on conflict do nothing;
  end loop;
end;
$$;

-- ###########################################################################
-- # SEARCH ASSOCIATION + COUNTERS + PROGRESS
-- ###########################################################################

-- Associates a canonical lead with a search and keeps every counter honest.
-- Duplicate discoveries never create a second association and never bill twice.
create or replace function public.search_register_lead(
  p_search_id uuid,
  p_lead_id uuid,
  p_input_id uuid default null,
  p_is_new_lead boolean default true,
  p_filtered boolean default false,
  p_filter_reasons text[] default '{}'
)
returns table (
  is_new_association boolean,
  is_workspace_new boolean,
  unique_count int,
  duplicate_count int,
  filtered_count int,
  out_workspace_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ws uuid;
  v_inserted boolean := false;
  v_ws_inserted boolean := false;
  v_row public.searches;
  v_contactable boolean;
begin
  select * into v_row from public.searches where id = p_search_id and deleted_at is null;
  if v_row.id is null then
    raise exception 'search_register_lead: unknown search %', p_search_id using errcode = 'P0002';
  end if;

  v_ws := v_row.workspace_id;

  insert into public.search_leads (search_id, lead_id, workspace_id, search_input_id, is_new_lead, filtered, filter_reasons)
  values (p_search_id, p_lead_id, v_ws, p_input_id, p_is_new_lead, p_filtered, coalesce(p_filter_reasons, '{}'))
  on conflict (search_id, lead_id) do nothing
  returning true into v_inserted;

  if not coalesce(v_inserted, false) then
    update public.search_leads
       set times_seen = times_seen + 1,
           last_seen_at = now(),
           filtered = search_leads.filtered and p_filtered
     where search_id = p_search_id and lead_id = p_lead_id;
  end if;

  insert into public.workspace_leads (workspace_id, lead_id, first_search_id, first_source)
  values (v_ws, p_lead_id, p_search_id, 'search')
  on conflict (workspace_id, lead_id) do nothing
  returning true into v_ws_inserted;

  if not coalesce(v_ws_inserted, false) then
    update public.workspace_leads
       set last_seen_at = now()
     where workspace_id = v_ws and lead_id = p_lead_id;
  end if;

  -- quota accounting: the first association of a contactable lead is billable,
  -- exactly once per workspace (idempotent dedupe key).
  if coalesce(v_ws_inserted, false) then
    select (coalesce(l.phone, '') <> '' or coalesce(l.website, '') <> '' or l.email_primary is not null)
      into v_contactable
      from public.leads l where l.id = p_lead_id;

    if coalesce(v_contactable, false) then
      perform public.usage_record(
        v_ws,
        'lead_generated',
        1,
        'lead:' || p_lead_id::text,
        'lead',
        p_lead_id,
        jsonb_build_object('search_id', p_search_id)
      );

      update public.workspace_leads
         set billable = true,
             billable_reason = 'first_association_with_contact_channel'
       where workspace_id = v_ws and lead_id = p_lead_id;
    end if;
  end if;

  update public.searches s
     set discovered_count = s.discovered_count + 1,
         unique_count = s.unique_count + case when coalesce(v_inserted, false) and not p_filtered then 1 else 0 end,
         duplicate_count = s.duplicate_count + case when not coalesce(v_inserted, false) then 1 else 0 end,
         filtered_count = s.filtered_count + case when p_filtered then 1 else 0 end,
         last_progress_at = now()
   where s.id = p_search_id;

  select s.unique_count, s.duplicate_count, s.filtered_count into unique_count, duplicate_count, filtered_count
    from public.searches s where s.id = p_search_id;

  is_new_association := coalesce(v_inserted, false);
  is_workspace_new := coalesce(v_ws_inserted, false);
  out_workspace_id := v_ws;

  return next;
end;
$$;

create or replace function public.search_input_progress(
  p_search_id uuid,
  p_input_id uuid,
  p_status text,
  p_places_discovered int default null,
  p_places_completed int default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.search_inputs
     set status = coalesce(p_status, status),
         places_discovered = coalesce(p_places_discovered, places_discovered),
         places_completed = coalesce(p_places_completed, places_completed),
         last_error = coalesce(p_error, last_error),
         started_at = case when p_status = 'running' and started_at is null then now() else started_at end,
         finished_at = case when p_status in ('completed', 'failed', 'skipped', 'cancelled') then now() else finished_at end
   where id = p_input_id and search_id = p_search_id;
end;
$$;

-- Progress is derived from real input state and observed throughput; never
-- from timers. Throttled so a fast worker cannot hammer the row.
create or replace function public.search_refresh_progress(
  p_search_id uuid,
  p_min_interval_seconds int default 0,
  p_force boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_search public.searches;
  v_total int := 0;
  v_done int := 0;
  v_enrich_ratio numeric := 1;
  v_scrape_ratio numeric := 0;
  v_enrich_enabled boolean;
  v_progress int;
  v_eta int;
  v_elapsed numeric;
  v_rate numeric;
begin
  select * into v_search from public.searches where id = p_search_id;
  if v_search.id is null then
    return;
  end if;

  if not p_force
     and v_search.last_progress_at is not null
     and now() - v_search.last_progress_at < make_interval(secs => greatest(0, p_min_interval_seconds)) then
    return;
  end if;

  select count(*)::int,
         count(*) filter (where status in ('completed', 'failed', 'skipped', 'cancelled'))::int
    into v_total, v_done
    from public.search_inputs
   where search_id = p_search_id;

  v_scrape_ratio := case when v_total = 0 then 0 else v_done::numeric / v_total::numeric end;

  v_enrich_enabled := coalesce((v_search.search_config ->> 'email_extraction')::boolean, false);

  if v_enrich_enabled then
    -- nothing to enrich yet -> no enrichment credit; never invents progress
    v_enrich_ratio := case
                        when v_search.unique_count > 0
                        then least(1, v_search.enriched_count::numeric / v_search.unique_count::numeric)
                        else 0
                      end;
    v_progress := round(100 * (0.85 * v_scrape_ratio + 0.15 * v_enrich_ratio))::int;
  else
    v_progress := round(100 * v_scrape_ratio)::int;
  end if;

  v_progress := least(99, greatest(0, v_progress));

  -- ETA from observed input completion rate; NULL when there is not enough data
  v_elapsed := extract(epoch from (now() - coalesce(v_search.started_at, v_search.created_at)));
  if v_done >= 2 and v_elapsed > 20 and v_total > v_done then
    v_rate := v_done::numeric / v_elapsed;
    v_eta := ceil((v_total - v_done)::numeric / greatest(v_rate, 0.0001))::int;
  end if;

  update public.searches
     set progress_percent = v_progress,
         eta_seconds = v_eta,
         last_progress_at = now(),
         phase = case
                   when status in ('completed', 'cancelled', 'failed') then phase
                   when v_scrape_ratio >= 1 and v_enrich_enabled and v_enrich_ratio < 1 then 'enriching'
                   when v_scrape_ratio >= 1 then 'finalizing'
                   when v_scrape_ratio > 0 then 'scraping'
                   else phase
                 end
   where id = p_search_id;
end;
$$;

-- ###########################################################################
-- # EVENTS + NOTIFICATIONS
-- ###########################################################################

create or replace function public.search_event(
  p_search_id uuid,
  p_event_type text,
  p_message text,
  p_level text default 'info',
  p_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
  v_ws uuid;
begin
  select workspace_id into v_ws from public.searches where id = p_search_id;

  insert into public.search_events (search_id, workspace_id, event_type, level, message, metadata)
  values (p_search_id, v_ws, p_event_type, coalesce(p_level, 'info'), left(coalesce(p_message, ''), 500), coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.notify_workspace(
  p_workspace_id uuid,
  p_type text,
  p_title text,
  p_body text default null,
  p_link text default null,
  p_severity text default 'info',
  p_user_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  insert into public.notifications (workspace_id, user_id, type, title, body, link, severity, metadata)
  values (
    p_workspace_id,
    p_user_id,
    p_type,
    left(coalesce(p_title, 'Notification'), 200),
    left(p_body, 1000),
    left(p_link, 300),
    coalesce(p_severity, 'info'),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ###########################################################################
-- # RATE LIMITING (fixed window, Postgres-backed)
-- ###########################################################################

create or replace function ops.rate_limit_hit(
  p_bucket text,
  p_limit int,
  p_window_seconds int default 60
)
returns table (allowed boolean, remaining int, reset_seconds int)
language plpgsql
security definer
set search_path = ops, public, pg_temp
as $$
declare
  v_window timestamptz;
  v_count int;
begin
  v_window := to_timestamp(floor(extract(epoch from now()) / greatest(1, p_window_seconds)) * greatest(1, p_window_seconds));

  insert into ops.rate_limits as rl (bucket, window_start, count)
  values (p_bucket, v_window, 1)
  on conflict (bucket, window_start) do update set count = rl.count + 1
  returning rl.count into v_count;

  allowed := v_count <= p_limit;
  remaining := greatest(0, p_limit - v_count);
  reset_seconds := greatest(0, ceil(extract(epoch from (v_window + make_interval(secs => p_window_seconds) - now())))::int);

  return next;
end;
$$;

-- ###########################################################################
-- # DASHBOARD AGGREGATES (single round trip, real numbers only)
-- ###########################################################################

create or replace function public.dashboard_stats(p_workspace_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_period_start timestamptz := date_trunc('month', now());
  v_result jsonb;
begin
  select jsonb_build_object(
    'period', jsonb_build_object(
      'start', v_period_start,
      'end', v_period_start + interval '1 month'
    ),
    'usage', coalesce((
      select to_jsonb(uc) - 'id' - 'created_at' - 'updated_at'
        from public.usage_counters uc
       where uc.workspace_id = p_workspace_id and uc.period_start = v_period_start
    ), jsonb_build_object('leads_generated', 0, 'searches_created', 0, 'ai_runs', 0, 'exports_created', 0, 'emails_found', 0,
                          'period_start', v_period_start, 'period_end', v_period_start + interval '1 month')),
    'active_searches', (
      select count(*) from public.searches
       where workspace_id = p_workspace_id and status in ('queued', 'running', 'enriching') and deleted_at is null
    ),
    'completed_searches', (
      select count(*) from public.searches
       where workspace_id = p_workspace_id and status in ('completed', 'partial') and deleted_at is null
    ),
    'total_leads', (
      select count(*) from public.workspace_leads where workspace_id = p_workspace_id
    ),
    'leads_with_email', (
      select count(*) from public.workspace_leads wl
        join public.leads l on l.id = wl.lead_id
       where wl.workspace_id = p_workspace_id and l.email_primary is not null
    ),
    'lists_count', (
      select count(*) from public.lists where workspace_id = p_workspace_id and deleted_at is null
    ),
    'exports_ready', (
      select count(*) from public.exports
       where workspace_id = p_workspace_id and status = 'ready' and deleted_at is null
    ),
    'unread_notifications', (
      select count(*) from public.notifications where workspace_id = p_workspace_id and read_at is null
    ),
    'weekly_activity', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'leads', coalesce(c.leads, 0)) order by d.day), '[]'::jsonb)
        from generate_series((now()::date - interval '6 days')::date, now()::date, interval '1 day') as d(day)
        left join (
          select date_trunc('day', created_at)::date as day, count(*) as leads
            from public.usage_events
           where workspace_id = p_workspace_id and kind = 'lead_generated'
             and created_at >= now() - interval '7 days'
           group by 1
        ) c on c.day = d.day::date
    ),
    'recent_searches', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', s.id, 'slug', s.slug, 'name', s.name, 'query', s.query, 'location', s.location,
               'status', s.status, 'phase', s.phase, 'unique_count', s.unique_count, 'discovered_count', s.discovered_count,
               'email_found_count', s.email_found_count, 'progress_percent', s.progress_percent,
               'eta_seconds', s.eta_seconds, 'created_at', s.created_at, 'started_at', s.started_at,
               'completed_at', s.completed_at) order by s.created_at desc), '[]'::jsonb)
        from (
          select * from public.searches
           where workspace_id = p_workspace_id and deleted_at is null
           order by created_at desc
           limit 5
        ) s
    ),
    'recent_leads', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', l.id, 'slug', l.slug, 'business_name', l.business_name, 'category', l.category,
               'city', l.city, 'country', l.country, 'email', l.email_primary, 'phone', l.phone,
               'website', l.website, 'rating', l.rating, 'review_count', l.review_count,
               'quality_score', l.quality_score, 'created_at', l.created_at,
               'first_seen_at', l.first_seen_at, 'ai_score', a.score) order by wl.first_seen_at desc), '[]'::jsonb)
        from (
          select wl.lead_id, wl.first_seen_at
            from public.workspace_leads wl
           where wl.workspace_id = p_workspace_id
           order by wl.first_seen_at desc
           limit 5
        ) wl
        join public.leads l on l.id = wl.lead_id
        left join lateral (
          select score from public.lead_ai_analyses
           where workspace_id = p_workspace_id and lead_id = l.id and status = 'ready'
           order by analyzed_at desc limit 1
        ) a on true
    )
  ) into v_result;

  return v_result;
end;
$$;

-- ###########################################################################
-- # GRANTS
-- ###########################################################################

revoke all on function public.lead_upsert(jsonb, text) from public, anon, authenticated;
revoke all on function public.lead_find_match(text, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.lead_sync_children(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.search_register_lead(uuid, uuid, uuid, boolean, boolean, text[]) from public, anon, authenticated;
revoke all on function public.search_input_progress(uuid, uuid, text, int, int, text) from public, anon, authenticated;
revoke all on function public.dashboard_stats(uuid) from public, anon;

grant execute on function public.usage_record(uuid, text, int, text, text, uuid, jsonb) to service_role;
grant execute on function public.usage_reserve(uuid, text, int, int, text, text, uuid, jsonb) to service_role;
grant execute on function public.workspace_entitlements(uuid) to authenticated, service_role;
grant execute on function public.dashboard_stats(uuid) to authenticated, service_role;
grant execute on function public.search_event(uuid, text, text, text, jsonb) to service_role;
grant execute on function public.notify_workspace(uuid, text, text, text, text, text, uuid, jsonb) to service_role;
grant execute on function public.search_refresh_progress(uuid, int, boolean) to service_role;
grant execute on function public.lead_upsert(jsonb, text) to service_role;
grant execute on function public.lead_find_match(text, text, text, text, text, text, text, text, text, text) to service_role;
grant execute on function public.lead_sync_children(uuid, jsonb) to service_role;
grant execute on function public.search_register_lead(uuid, uuid, uuid, boolean, boolean, text[]) to service_role;
grant execute on function public.search_input_progress(uuid, uuid, text, int, int, text) to service_role;
grant execute on function public.usage_period_start(timestamptz) to authenticated, service_role;
