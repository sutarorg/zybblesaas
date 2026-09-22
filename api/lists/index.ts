import { z } from "zod";
import { route, ok, created } from "../_lib/http";
import { parse } from "../_lib/validate";
import { admin, query } from "../_lib/supabase";
import { uniqueSlug } from "../_lib/slugs";
import { audit } from "../_lib/audit";
import { badRequest, conflict } from "../_lib/errors";
import { toList } from "../_lib/serialize";

type ListRow = Parameters<typeof toList>[0];

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  tag: z.string().max(40).optional(),
  color: z.string().max(20).optional(),
  sourceSearchId: z.string().uuid().optional(),
  /** optionally seed the list from a search's leads */
  leadIds: z.array(z.string().uuid()).max(500).optional(),
});

export default route(
  { methods: ["GET", "POST"], auth: "both", scopes: ["lists:read", "lists:write"], limit: { bucket: "lists", perMinute: 120 } },
  async (ctx) => {
    if (ctx.req.method?.toUpperCase() === "GET") {
      const rows = await query<Array<ListRow & { source_search: { slug: string } | null }>>(
        admin()
          .from("lists")
          .select("*, source_search:searches(slug)")
          .eq("workspace_id", ctx.workspaceId)
          .is("deleted_at", null)
          .order("updated_at", { ascending: false })
          .limit(200),
        "list query",
      );
      return ok({
        items: rows.map((row) => toList({ ...row, source_search_slug: row.source_search?.slug ?? null })),
        total: rows.length,
      });
    }

    const body = parse(createSchema, ctx.body);
    const slug = await uniqueSlug("lists", body.name);

    const rows = await query<ListRow[]>(
      admin()
        .from("lists")
        .insert({
          slug,
          workspace_id: ctx.workspaceId,
          created_by: ctx.caller?.userId ?? null,
          name: body.name,
          description: body.description ?? null,
          tag: body.tag ?? null,
          color: body.color ?? null,
          source_search_id: body.sourceSearchId ?? null,
        })
        .select("*"),
      "list insert",
    );
    const list = rows[0];
    if (!list) throw badRequest("List could not be created");

    if (body.leadIds && body.leadIds.length > 0) {
      const { error } = await admin()
        .from("list_leads")
        .upsert(
          body.leadIds.map((leadId) => ({
            list_id: list.id,
            lead_id: leadId,
            workspace_id: ctx.workspaceId,
            added_by: ctx.caller?.userId ?? null,
          })),
          { onConflict: "list_id,lead_id", ignoreDuplicates: true },
        );
      if (error) throw conflict(error.message);
    }

    let sourceSearchSlug: string | null = null;
    if (list.source_search_id) {
      const sources = await query<Array<{ slug: string }>>(
        admin().from("searches").select("slug").eq("id", list.source_search_id).limit(1),
        "list source search",
      );
      sourceSearchSlug = sources[0]?.slug ?? null;
    }

    await audit(ctx, { action: "list.created", targetType: "list", targetId: list.id, metadata: { name: body.name, seeded: body.leadIds?.length ?? 0 } });
    return created({ list: toList({ ...list, source_search_slug: sourceSearchSlug }) });
  },
);
