/**
 * Cross-tenant isolation tests.
 *
 * These run as the real `authenticated` Postgres role with a real JWT claim
 * (auth.uid()), so they prove the RLS policies — not the API layer.
 */
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createTestDb, createUser, type TestDb } from "./db/harness";

let db: TestDb;
let alice: { userId: string; workspaceId: string };
let bob: { userId: string; workspaceId: string };
let aliceSearchId: string;
let aliceLeadId: string;
let aliceListId: string;
let aliceExportId: string;

async function seedAliceData() {
  const [lead] = await db.sql<{ id: string }>(
    `insert into public.leads (slug, business_name, city, country, phone, website, domain, normalized_phone, rating, review_count, place_id, raw_data)
     values ('acme-dental-berlin', 'Acme Dental', 'Berlin', 'Germany', '+49 30 1234', 'https://acme-dental.de', 'acme-dental.de', '49301234', 4.7, 210, 'ChIJ_alice', '{"source":"test"}')
     returning id`,
  );
  aliceLeadId = lead.id;

  const [search] = await db.sql<{ id: string }>(
    `insert into public.searches (slug, workspace_id, created_by, name, query, location, status, search_config)
     values ('dentists-in-berlin', $1, $2, 'Dentists in Berlin', 'dentists in Berlin', 'Berlin', 'completed',
             '{"depth":10,"radius_km":10,"language":"de","email_extraction":true}'::jsonb)
     returning id`,
    [alice.workspaceId, alice.userId],
  );
  aliceSearchId = search.id;

  // the worker path: association, workspace ownership and quota accrual happen
  // in one call, exactly as in production
  await db.sql(`select public.search_register_lead($1, $2, null, true, false, '{}')`, [aliceSearchId, aliceLeadId]);
  await db.sql(`select public.search_event($1, 'completed', 'done', 'success', '{}'::jsonb)`, [aliceSearchId]);

  await db.sql(`insert into public.lead_emails (lead_id, email, source, is_primary) values ($1, 'hello@acme-dental.de', 'website_scrape', true)`, [aliceLeadId]);
  await db.sql(`update public.leads set email_primary = 'hello@acme-dental.de' where id = $1`, [aliceLeadId]);

  const [list] = await db.sql<{ id: string }>(
    `insert into public.lists (slug, workspace_id, created_by, name) values ('berlin-dentists', $1, $2, 'Berlin dentists') returning id`,
    [alice.workspaceId, alice.userId],
  );
  aliceListId = list.id;
  await db.sql(`insert into public.list_leads (list_id, lead_id, workspace_id, added_by) values ($1, $2, $3, $4)`, [
    aliceListId,
    aliceLeadId,
    alice.workspaceId,
    alice.userId,
  ]);

  const [exp] = await db.sql<{ id: string }>(
    `insert into public.exports (slug, workspace_id, created_by, name, format, status, source_type, source_id)
     values ('berlin-dentists-csv', $1, $2, 'berlin-dentists.csv', 'csv', 'ready', 'search', $3) returning id`,
    [alice.workspaceId, alice.userId, aliceSearchId],
  );
  aliceExportId = exp.id;

  await db.sql(`insert into public.notifications (workspace_id, type, title) values ($1, 'search_completed', 'Search completed')`, [alice.workspaceId]);
  await db.sql(`insert into public.ai_conversations (slug, workspace_id, created_by, title) values ('conv-1', $1, $2, 'HVAC gap')`, [alice.workspaceId, alice.userId]);
  await db.sql(`insert into public.api_keys (workspace_id, created_by, name, prefix, key_hash) values ($1, $2, 'default', 'zyb_live_abc123', 'deadbeef')`, [
    alice.workspaceId,
    alice.userId,
  ]);
}

describe("row level security — cross-workspace isolation", () => {
  beforeAll(async () => {
    db = await createTestDb();
    alice = await createUser(db, "alice@alpha.test", { full_name: "Alice", company: "Alpha" });
    bob = await createUser(db, "bob@beta.test", { full_name: "Bob", company: "Beta" });
    await seedAliceData();
  });

  afterAll(async () => {
    await db?.close();
  });

  it("lets a member read their own workspace data", async () => {
    await db.asUser(alice.userId, async (q) => {
      const leads = await q.sql(`select id from public.leads`);
      const searches = await q.sql(`select id from public.searches`);
      const lists = await q.sql(`select id from public.lists`);
      const exports = await q.sql(`select id from public.exports`);
      const notifs = await q.sql(`select id from public.notifications`);
      const convs = await q.sql(`select id from public.ai_conversations`);
      const usage = await q.sql(`select id from public.usage_counters`);
      expect(leads).toHaveLength(1);
      expect(searches).toHaveLength(1);
      expect(lists).toHaveLength(1);
      expect(exports).toHaveLength(1);
      expect(notifs).toHaveLength(1);
      expect(convs).toHaveLength(1);
      expect(usage.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("hides every one of Alice's resources from Bob", async () => {
    const workspaceScoped: [string, string][] = [
      ["workspace_leads", "workspace_id"], ["search_leads", "search_id"], ["searches", "id"],
      ["search_events", "id"], ["search_inputs", "id"], ["usage_events", "id"], ["usage_counters", "id"],
      ["lists", "id"], ["list_leads", "list_id"], ["exports", "id"], ["notifications", "id"],
      ["ai_conversations", "id"], ["ai_messages", "id"], ["subscriptions", "id"], ["payments", "id"],
      ["invoices", "id"], ["payment_methods", "id"], ["billing_customers", "workspace_id"],
      ["audit_logs", "id"],
    ];
    // canonical lead rows carry no workspace column: they are reachable only
    // through the workspace_leads association checked above
    const leadScoped: [string, string][] = [
      ["leads", "id"], ["lead_emails", "lead_id"], ["lead_social_profiles", "lead_id"],
      ["lead_reviews", "lead_id"], ["lead_ai_analyses", "lead_id"],
    ];

    await db.asUser(bob.userId, async (q) => {
      for (const [table, column] of workspaceScoped) {
        const rows = await q.sql(`select ${column} from public.${table} where workspace_id = $1`, [alice.workspaceId]);
        expect(rows, `leaked rows in ${table}`).toHaveLength(0);
      }
      for (const [table, column] of leadScoped) {
        const rows = await q.sql(`select ${column} from public.${table} where ${column} = $1`, [aliceLeadId]);
        expect(rows, `leaked rows in ${table}`).toHaveLength(0);
      }
    });
  });

  it("blocks cross-workspace selects even when the caller knows the id", async () => {
    await db.asUser(bob.userId, async (q) => {
      const lead = await q.sql(`select id from public.leads where id = $1`, [aliceLeadId]);
      const search = await q.sql(`select id from public.searches where id = $1`, [aliceSearchId]);
      const exp = await q.sql(`select id from public.exports where id = $1`, [aliceExportId]);
      expect(lead).toHaveLength(0);
      expect(search).toHaveLength(0);
      expect(exp).toHaveLength(0);
    });

    // service role (the API) can read it because it performs its own checks
    await db.asService(async (q) => {
      const lead = await q.sql(`select id from public.leads where id = $1`, [aliceLeadId]);
      expect(lead).toHaveLength(1);
    });
  });

  it("denies writes to other workspaces (no grant, no policy)", async () => {
    await db.asUser(bob.userId, async (q) => {
      await expect(q.sql(`update public.searches set name = 'hijacked' where id = $1`, [aliceSearchId])).rejects.toThrow();
      await expect(q.sql(`delete from public.list_leads where list_id = $1`, [aliceListId])).rejects.toThrow();
      await expect(q.sql(`insert into public.search_leads (search_id, lead_id, workspace_id) values ($1, $2, $3)`, [
        aliceSearchId, aliceLeadId, alice.workspaceId,
      ])).rejects.toThrow();
    });

    const name = await db.one<{ name: string }>(`select name from public.searches where id = $1`, [aliceSearchId]);
    expect(name?.name).toBe("Dentists in Berlin");
  });

  it("never exposes api_keys to authenticated clients (hash stays server-side)", async () => {
    await db.asUser(alice.userId, async (q) => {
      await expect(q.sql(`select prefix, key_hash from public.api_keys`)).rejects.toThrow();
    });
  });

  it("never exposes the ops schema", async () => {
    await db.asUser(alice.userId, async (q) => {
      await expect(q.sql(`select * from ops.job_queue`)).rejects.toThrow();
      await expect(q.sql(`select * from ops.billing_events`)).rejects.toThrow();
    });
  });

  it("lets an owner read their own audit log but not another workspace's", async () => {
    await db.asUser(alice.userId, async (q) => {
      const rows = await q.sql(`select id from public.audit_logs`);
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });
    await db.asUser(bob.userId, async (q) => {
      const rows = await q.sql(`select id from public.audit_logs where workspace_id = $1`, [alice.workspaceId]);
      expect(rows).toHaveLength(0);
    });
  });

  it("refuses usage counter manipulation from the browser", async () => {
    await db.asUser(alice.userId, async (q) => {
      await expect(
        q.sql(`update public.usage_counters set leads_generated = 0 where workspace_id = $1`, [alice.workspaceId]),
      ).rejects.toThrow();
    });
  });

  it("keeps anon blind to private data while allowing the public plan list", async () => {
    await db.asAnon(async (q) => {
      // no grant at all on customer tables — anon cannot even attempt a read
      await expect(q.sql(`select id from public.leads`)).rejects.toThrow(/permission denied/);
      await expect(q.sql(`select id from public.searches`)).rejects.toThrow(/permission denied/);
      await expect(q.sql(`select id from public.usage_counters`)).rejects.toThrow(/permission denied/);
      const plans = await q.sql(`select code, price_minor, currency from public.public_plans order by price_minor`);
      expect(plans.map((p) => p.code)).toEqual(["starter", "growth", "scale"]);
    });
  });

  it("exposes workspace_entitlements only to the requesting workspace's members", async () => {
    await db.asUser(alice.userId, async (q) => {
      const ent = await q.one<{ workspace_entitlements: { plan: { code: string }; usage: { leads_generated: number } } }>(
        `select public.workspace_entitlements($1) as workspace_entitlements`,
        [alice.workspaceId],
      );
      expect(ent?.workspace_entitlements.plan.code).toBe("starter");
      expect(ent?.workspace_entitlements.usage.leads_generated).toBe(1);
    });
  });

  it("enforces list dedupe (a lead cannot appear twice in a list)", async () => {
    await expect(
      db.sql(`insert into public.list_leads (list_id, lead_id, workspace_id) values ($1, $2, $3)`, [
        aliceListId, aliceLeadId, alice.workspaceId,
      ]),
    ).rejects.toThrow();
  });

  it("keeps list aggregates derived from real rows", async () => {
    const list = await db.one<{ lead_count: number; with_email_count: number; completeness: number }>(
      `select lead_count, with_email_count, completeness from public.lists where id = $1`,
      [aliceListId],
    );
    expect(list?.lead_count).toBe(1);
    expect(list?.with_email_count).toBe(1);
    expect(list?.completeness).toBeGreaterThan(50);
  });
});
