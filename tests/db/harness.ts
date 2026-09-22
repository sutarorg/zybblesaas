/**
 * Zybble database test harness.
 *
 * Runs the *real* migration files against a real PostgreSQL engine (PGlite is
 * PostgreSQL 16 compiled to WASM) inside a Supabase-compatible shim:
 *
 *   auth.users        + auth.uid()   (reads the request.jwt.claims GUC like Supabase)
 *   storage.buckets   + storage.objects + storage.foldername()
 *   roles: anon, authenticated, service_role
 *
 * This means RLS policies, grants, triggers and functions are exercised exactly
 * as they will be in production — not mocked.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");

export type TestDb = {
  db: PGlite;
  sql: <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>;
  one: <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T | null>;
  /** run as a signed-in Supabase user (sets role + JWT claims) */
  asUser: <T>(userId: string, fn: (q: Query) => Promise<T>) => Promise<T>;
  /** run as the service role (bypasses RLS, like the Vercel API / Go worker) */
  asService: <T>(fn: (q: Query) => Promise<T>) => Promise<T>;
  asAnon: <T>(fn: (q: Query) => Promise<T>) => Promise<T>;
  reset: () => Promise<void>;
  close: () => Promise<void>;
};

export type Query = {
  sql: <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>;
  one: <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T | null>;
  value: <T = unknown>(text: string, params?: unknown[]) => Promise<T | undefined>;
};

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

export function readMigration(file: string): string {
  return readFileSync(join(MIGRATIONS_DIR, file), "utf8");
}

async function createSupabaseShim(db: PGlite): Promise<void> {
  await db.exec(`
    create extension if not exists citext;
    create extension if not exists pg_trgm;
    create extension if not exists pgcrypto;

    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then
        create role service_role nologin noinherit bypassrls;
      end if;
    end $$;

    create schema if not exists auth;
    create schema if not exists storage;

    create table if not exists auth.users (
      id uuid primary key,
      email text unique,
      encrypted_password text,
      email_confirmed_at timestamptz,
      raw_user_meta_data jsonb default '{}'::jsonb,
      created_at timestamptz default now()
    );

    grant usage on schema auth to anon, authenticated, service_role;
    grant select on auth.users to service_role;

    -- Mirrors Supabase: auth.uid() reads the verified JWT 'sub' claim.
    create or replace function auth.uid() returns uuid
    language sql stable as $$
      select nullif(
        coalesce(
          current_setting('request.jwt.claim.sub', true),
          (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
        ),
        ''
      )::uuid;
    $$;

    create or replace function auth.role() returns text
    language sql stable as $$
      select coalesce(current_setting('request.jwt.claim.role', true), 'anon');
    $$;

    create table if not exists storage.buckets (
      id text primary key,
      name text not null,
      owner uuid,
      public boolean default false,
      avif_autodetection boolean default false,
      file_size_limit bigint,
      allowed_mime_types text[],
      created_at timestamptz default now()
    );

    create table if not exists storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text references storage.buckets (id),
      name text,
      owner uuid,
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      last_accessed_at timestamptz default now(),
      metadata jsonb
    );

    create or replace function storage.foldername(name text) returns text[]
    language plpgsql immutable as $$
      declare parts text[];
      begin
        parts := string_to_array(name, '/');
        return parts[1:array_length(parts, 1) - 1];
      end;
    $$;

    grant usage on schema storage to anon, authenticated, service_role;
    grant all on storage.objects to service_role;
    grant all on storage.buckets to service_role;
  `);
}

export async function createTestDb(options: { migrations?: string[] } = {}): Promise<TestDb> {
  const db = new PGlite({
    extensions: { pg_trgm, citext, pgcrypto },
  });

  await db.waitReady;
  await createSupabaseShim(db);

  const files = options.migrations ?? migrationFiles();
  for (const file of files) {
    const sql = readMigration(file);
    try {
      await db.exec(sql);
    } catch (err) {
      throw new Error(`migration ${file} failed: ${(err as Error).message}`);
    }
  }

  const sql = async <T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> => {
    const res = await db.query<T>(text, params as never[]);
    return res.rows;
  };

  const one = async <T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T | null> => {
    const rows = await sql<T>(text, params);
    return rows[0] ?? null;
  };

  const withRole = async <T>(role: string, claims: Record<string, unknown> | null, fn: (q: Query) => Promise<T>): Promise<T> => {
    // Session-scoped, not transaction-scoped: a failing statement (e.g. an RLS
    // denial) must not poison the following statements in the same test.
    await db.query(`select set_config('request.jwt.claims', $1, false)`, [claims ? JSON.stringify(claims) : ""]);
    await db.exec(`set role ${role}`);
    try {
      return await fn({ sql, one, value: async (t, p) => (await one(t, p) as never)?.["value"] as never });
    } finally {
      await db.exec("reset role");
      await db.query(`select set_config('request.jwt.claims', $1, false)`, [""]);
    }
  };

  return {
    db,
    sql,
    one,
    asUser: (userId, fn) => withRole("authenticated", { sub: userId, role: "authenticated" }, fn),
    asService: (fn) => withRole("service_role", null, fn),
    asAnon: (fn) => withRole("anon", { role: "anon" }, fn),
    reset: async () => {
      await db.exec(`
        truncate table
          public.audit_logs, public.usage_events, public.usage_counters, public.notifications,
          public.exports, public.list_leads, public.lists, public.search_events, public.search_leads,
          public.search_inputs, public.searches, public.lead_ai_analyses, public.lead_reviews,
          public.lead_social_profiles, public.lead_emails, public.workspace_leads, public.leads,
          public.ai_messages, public.ai_conversations, public.ai_runs, public.api_keys,
          public.payment_methods, public.invoices, public.payments, public.subscriptions,
          public.billing_customers, public.notification_preferences, public.workspace_preferences,
          public.workspace_invites, public.workspace_members, public.workspaces, public.profiles,
          public.geo_places, public.plans, ops.job_queue, ops.workers, ops.billing_events,
          ops.rate_limits, ops.idempotency_keys, ops.quota_warnings, ops.system_settings
        restart identity cascade;
      `);
    },
    close: () => db.close(),
  };
}

/** Creates an auth user through the real Supabase trigger path. */
export async function createUser(db: TestDb, email: string, meta: Record<string, unknown> = {}): Promise<{ userId: string; workspaceId: string }> {
  const userId = crypto.randomUUID();
  await db.sql(`insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values ($1, $2, $3, now())`, [
    userId,
    email,
    JSON.stringify(meta),
  ]);
  const ws = await db.one<{ id: string }>(`select id from public.workspaces where owner_id = $1 limit 1`, [userId]);
  return { userId, workspaceId: ws!.id };
}
