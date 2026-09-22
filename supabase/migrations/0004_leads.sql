-- ============================================================================
-- Zybble · 0004 · leads (globally deduplicated canonical records)
--
-- Ownership model (see docs/ARCHITECTURE.md §data model):
--   * leads                  → canonical business record, not workspace owned
--   * workspace_leads        → "this workspace has this lead" (the unit of quota)
--   * search_leads           → this lead was discovered by this search
--   * list_leads             → this lead is in this list
-- A customer only ever sees canonical rows they have a workspace_leads row for.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- audit_logs (created early: the signup trigger writes to it)
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id           bigserial primary key,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  actor_id     uuid references public.profiles (id) on delete set null,
  actor_type   text not null default 'user',
  action       text not null,
  target_type  text,
  target_id    uuid,
  metadata     jsonb not null default '{}'::jsonb,
  ip_hash      text,
  user_agent   text,
  created_at   timestamptz not null default now(),
  constraint audit_logs_actor_type_check check (actor_type in ('user', 'system', 'worker', 'api_key', 'provider'))
);

create index if not exists audit_logs_workspace_idx on public.audit_logs (workspace_id, created_at desc);
create index if not exists audit_logs_action_idx on public.audit_logs (action, created_at desc);
create index if not exists audit_logs_retention_idx on public.audit_logs (created_at);

-- ---------------------------------------------------------------------------
-- deterministic lead quality score (task §34): coverage of captured fields,
-- never a fabricated value. Immutable so it can back a generated column.
-- ---------------------------------------------------------------------------
create or replace function public.lead_quality_score(
  p_business_name text,
  p_category text,
  p_address text,
  p_phone text,
  p_website text,
  p_email text,
  p_rating numeric,
  p_review_count int,
  p_latitude double precision,
  p_longitude double precision,
  p_description text,
  p_open_hours jsonb,
  p_images jsonb,
  p_social_count int default 0
)
returns smallint
language sql
immutable
as $$
  with parts as (
    select
      (case when coalesce(btrim(p_business_name), '') <> '' then 18 else 0 end) +
      (case when coalesce(btrim(p_category), '') <> '' then 8 else 0 end) +
      (case when coalesce(btrim(p_address), '') <> '' then 12 else 0 end) +
      (case when coalesce(btrim(p_phone), '') <> '' then 14 else 0 end) +
      (case when coalesce(btrim(p_website), '') <> '' then 10 else 0 end) +
      (case when coalesce(btrim(p_email), '') <> '' then 12 else 0 end) +
      (case when p_rating is not null and p_rating > 0 then 6 else 0 end) +
      (case when coalesce(p_review_count, 0) > 0 then 5 else 0 end) +
      (case when p_latitude is not null and p_longitude is not null
              and not (p_latitude = 0 and p_longitude = 0) then 5 else 0 end) +
      (case when coalesce(btrim(p_description), '') <> '' then 3 else 0 end) +
      (case when p_open_hours is not null and p_open_hours <> 'null'::jsonb and p_open_hours <> '{}'::jsonb then 3 else 0 end) +
      (case when jsonb_typeof(coalesce(p_images, '[]'::jsonb)) = 'array'
              and jsonb_array_length(coalesce(p_images, '[]'::jsonb)) > 0 then 2 else 0 end) +
      (least(coalesce(p_social_count, 0), 2) * 1) as score
  )
  select least(100, greatest(0, score))::smallint from parts;
$$;

-- ---------------------------------------------------------------------------
-- geo_places — curated centroid lookup used for radius/grid/fast-mode queries.
-- Deliberately NOT the Google Geocoding API (task §26/§288). Seed rows live in
-- 0011; operators may extend the table.
-- ---------------------------------------------------------------------------
create table if not exists public.geo_places (
  id           bigserial primary key,
  name         text not null,
  name_norm    text not null,
  country_code char(2),
  admin_area   text,
  latitude     double precision not null,
  longitude    double precision not null,
  timezone     text,
  population   bigint,
  source       text not null default 'seed',
  created_at   timestamptz not null default now(),
  unique (name_norm, country_code)
);

create index if not exists geo_places_trgm_idx on public.geo_places using gin (name_norm gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- leads
-- ---------------------------------------------------------------------------
create table if not exists public.leads (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique,

  business_name       text not null,
  category            text,
  categories          text[] not null default '{}',

  website             text,
  domain              text,
  phone               text,
  normalized_phone    text,
  email_primary       citext,        -- convenience mirror of lead_emails.is_primary

  address             text,
  complete_address    text,
  street              text,
  city                text,
  state               text,
  country             text,
  country_code        char(2),
  postal_code         text,

  latitude            double precision,
  longitude           double precision,

  rating              numeric(2, 1),
  review_count        int,
  reviews_per_rating  jsonb,

  status              text not null default 'unknown',   -- source-reported open/closed
  open_hours          jsonb,
  popular_times       jsonb,

  plus_code           text,
  timezone            text,
  price_range         text,

  map_url             text,
  reviews_url         text,
  place_id            text,
  cid                 text,
  data_id             text,

  thumbnail_url       text,
  street_view_url     text,
  images              jsonb not null default '[]'::jsonb,

  reservations_url    text,
  order_online_url    text,
  menu_url            text,
  owner_data          jsonb,

  description         text,
  about               jsonb not null default '{}'::jsonb,

  -- raw scraper payload, protects Zybble against engine schema changes
  raw_data            jsonb not null default '{}'::jsonb,

  source              text not null default 'google_maps',
  source_engine       text not null default 'gosom',
  engine_version      text,

  quality_score       smallint generated always as (
                        public.lead_quality_score(
                          business_name, category, address, phone, website, email_primary::text,
                          rating, review_count, latitude, longitude, description, open_hours, images, 0
                        )
                      ) stored,

  emails_discovered   int not null default 0,
  ai_analyzed_at      timestamptz,

  first_seen_at       timestamptz not null default now(),
  last_seen_at        timestamptz not null default now(),

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,

  constraint leads_status_check check (status in ('open', 'closed', 'unknown')),
  constraint leads_coords_check check (
    (latitude is null or (latitude >= -90 and latitude <= 90)) and
    (longitude is null or (longitude >= -180 and longitude <= 180))
  ),
  constraint leads_rating_check check (rating is null or (rating >= 0 and rating <= 5))
);

-- identity hierarchy for deduplication (strong -> weak)
create unique index if not exists leads_place_id_uniq on public.leads (place_id) where place_id is not null and deleted_at is null;
create unique index if not exists leads_cid_uniq on public.leads (cid) where cid is not null and deleted_at is null;
create unique index if not exists leads_data_id_uniq on public.leads (data_id) where data_id is not null and deleted_at is null;

create index if not exists leads_domain_idx on public.leads (domain) where domain is not null and deleted_at is null;
create index if not exists leads_phone_idx on public.leads (normalized_phone) where normalized_phone is not null and deleted_at is null;
create index if not exists leads_name_city_idx
  on public.leads (lower(business_name), lower(coalesce(city, '')))
  where deleted_at is null;
create index if not exists leads_city_idx on public.leads (city) where deleted_at is null;
create index if not exists leads_state_idx on public.leads (state) where deleted_at is null;
create index if not exists leads_country_idx on public.leads (country) where deleted_at is null;
create index if not exists leads_category_idx on public.leads (category) where deleted_at is null;
create index if not exists leads_rating_idx on public.leads (rating desc nulls last) where deleted_at is null;
create index if not exists leads_review_count_idx on public.leads (review_count desc nulls last) where deleted_at is null;
create index if not exists leads_created_idx on public.leads (created_at desc) where deleted_at is null;
create index if not exists leads_quality_idx on public.leads (quality_score desc) where deleted_at is null;
create index if not exists leads_categories_gin on public.leads using gin (categories);
create index if not exists leads_name_trgm on public.leads using gin (business_name gin_trgm_ops);
create index if not exists leads_has_email_idx on public.leads (email_primary) where email_primary is not null;

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- lead_emails — one lead may have many candidate addresses (task §32)
-- "valid" is never inferred from syntax: it requires a recorded verification.
-- ---------------------------------------------------------------------------
create table if not exists public.lead_emails (
  id           uuid primary key default gen_random_uuid(),
  lead_id      uuid not null references public.leads (id) on delete cascade,
  email        citext not null,
  source       text not null default 'website_scrape',
  status       text not null default 'unknown',
  confidence   smallint,
  is_primary   boolean not null default false,
  verification_source text,
  verified_at  timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint lead_emails_status_check check (status in ('unknown', 'valid', 'invalid', 'risky')),
  constraint lead_emails_source_check check (source in ('website_scrape', 'manual', 'import', 'ai', 'provider')),
  constraint lead_emails_confidence_check check (confidence is null or (confidence between 0 and 100)),
  constraint lead_emails_verified_check check (
    (status = 'valid') = (verified_at is not null)
  )
);

create unique index if not exists lead_emails_lead_email_uniq on public.lead_emails (lead_id, email);
create unique index if not exists lead_emails_primary_uniq on public.lead_emails (lead_id) where is_primary = true;

drop trigger if exists lead_emails_set_updated_at on public.lead_emails;
create trigger lead_emails_set_updated_at
  before update on public.lead_emails
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- lead_social_profiles
-- ---------------------------------------------------------------------------
create table if not exists public.lead_social_profiles (
  id           uuid primary key default gen_random_uuid(),
  lead_id      uuid not null references public.leads (id) on delete cascade,
  platform     text not null,
  url          text not null,
  handle       text,
  source       text not null default 'website_scrape',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint lead_social_platform_check check (
    platform in ('linkedin', 'instagram', 'facebook', 'x', 'youtube', 'tiktok', 'pinterest', 'other')
  )
);

create unique index if not exists lead_social_uniq on public.lead_social_profiles (lead_id, platform, url);

drop trigger if exists lead_social_set_updated_at on public.lead_social_profiles;
create trigger lead_social_set_updated_at
  before update on public.lead_social_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- lead_reviews — real review rows returned by the engine, never generated
-- ---------------------------------------------------------------------------
create table if not exists public.lead_reviews (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references public.leads (id) on delete cascade,
  review_id     text,
  author_name   text,
  author_url    text,
  rating        int,
  text_original text,
  text_translated text,
  language      text,
  published_at  timestamptz,
  source        text not null default 'google_maps',
  created_at    timestamptz not null default now(),
  constraint lead_reviews_rating_check check (rating is null or rating between 1 and 5)
);

create unique index if not exists lead_reviews_uniq on public.lead_reviews (lead_id, review_id) where review_id is not null;
create index if not exists lead_reviews_lead_idx on public.lead_reviews (lead_id, published_at desc nulls last);

-- ---------------------------------------------------------------------------
-- workspace_leads — the workspace's relationship to a canonical lead.
-- The first association of a contactable lead is the billable unit.
-- ---------------------------------------------------------------------------
create table if not exists public.workspace_leads (
  workspace_id     uuid not null references public.workspaces (id) on delete cascade,
  lead_id          uuid not null references public.leads (id) on delete cascade,
  first_seen_at    timestamptz not null default now(),
  last_seen_at     timestamptz not null default now(),
  first_search_id  uuid,
  first_source     text not null default 'search',
  billable         boolean not null default false,
  billable_reason  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (workspace_id, lead_id)
);

create index if not exists workspace_leads_lead_idx on public.workspace_leads (lead_id);
create index if not exists workspace_leads_ws_recent_idx on public.workspace_leads (workspace_id, first_seen_at desc);

drop trigger if exists workspace_leads_set_updated_at on public.workspace_leads;
create trigger workspace_leads_set_updated_at
  before update on public.workspace_leads
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- lead_ai_analyses — cached, versioned, evidence-grounded AI output
-- ---------------------------------------------------------------------------
create table if not exists public.lead_ai_analyses (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces (id) on delete cascade,
  lead_id          uuid not null references public.leads (id) on delete cascade,
  input_hash       text not null,
  prompt_version   text not null,
  model            text not null,
  status           text not null default 'ready',
  summary          text,
  fit              text,
  score            smallint,
  reasons          jsonb not null default '[]'::jsonb,
  opportunities    jsonb not null default '[]'::jsonb,
  risks            jsonb not null default '[]'::jsonb,
  outreach_angle   text,
  usage            jsonb not null default '{}'::jsonb,
  latency_ms       int,
  error_message    text,
  analyzed_at      timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint lead_ai_status_check check (status in ('queued', 'ready', 'failed')),
  constraint lead_ai_score_check check (score is null or score between 0 and 100)
);

create unique index if not exists lead_ai_cache_uniq
  on public.lead_ai_analyses (workspace_id, lead_id, input_hash, model, prompt_version);
create index if not exists lead_ai_lead_idx on public.lead_ai_analyses (lead_id, analyzed_at desc);

drop trigger if exists lead_ai_set_updated_at on public.lead_ai_analyses;
create trigger lead_ai_set_updated_at
  before update on public.lead_ai_analyses
  for each row execute function public.set_updated_at();
