-- ============================================================================
-- Zybble · 0001 · extensions, shared helpers, updated_at trigger
--
-- Works from an empty Supabase database. Everything is idempotent so the
-- migration runner can be re-run safely.
-- ============================================================================

create extension if not exists "pgcrypto";      -- gen_random_uuid(), digest(), hmac()
create extension if not exists "citext";        -- case-insensitive e-mail columns
create extension if not exists "pg_trgm";       -- trigram indexes for lead search

-- ---------------------------------------------------------------------------
-- schemas
--   public   : customer-facing tables (RLS protected)
--   ops      : internal worker/queue/billing internals, never exposed to clients
-- ---------------------------------------------------------------------------
create schema if not exists ops;

revoke all on schema ops from anon, authenticated;
grant usage on schema ops to service_role;

comment on schema ops is 'Zybble internal operations schema (queue, workers, provider event log). Service-role only.';

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- text helpers
-- ---------------------------------------------------------------------------

-- Normalizes e-mail addresses for dedupe/comparison. Never used to "verify"
-- an address: verification is a separate, explicitly recorded event.
create or replace function public.normalize_email(p_email text)
returns text
language sql
immutable
as $$
  select nullif(lower(btrim(coalesce(p_email, ''))), '');
$$;

create or replace function public.normalize_phone(p_phone text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), '');
$$;

-- https://www.example.com/about?x=1  ->  example.com
create or replace function public.normalize_domain(p_url text)
returns text
language plpgsql
immutable
as $$
declare
  v text;
begin
  v := lower(btrim(coalesce(p_url, '')));
  if v = '' then
    return null;
  end if;

  v := regexp_replace(v, '^[a-z][a-z0-9+.-]*://', '');
  v := split_part(v, '/', 1);
  v := split_part(v, '?', 1);
  v := split_part(v, '#', 1);
  v := split_part(v, '@', case when position('@' in v) > 0 then 2 else 1 end);
  v := split_part(v, ':', 1);
  v := regexp_replace(v, '^www\.', '');

  if v = '' then
    return null;
  end if;

  return v;
end;
$$;

-- Stable, human-readable, URL-safe slug. `p_fallback` is used when the input
-- slugifies to nothing (e.g. a purely non-latin business name).
create or replace function public.slugify(p_text text, p_fallback text default 'item')
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(
      left(
        regexp_replace(
          regexp_replace(
            -- '&' becomes 'and' to match the slug shape the SPA already produces
            regexp_replace(lower(btrim(coalesce(p_text, ''))), '&', ' and ', 'g'),
            '[^a-z0-9]+', '-', 'g'
          ),
          '(^-+|-+$)', '', 'g'
        ),
        72
      ),
      ''
    ),
    p_fallback
  );
$$;

-- Appends an incrementing suffix until the candidate slug is unique for the
-- given table+column. Used by API services; kept in SQL so the race is handled
-- by the same transaction that inserts the row.
create or replace function public.unique_slug(
  p_table text,
  p_column text,
  p_base text,
  p_max int default 200
)
returns text
language plpgsql
stable
as $$
declare
  v_base text := public.slugify(p_base, 'item');
  v_candidate text := v_base;
  v_i int := 1;
  v_exists boolean;
begin
  if p_table not in ('searches', 'leads', 'lists', 'exports', 'ai_conversations', 'workspaces') then
    raise exception 'unique_slug: unsupported table %', p_table using errcode = '22023';
  end if;

  if p_column <> 'slug' then
    raise exception 'unique_slug: unsupported column %', p_column using errcode = '22023';
  end if;

  loop
    execute format('select exists (select 1 from public.%I where %I = $1)', p_table, p_column)
      into v_exists
      using v_candidate;

    if not v_exists then
      return v_candidate;
    end if;

    v_i := v_i + 1;
    v_candidate := left(v_base, 60) || '-' || v_i::text;

    if v_i > p_max then
      return left(v_base, 48) || '-' || encode(gen_random_bytes(6), 'hex');
    end if;
  end loop;
end;
$$;
