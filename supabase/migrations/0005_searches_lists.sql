-- ============================================================================
-- Zybble · 0005 · searches, inputs, events, lists, exports, AI, notifications
-- ============================================================================

-- ---------------------------------------------------------------------------
-- searches
-- ---------------------------------------------------------------------------
create table if not exists public.searches (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique,
  workspace_id        uuid not null references public.workspaces (id) on delete cascade,
  created_by          uuid references public.profiles (id) on delete set null,

  name                text not null,
  query               text not null,
  location            text,
  language            text not null default 'en',

  status              text not null default 'draft',
  phase               text not null default 'queued',

  -- exact configuration used for this run (immutable after start)
  search_config       jsonb not null default '{}'::jsonb,
  -- AI planning provenance (original brief, generated plan, approved plan)
  ai_plan             jsonb,

  -- counters (all real, maintained by the worker transactionally)
  requested_count     int not null default 0,
  discovered_count    int not null default 0,
  unique_count        int not null default 0,
  duplicate_count     int not null default 0,
  filtered_count      int not null default 0,
  enriched_count      int not null default 0,
  email_found_count   int not null default 0,
  ai_completed_count  int not null default 0,
  error_count         int not null default 0,

  progress_percent    smallint not null default 0,
  eta_seconds         int,

  source              text not null default 'manual',
  source_engine       text not null default 'gosom',
  engine_version      text,
  worker_id           text,

  rerun_of            uuid references public.searches (id) on delete set null,

  started_at          timestamptz,
  last_progress_at    timestamptz,
  completed_at        timestamptz,
  cancelled_at        timestamptz,
  paused_at           timestamptz,
  failed_at           timestamptz,
  error_message       text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,

  constraint searches_status_check check (
    status in ('draft', 'queued', 'running', 'enriching', 'paused', 'partial', 'completed', 'cancelled', 'failed')
  ),
  constraint searches_phase_check check (
    phase in ('draft', 'queued', 'planning', 'scraping', 'deduplicating', 'enriching', 'ai', 'finalizing', 'done', 'cancelled', 'failed')
  ),
  constraint searches_source_check check (source in ('manual', 'ai', 'api', 'rerun')),
  constraint searches_progress_check check (progress_percent between 0 and 100)
);

create index if not exists searches_workspace_idx on public.searches (workspace_id, created_at desc) where deleted_at is null;
create index if not exists searches_status_idx on public.searches (status);
create index if not exists searches_workspace_status_idx on public.searches (workspace_id, status) where deleted_at is null;
create index if not exists searches_created_idx on public.searches (created_at desc) where deleted_at is null;

drop trigger if exists searches_set_updated_at on public.searches;
create trigger searches_set_updated_at
  before update on public.searches
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- search_inputs — one row per engine query line (grid cells included).
-- Drives honest progress, pause/resume and rerun bookkeeping.
-- ---------------------------------------------------------------------------
create table if not exists public.search_inputs (
  id               uuid primary key default gen_random_uuid(),
  search_id        uuid not null references public.searches (id) on delete cascade,
  workspace_id     uuid not null references public.workspaces (id) on delete cascade,
  seq              int not null,
  query_text       text not null,
  geo_lat          double precision,
  geo_lon          double precision,
  zoom             int,
  radius_m         int,
  grid_cell        text,
  status           text not null default 'pending',
  places_discovered int not null default 0,
  places_completed int not null default 0,
  attempts         int not null default 0,
  last_error       text,
  started_at       timestamptz,
  finished_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (search_id, seq),
  constraint search_inputs_status_check check (status in ('pending', 'running', 'completed', 'failed', 'skipped', 'cancelled'))
);

create index if not exists search_inputs_search_idx on public.search_inputs (search_id, seq);
create index if not exists search_inputs_status_idx on public.search_inputs (search_id, status);

drop trigger if exists search_inputs_set_updated_at on public.search_inputs;
create trigger search_inputs_set_updated_at
  before update on public.search_inputs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- search_leads — association between a search and a canonical lead
-- ---------------------------------------------------------------------------
create table if not exists public.search_leads (
  search_id       uuid not null references public.searches (id) on delete cascade,
  lead_id         uuid not null references public.leads (id) on delete cascade,
  workspace_id    uuid not null references public.workspaces (id) on delete cascade,
  search_input_id uuid references public.search_inputs (id) on delete set null,
  times_seen      int not null default 1,
  is_new_lead     boolean not null default true,   -- lead row created by this discovery
  is_workspace_new boolean not null default true,  -- first time this workspace saw it
  filtered        boolean not null default false,
  filter_reasons  text[] not null default '{}',
  first_seen_at   timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  primary key (search_id, lead_id)
);

create index if not exists search_leads_search_idx on public.search_leads (search_id, first_seen_at desc);
create index if not exists search_leads_lead_idx on public.search_leads (lead_id);
create index if not exists search_leads_workspace_idx on public.search_leads (workspace_id, first_seen_at desc);

-- ---------------------------------------------------------------------------
-- search_events — the user-visible event log (search diary)
-- ---------------------------------------------------------------------------
create table if not exists public.search_events (
  id           bigserial primary key,
  search_id    uuid not null references public.searches (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  event_type   text not null,
  level        text not null default 'info',
  message      text not null,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  constraint search_events_level_check check (level in ('info', 'warn', 'error', 'success'))
);

create index if not exists search_events_search_idx on public.search_events (search_id, created_at desc);
create index if not exists search_events_retention_idx on public.search_events (created_at);

-- ---------------------------------------------------------------------------
-- lists
-- ---------------------------------------------------------------------------
create table if not exists public.lists (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  workspace_id    uuid not null references public.workspaces (id) on delete cascade,
  created_by      uuid references public.profiles (id) on delete set null,
  name            text not null,
  description     text,
  tag             text,
  color           text,
  source_search_id uuid references public.searches (id) on delete set null,
  is_archived     boolean not null default false,
  lead_count      int not null default 0,
  with_email_count int not null default 0,
  avg_rating      numeric(3, 2),
  completeness    smallint,
  last_activity_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index if not exists lists_workspace_idx on public.lists (workspace_id, created_at desc) where deleted_at is null;

drop trigger if exists lists_set_updated_at on public.lists;
create trigger lists_set_updated_at
  before update on public.lists
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- list_leads — (list_id, lead_id) unique: a lead cannot appear twice in a list
-- ---------------------------------------------------------------------------
create table if not exists public.list_leads (
  list_id      uuid not null references public.lists (id) on delete cascade,
  lead_id      uuid not null references public.leads (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  added_by     uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  primary key (list_id, lead_id)
);

create index if not exists list_leads_list_idx on public.list_leads (list_id, created_at desc);
create index if not exists list_leads_lead_idx on public.list_leads (lead_id);

-- keep list aggregates honest (never computed from client state)
create or replace function public.list_leads_refresh_counters()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_list_id uuid := coalesce(new.list_id, old.list_id);
begin
  update public.lists l
     set lead_count = agg.count,
         with_email_count = agg.with_email,
         avg_rating = agg.avg_rating,
         completeness = agg.completeness,
         last_activity_at = now(),
         updated_at = now()
    from (
      select
        count(*)::int as count,
        count(*) filter (where ld.email_primary is not null)::int as with_email,
        round(avg(ld.rating)::numeric, 2) as avg_rating,
        round(avg(ld.quality_score))::smallint as completeness
      from public.list_leads ll
      join public.leads ld on ld.id = ll.lead_id and ld.deleted_at is null
      where ll.list_id = v_list_id
    ) agg
   where l.id = v_list_id;

  return null;
end;
$$;

drop trigger if exists list_leads_counters_trg on public.list_leads;
create trigger list_leads_counters_trg
  after insert or delete on public.list_leads
  for each row execute function public.list_leads_refresh_counters();

-- ---------------------------------------------------------------------------
-- exports — asynchronous, worker-generated, private storage
-- ---------------------------------------------------------------------------
create table if not exists public.exports (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  workspace_id    uuid not null references public.workspaces (id) on delete cascade,
  created_by      uuid references public.profiles (id) on delete set null,

  name            text not null,
  format          text not null default 'csv',
  status          text not null default 'queued',
  source_type     text not null,
  source_id       uuid,
  filters         jsonb not null default '{}'::jsonb,
  columns         jsonb not null default '[]'::jsonb,
  row_count       int,
  byte_size       bigint,
  storage_bucket  text,
  storage_path    text,
  checksum        text,
  expires_at      timestamptz,
  completed_at    timestamptz,
  last_downloaded_at timestamptz,
  download_count  int not null default 0,
  error_message   text,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint exports_format_check check (format in ('csv', 'json')),
  constraint exports_status_check check (status in ('queued', 'generating', 'ready', 'failed', 'expired', 'deleted')),
  constraint exports_source_check check (source_type in ('search', 'list', 'leads', 'workspace'))
);

create index if not exists exports_workspace_idx on public.exports (workspace_id, created_at desc) where deleted_at is null;
create index if not exists exports_status_idx on public.exports (status);
create index if not exists exports_expiry_idx on public.exports (expires_at) where status = 'ready';

drop trigger if exists exports_set_updated_at on public.exports;
create trigger exports_set_updated_at
  before update on public.exports
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid references public.profiles (id) on delete cascade,
  type         text not null,
  title        text not null,
  body         text,
  link         text,
  severity     text not null default 'info',
  metadata     jsonb not null default '{}'::jsonb,
  read_at      timestamptz,
  email_sent_at timestamptz,
  created_at   timestamptz not null default now(),
  constraint notifications_type_check check (type in (
    'search_completed', 'search_failed', 'search_partial', 'export_ready', 'export_failed',
    'ai_completed', 'payment_succeeded', 'payment_failed', 'quota_warning', 'subscription_changed',
    'team_invite', 'system'
  )),
  constraint notifications_severity_check check (severity in ('info', 'success', 'warn', 'error'))
);

create index if not exists notifications_workspace_idx on public.notifications (workspace_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (workspace_id, created_at desc) where read_at is null;
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc) where user_id is not null;

-- ---------------------------------------------------------------------------
-- api_keys — hashed secrets only; the plaintext is shown once at creation
-- ---------------------------------------------------------------------------
create table if not exists public.api_keys (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  created_by    uuid references public.profiles (id) on delete set null,
  name          text not null,
  prefix        text not null,            -- public lookup fragment, e.g. zyb_live_8f3k2m
  key_hash      text not null,            -- sha256(secret) hex
  scopes        text[] not null default array['searches:write', 'leads:read', 'lists:read', 'exports:read'],
  rate_limit_per_minute int not null default 60,
  last_used_at  timestamptz,
  last_used_ip_hash text,
  request_count bigint not null default 0,
  expires_at    timestamptz,
  revoked_at    timestamptz,
  rotated_from  uuid references public.api_keys (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists api_keys_prefix_uniq on public.api_keys (prefix);
create index if not exists api_keys_workspace_idx on public.api_keys (workspace_id) where revoked_at is null;

drop trigger if exists api_keys_set_updated_at on public.api_keys;
create trigger api_keys_set_updated_at
  before update on public.api_keys
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- AI conversations / messages / runs
-- ---------------------------------------------------------------------------
create table if not exists public.ai_conversations (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  created_by    uuid references public.profiles (id) on delete set null,
  title         text not null default 'New conversation',
  kind          text not null default 'chat',
  message_count int not null default 0,
  last_message_at timestamptz,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  constraint ai_conversations_kind_check check (kind in ('chat', 'search_plan', 'list_analysis'))
);

create index if not exists ai_conversations_workspace_idx
  on public.ai_conversations (workspace_id, updated_at desc) where deleted_at is null;

drop trigger if exists ai_conversations_set_updated_at on public.ai_conversations;
create trigger ai_conversations_set_updated_at
  before update on public.ai_conversations
  for each row execute function public.set_updated_at();

create table if not exists public.ai_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  workspace_id    uuid not null references public.workspaces (id) on delete cascade,
  role            text not null,
  content         text not null,
  model           text,
  prompt_version  text,
  plan            jsonb,
  run_id          uuid,
  usage           jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  constraint ai_messages_role_check check (role in ('user', 'assistant', 'system', 'tool'))
);

create index if not exists ai_messages_conversation_idx on public.ai_messages (conversation_id, created_at);

create table if not exists public.ai_runs (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces (id) on delete cascade,
  conversation_id   uuid references public.ai_conversations (id) on delete set null,
  lead_id           uuid references public.leads (id) on delete set null,
  search_id         uuid references public.searches (id) on delete set null,
  list_id           uuid references public.lists (id) on delete set null,
  task              text not null,
  status            text not null default 'queued',
  model             text not null,
  prompt_version    text not null,
  input_hash        text,
  input_tokens      int,
  output_tokens     int,
  total_tokens      int,
  latency_ms        int,
  cost_usd_micros   bigint,
  result            jsonb,
  error_code        text,
  error_message     text,
  created_by        uuid references public.profiles (id) on delete set null,
  started_at        timestamptz,
  finished_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint ai_runs_task_check check (task in ('SEARCH_PLAN', 'LEAD_ANALYSIS', 'LEAD_SCORING', 'LIST_ANALYSIS', 'AI_CHAT')),
  constraint ai_runs_status_check check (status in ('queued', 'running', 'succeeded', 'failed', 'cached'))
);

create index if not exists ai_runs_workspace_idx on public.ai_runs (workspace_id, created_at desc);
create index if not exists ai_runs_lead_idx on public.ai_runs (lead_id, created_at desc);

drop trigger if exists ai_runs_set_updated_at on public.ai_runs;
create trigger ai_runs_set_updated_at
  before update on public.ai_runs
  for each row execute function public.set_updated_at();
