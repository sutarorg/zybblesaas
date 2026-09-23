import { z } from "zod";
import { route, created } from "../../_lib/http";
import { parse } from "../../_lib/validate";
import { admin, query } from "../../_lib/supabase";
import { assertAiEnabled, entitlements, queuePriority } from "../../_lib/entitlements";
import { enqueue } from "../../_lib/queue";
import { audit } from "../../_lib/audit";
import { badRequest, notFound, quotaExceeded } from "../../_lib/errors";

const bodySchema = z
  .object({
    listSlug: z.string().max(200).optional(),
    leadSlugs: z.array(z.string().max(200)).max(500).optional(),
    force: z.boolean().default(false),
  })
  .refine((value) => Boolean(value.listSlug) !== Boolean(value.leadSlugs?.length), {
    message: "Provide either listSlug or leadSlugs",
  });

const BATCH = 10;

/**
 * Scoring runs in the worker (one durable job per batch of leads) because a
 * large list must not be tied to a browser request. Quota is checked up front
 * against real remaining runs, so the API never queues work it cannot pay for.
 */
export default route(
  { methods: ["POST"], auth: "both", scopes: ["leads:write"], limit: { bucket: "ai-score", perMinute: 20 } },
  async (ctx) => {
    const body = parse(bodySchema, ctx.body);
    const ent = await entitlements(ctx.workspaceId);
    assertAiEnabled(ent.plan);

    let leadIds: string[] = [];

    if (body.listSlug) {
      const lists = await query<Array<{ id: string; name: string }>>(
        admin()
          .from("lists")
          .select("id, name")
          .eq("workspace_id", ctx.workspaceId)
          .eq("slug", body.listSlug)
          .is("deleted_at", null)
          .limit(1),
        "score list lookup",
      );
      const list = lists[0];
      if (!list) throw notFound("List not found");

      const rows = await query<Array<{ lead_id: string }>>(
        admin().from("list_leads").select("lead_id").eq("list_id", list.id).eq("workspace_id", ctx.workspaceId).limit(5000),
        "score list leads",
      );
      leadIds = rows.map((row) => row.lead_id);
    } else {
      const rows = await query<Array<{ id: string }>>(
        admin()
          .from("leads")
          .select("id, workspace_leads!inner(workspace_id)")
          .eq("workspace_leads.workspace_id", ctx.workspaceId)
          .in("slug", body.leadSlugs ?? [])
          .limit(500),
        "score lead lookup",
      );
      leadIds = rows.map((row) => row.id);
      if (leadIds.length === 0) throw notFound("None of those leads belong to this workspace");
    }

    if (leadIds.length === 0) throw badRequest("There is nothing to score in that selection");

    // Skip leads that already have a fresh analysis unless force=true.
    let candidates = leadIds;
    if (!body.force) {
      const existing = await query<Array<{ lead_id: string }>>(
        admin()
          .from("lead_ai_analyses")
          .select("lead_id")
          .eq("workspace_id", ctx.workspaceId)
          .in("lead_id", leadIds)
          .eq("status", "ready")
          .limit(5000),
        "score existing analyses",
      );
      const scored = new Set(existing.map((row) => row.lead_id));
      candidates = leadIds.filter((id) => !scored.has(id));
    }

    if (candidates.length === 0) {
      return created({ queued: 0, skipped: leadIds.length, note: "Every lead in that selection already has a current analysis." });
    }

    const remaining = ent.plan.ai_runs_per_period - ent.usage.ai_runs;
    if (remaining < candidates.length) {
      throw quotaExceeded(
        `Scoring ${candidates.length} leads needs ${candidates.length} AI runs but only ${Math.max(0, remaining)} remain this period.`,
        { requested: candidates.length, remaining: Math.max(0, remaining), included: ent.plan.ai_runs_per_period, upgrade: "/billing" },
      );
    }

    const priority = queuePriority(ent.plan);
    const jobIds: string[] = [];
    for (let index = 0; index < candidates.length; index += BATCH) {
      const batch = candidates.slice(index, index + BATCH);
      const id = await enqueue({
        jobType: "ai_lead_scoring",
        workspaceId: ctx.workspaceId,
        priority,
        payload: { workspace_id: ctx.workspaceId, lead_ids: batch, model: null, force: body.force },
        dedupeKey: `score:${ctx.workspaceId}:${batch.sort().join(",")}`,
        scheduledBy: ctx.caller?.via === "api_key" ? "api_key" : "api",
      });
      if (id) jobIds.push(id);
    }

    await audit(ctx, {
      action: "ai.scoring_queued",
      targetType: "workspace",
      targetId: ctx.workspaceId,
      metadata: { leads: candidates.length, batches: jobIds.length, list: body.listSlug ?? null },
    });

    return created({
      queued: candidates.length,
      skipped: leadIds.length - candidates.length,
      batches: jobIds.length,
      jobIds,
      quota: { used: ent.usage.ai_runs, included: ent.plan.ai_runs_per_period },
      note: "Scoring runs in the background; results appear on each lead and in the list as they finish.",
    });
  },
);
