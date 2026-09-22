-- ============================================================================
-- Zybble · 0006 · durable PostgreSQL job queue + worker registry (ops schema)
--
-- Design: single table, atomic claim with FOR UPDATE SKIP LOCKED, leases with
-- heartbeats, bounded attempts with exponential backoff + jitter, priorities
-- that protect interactive searches. No Redis (task §41/§136/§391).
-- ============================================================================

create table if not exists ops.job_queue (
  id             uuid primary key default gen_random_uuid(),
  job_type       text not null,
  workspace_id   uuid references public.workspaces (id) on delete cascade,
  priority       int not null default 50,
  status         text not null default 'pending',
  payload        jsonb not null default '{}'::jsonb,
  dedupe_key     text,
  attempts       int not null default 0,
  max_attempts   int not null default 3,
  available_at   timestamptz not null default now(),
  locked_at      timestamptz,
  locked_until   timestamptz,
  locked_by      text,
  last_error     text,
  last_error_at  timestamptz,
  result         jsonb,
  started_at     timestamptz,
  finished_at    timestamptz,
  scheduled_by   text not null default 'api',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint job_queue_type_check check (job_type in (
    'scrape', 'email_enrichment', 'ai_search_plan', 'ai_lead_analysis', 'ai_lead_scoring',
    'ai_list_analysis', 'ai_chat', 'export', 'notification', 'cleanup'
  )),
  constraint job_queue_status_check check (status in ('pending', 'running', 'succeeded', 'failed', 'cancelled')),
  constraint job_queue_priority_check check (priority between 0 and 1000),
  constraint job_queue_attempts_check check (attempts >= 0 and max_attempts >= 1)
);

-- claim path: pending work ordered by priority then availability
create index if not exists job_queue_claim_idx
  on ops.job_queue (job_type, priority desc, available_at)
  where status = 'pending';

-- expired lease reclamation
create index if not exists job_queue_lease_idx
  on ops.job_queue (locked_until)
  where status = 'running';

create index if not exists job_queue_workspace_idx on ops.job_queue (workspace_id, created_at desc);
create index if not exists job_queue_payload_gin on ops.job_queue using gin (payload jsonb_path_ops);

-- a job producer can make enqueueing idempotent (browser double-submit, webhook retry)
create unique index if not exists job_queue_dedupe_uniq
  on ops.job_queue (job_type, dedupe_key)
  where dedupe_key is not null and status in ('pending', 'running');

drop trigger if exists job_queue_set_updated_at on ops.job_queue;
create trigger job_queue_set_updated_at
  before update on ops.job_queue
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- workers — heartbeat registry used by /health and the ops views
-- ---------------------------------------------------------------------------
create table if not exists ops.workers (
  worker_id        text primary key,
  status           text not null default 'starting',
  version          text not null default 'unknown',
  engine_version   text,
  hostname         text,
  region           text,
  started_at       timestamptz not null default now(),
  last_heartbeat_at timestamptz not null default now(),
  active_jobs      int not null default 0,
  queued_jobs      int not null default 0,
  concurrency      jsonb not null default '{}'::jsonb,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint workers_status_check check (status in ('starting', 'idle', 'running', 'draining', 'stopped', 'error'))
);

create index if not exists workers_heartbeat_idx on ops.workers (last_heartbeat_at desc);

drop trigger if exists workers_set_updated_at on ops.workers;
create trigger workers_set_updated_at
  before update on ops.workers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- ops.system_settings — operator-configurable knobs (never secrets)
-- ---------------------------------------------------------------------------
create table if not exists ops.system_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_by  uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now()
);

drop trigger if exists system_settings_set_updated_at on ops.system_settings;
create trigger system_settings_set_updated_at
  before update on ops.system_settings
  for each row execute function public.set_updated_at();
