import { z } from "zod";
import { route, ok } from "../../_lib/http.js";
import { parse } from "../../_lib/validate.js";
import { admin, query, rpc } from "../../_lib/supabase.js";
import { entitlements } from "../../_lib/entitlements.js";
import { uniqueSlug } from "../../_lib/slugs.js";
import { enqueue } from "../../_lib/queue.js";
import { audit } from "../../_lib/audit.js";
import { badRequest, conflict, notFound } from "../../_lib/errors.js";
import { toJob, toLeadListItem, type EventRow, type LeadRow, type SearchRow } from "../../_lib/serialize.js";

const actionSchema = z.object({
  action: z.enum(["pause", "resume", "cancel", "rerun"]),
});

async function loadSearch(workspaceId: string, slug: string): Promise<SearchRow> {
  const rows = await query<SearchRow[]>(
    admin().from("searches").select("*").eq("workspace_id", workspaceId).eq("slug", slug).is("deleted_at", null).limit(1),
    "search lookup",
  );
  const search = rows[0];
  if (!search) throw notFound("Search not found");
  return search;
}

export default route(
  {
    methods: ["GET", "POST", "PATCH", "DELETE"],
    auth: "both",
    scopes: ["searches:read", "searches:write"],
    limit: { bucket: "search-detail", perMinute: 240 },
  },
  async (ctx) => {
    const slug = ctx.params.slug;
    if (!slug) throw badRequest("A search slug is required");
    const search = await loadSearch(ctx.workspaceId, slug);
    const method = ctx.req.method?.toUpperCase();

    if (method === "GET") {
      const inputs = await query<Array<{ id: string; seq: number; query_text: string; status: string; grid_cell: string | null; places_discovered: number; places_completed: number; last_error: string | null }>>(
        admin()
          .from("search_inputs")
          .select("id, seq, query_text, status, grid_cell, places_discovered, places_completed, last_error")
          .eq("search_id", search.id)
          .order("seq", { ascending: true }),
        "search inputs",
      );

      const events = await query<EventRow[]>(
        admin()
          .from("search_events")
          .select("id, event_type, level, message, metadata, created_at")
          .eq("search_id", search.id)
          .order("created_at", { ascending: false })
          .limit(60),
        "search events",
      );

      const preview = await query<Array<{ lead: LeadRow[] }>>(
        admin()
          .from("search_leads")
          .select("lead:leads(*)")
          .eq("search_id", search.id)
          .eq("filtered", false)
          .order("first_seen_at", { ascending: false })
          .limit(12),
        "search leads",
      );

      return ok({
        search: toJob(search, events.reverse()),
        inputs,
        events: events.map((event) => ({
          id: event.id,
          type: event.event_type,
          level: event.level,
          message: event.message,
          metadata: event.metadata,
          at: event.created_at,
        })),
        leads: preview.flatMap((row) => row.lead ?? []).map((row) => toLeadListItem(row)),
        pendingInputs: inputs.filter((input) => input.status === "pending" || input.status === "running").length,
      });
    }

    if (method === "PATCH") {
      const body = parse(z.object({ name: z.string().min(1).max(200).optional() }), ctx.body);
      if (!body.name) throw badRequest("Nothing to update");
      const updated = await query<SearchRow[]>(
        admin().from("searches").update({ name: body.name }).eq("id", search.id).select("*"),
        "search rename",
      );
      await audit(ctx, { action: "search.renamed", targetType: "search", targetId: search.id, metadata: { name: body.name } });
      return ok({ search: toJob(updated[0]) });
    }

    if (method === "DELETE") {
      if (search.status === "running" || search.status === "enriching" || search.status === "queued") {
        throw conflict("Cancel the search before deleting it");
      }
      await query(
        admin().from("searches").update({ deleted_at: new Date().toISOString() }).eq("id", search.id).select("id"),
        "search delete",
      );
      await audit(ctx, { action: "search.deleted", targetType: "search", targetId: search.id, metadata: { slug: search.slug } });
      return ok({ deleted: true });
    }

    const { action } = parse(actionSchema, ctx.body);
    const now = new Date().toISOString();

    if (action === "pause") {
      if (search.status !== "running" && search.status !== "enriching" && search.status !== "queued") {
        throw conflict(`A ${search.status} search cannot be paused`);
      }
      await rpc("queue_cancel_search", { p_search_id: search.id, p_job_types: ["scrape", "email_enrichment"] });
      const paused = await query<SearchRow[]>(
        admin()
          .from("searches")
          .update({ status: "paused", phase: "paused", paused_at: now })
          .eq("id", search.id)
          .select("*"),
        "search pause",
      );
      await rpc("search_event", {
        p_search_id: search.id,
        p_event_type: "paused",
        p_message: "Paused by user — completed work is kept and the run resumes where it stopped",
        p_level: "warning",
        p_metadata: {},
      });
      await audit(ctx, { action: "search.paused", targetType: "search", targetId: search.id });
      return ok({ search: toJob(paused[0]) });
    }

    if (action === "resume") {
      if (search.status !== "paused") throw conflict("Only a paused search can be resumed");
      const inputs = await query<Array<{ id: string; seq: number }>>(
        admin()
          .from("search_inputs")
          .select("id, seq")
          .eq("search_id", search.id)
          .in("status", ["pending", "running"])
          .order("seq", { ascending: true }),
        "resume inputs",
      );
      if (inputs.length === 0) throw conflict("Every engine pass for this search is already finished");

      const ent = await entitlements(ctx.workspaceId);
      for (const input of inputs) {
        await enqueue({
          jobType: "scrape",
          workspaceId: ctx.workspaceId,
          payload: { search_id: search.id, input_id: input.id, seq: input.seq },
          priority: ent.plan.queue_priority,
          dedupeKey: `search:${search.id}:input:${input.id}`,
        });
      }
      const resumed = await query<SearchRow[]>(
        admin()
          .from("searches")
          .update({ status: "running", phase: "scraping", paused_at: null, last_progress_at: now })
          .eq("id", search.id)
          .select("*"),
        "search resume",
      );
      await rpc("search_event", {
        p_search_id: search.id,
        p_event_type: "resumed",
        p_message: `Resumed — ${inputs.length} unfinished engine pass${inputs.length === 1 ? "" : "es"} re-queued`,
        p_level: "info",
        p_metadata: { inputs: inputs.length },
      });
      await audit(ctx, { action: "search.resumed", targetType: "search", targetId: search.id, metadata: { inputs: inputs.length } });
      return ok({ search: toJob(resumed[0]) });
    }

    if (action === "cancel") {
      if (search.status === "completed" || search.status === "cancelled") throw conflict("This search is already finished");
      await rpc("queue_cancel_search", { p_search_id: search.id, p_job_types: ["scrape", "email_enrichment"] });
      const cancelled = await query<SearchRow[]>(
        admin()
          .from("searches")
          .update({ status: "cancelled", phase: "cancelled", cancelled_at: now })
          .eq("id", search.id)
          .select("*"),
        "search cancel",
      );
      await rpc("search_event", {
        p_search_id: search.id,
        p_event_type: "cancelled",
        p_message: "Cancelled by user — pending passes dropped, discovered leads kept",
        p_level: "warning",
        p_metadata: {},
      });
      await audit(ctx, { action: "search.cancelled", targetType: "search", targetId: search.id });
      return ok({ search: toJob(cancelled[0]) });
    }

    // rerun: a brand new search with the same configuration and inputs
    const inputs = await query<Array<{ seq: number; query_text: string; geo_lat: number; geo_lon: number; zoom: number; radius_m: number; grid_cell: string | null }>>(
      admin()
        .from("search_inputs")
        .select("seq, query_text, geo_lat, geo_lon, zoom, radius_m, grid_cell")
        .eq("search_id", search.id)
        .order("seq", { ascending: true }),
      "rerun inputs",
    );
    if (inputs.length === 0) throw conflict("This search has no engine passes to repeat");

    const ent = await entitlements(ctx.workspaceId);
    const slugValue = await uniqueSlug("searches", `${search.name} rerun`);

    const createdRows = await query<SearchRow[]>(
      admin()
        .from("searches")
        .insert({
          slug: slugValue,
          workspace_id: ctx.workspaceId,
          created_by: ctx.caller?.userId ?? null,
          name: `${search.name} (rerun)`,
          query: search.query,
          location: search.location,
          language: search.language,
          status: "queued",
          phase: "queued",
          search_config: search.search_config,
          ai_plan: search.ai_plan,
          requested_count: search.requested_count,
          source: "rerun",
          rerun_of: search.id,
        })
        .select("*"),
      "rerun insert",
    );
    const rerun = createdRows[0];
    if (!rerun) throw badRequest("Rerun could not be created");

    const inserted = await query<Array<{ id: string; seq: number }>>(
      admin()
        .from("search_inputs")
        .insert(inputs.map((input) => ({ ...input, search_id: rerun.id, workspace_id: ctx.workspaceId, status: "pending" })))
        .select("id, seq"),
      "rerun inputs insert",
    );

    for (const input of inserted) {
      await enqueue({
        jobType: "scrape",
        workspaceId: ctx.workspaceId,
        payload: { search_id: rerun.id, input_id: input.id, seq: input.seq },
        priority: ent.plan.queue_priority,
        dedupeKey: `search:${rerun.id}:input:${input.id}`,
      });
    }

    await rpc("search_event", {
      p_search_id: rerun.id,
      p_event_type: "queued",
      p_message: `Re-run queued — ${inserted.length} engine pass${inserted.length === 1 ? "" : "es"}, previous run kept`,
      p_level: "info",
      p_metadata: { rerun_of: search.id },
    });
    await audit(ctx, { action: "search.rerun", targetType: "search", targetId: rerun.id, metadata: { rerun_of: search.id } });

    return ok({ search: toJob(rerun) });
  },
);
