import { z } from "zod";
import { route, ok } from "../../_lib/http.js";
import { parse } from "../../_lib/validate.js";
import { admin, query } from "../../_lib/supabase.js";
import { audit } from "../../_lib/audit.js";
import { badRequest, notFound } from "../../_lib/errors.js";
import { toLeadListItem, toList, type LeadRow } from "../../_lib/serialize.js";

type ListRow = Parameters<typeof toList>[0];
/** `loadList` always resolves the source search slug, so links can be built. */
type LoadedList = ListRow & { source_search_slug: string | null };

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  tag: z.string().max(40).nullable().optional(),
  isArchived: z.boolean().optional(),
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add_leads"), leadIds: z.array(z.string().uuid()).min(1).max(1000) }),
  z.object({ action: z.literal("remove_leads"), leadIds: z.array(z.string().uuid()).min(1).max(1000) }),
]);

async function loadList(workspaceId: string, slug: string): Promise<LoadedList> {
  const rows = await query<Array<ListRow & { source_search: { slug: string } | null }>>(
    admin()
      .from("lists")
      .select("*, source_search:searches(slug)")
      .eq("workspace_id", workspaceId)
      .eq("slug", slug)
      .is("deleted_at", null)
      .limit(1),
    "list lookup",
  );
  const list = rows[0];
  if (!list) throw notFound("List not found");
  return { ...list, source_search_slug: list.source_search?.slug ?? null };
}

export default route(
  {
    methods: ["GET", "POST", "PATCH", "DELETE"],
    auth: "both",
    scopes: ["lists:read", "lists:write"],
    limit: { bucket: "list-detail", perMinute: 180 },
  },
  async (ctx) => {
    const slug = ctx.params.slug;
    if (!slug) throw badRequest("A list slug is required");
    const list = await loadList(ctx.workspaceId, slug);
    const method = ctx.req.method?.toUpperCase();

    if (method === "GET") {
      const limit = Math.min(200, Number(ctx.query.limit ?? 60));
      const offset = Math.max(0, Number(ctx.query.offset ?? 0));

      let builder = admin()
        .from("list_leads")
        .select("lead:leads(*), created_at", { count: "exact" })
        .eq("list_id", list.id)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (ctx.query.q) {
        const term = ctx.query.q.replace(/[%,]/g, " ").trim();
        builder = builder.or(`business_name.ilike.%${term}%,city.ilike.%${term}%,category.ilike.%${term}%`, { referencedTable: "leads" });
      }
      if (ctx.query.has_email === "true") builder = builder.not("leads.email_primary", "is", null);

      const { data, error, count } = await builder;
      if (error) throw badRequest(error.message);

      const rows = (data ?? []) as unknown as Array<{ lead: LeadRow | null }>;
      return ok({
        list: toList(list),
        items: rows.filter((row) => row.lead).map((row) => toLeadListItem(row.lead as LeadRow)),
        total: count ?? rows.length,
        limit,
        offset,
      });
    }

    if (method === "PATCH") {
      const body = parse(patchSchema, ctx.body);
      const patch: Record<string, unknown> = {};
      if (body.name !== undefined) patch.name = body.name;
      if (body.description !== undefined) patch.description = body.description;
      if (body.tag !== undefined) patch.tag = body.tag;
      if (body.isArchived !== undefined) patch.is_archived = body.isArchived;

      if (Object.keys(patch).length === 0) throw badRequest("Nothing to update");

      const rows = await query<ListRow[]>(admin().from("lists").update(patch).eq("id", list.id).select("*"), "list update");
      await audit(ctx, { action: "list.updated", targetType: "list", targetId: list.id, metadata: patch });
      return ok({ list: toList({ ...rows[0], source_search_slug: list.source_search_slug }) });
    }

    if (method === "DELETE") {
      await query(admin().from("lists").update({ deleted_at: new Date().toISOString() }).eq("id", list.id).select("id"), "list delete");
      await audit(ctx, { action: "list.deleted", targetType: "list", targetId: list.id, metadata: { slug: list.slug } });
      return ok({ deleted: true });
    }

    const body = parse(actionSchema, ctx.body);
    if (body.action === "add_leads") {
      const { error } = await admin()
        .from("list_leads")
        .upsert(
          body.leadIds.map((leadId) => ({ list_id: list.id, lead_id: leadId, workspace_id: ctx.workspaceId, added_by: ctx.caller?.userId ?? null })),
          { onConflict: "list_id,lead_id", ignoreDuplicates: true },
        );
      if (error) throw badRequest(error.message);
      await audit(ctx, { action: "list.leads_added", targetType: "list", targetId: list.id, metadata: { count: body.leadIds.length } });
      return ok({ added: body.leadIds.length });
    }

    await query(
      admin().from("list_leads").delete().eq("list_id", list.id).in("lead_id", body.leadIds).select("lead_id"),
      "list leads remove",
    );
    await audit(ctx, { action: "list.leads_removed", targetType: "list", targetId: list.id, metadata: { count: body.leadIds.length } });
    return ok({ removed: body.leadIds.length });
  },
);
