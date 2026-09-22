-- ============================================================================
-- Zybble · 0002 · identity: profiles, workspaces, members, invites, preferences
-- ============================================================================

-- ---------------------------------------------------------------------------
-- profiles — 1:1 with auth.users, created by the signup trigger below
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         citext,
  full_name     text,
  company       text,
  timezone      text not null default 'UTC',
  avatar_url    text,
  locale        text not null default 'en',
  is_platform_admin boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index if not exists profiles_email_idx on public.profiles (email) where deleted_at is null;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- workspaces
-- ---------------------------------------------------------------------------
create table if not exists public.workspaces (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  slug              text not null unique,
  owner_id          uuid not null references public.profiles (id) on delete restrict,
  plan_id           uuid,                        -- fk added in 0003 (plans)
  billing_email     citext,
  country_code      text,
  default_currency  char(3) not null default 'USD',
  settings          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  constraint workspaces_slug_format check (slug ~ '^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$')
);

create index if not exists workspaces_owner_idx on public.workspaces (owner_id) where deleted_at is null;

drop trigger if exists workspaces_set_updated_at on public.workspaces;
create trigger workspaces_set_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- workspace_members — roles: owner | admin | member | viewer
-- ---------------------------------------------------------------------------
create table if not exists public.workspace_members (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  user_id       uuid references public.profiles (id) on delete cascade,
  invited_email citext,
  role          text not null default 'member',
  status        text not null default 'active',
  invited_by    uuid references public.profiles (id) on delete set null,
  invited_at    timestamptz,
  joined_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint workspace_members_role_check check (role in ('owner', 'admin', 'member', 'viewer')),
  constraint workspace_members_status_check check (status in ('active', 'invited', 'suspended', 'removed')),
  constraint workspace_members_target_check check (user_id is not null or invited_email is not null)
);

create unique index if not exists workspace_members_user_uniq
  on public.workspace_members (workspace_id, user_id)
  where user_id is not null;

create unique index if not exists workspace_members_invite_uniq
  on public.workspace_members (workspace_id, invited_email)
  where invited_email is not null and status = 'invited';

create index if not exists workspace_members_user_idx on public.workspace_members (user_id) where status = 'active';
create index if not exists workspace_members_workspace_idx on public.workspace_members (workspace_id);

drop trigger if exists workspace_members_set_updated_at on public.workspace_members;
create trigger workspace_members_set_updated_at
  before update on public.workspace_members
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- workspace_invites — accepted through the API (never through the browser)
-- ---------------------------------------------------------------------------
create table if not exists public.workspace_invites (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  email         citext not null,
  role          text not null default 'member',
  token_hash    text not null,
  invited_by    uuid references public.profiles (id) on delete set null,
  expires_at    timestamptz not null default (now() + interval '14 days'),
  accepted_at   timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now(),
  constraint workspace_invites_role_check check (role in ('admin', 'member', 'viewer'))
);

create unique index if not exists workspace_invites_token_uniq on public.workspace_invites (token_hash);
create unique index if not exists workspace_invites_pending_uniq
  on public.workspace_invites (workspace_id, email)
  where accepted_at is null and revoked_at is null;

-- ---------------------------------------------------------------------------
-- workspace_preferences — the /setting?tab=preferences + notifications model
-- ---------------------------------------------------------------------------
create table if not exists public.workspace_preferences (
  workspace_id            uuid primary key references public.workspaces (id) on delete cascade,
  default_language        text not null default 'en',
  default_depth           int not null default 10,
  default_radius_km       int not null default 10,
  email_extraction_default boolean not null default true,
  dedupe_strictness       text not null default 'balanced',
  theme                   text not null default 'light',
  updated_at              timestamptz not null default now(),
  constraint workspace_preferences_depth_check check (default_depth between 1 and 60),
  constraint workspace_preferences_radius_check check (default_radius_km between 1 and 100),
  constraint workspace_preferences_dedupe_check check (dedupe_strictness in ('loose', 'balanced', 'strict')),
  constraint workspace_preferences_theme_check check (theme in ('light', 'dark', 'system'))
);

drop trigger if exists workspace_preferences_set_updated_at on public.workspace_preferences;
create trigger workspace_preferences_set_updated_at
  before update on public.workspace_preferences
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- notification preferences (per member, per workspace)
-- ---------------------------------------------------------------------------
create table if not exists public.notification_preferences (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references public.workspaces (id) on delete cascade,
  user_id               uuid not null references public.profiles (id) on delete cascade,
  search_completed      boolean not null default true,
  search_failed         boolean not null default true,
  export_ready          boolean not null default true,
  ai_completed          boolean not null default true,
  quota_warnings        boolean not null default true,
  weekly_digest         boolean not null default false,
  product_updates       boolean not null default false,
  marketing_tips        boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create unique index if not exists notification_preferences_uniq
  on public.notification_preferences (workspace_id, user_id);

drop trigger if exists notification_preferences_set_updated_at on public.notification_preferences;
create trigger notification_preferences_set_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- quota warnings ledger (so "80% warning" is sent once per period)
-- ---------------------------------------------------------------------------
create table if not exists ops.quota_warnings (
  id           bigserial primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  period_start timestamptz not null,
  threshold    int not null,
  created_at   timestamptz not null default now(),
  unique (workspace_id, period_start, threshold)
);

-- ---------------------------------------------------------------------------
-- workspace membership helpers (used by RLS policies)
-- (defined after workspace_members: SQL-language functions are validated at
--  creation time, so table references must already resolve)
--
-- These are SECURITY DEFINER so that a policy on workspace_members itself can
-- be evaluated without recursing into workspace_members' own policies. They
-- are STABLE (not IMMUTABLE) and only ever read the caller's memberships.
-- ---------------------------------------------------------------------------
create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = p_workspace_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function public.workspace_role(p_workspace_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.role
  from public.workspace_members m
  where m.workspace_id = p_workspace_id
    and m.user_id = auth.uid()
    and m.status = 'active'
  limit 1;
$$;

create or replace function public.has_workspace_role(p_workspace_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.workspace_role(p_workspace_id) = any (p_roles), false);
$$;

revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.workspace_role(uuid) from public;
revoke all on function public.has_workspace_role(uuid, text[]) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated, service_role;
grant execute on function public.workspace_role(uuid) to authenticated, service_role;
grant execute on function public.has_workspace_role(uuid, text[]) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Signup provisioning trigger
--
-- Creates profile + workspace + owner membership + starter plan + preferences
-- + notification preferences exactly once per auth user. Idempotent because the
-- whole function is a no-op when the profile already exists.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile_id uuid;
  v_workspace_id uuid;
  v_starter_plan_id uuid;
  v_base_slug text;
  v_name text;
  v_company text;
begin
  insert into public.profiles (id, email, full_name, timezone, locale)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, 'user@zybble'), '@', 1)),
    coalesce(nullif(new.raw_user_meta_data ->> 'timezone', ''), 'UTC'),
    coalesce(nullif(new.raw_user_meta_data ->> 'locale', ''), 'en')
  )
  on conflict (id) do nothing
  returning id into v_profile_id;

  -- already provisioned -> nothing else to do
  if v_profile_id is null then
    return new;
  end if;

  select id into v_starter_plan_id from public.plans where code = 'starter' limit 1;

  v_name := coalesce(nullif(new.raw_user_meta_data ->> 'company', ''),
                     nullif(new.raw_user_meta_data ->> 'full_name', ''),
                     split_part(coalesce(new.email, 'workspace'), '@', 1));
  v_company := v_name;
  v_base_slug := public.slugify(v_company, 'workspace');

  insert into public.workspaces (name, slug, owner_id, plan_id, billing_email, settings)
  values (
    left(v_company, 120),
    public.unique_slug('workspaces'::text, 'slug', v_base_slug),
    new.id,
    v_starter_plan_id,
    new.email,
    jsonb_build_object('onboarding_state', 'new')
  )
  returning id into v_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role, status, joined_at)
  values (v_workspace_id, new.id, 'owner', 'active', now())
  on conflict do nothing;

  insert into public.workspace_preferences (workspace_id) values (v_workspace_id)
  on conflict (workspace_id) do nothing;

  insert into public.notification_preferences (workspace_id, user_id)
  values (v_workspace_id, new.id)
  on conflict do nothing;

  insert into public.audit_logs (workspace_id, actor_id, action, target_type, target_id, metadata)
  values (v_workspace_id, new.id, 'workspace.created', 'workspace', v_workspace_id,
          jsonb_build_object('source', 'signup_trigger'));

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
