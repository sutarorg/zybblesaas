/**
 * Job queue, quota accounting and lead-identity behaviour.
 *
 * These are the invariants the Go worker relies on: claim exclusivity, lease
 * recovery after a crash, retry backoff, idempotent billing of the first
 * contactable lead, and progress that is derived from real work only.
 */
import { describe, expect, it, beforeAll, beforeEach, afterAll } from "vitest";
import { createTestDb, createUser, type TestDb } from "./db/harness";

let db: TestDb;
let ws: string;
let userId: string;

async function enqueue(overrides: Partial<Record<string, unknown>> = {}) {
  const p = {
    jobType: "scrape",
    payload: { search_id: "00000000-0000-0000-0000-000000000000" },
    priority: 50,
    dedupe: null as string | null,
    maxAttempts: 3,
    ...overrides,
  };
  const row = await db.one<{ queue_enqueue: string }>(
    `select ops.queue_enqueue($1, $2::jsonb, $3, $4, $5, now(), $6, 'test') as queue_enqueue`,
    [p.jobType, JSON.stringify(p.payload), ws, p.priority, p.dedupe, p.maxAttempts],
  );
  return row!.queue_enqueue;
}

beforeAll(async () => {
  db = await createTestDb();
  const created = await createUser(db, "queue@acme.test", { company: "Acme" });
  ws = created.workspaceId;
  userId = created.userId;
});

beforeEach(async () => {
  await db.sql(`truncate table ops.job_queue`);
});

afterAll(async () => {
  await db?.close();
});

describe("job queue", () => {
  it("claims jobs exclusively and honours priority", async () => {
    const low = await enqueue({ priority: 10 });
    const high = await enqueue({ priority: 90 });

    const first = await db.one<{ id: string; attempts: number; status: string; locked_by: string }>(
      `select id, attempts, status, locked_by from ops.queue_claim('worker-a', array['scrape'], 1, 300)`,
    );
    expect(first?.id).toBe(high);
    expect(first?.status).toBe("running");
    expect(first?.attempts).toBe(1);
    expect(first?.locked_by).toBe("worker-a");

    const second = await db.one<{ id: string }>(
      `select id from ops.queue_claim('worker-b', array['scrape'], 1, 300)`,
    );
    expect(second?.id).toBe(low);

    const none = await db.one(`select id from ops.queue_claim('worker-c', array['scrape'], 1, 300)`);
    expect(none).toBeNull();
  });

  it("does not hand the same job to two workers", async () => {
    await enqueue({});
    const a = await db.one<{ id: string }>(`select id from ops.queue_claim('worker-a', array['scrape'], 1, 300)`);
    const b = await db.one<{ id: string }>(`select id from ops.queue_claim('worker-b', array['scrape'], 1, 300)`);
    expect(a?.id).not.toBe(b?.id);
    expect(b).toBeNull(); // only one job queued
  });

  it("dedupes by key while pending/running, and allows a fresh job afterwards", async () => {
    const key = "search:abc:input:1";
    const first = await enqueue({ dedupe: key });
    const second = await enqueue({ dedupe: key });
    expect(second).toBe(first);

    await db.sql(`select ops.queue_claim('worker-a', array['scrape'], 1, 300)`);
    expect(await db.one<{ queue_complete: boolean }>(`select ops.queue_complete($1, 'worker-a', '{}'::jsonb) as queue_complete`, [first]))
      .toMatchObject({ queue_complete: true });
    const third = await enqueue({ dedupe: key });
    expect(third).not.toBe(first);
  });

  it("extends a lease only for the owning worker", async () => {
    const id = await enqueue({});
    await db.sql(`select ops.queue_claim('worker-a', array['scrape'], 1, 300)`);

    const wrong = await db.one<{ queue_heartbeat: boolean }>(`select ops.queue_heartbeat($1, 'worker-b', 300) as queue_heartbeat`, [id]);
    const right = await db.one<{ queue_heartbeat: boolean }>(`select ops.queue_heartbeat($1, 'worker-a', 300) as queue_heartbeat`, [id]);
    expect(wrong?.queue_heartbeat).toBe(false);
    expect(right?.queue_heartbeat).toBe(true);
  });

  it("only the owning worker can complete a job", async () => {
    const id = await enqueue({});
    await db.sql(`select ops.queue_claim('worker-a', array['scrape'], 1, 300)`);

    const wrong = await db.one<{ queue_complete: boolean }>(`select ops.queue_complete($1, 'worker-b', '{}'::jsonb) as queue_complete`, [id]);
    expect(wrong?.queue_complete).toBe(false);

    const right = await db.one<{ queue_complete: boolean }>(`select ops.queue_complete($1, 'worker-a', '{"leads":3}'::jsonb) as queue_complete`, [id]);
    expect(right?.queue_complete).toBe(true);

    const row = await db.one<{ status: string; result: Record<string, unknown>; locked_by: string | null }>(
      `select status, result, locked_by from ops.job_queue where id = $1`,
      [id],
    );
    expect(row).toMatchObject({ status: "succeeded", result: { leads: 3 }, locked_by: null });
  });

  it("retries with backoff and then fails permanently after max_attempts", async () => {
    const id = await enqueue({ maxAttempts: 2 });

    await db.sql(`select ops.queue_claim('worker-a', array['scrape'], 1, 300)`);
    const first = await db.one<{ queue_fail: string }>(`select ops.queue_fail($1, 'worker-a', 'boom', 30) as queue_fail`, [id]);
    expect(first?.queue_fail).toBe("pending");

    const backoff = await db.one<{ available_in: number; attempts: number; last_error: string }>(
      `select extract(epoch from (available_at - now()))::int as available_in, attempts, last_error from ops.job_queue where id = $1`,
      [id],
    );
    expect(backoff!.available_in).toBeGreaterThan(20);
    expect(backoff!.last_error).toBe("boom");

    // not yet available
    expect(await db.one(`select id from ops.queue_claim('worker-a', array['scrape'], 1, 300)`)).toBeNull();

    // make it available and fail again -> exhausted
    await db.sql(`update ops.job_queue set available_at = now() where id = $1`, [id]);
    await db.sql(`select ops.queue_claim('worker-a', array['scrape'], 1, 300)`);
    const second = await db.one<{ queue_fail: string }>(`select ops.queue_fail($1, 'worker-a', 'boom again', 30) as queue_fail`, [id]);
    expect(second?.queue_fail).toBe("failed");

    const row = await db.one<{ status: string; finished_at: string | null; attempts: number }>(
      `select status, finished_at, attempts from ops.job_queue where id = $1`,
      [id],
    );
    expect(row?.status).toBe("failed");
    expect(row?.finished_at).not.toBeNull();
    expect(row?.attempts).toBe(2);
  });

  it("reclaims jobs whose worker died (lease expired)", async () => {
    const id = await enqueue({});
    await db.sql(`select ops.queue_claim('worker-a', array['scrape'], 1, 300)`);
    await db.sql(`update ops.job_queue set locked_until = now() - interval '5 minutes' where id = $1`, [id]);

    const statsBefore = await db.one<{ queue_stats: { expired_leases: number } }>(`select ops.queue_stats() as queue_stats`);
    expect(statsBefore!.queue_stats.expired_leases).toBe(1);

    const reclaimed = await db.one<{ reclaimed: number; failed: number }>(`select * from ops.queue_reclaim_expired(100)`);
    expect(reclaimed).toEqual({ reclaimed: 1, failed: 0 });

    const row = await db.one<{ status: string; locked_by: string | null; last_error: string }>(
      `select status, locked_by, last_error from ops.job_queue where id = $1`,
      [id],
    );
    expect(row?.status).toBe("pending");
    expect(row?.locked_by).toBeNull();
    expect(row?.last_error).toMatch(/lease expired/);
  });

  it("cancels pending work for one search without touching other searches", async () => {
    const searchA = crypto.randomUUID();
    const searchB = crypto.randomUUID();
    const a1 = await enqueue({ payload: { search_id: searchA } });
    const a2 = await enqueue({ payload: { search_id: searchA } });
    const b1 = await enqueue({ payload: { search_id: searchB } });

    const cancelled = await db.one<{ queue_cancel_search: number }>(`select ops.queue_cancel_search($1) as queue_cancel_search`, [searchA]);
    expect(cancelled?.queue_cancel_search).toBe(2);

    const rows = await db.sql<{ id: string; status: string }>(`select id, status from ops.job_queue where id = any($1::uuid[])`, [
      [a1, a2, b1],
    ]);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.status]));
    expect(byId[a1]).toBe("cancelled");
    expect(byId[a2]).toBe("cancelled");
    expect(byId[b1]).toBe("pending");
  });

  it("registers workers and detects stale heartbeats", async () => {
    await db.sql(`select ops.worker_register('worker-1', '1.0.0', 'gosom-1.18.1', 'railway-1', 'eu-west', '{"scrape":2}'::jsonb)`);
    await db.sql(`select ops.worker_heartbeat('worker-1', 'idle', 0, 0)`);
    const worker = await db.one<{ status: string; version: string; engine_version: string; concurrency: Record<string, number> }>(
      `select status, version, engine_version, concurrency from ops.workers where worker_id = 'worker-1'`,
    );
    expect(worker).toMatchObject({ status: "idle", version: "1.0.0", engine_version: "gosom-1.18.1" });
  });

  it("rate limits per bucket (fixed window)", async () => {
    const first = await db.one<{ allowed: boolean; remaining: number }>(`select * from ops.rate_limit_hit('user:test', 2, 60)`);
    const second = await db.one<{ allowed: boolean; remaining: number }>(`select * from ops.rate_limit_hit('user:test', 2, 60)`);
    const third = await db.one<{ allowed: boolean; remaining: number }>(`select * from ops.rate_limit_hit('user:test', 2, 60)`);
    expect(first).toMatchObject({ allowed: true, remaining: 1 });
    expect(second).toMatchObject({ allowed: true, remaining: 0 });
    expect(third?.allowed).toBe(false);
  });
});

describe("quota accounting", () => {
  it("reserves usage atomically and refuses to exceed the plan limit", async () => {
    const allowed = await db.one<{ usage_reserve: boolean }>(
      `select public.usage_reserve($1, 'export_created', 2, 1, 'export:1', 'export', null, '{}'::jsonb) as usage_reserve`,
      [ws],
    );
    const second = await db.one<{ usage_reserve: boolean }>(
      `select public.usage_reserve($1, 'export_created', 2, 1, 'export:2', 'export', null, '{}'::jsonb) as usage_reserve`,
      [ws],
    );
    const third = await db.one<{ usage_reserve: boolean }>(
      `select public.usage_reserve($1, 'export_created', 2, 1, 'export:3', 'export', null, '{}'::jsonb) as usage_reserve`,
      [ws],
    );
    expect([allowed?.usage_reserve, second?.usage_reserve, third?.usage_reserve]).toEqual([true, true, false]);
  });

  it("treats a replayed dedupe key as already-allowed (idempotent retries)", async () => {
    const again = await db.one<{ usage_reserve: boolean }>(
      `select public.usage_reserve($1, 'export_created', 2, 1, 'export:1', 'export', null, '{}'::jsonb) as usage_reserve`,
      [ws],
    );
    expect(again?.usage_reserve).toBe(true);

    const events = await db.one<{ count: number }>(
      `select count(*)::int as count from public.usage_events where workspace_id = $1 and kind = 'export_created'`,
      [ws],
    );
    expect(events?.count).toBe(2);
  });

  it("rolls usage events into the monthly counter exactly once", async () => {
    await db.sql(`select public.usage_record($1, 'email_found', 3, 'batch:1', 'search', null, '{}'::jsonb)`, [ws]);
    // replay must not double count
    await db.sql(`select public.usage_record($1, 'email_found', 3, 'batch:1', 'search', null, '{}'::jsonb)`, [ws]);

    const counter = await db.one<{ emails_found: number; exports_created: number }>(
      `select emails_found, exports_created from public.usage_counters where workspace_id = $1 and period_start = date_trunc('month', now())`,
      [ws],
    );
    expect(counter).toEqual({ emails_found: 3, exports_created: 2 });
  });

  it("reports the real entitlement + usage snapshot", async () => {
    const ent = await db.one<{ workspace_entitlements: any }>(`select public.workspace_entitlements($1) as workspace_entitlements`, [ws]);
    const e = ent!.workspace_entitlements;
    expect(e.plan.code).toBe("starter");
    expect(e.usage.exports_created).toBe(2);
    expect(e.plan.leads_per_period).toBe(50);
    expect(e.plan.ai_enabled).toBe(false);
    expect(e.seats_used).toBe(1);
    expect(e.subscription).toBeNull();
  });
});

describe("lead identity + billing", () => {
  it("upserts the same Google place twice into one canonical lead", async () => {
    const payload = {
      business_name: "Zahnarzt Berlin Mitte",
      category: "Dentist",
      place_id: "ChIJ_zybble_test",
      cid: "1234567890",
      website: "https://www.zahnarzt-berlin.de/termin",
      phone: "+49 (30) 555-1234",
      city: "Berlin",
      country_code: "DE",
      latitude: 52.52,
      longitude: 13.405,
      rating: 4.6,
      review_count: 143,
      raw_data: { link: "https://maps.google.com/?cid=1234567890" },
    };

    const first = await db.one<{ lead_id: string; created: boolean; matched_by: string | null }>(
      `select * from public.lead_upsert($1::jsonb, 'gosom-1.18.1')`,
      [JSON.stringify(payload)],
    );
    expect(first?.created).toBe(true);

    const second = await db.one<{ lead_id: string; created: boolean; matched_by: string }>(
      `select * from public.lead_upsert($1::jsonb, 'gosom-1.18.1')`,
      [JSON.stringify({ ...payload, phone: "+49 30 5551234", review_count: 150 })],
    );
    expect(second?.created).toBe(false);
    expect(second?.lead_id).toBe(first?.lead_id);
    expect(second?.matched_by).toBe("place_id");

    const lead = await db.one<{ domain: string; normalized_phone: string; review_count: number; business_name: string }>(
      `select domain, normalized_phone, review_count, business_name from public.leads where id = $1`,
      [first!.lead_id],
    );
    expect(lead).toMatchObject({
      domain: "zahnarzt-berlin.de",
      normalized_phone: "49305551234",
      review_count: 150,
      business_name: "Zahnarzt Berlin Mitte",
    });
  });

  it("keeps the original engine payload in raw_data", async () => {
    const lead = await db.one<{ raw_data: { link: string } }>(
      `select raw_data from public.leads where place_id = 'ChIJ_zybble_test'`,
    );
    expect(lead?.raw_data.link).toBe("https://maps.google.com/?cid=1234567890");
  });

  it("matches the same business scraped without a place_id (domain + phone)", async () => {
    const row = await db.one<{ lead_id: string; created: boolean }>(
      `select * from public.lead_upsert($1::jsonb, 'gosom-1.18.1')`,
      [JSON.stringify({
        business_name: "Zahnarzt Berlin Mitte",
        website: "https://zahnarzt-berlin.de",
        phone: "+49305551234",
        city: "Berlin",
      })],
    );
    expect(row?.created).toBe(false);
  });

  it("bills the first association of a contactable lead once per workspace", async () => {
    const lead = await db.one<{ id: string }>(`select id from public.leads where place_id = 'ChIJ_zybble_test'`);

    const [search1] = await db.sql<{ id: string }>(
      `insert into public.searches (slug, workspace_id, created_by, name, query, location, search_config)
       values ('dentists-berlin-1', $1, $2, 'Dentists Berlin', 'zahnarzt berlin', 'Berlin', '{"email_extraction":false}'::jsonb)
       returning id`,
      [ws, userId],
    );
    const [search2] = await db.sql<{ id: string }>(
      `insert into public.searches (slug, workspace_id, created_by, name, query, location, search_config)
       values ('dentists-berlin-2', $1, $2, 'Dentists Berlin 2', 'zahnarzt berlin', 'Berlin', '{"email_extraction":false}'::jsonb)
       returning id`,
      [ws, userId],
    );

    const r1 = await db.one<{ is_new_association: boolean; is_workspace_new: boolean; unique_count: number; duplicate_count: number; out_workspace_id: string }>(
      `select * from public.search_register_lead($1, $2, null, true, false, '{}')`,
      [search1.id, lead!.id],
    );
    expect(r1).toMatchObject({ is_new_association: true, is_workspace_new: true, unique_count: 1, duplicate_count: 0 });
    expect(r1!.out_workspace_id).toBe(ws);

    const billed = await db.one<{ count: number }>(
      `select count(*)::int as count from public.usage_events where workspace_id = $1 and dedupe_key = $2`,
      [ws, `lead:${lead!.id}`],
    );
    expect(billed?.count).toBe(1);

    // second search in the same workspace: new association, not new to the workspace, not billed again
    const r2 = await db.one<{ is_new_association: boolean; is_workspace_new: boolean }>(
      `select * from public.search_register_lead($1, $2, null, true, false, '{}')`,
      [search2.id, lead!.id],
    );
    expect(r2).toMatchObject({ is_new_association: true, is_workspace_new: false });

    const billedAgain = await db.one<{ count: number }>(
      `select count(*)::int as count from public.usage_events where workspace_id = $1 and dedupe_key = $2`,
      [ws, `lead:${lead!.id}`],
    );
    expect(billedAgain?.count).toBe(1);

    // replaying the exact same association is a duplicate, not a new lead
    const r3 = await db.one<{ is_new_association: boolean; duplicate_count: number }>(
      `select * from public.search_register_lead($1, $2, null, true, false, '{}')`,
      [search1.id, lead!.id],
    );
    expect(r3).toMatchObject({ is_new_association: false, duplicate_count: 1 });
  });

  it("does not bill a lead with no contact channel", async () => {
    const row = await db.one<{ lead_id: string }>(
      `select * from public.lead_upsert($1::jsonb, 'gosom-1.18.1')`,
      [JSON.stringify({ business_name: "Kiosk ohne Kontakt", city: "Berlin", place_id: "ChIJ_no_contact" })],
    );
    const [search] = await db.sql<{ id: string }>(
      `insert into public.searches (slug, workspace_id, created_by, name, query, location, search_config)
       values ('no-contact-search', $1, $2, 'No contact', 'kiosk', 'Berlin', '{}'::jsonb) returning id`,
      [ws, userId],
    );
    await db.sql(`select * from public.search_register_lead($1, $2, null, true, false, '{}')`, [search.id, row!.lead_id]);

    const wl = await db.one<{ billable: boolean }>(`select billable from public.workspace_leads where workspace_id = $1 and lead_id = $2`, [ws, row!.lead_id]);
    const billed = await db.one<{ count: number }>(`select count(*)::int as count from public.usage_events where dedupe_key = $1`, [`lead:${row!.lead_id}`]);
    expect(wl?.billable).toBe(false);
    expect(billed?.count).toBe(0);
  });

  it("syncs child emails/socials/reviews without duplicating them", async () => {
    const lead = await db.one<{ id: string }>(`select id from public.leads where place_id = 'ChIJ_zybble_test'`);
    const children = {
      emails: [{ email: "Termin@Zahnarzt-Berlin.de", source: "website_scrape", is_primary: true }],
      social_profiles: [{ platform: "instagram", url: "https://instagram.com/zahnarztberlin" }],
      reviews: [{ review_id: "r1", author_name: "Kim", rating: 5, text_original: "Sehr gut" }],
    };
    await db.sql(`select public.lead_sync_children($1, $2::jsonb)`, [lead!.id, JSON.stringify(children)]);
    await db.sql(`select public.lead_sync_children($1, $2::jsonb)`, [lead!.id, JSON.stringify(children)]);

    const counts = await db.one<{ emails: number; socials: number; reviews: number }>(
      `select (select count(*) from public.lead_emails where lead_id = $1)::int as emails,
              (select count(*) from public.lead_social_profiles where lead_id = $1)::int as socials,
              (select count(*) from public.lead_reviews where lead_id = $1)::int as reviews`,
      [lead!.id],
    );
    expect(counts).toEqual({ emails: 1, socials: 1, reviews: 1 });

    const email = await db.one<{ email: string; is_primary: boolean }>(`select email::text as email, is_primary from public.lead_emails where lead_id = $1`, [lead!.id]);
    expect(email?.email).toBe("termin@zahnarzt-berlin.de");
    expect(email?.is_primary).toBe(true);
  });
});

describe("progress honesty", () => {
  it("reports 0%/no ETA before any work has been observed", async () => {
    const [search] = await db.sql<{ id: string }>(
      `insert into public.searches (slug, workspace_id, created_by, name, query, location, search_config, status)
       values ('progress-empty', $1, $2, 'Empty', 'q', 'Berlin', '{"email_extraction":true}'::jsonb, 'queued') returning id`,
      [ws, userId],
    );
    await db.sql(`select public.search_refresh_progress($1, 0, true)`, [search.id]);
    const row = await db.one<{ progress_percent: number; eta_seconds: number | null; phase: string }>(
      `select progress_percent, eta_seconds, phase from public.searches where id = $1`,
      [search.id],
    );
    expect(row?.progress_percent).toBe(0);
    expect(row?.eta_seconds).toBeNull();
  });

  it("derives progress from completed inputs and never reports 100% early", async () => {
    const [search] = await db.sql<{ id: string }>(
      `insert into public.searches (slug, workspace_id, created_by, name, query, location, search_config, status, started_at)
       values ('progress-run', $1, $2, 'Running', 'q', 'Berlin', '{"email_extraction":false}'::jsonb, 'running', now() - interval '5 minutes')
       returning id`,
      [ws, userId],
    );
    await db.sql(
      `insert into public.search_inputs (search_id, workspace_id, seq, query_text, status) values
        ($1, $2, 1, 'a', 'completed'), ($1, $2, 2, 'b', 'running'), ($1, $2, 3, 'c', 'pending'), ($1, $2, 4, 'd', 'pending')`,
      [search.id, ws],
    );

    await db.sql(`select public.search_refresh_progress($1, 0, true)`, [search.id]);
    const row = await db.one<{ progress_percent: number; phase: string; eta_seconds: number | null }>(
      `select progress_percent, phase, eta_seconds from public.searches where id = $1`,
      [search.id],
    );
    // email extraction disabled -> scraping is the whole job: 1/4 inputs = 25%
    expect(row?.progress_percent).toBe(25);
    expect(row?.phase).toBe("scraping");
    // one completed input is not enough evidence for an ETA
    expect(row?.eta_seconds).toBeNull();

    await db.sql(`update public.search_inputs set status = 'completed' where search_id = $1 and seq in (1,2)`, [search.id]);
    await db.sql(`select public.search_refresh_progress($1, 0, true)`, [search.id]);
    const row2 = await db.one<{ progress_percent: number; eta_seconds: number | null }>(
      `select progress_percent, eta_seconds from public.searches where id = $1`,
      [search.id],
    );
    expect(row2?.progress_percent).toBe(50);
    expect(row2?.eta_seconds).toBeGreaterThan(0);
  });

  it("splits scraping 85% / enrichment 15% and never claims 100% before completion", async () => {
    const [search] = await db.sql<{ id: string }>(
      `insert into public.searches (slug, workspace_id, created_by, name, query, location, search_config, status, started_at)
       values ('progress-enrich', $1, $2, 'Enriching', 'q', 'Berlin', '{"email_extraction":true}'::jsonb, 'running', now() - interval '2 minutes')
       returning id`,
      [ws, userId],
    );
    await db.sql(
      `insert into public.search_inputs (search_id, workspace_id, seq, query_text, status) values
        ($1, $2, 1, 'a', 'completed'), ($1, $2, 2, 'b', 'completed')`,
      [search.id, ws],
    );
    // 10 unique leads discovered, none enriched yet
    await db.sql(
      `insert into public.leads (slug, business_name, city, raw_data)
       select 'enrich-' || g, 'Business ' || g, 'Berlin', '{}'::jsonb from generate_series(1, 10) g
       on conflict do nothing`,
    );
    await db.sql(
      `update public.searches set unique_count = 10, enriched_count = 0 where id = $1`,
      [search.id],
    );

    await db.sql(`select public.search_refresh_progress($1, 0, true)`, [search.id]);
    const scraping = await db.one<{ progress_percent: number; phase: string; eta_seconds: number | null }>(
      `select progress_percent, phase, eta_seconds from public.searches where id = $1`,
      [search.id],
    );
    expect(scraping?.progress_percent).toBe(85);
    expect(scraping?.phase).toBe("enriching");

    await db.sql(`update public.searches set enriched_count = 5 where id = $1`, [search.id]);
    await db.sql(`select public.search_refresh_progress($1, 0, true)`, [search.id]);
    const half = await db.one<{ progress_percent: number }>(`select progress_percent from public.searches where id = $1`, [search.id]);
    expect(half?.progress_percent).toBe(93); // 85 + 7.5 -> 93

    // all leads processed but the search is not finished yet: still not 100%
    await db.sql(`update public.searches set enriched_count = 10 where id = $1`, [search.id]);
    await db.sql(`select public.search_refresh_progress($1, 0, true)`, [search.id]);
    const done = await db.one<{ progress_percent: number; eta_seconds: number | null }>(
      `select progress_percent, eta_seconds from public.searches where id = $1`,
      [search.id],
    );
    expect(done?.progress_percent).toBe(99);
  });

  it("tracks per-input progress for pause/resume", async () => {
    const [search] = await db.sql<{ id: string }>(
      `insert into public.searches (slug, workspace_id, created_by, name, query, location, search_config)
       values ('input-progress', $1, $2, 'Inputs', 'q', 'Berlin', '{}'::jsonb) returning id`,
      [ws, userId],
    );
    const [input] = await db.sql<{ id: string }>(
      `insert into public.search_inputs (search_id, workspace_id, seq, query_text) values ($1, $2, 1, 'a') returning id`,
      [search.id, ws],
    );
    await db.sql(`select public.search_input_progress($1, $2, 'running', 12, 4, null)`, [search.id, input.id]);
    await db.sql(`select public.search_input_progress($1, $2, 'completed', 30, 30, null)`, [search.id, input.id]);

    const row = await db.one<{ status: string; places_discovered: number; places_completed: number; finished_at: string | null }>(
      `select status, places_discovered, places_completed, finished_at from public.search_inputs where id = $1`,
      [input.id],
    );
    expect(row).toMatchObject({ status: "completed", places_discovered: 30, places_completed: 30 });
    expect(row?.finished_at).not.toBeNull();
  });
});

describe("dashboard + events", () => {
  it("logs user-visible search events and notifications", async () => {
    const [search] = await db.sql<{ id: string }>(
      `insert into public.searches (slug, workspace_id, created_by, name, query, location, search_config)
       values ('events-search', $1, $2, 'Events', 'q', 'Berlin', '{}'::jsonb) returning id`,
      [ws, userId],
    );
    await db.sql(`select public.search_event($1, 'started', 'Scraping started', 'info', '{}'::jsonb)`, [search.id]);
    await db.sql(`select public.notify_workspace($1, 'search_completed', 'Search completed', 'body', '/search/events-search', 'success', null, '{}'::jsonb)`, [ws]);

    const event = await db.one<{ event_type: string; workspace_id: string }>(`select event_type, workspace_id from public.search_events where search_id = $1`, [search.id]);
    const notif = await db.one<{ type: string; severity: string }>(`select type, severity from public.notifications where workspace_id = $1 order by created_at desc limit 1`, [ws]);
    expect(event).toMatchObject({ event_type: "started", workspace_id: ws });
    expect(notif).toMatchObject({ type: "search_completed", severity: "success" });
  });

  it("returns real dashboard numbers", async () => {
    const stats = await db.one<{ dashboard_stats: any }>(`select public.dashboard_stats($1) as dashboard_stats`, [ws]);
    const s = stats!.dashboard_stats;

    const leads = await db.one<{ count: number }>(
      `select count(*)::int as count from public.workspace_leads where workspace_id = $1`,
      [ws],
    );
    const searches = await db.one<{ count: number }>(
      `select count(*)::int as count from public.searches where workspace_id = $1 and deleted_at is null`,
      [ws],
    );
    const emails = await db.one<{ count: number }>(
      `select count(*)::int as count
         from public.lead_emails le
         join public.workspace_leads wl on wl.lead_id = le.lead_id
        where wl.workspace_id = $1`,
      [ws],
    );

    expect(s.total_leads).toBe(leads!.count);
    expect(s.leads_with_email).toBe(emails!.count);
    expect(s.completed_searches).toBeLessThanOrEqual(searches!.count);
    expect(s.unread_notifications).toBeGreaterThanOrEqual(1);
    expect(s.weekly_activity).toHaveLength(7);
    expect(s.recent_searches.length).toBeGreaterThan(0);
    expect(s.recent_leads.length).toBeGreaterThan(0);
    expect(s.usage.exports_created).toBe(2);
    expect(s.period.start).toBeTruthy();
  });
});
