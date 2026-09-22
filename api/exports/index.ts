import { z } from "zod";
import { route, ok, created } from "../_lib/http";
import { parse } from "../_lib/validate";
import { admin, query } from "../_lib/supabase";
import { entitlements, recordUsage } from "../_lib/entitlements";
import { uniqueSlug } from "../_lib/slugs";
import { enqueue } from "../_lib/queue";
import { audit } from "../_lib/audit";
import { badRequest, planRequired } from "../_lib/errors";
import { toExport } from "../_lib/serialize";

type ExportRow = Parameters<typeof toExport>[0];

const createSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  format: z.enum(["csv", "json"]).default("csv"),
  sourceType: z.enum(["search", "list", "filter", "all"]).default("search"),
  sourceId: z.string().uuid().optional(),
  filters: z
    .object({
      q: z.string().max(160).optional(),
      city: z.string().max(120).optional(),
      category: z.string().max(120).optional(),
      hasEmail: z.boolean().optional(),
      minRating: z.number().min(0).max(5).optional(),
      minScore: z.number().min(0).max(100).optional(),
    })
    .default({}),
  columns: z.array(z.string().max(60)).max(60).optional(),
});

export default route(
  { methods: ["GET", "POST"], auth: "both", scopes: ["exports:read", "exports:write"], limit: { bucket: "exports", perMinute: 60 } },
  async (ctx) => {
    if (ctx.req.method?.toUpperCase() === "GET") {
      const rows = await query<ExportRow[]>(
        admin()
          .from("exports")
          .select("*")
          .eq("workspace_id", ctx.workspaceId)
          .neq("status", "deleted")
          .order("created_at", { ascending: false })
          .limit(100),
        "export list",
      );
      return ok({ items: rows.map(toExport), total: rows.length });
    }

    const body = parse(createSchema, ctx.body);
    const ent = await entitlements(ctx.workspaceId);

    if (!ent.plan.export_formats.includes(body.format)) {
      throw planRequired(`The ${ent.plan.name} plan exports ${ent.plan.export_formats.join(" and ")} only`, {
        plan: ent.plan.code,
        formats: ent.plan.export_formats,
      });
    }

    if (body.sourceId) {
      const table = body.sourceType === "list" ? "lists" : "searches";
      const source = await query<Array<{ id: string; name: string }>>(
        admin().from(table).select("id, name").eq("id", body.sourceId).eq("workspace_id", ctx.workspaceId).limit(1),
        "export source",
      );
      if (!source[0]) throw badRequest("The export source does not exist in this workspace");
    }

    const defaultName = `zybble-${body.sourceType}-${new Date().toISOString().slice(0, 10)}`;
    const name = body.name ?? defaultName;
    const slug = await uniqueSlug("exports", name);

    const rows = await query<ExportRow[]>(
      admin()
        .from("exports")
        .insert({
          slug,
          workspace_id: ctx.workspaceId,
          created_by: ctx.caller?.userId ?? null,
          name,
          format: body.format,
          status: "queued",
          source_type: body.sourceType,
          source_id: body.sourceId ?? null,
          filters: body.filters,
          columns: body.columns ?? null,
        })
        .select("*"),
      "export insert",
    );
    const exportRow = rows[0];
    if (!exportRow) throw badRequest("Export could not be queued");

    await enqueue({
      jobType: "export",
      workspaceId: ctx.workspaceId,
      payload: { export_id: exportRow.id, workspace_id: ctx.workspaceId },
      priority: ent.plan.priority_queue ? 80 : 40,
      dedupeKey: `export:${exportRow.id}`,
      scheduledBy: ctx.caller?.via === "api_key" ? "api_key" : "api",
    });

    await recordUsage(ctx.workspaceId, "export_created", {
      refType: "export",
      refId: exportRow.id,
      dedupeKey: `export-created:${exportRow.id}`,
    });
    await audit(ctx, { action: "export.requested", targetType: "export", targetId: exportRow.id, metadata: { format: body.format, source: body.sourceType } });

    return created({ export: toExport(exportRow) });
  },
);
