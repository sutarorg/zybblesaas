import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createTestDb, createUser, migrationFiles, type TestDb } from "./db/harness";

let db: TestDb;

describe("migrations (empty database -> production schema)", () => {
  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    await db?.close();
  });

  it("includes every migration in order", () => {
    expect(migrationFiles()).toEqual([
      "0001_extensions_and_helpers.sql",
      "0002_identity.sql",
      "0003_billing_and_usage.sql",
      "0004_leads.sql",
      "0005_searches_lists.sql",
      "0006_job_queue.sql",
      "0007_functions.sql",
      "0008_rls.sql",
      "0009_storage_and_realtime.sql",
      "0010_seed.sql",
      "0011_notification_email_queue.sql",
    ]);
  });

  it("creates the full domain schema", async () => {
    const rows = await db.sql<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1`,
    );
    const tables = rows.map((r) => r.table_name);
    for (const expected of [
      "profiles", "workspaces", "workspace_members", "workspace_invites", "workspace_preferences",
      "plans", "subscriptions", "billing_customers", "payments", "payment_methods", "invoices",
      "leads", "lead_emails", "lead_social_profiles", "lead_reviews", "workspace_leads", "lead_ai_analyses",
      "searches", "search_inputs", "search_leads", "search_events", "lists", "list_leads",
      "exports", "notifications", "notification_preferences", "usage_counters", "usage_events",
      "api_keys", "audit_logs", "ai_conversations", "ai_messages", "ai_runs", "geo_places",
    ]) {
      expect(tables, `missing table ${expected}`).toContain(expected);
    }

    const opsRows = await db.sql<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema = 'ops' order by 1`,
    );
    expect(opsRows.map((r) => r.table_name)).toEqual([
      "billing_events", "idempotency_keys", "job_queue", "quota_warnings", "rate_limits", "system_settings", "workers",
    ]);
  });

  it("seeds the three plans with real entitlements", async () => {
    const plans = await db.sql<{ code: string; price_minor: number; currency: string; leads_per_period: number; ai_enabled: boolean; trial_days: number }>(
      `select code, price_minor, currency, leads_per_period, ai_enabled, trial_days from public.plans order by sort_order`,
    );
    expect(plans).toEqual([
      { code: "starter", price_minor: 0, currency: "USD", leads_per_period: 50, ai_enabled: false, trial_days: 0 },
      { code: "growth", price_minor: 4900, currency: "USD", leads_per_period: 10000, ai_enabled: true, trial_days: 14 },
      { code: "scale", price_minor: 9900, currency: "USD", leads_per_period: 50000, ai_enabled: true, trial_days: 14 },
    ]);
  });

  it("provisions profile + workspace + owner membership + starter plan on signup", async () => {
    const { userId, workspaceId } = await createUser(db, "founder@acme.test", { full_name: "Ada Founder", company: "Acme" });

    const profile = await db.one<{ full_name: string; email: string }>(
      `select full_name, email::text from public.profiles where id = $1`,
      [userId],
    );
    expect(profile).toMatchObject({ full_name: "Ada Founder", email: "founder@acme.test" });

    const workspace = await db.one<{ name: string; slug: string; plan: string }>(
      `select w.name, w.slug, p.code as plan from public.workspaces w join public.plans p on p.id = w.plan_id where w.id = $1`,
      [workspaceId],
    );
    expect(workspace?.plan).toBe("starter");
    expect(workspace?.name).toBe("Acme");

    const member = await db.one<{ role: string; status: string }>(
      `select role, status from public.workspace_members where workspace_id = $1 and user_id = $2`,
      [workspaceId, userId],
    );
    expect(member).toEqual({ role: "owner", status: "active" });

    const prefs = await db.sql(`select 1 from public.workspace_preferences where workspace_id = $1`, [workspaceId]);
    const notifPrefs = await db.sql(`select 1 from public.notification_preferences where workspace_id = $1`, [workspaceId]);
    const audit = await db.one<{ action: string }>(`select action from public.audit_logs where workspace_id = $1`, [workspaceId]);
    expect(prefs).toHaveLength(1);
    expect(notifPrefs).toHaveLength(1);
    expect(audit?.action).toBe("workspace.created");
  });

  it("provisions exactly once per user (idempotent trigger)", async () => {
    const { userId, workspaceId } = await createUser(db, "idem@acme.test", {});
    await db.sql(`update auth.users set raw_user_meta_data = raw_user_meta_data where id = $1`, [userId]);
    const count = await db.one<{ count: number }>(
      `select count(*)::int as count from public.workspaces where owner_id = $1`,
      [userId],
    );
    expect(count?.count).toBe(1);
    const memberships = await db.one<{ count: number }>(
      `select count(*)::int as count from public.workspace_members where workspace_id = $1`,
      [workspaceId],
    );
    expect(memberships?.count).toBe(1);
  });

  it("enables RLS on every customer table", async () => {
    const rows = await db.sql<{ relname: string }>(
      `select c.relname from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    );
    expect(rows.map((r) => r.relname)).toEqual([]);
  });

  it("gives anon/authenticated no direct write access to customer tables", async () => {
    const rows = await db.sql<{ table_name: string; privilege_type: string }>(
      `select table_name, privilege_type from information_schema.role_table_grants
        where grantee in ('anon','authenticated')
          and table_schema = 'public'
          and privilege_type in ('INSERT','UPDATE','DELETE')
        order by 1,2`,
    );
    // only the self-service columns the SPA is allowed to touch directly
    expect(rows).toEqual([
      { table_name: "notification_preferences", privilege_type: "UPDATE" },
      { table_name: "notifications", privilege_type: "UPDATE" },
      { table_name: "profiles", privilege_type: "UPDATE" },
      { table_name: "workspace_preferences", privilege_type: "UPDATE" },
    ]);
  });

  it("hides the ops schema from clients", async () => {
    const rows = await db.sql<{ has_schema_privilege: boolean }>(
      `select has_schema_privilege('authenticated', 'ops', 'USAGE') as has_schema_privilege`,
    );
    expect(rows[0]?.has_schema_privilege).toBe(false);
  });

  it("validates helper functions", async () => {
    const [row] = await db.sql<{ slug: string; domain: string; email: string; phone: string }>(
      `select
         public.slugify('Café & Bakery №1', 'item') as slug,
         public.normalize_domain('https://www.Example.com/about?x=1') as domain,
         public.normalize_email('  HELLO@Example.COM ') as email,
         public.normalize_phone('+49 (30) 1234-5678') as phone`,
    );
    expect(row.slug).toBe("caf-and-bakery-1");
    expect(row.domain).toBe("example.com");
    expect(row.email).toBe("hello@example.com");
    expect(row.phone).toBe("493012345678");

    const built = await db.one<{ unique_slug: string }>(`select public.unique_slug('leads', 'slug', 'Acme Dental') as unique_slug`);
    expect(built?.unique_slug).toBe("acme-dental");
  });

  it("provides a deterministic, coverage-based lead quality score", async () => {
    const [full] = await db.sql<{ score: number }>(
      `select public.lead_quality_score('Acme Dental', 'Dentist', 'Main St 1', '+4912345', 'https://acme.de',
        'hi@acme.de', 4.7, 120, 52.5, 13.4, 'A dental practice', '{"mon":["9-17"]}'::jsonb, '["a.jpg"]'::jsonb, 2) as score`,
    );
    const [empty] = await db.sql<{ score: number }>(
      `select public.lead_quality_score('', null, null, null, null, null, null, null, null, null, null, null, '[]'::jsonb, 0) as score`,
    );
    expect(full.score).toBe(100);
    expect(empty.score).toBe(0);
  });

  it("stores money in minor units with explicit currency", async () => {
    const [row] = await db.sql<{ data_type: string; numeric_precision: number | null }>(
      `select data_type, numeric_precision from information_schema.columns where table_name = 'plans' and column_name = 'price_minor'`,
    );
    expect(row.data_type).toBe("bigint");
  });
});
