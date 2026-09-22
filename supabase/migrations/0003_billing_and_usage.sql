-- ============================================================================
-- Zybble · 0003 · billing (Razorpay), entitlements and usage metering
--
-- Money is stored in MINOR UNITS (integers) with an explicit currency column.
-- No floating point arithmetic anywhere in the billing path.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- plans — database-configurable pricing (frontend pricing must not hardcode)
--
--   Starter : $0   / 50 leads  / month   (no Razorpay involvement at all)
--   Growth  : $49  / 10 000    / month   (14-day trial via Razorpay subscription)
--   Scale   : $99  / 50 000    / month
-- ---------------------------------------------------------------------------
create table if not exists public.plans (
  id                     uuid primary key default gen_random_uuid(),
  code                   text not null unique,
  name                   text not null,
  description            text,
  price_minor            bigint not null default 0,
  currency               char(3) not null default 'USD',
  billing_interval       text not null default 'month',
  billing_interval_count int not null default 1,
  trial_days             int not null default 0,
  razorpay_plan_id       text,
  is_public              boolean not null default true,
  is_active              boolean not null default true,
  sort_order             int not null default 0,
  -- entitlements (single source of truth for server-side checks)
  leads_per_period       int not null default 50,
  ai_runs_per_period     int not null default 0,
  seats                  int not null default 1,
  concurrent_searches    int not null default 1,
  max_search_depth       int not null default 10,
  max_radius_km          int not null default 15,
  queue_priority         int not null default 10,
  ai_enabled             boolean not null default false,
  api_access             boolean not null default false,
  grid_coverage          boolean not null default false,
  priority_queue         boolean not null default false,
  export_formats         text[] not null default array['csv'],
  best_export_format     text not null default 'csv',
  export_retention_days  int not null default 30,
  features               jsonb not null default '[]'::jsonb,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint plans_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint plans_interval_check check (billing_interval in ('day', 'week', 'month', 'year'))
);

drop trigger if exists plans_set_updated_at on public.plans;
create trigger plans_set_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

alter table public.workspaces
  add constraint workspaces_plan_fk foreign key (plan_id) references public.plans (id) on delete set null;

-- ---------------------------------------------------------------------------
-- billing_customers — one Razorpay customer per workspace
-- ---------------------------------------------------------------------------
create table if not exists public.billing_customers (
  workspace_id          uuid primary key references public.workspaces (id) on delete cascade,
  provider              text not null default 'razorpay',
  razorpay_customer_id  text unique,
  email                 citext,
  contact               text,
  billing_name          text,
  billing_address       jsonb,
  gstin                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint billing_customers_provider_check check (provider = 'razorpay')
);

drop trigger if exists billing_customers_set_updated_at on public.billing_customers;
create trigger billing_customers_set_updated_at
  before update on public.billing_customers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- subscriptions — provider state mirrored into Zybble
--
-- status values follow Razorpay's documented subscription states.
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  workspace_id             uuid not null references public.workspaces (id) on delete cascade,
  plan_id                  uuid not null references public.plans (id) on delete restrict,
  provider                 text not null default 'razorpay',
  razorpay_subscription_id text unique,
  razorpay_plan_id         text,
  razorpay_customer_id     text,
  status                   text not null default 'pending',
  currency                 char(3) not null default 'USD',
  amount_minor             bigint not null default 0,
  quantity                 int not null default 1,
  total_count              int,
  paid_count               int not null default 0,
  remaining_count          int,
  current_start            timestamptz,
  current_end              timestamptz,
  started_at               timestamptz,
  ended_at                 timestamptz,
  paused_at                timestamptz,
  cancelled_at             timestamptz,
  cancel_at_cycle_end      boolean not null default false,
  trial_ends_at            timestamptz,
  last_event_id            text,
  last_event_at            timestamptz,
  provider_payload         jsonb not null default '{}'::jsonb,
  created_by               uuid references public.profiles (id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint subscriptions_provider_check check (provider = 'razorpay'),
  constraint subscriptions_status_check check (
    status in ('created', 'pending', 'authenticated', 'active', 'paused', 'halted', 'cancelled', 'completed', 'expired')
  ),
  constraint subscriptions_currency_check check (currency ~ '^[A-Z]{3}$')
);

create index if not exists subscriptions_workspace_idx on public.subscriptions (workspace_id, created_at desc);
create index if not exists subscriptions_status_idx on public.subscriptions (status);

-- only one non-terminal subscription per workspace
create unique index if not exists subscriptions_one_live_per_workspace
  on public.subscriptions (workspace_id)
  where status in ('created', 'pending', 'authenticated', 'active', 'paused', 'halted');

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- payment_methods — provider metadata only. Zybble never stores card data.
-- ---------------------------------------------------------------------------
create table if not exists public.payment_methods (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references public.workspaces (id) on delete cascade,
  provider           text not null default 'razorpay',
  -- Razorpay token id (a provider-issued identifier that may be stored)
  razorpay_token_id  text,
  razorpay_customer_id text,
  method_type        text,
  card_brand         text,
  card_last4         char(4),
  card_exp_month     int,
  card_exp_year      int,
  card_network       text,
  cardholder_name    text,
  is_default         boolean not null default false,
  is_revoked         boolean not null default false,
  revoked_at         timestamptz,
  metadata           jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint payment_methods_provider_check check (provider = 'razorpay'),
  constraint payment_methods_no_pan_check check (
    -- guard rail: PAN/CVV must never reach these columns
    coalesce(card_last4, '') !~ '[0-9]{5,}'
  )
);

create unique index if not exists payment_methods_token_uniq
  on public.payment_methods (razorpay_token_id)
  where razorpay_token_id is not null;
create index if not exists payment_methods_workspace_idx on public.payment_methods (workspace_id) where is_revoked = false;

drop trigger if exists payment_methods_set_updated_at on public.payment_methods;
create trigger payment_methods_set_updated_at
  before update on public.payment_methods
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- payments + invoices — mirrored provider records (never fabricated)
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references public.workspaces (id) on delete cascade,
  subscription_id    uuid references public.subscriptions (id) on delete set null,
  provider           text not null default 'razorpay',
  razorpay_payment_id text unique,
  razorpay_order_id   text,
  razorpay_invoice_id text,
  amount_minor       bigint not null default 0,
  amount_refunded_minor bigint not null default 0,
  currency           char(3) not null default 'USD',
  status             text not null default 'created',
  method             text,
  international      boolean not null default false,
  fee_minor          bigint,
  tax_minor          bigint,
  error_code         text,
  error_description  text,
  captured_at        timestamptz,
  provider_created_at timestamptz,
  notes              jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint payments_provider_check check (provider = 'razorpay'),
  constraint payments_status_check check (status in ('created', 'authorized', 'captured', 'refunded', 'failed')),
  constraint payments_no_negative check (amount_minor >= 0 and amount_refunded_minor >= 0)
);

create index if not exists payments_workspace_idx on public.payments (workspace_id, created_at desc);
create index if not exists payments_subscription_idx on public.payments (subscription_id);

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

create table if not exists public.invoices (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces (id) on delete cascade,
  subscription_id     uuid references public.subscriptions (id) on delete set null,
  payment_id          uuid references public.payments (id) on delete set null,
  provider            text not null default 'razorpay',
  razorpay_invoice_id text unique,
  number              text,
  amount_minor        bigint not null default 0,
  currency            char(3) not null default 'USD',
  status              text not null default 'issued',
  issued_at           timestamptz,
  paid_at             timestamptz,
  period_start        timestamptz,
  period_end          timestamptz,
  short_url           text,
  provider_payload    jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint invoices_provider_check check (provider = 'razorpay'),
  constraint invoices_status_check check (status in ('draft', 'issued', 'paid', 'failed', 'cancelled', 'expired'))
);

create index if not exists invoices_workspace_idx on public.invoices (workspace_id, created_at desc);

drop trigger if exists invoices_set_updated_at on public.invoices;
create trigger invoices_set_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- ops.billing_events — verified provider webhook/event ledger with idempotency
--
-- provider_event_id is the `x-razorpay-event-id` header value (documented as
-- unique per event). Duplicate deliveries hit the unique index and are ignored.
-- ---------------------------------------------------------------------------
create table if not exists ops.billing_events (
  id                bigserial primary key,
  provider          text not null default 'razorpay',
  provider_event_id text not null,
  event_type        text not null,
  workspace_id      uuid references public.workspaces (id) on delete set null,
  subscription_id   uuid references public.subscriptions (id) on delete set null,
  payload           jsonb not null,
  signature_valid   boolean not null default false,
  processed_at      timestamptz,
  process_error     text,
  attempts          int not null default 0,
  received_at       timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create index if not exists billing_events_unprocessed_idx
  on ops.billing_events (received_at)
  where processed_at is null and process_error is not null;
create index if not exists billing_events_type_idx on ops.billing_events (event_type, received_at desc);

-- ---------------------------------------------------------------------------
-- usage metering
--
-- usage_events is append-only and idempotent through dedupe_key; the counter
-- rollup is maintained by trigger so reads are cheap.
-- ---------------------------------------------------------------------------
create table if not exists public.usage_counters (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces (id) on delete cascade,
  period_start      timestamptz not null,
  period_end        timestamptz not null,
  leads_generated   int not null default 0,
  searches_created  int not null default 0,
  ai_runs           int not null default 0,
  exports_created   int not null default 0,
  emails_found      int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (workspace_id, period_start)
);

create index if not exists usage_counters_period_idx on public.usage_counters (period_end);

drop trigger if exists usage_counters_set_updated_at on public.usage_counters;
create trigger usage_counters_set_updated_at
  before update on public.usage_counters
  for each row execute function public.set_updated_at();

create table if not exists public.usage_events (
  id           bigserial primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind         text not null,
  quantity     int not null default 1,
  dedupe_key   text not null,
  ref_type     text,
  ref_id       uuid,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  unique (workspace_id, dedupe_key),
  constraint usage_events_kind_check check (kind in ('lead_generated', 'search_created', 'ai_run', 'export_created', 'email_found')),
  constraint usage_events_quantity_check check (quantity > 0)
);

create index if not exists usage_events_workspace_idx on public.usage_events (workspace_id, created_at desc);

-- ---------------------------------------------------------------------------
-- usage rollup trigger
-- ---------------------------------------------------------------------------
create or replace function public.usage_events_apply()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_period_start timestamptz := date_trunc('month', new.created_at);
  v_period_end timestamptz := date_trunc('month', new.created_at) + interval '1 month';
begin
  insert into public.usage_counters (workspace_id, period_start, period_end)
  values (new.workspace_id, v_period_start, v_period_end)
  on conflict (workspace_id, period_start) do nothing;

  update public.usage_counters
     set leads_generated = leads_generated + case when new.kind = 'lead_generated' then new.quantity else 0 end,
         searches_created = searches_created + case when new.kind = 'search_created' then new.quantity else 0 end,
         ai_runs = ai_runs + case when new.kind = 'ai_run' then new.quantity else 0 end,
         exports_created = exports_created + case when new.kind = 'export_created' then new.quantity else 0 end,
         emails_found = emails_found + case when new.kind = 'email_found' then new.quantity else 0 end,
         updated_at = now()
   where workspace_id = new.workspace_id
     and period_start = v_period_start;

  return new;
end;
$$;

drop trigger if exists usage_events_apply_trg on public.usage_events;
create trigger usage_events_apply_trg
  after insert on public.usage_events
  for each row execute function public.usage_events_apply();

-- ---------------------------------------------------------------------------
-- ops.rate_limits — Postgres-backed fixed-window limiter (no extra infra)
-- ---------------------------------------------------------------------------
create table if not exists ops.rate_limits (
  bucket       text not null,
  window_start timestamptz not null,
  count        int not null default 0,
  primary key (bucket, window_start)
);

create index if not exists rate_limits_window_idx on ops.rate_limits (window_start);

-- ---------------------------------------------------------------------------
-- ops.idempotency_keys — duplicated browser retries must not duplicate work
-- ---------------------------------------------------------------------------
create table if not exists ops.idempotency_keys (
  id           bigserial primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  scope        text not null,
  key          text not null,
  request_hash text,
  response     jsonb,
  status_code  int,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '24 hours'),
  unique (workspace_id, scope, key)
);
