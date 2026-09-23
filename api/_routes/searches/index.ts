import { z } from "zod";
import { route, ok, created } from "../../_lib/http";
import { parse, searchConfigSchema } from "../../_lib/validate";
import { admin, query, rpc } from "../../_lib/supabase";
import {
  assertConcurrency,
  assertGridCoverage,
  assertSearchParams,
  entitlements,
  queuePriority,
  recordUsage,
} from "../../_lib/entitlements";
import { findPlace, gridCells, zoomForRadius } from "../../_lib/geo";
import { uniqueSlug } from "../../_lib/slugs";
import { enqueue } from "../../_lib/queue";
import { audit } from "../../_lib/audit";
import { badRequest, quotaExceeded } from "../../_lib/errors";
import { toJob, type EventRow, type SearchRow } from "../../_lib/serialize";

/** Gosom caps a single query at roughly 120 unique places. */
const RESULTS_PER_INPUT = 120;
const MAX_INPUTS = 24;

const createSchema = z.object({
  query: z.string().min(2).max(300),
  name: z.string().min(1).max(200).optional(),
  location: z.string().min(2).max(120).optional(),
  requestedCount: z.number().int().min(10).max(5000).optional(),
  config: searchConfigSchema.partial().optional(),
  source: z.enum(["manual", "ai"]).default("manual"),
  /** plan that the user reviewed and approved in the UI */
  aiPlan: z.record(z.string(), z.unknown()).nullable().optional(),
});

function configToJson(config: z.infer<typeof searchConfigSchema>, location: string | null) {
  return {
    depth: config.depth,
    radiusKm: config.radiusKm,
    language: config.language,
    emailExtraction: config.emailExtraction,
    fastMode: config.fastMode,
    grid: config.grid,
    gridCellKm: config.gridCellKm,
    extraReviews: config.extraReviews,
    filters: config.includeFilters,
    location,
    engine: "gosom",
  };
}

export default route(
  {
    methods: ["GET", "POST"],
    auth: "both",
    scopes: ["searches:read", "searches:write"],
    limit: { bucket: "searches", perMinute: 120 },
  },
  async (ctx) => {
    const workspaceId = ctx.workspaceId;

    if (ctx.req.method?.toUpperCase() === "GET") {
      const limit = Math.min(200, Number(ctx.query.limit ?? 50));
      const offset = Math.max(0, Number(ctx.query.offset ?? 0));
      const status = ctx.query.status;

      let builder = admin()
        .from("searches")
        .select("*", { count: "exact" })
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (status) builder = builder.eq("status", status);

      const { data, error, count } = await builder;
      if (error) throw badRequest(error.message);
      const searches = (data ?? []) as SearchRow[];

      // Recent log lines for the searches that are still moving, in one query.
      const activeIds = searches.filter((s) => s.status === "running" || s.status === "enriching" || s.status === "queued").map((s) => s.id);
      let eventsBySearch = new Map<string, EventRow[]>();
      if (activeIds.length > 0) {
        const events = await query<Array<EventRow & { search_id: string }>>(
          admin()
            .from("search_events")
            .select("id, search_id, event_type, level, message, metadata, created_at")
            .in("search_id", activeIds)
            .order("created_at", { ascending: false })
            .limit(300),
          "search events",
        );
        eventsBySearch = events.reduce((map, event) => {
          const list = map.get(event.search_id) ?? [];
          if (list.length < 12) list.push(event);
          map.set(event.search_id, list);
          return map;
        }, new Map<string, EventRow[]>());
      }

      return ok({
        items: searches.map((search) => toJob(search, (eventsBySearch.get(search.id) ?? []).reverse())),
        total: count ?? searches.length,
        limit,
        offset,
      });
    }

    const body = parse(createSchema, ctx.body);
    const config = searchConfigSchema.parse({ ...(body.config ?? {}), language: body.config?.language ?? undefined });

    const ent = await entitlements(workspaceId);
    assertSearchParams(ent.plan, config.depth, config.radiusKm);
    assertGridCoverage(ent.plan, config.grid);
    assertConcurrency(ent.plan, ent.active_searches);

    if (ent.usage.leads_generated >= ent.plan.leads_per_period) {
      throw quotaExceeded(
        `You have used all ${ent.plan.leads_per_period.toLocaleString()} leads included this month. Upgrade or wait for the next period — Zybble will not start work it cannot deliver.`,
        { used: ent.usage.leads_generated, included: ent.plan.leads_per_period, period_end: ent.usage.period_end },
      );
    }

    const locationTerm = body.location ?? inferLocation(body.query);
    if (!locationTerm) {
      throw badRequest("Tell Zybble where to search, e.g. “dentists in Berlin”");
    }
    const place = await findPlace(locationTerm);

    // How many engine passes are needed to cover the requested volume, and
    // which geo points they cover. Pure arithmetic over the resolved city.
    const requested = body.requestedCount ?? RESULTS_PER_INPUT;
    const passes = Math.max(1, Math.min(MAX_INPUTS, Math.ceil(requested / RESULTS_PER_INPUT)));
    const cells = config.grid
      ? gridCells({ latitude: place.latitude, longitude: place.longitude }, config.radiusKm, config.gridCellKm, 144)
      : gridCells({ latitude: place.latitude, longitude: place.longitude }, passRadius(config.radiusKm, passes), passCellKm(config.radiusKm, passes), passes);

    const slug = await uniqueSlug("searches", body.name ?? `${body.query} ${place.name}`);
    const name = body.name ?? `${body.query} · ${place.name}`;

    const search = await query<SearchRow[]>(
      admin()
        .from("searches")
        .insert({
          slug,
          workspace_id: workspaceId,
          created_by: ctx.caller?.userId ?? null,
          name,
          query: body.query,
          location: place.name,
          language: config.language,
          status: "queued",
          phase: "queued",
          search_config: configToJson(config, place.name),
          ai_plan: body.aiPlan ?? null,
          requested_count: cells.length * RESULTS_PER_INPUT,
          source: body.source,
          engine_version: null,
        })
        .select("*"),
      "search insert",
    );

    const searchRow = search[0];
    if (!searchRow) throw badRequest("Search could not be created");

    const inputs = cells.map((cell, index) => ({
      search_id: searchRow.id,
      workspace_id: workspaceId,
      seq: index + 1,
      query_text: body.query,
      geo_lat: cell.lat,
      geo_lon: cell.lon,
      zoom: zoomForRadius(config.radiusKm),
      radius_m: Math.round(config.radiusKm * 1000),
      grid_cell: cell.label,
      status: "pending" as const,
    }));

    const insertedInputs = await query<Array<{ id: string; seq: number }>>(
      admin().from("search_inputs").insert(inputs).select("id, seq"),
      "search inputs insert",
    );

    const priority = queuePriority(ent.plan);
    for (const input of insertedInputs) {
      await enqueue({
        jobType: "scrape",
        workspaceId,
        payload: { search_id: searchRow.id, input_id: input.id, seq: input.seq },
        priority,
        dedupeKey: `search:${searchRow.id}:input:${input.id}`,
        scheduledBy: ctx.caller?.via === "api_key" ? "api_key" : "api",
      });
    }

    await recordUsage(workspaceId, "search_created", { refType: "search", refId: searchRow.id, dedupeKey: `search-created:${searchRow.id}` });
    await rpc("search_event", {
      p_search_id: searchRow.id,
      p_event_type: "queued",
      p_message: `Search queued — ${inputs.length} engine pass${inputs.length === 1 ? "" : "es"} over ${place.name}`,
      p_level: "info",
      p_metadata: { inputs: inputs.length, email_extraction: config.emailExtraction, fast_mode: config.fastMode },
    });
    await audit(ctx, {
      action: "search.created",
      targetType: "search",
      targetId: searchRow.id,
      metadata: { query: body.query, location: place.name, inputs: inputs.length, source: body.source },
    });

    return created({ search: toJob(searchRow) });
  },
);

function inferLocation(query: string): string | null {
  const match = query.match(/\bin\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .'-]{1,60})$/);
  return match ? match[1].trim() : null;
}

/** One pass covers a radius that grows with the requested volume. */
function passRadius(radiusKm: number, passes: number): number {
  return passes <= 1 ? radiusKm : radiusKm;
}

function passCellKm(radiusKm: number, passes: number): number {
  if (passes <= 1) return radiusKm * 2;
  return (radiusKm * 2) / Math.ceil(Math.sqrt(passes));
}
