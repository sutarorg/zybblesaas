/**
 * Lead ingest: what the engine reports must always become a lead row.
 *
 * Regression test for the bug where a search found places but displayed none:
 * the worker forwards Google's own status display string ("Open", "CLOSED",
 * "Permanently closed", "Geöffnet", …) under `status`, while public.leads only
 * accepts the normalized enum ('open' | 'closed' | 'unknown'). Every insert
 * therefore raised 23514 (check_violation), public.lead_upsert failed for every
 * place, the worker's result writer logged "flush failed", and the search ended
 * with zero leads.
 *
 * These tests drive the same function the worker calls, with payloads shaped
 * exactly like worker/internal/engine.PayloadFromEntry output.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, createUser, type TestDb } from "./db/harness";

let db: TestDb;
let workspaceId: string;
let searchId: string;
let inputId: string;

/** One engine result, as the worker builds it (see PayloadFromEntry). */
function enginePayload({ status = "Open", ...overrides }: Record<string, unknown> = {}) {
  return {
    business_name: "Cafe Krähe",
    category: "Cafe",
    categories: ["Cafe"],
    website: "https://cafe-kraehe.example",
    phone: "030 1234567",
    address: "Krähenweg 3, 10115 Berlin, Germany",
    city: "Berlin",
    street: "Krähenweg 3",
    state: "Berlin",
    country: "Germany",
    postal_code: "10115",
    complete_address: "Krähenweg 3, Berlin, Berlin, 10115, Germany",
    latitude: 52.53,
    longitude: 13.4,
    rating: 4.6,
    review_count: 218,
    // What the engine reported, verbatim — Google's own display string.
    status,
    open_hours: { mon: ["9 AM–6 PM"] },
    popular_times: {},
    plus_code: "9F5M+2R Berlin",
    timezone: "Europe/Berlin",
    price_range: "€€",
    data_id: "0x47a84e3c0dc2bf21:0x1b2c3d4e5f607182",
    cid: "1959682825634833794",
    place_id: "ChIJk3Lym3RRqEcRglQhZtLm1pY",
    map_url: "https://www.google.com/maps/place/?q=place_id:ChIJk3Lym3RRqEcRglQhZtLm1pY",
    reviews_url: "https://search.google.com/local/reviews?placeid=ChIJk3Lym3RRqEcRglQhZtLm1pY",
    thumbnail_url: "https://lh3.googleusercontent.com/p/abc",
    street_view_url: "",
    description: "Neighbourhood cafe",
    owner_data: {},
    images: [{ title: "", image: "https://lh3.googleusercontent.com/p/def" }],
    about: {},
    emails: [],
    // PayloadFromEntry stores the untouched engine payload here.
    raw_data: { input_id: "seed-1", title: "Cafe Krähe", status },
    source: "google_maps",
    source_engine: "gosom",
    ...overrides,
  };
}

async function ingest(payload: Record<string, unknown>) {
  const lead = await db.one<{ lead_id: string; created: boolean; matched_by: string }>(
    `select lead_id, created, matched_by from public.lead_upsert($1::jsonb, 'gosom-1.18.1')`,
    [JSON.stringify(payload)],
  );
  const register = await db.one<{ is_new_association: boolean; is_workspace_new: boolean }>(
    `select is_new_association, is_workspace_new from public.search_register_lead($1, $2, $3, $4, false, '{}')`,
    [searchId, lead!.lead_id, inputId, lead!.created],
  );
  const row = await db.one<{ status: string; raw_data: { status?: string } }>(
    `select status, raw_data from public.leads where id = $1`,
    [lead!.lead_id],
  );
  return { lead: lead!, register: register!, row: row! };
}

beforeAll(async () => {
  db = await createTestDb();
  const created = await createUser(db, "ingest@zybble.test", { company: "Ingest" });
  workspaceId = created.workspaceId;
});

beforeEach(async () => {
  await db.sql(`truncate table public.lead_reviews, public.lead_social_profiles, public.lead_emails,
      public.search_leads, public.workspace_leads, public.usage_events, public.search_inputs,
      public.searches, public.leads cascade`);
  const search = await db.one<{ id: string }>(
    `insert into public.searches (slug, workspace_id, name, query, location, status, phase)
     values ('ingest-search', $1, 'Berlin cafes', 'cafe', 'Berlin', 'running', 'scraping')
     returning id`,
    [workspaceId],
  );
  searchId = search!.id;
  const input = await db.one<{ id: string }>(
    `insert into public.search_inputs (search_id, workspace_id, seq, query_text, status)
     values ($1, $2, 1, 'cafe, Berlin', 'running') returning id`,
    [searchId, workspaceId],
  );
  inputId = input!.id;
});

afterAll(async () => {
  await db?.close();
});

describe("lead ingest from the engine", () => {
  it("stores every status the engine actually reports", async () => {
    // Two of these are exactly what gosom v1.18.1 produces: the English
    // display string from darray[34][4][4] and the uppercase "CLOSED" enum from
    // darray[88][0] (the index that replaced it in 2026-07).
    const cases: Array<[string, string]> = [
      ["Open", "open"],
      ["open", "open"],
      ["Open ⋅ Closes 10 PM", "open"],
      ["Geöffnet", "open"],
      ["Ouvert", "open"],
      ["营业中", "open"],
      ["Closed", "closed"],
      ["CLOSED", "closed"],
      ["Permanently closed", "closed"],
      ["Temporarily closed", "closed"],
      ["Geschlossen", "closed"],
      ["Öffnet um 9 Uhr", "closed"],
      ["Opens 9 AM", "closed"],
      ["مغلق", "closed"],
    ];

    let index = 0;
    for (const [reported, expected] of cases) {
      index += 1;
      const { row } = await ingest(
        enginePayload({
          status: reported,
          business_name: `Place ${index}`,
          place_id: `place-${index}`,
          cid: `cid-${index}`,
          data_id: `data-${index}`,
          map_url: `https://www.google.com/maps/place/?q=place_id:place-${index}`,
        }),
      );
      expect(row.status, `engine reported ${JSON.stringify(reported)}`).toBe(expected);
    }
  });

  it("says 'unknown' instead of guessing when the engine did not really tell us", async () => {
    // Distinct identities (and names) so each probe is its own lead.
    const probe = (name: string, extra: Record<string, unknown> = {}) =>
      enginePayload({
        business_name: name,
        address: `${name} 1, 10115 Berlin, Germany`,
        complete_address: `${name} 1, Berlin, Berlin, 10115, Germany`,
        street: `${name} 1`,
        postal_code: "10115",
        place_id: name,
        cid: name,
        data_id: name,
        map_url: `https://www.google.com/maps/place/${name}`,
        ...extra,
      });

    expect((await ingest(probe("Empty", { status: "" }))).row.status).toBe("unknown");
    expect((await ingest(probe("Blank", { status: "   " }))).row.status).toBe("unknown");
    expect((await ingest(probe("Zzzz", { status: "Zzzz" }))).row.status).toBe("unknown");
    // "Closed on Mondays" is an opening-hours note, but it does contain the
    // word "closed"; the honest reading is closed, never open.
    expect((await ingest(probe("Mondays", { status: "Closed on Mondays" }))).row.status).toBe("closed");
  });

  it("keeps the verbatim engine string in raw_data and never fails the ingest", async () => {
    const { row } = await ingest(enginePayload({ status: "Permanently closed" }));
    expect(row.raw_data.status).toBe("Permanently closed");
    expect(row.status).toBe("closed");
  });

  it("does not clobber a known status when a later scrape reports nothing recognizable", async () => {
    const first = await ingest(enginePayload({ status: "Permanently closed" }));
    expect(first.row.status).toBe("closed");

    // Same place seen again (same place_id/cid) with an unrecognised status.
    const second = await ingest(enginePayload({ status: "", place_id: "different-id-but-same-cid" }));
    expect(second.lead.lead_id).toBe(first.lead.lead_id);
    expect(second.row.status).toBe("closed");
  });

  it("associates each stored lead with the search so it can be displayed", async () => {
    const { lead, register } = await ingest(enginePayload({ status: "Open" }));
    expect(register.is_new_association).toBe(true);

    const associated = await db.one<{ count: string }>(
      `select count(*)::text as count from public.search_leads where search_id = $1 and lead_id = $2`,
      [searchId, lead.lead_id],
    );
    expect(associated?.count).toBe("1");

    const visible = await db.one<{ business_name: string; filtered: boolean }>(
      `select l.business_name, sl.filtered
         from public.search_leads sl join public.leads l on l.id = sl.lead_id
        where sl.search_id = $1`,
      [searchId],
    );
    expect(visible).toEqual({ business_name: "Cafe Krähe", filtered: false });

    const counters = await db.one<{ discovered_count: number; unique_count: number }>(
      `select discovered_count, unique_count from public.searches where id = $1`,
      [searchId],
    );
    expect(counters).toMatchObject({ discovered_count: 1, unique_count: 1 });
  });

  it("normalizes status inside the function, not in the caller", async () => {
    const normalized = await db.sql<{ normalize_lead_status: string | null }>(
      `select public.normalize_lead_status(v) as normalize_lead_status
         from unnest(array['Open', 'CLOSED', 'Permanently closed', 'Geöffnet', 'Opens 9 AM',
                           'opening hours may vary', '', '   ', null, 'Zzzz']) as v`,
    );
    expect(normalized.map((row) => row.normalize_lead_status)).toEqual([
      "open",
      "closed",
      "closed",
      "open",
      "closed",
      // "opening hours may vary" is not a state: "open" must not match "opening".
      null,
      null,
      null,
      null,
      null,
    ]);
  });
});
