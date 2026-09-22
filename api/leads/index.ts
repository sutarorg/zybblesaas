import { route, ok } from "../_lib/http";
import { admin, query } from "../_lib/supabase";
import { badRequest } from "../_lib/errors";
import { toLeadListItem, type LeadRow } from "../_lib/serialize";

const SORTS: Record<string, { column: string; ascending: boolean }> = {
  newest: { column: "first_seen_at", ascending: false },
  oldest: { column: "first_seen_at", ascending: true },
  rating: { column: "rating", ascending: false },
  reviews: { column: "review_count", ascending: false },
  quality: { column: "quality_score", ascending: false },
  name: { column: "business_name", ascending: true },
};

export default route(
  {
    methods: ["GET"],
    auth: "both",
    scopes: ["leads:read"],
    limit: { bucket: "leads", perMinute: 300 },
  },
  async (ctx) => {
    const limit = Math.min(200, Number(ctx.query.limit ?? 50));
    const offset = Math.max(0, Number(ctx.query.offset ?? 0));
    const sort = SORTS[ctx.query.sort ?? "newest"];
    if (!sort) throw badRequest(`Unknown sort “${ctx.query.sort}”`);

    // Leads are canonical rows; a workspace sees the ones it is associated with.
    let builder = admin()
      .from("leads")
      .select("*, workspace_leads!inner(workspace_id, first_seen_at, billable)", { count: "exact" })
      .eq("workspace_leads.workspace_id", ctx.workspaceId)
      .is("deleted_at", null)
      .order(sort.column, { ascending: sort.ascending })
      .range(offset, offset + limit - 1);

    const q = ctx.query.q;
    if (q) {
      const term = q.replace(/[%,]/g, " ").trim();
      builder = builder.or(`business_name.ilike.%${term}%,city.ilike.%${term}%,category.ilike.%${term}%,domain.ilike.%${term}%`);
    }
    if (ctx.query.city) builder = builder.ilike("city", `%${ctx.query.city}%`);
    if (ctx.query.country) builder = builder.eq("country_code", ctx.query.country.toUpperCase());
    if (ctx.query.category) builder = builder.ilike("category", `%${ctx.query.category}%`);
    if (ctx.query.has_email === "true") builder = builder.not("email_primary", "is", null);
    if (ctx.query.has_phone === "true") builder = builder.not("phone", "is", null);
    if (ctx.query.has_website === "true") builder = builder.not("website", "is", null);
    if (ctx.query.min_rating) builder = builder.gte("rating", Number(ctx.query.min_rating));
    if (ctx.query.min_score) builder = builder.gte("quality_score", Number(ctx.query.min_score));

    const { data, error, count } = await builder;
    if (error) throw badRequest(error.message);

    const rows = (data ?? []) as Array<LeadRow & { workspace_leads: Array<{ first_seen_at: string; billable: boolean }> }>;
    return ok({
      items: rows.map((row) => ({
        ...toLeadListItem({ ...row, first_seen_at: row.workspace_leads?.[0]?.first_seen_at ?? row.first_seen_at }),
        billable: Boolean(row.workspace_leads?.[0]?.billable),
      })),
      total: count ?? rows.length,
      limit,
      offset,
    });
  },
);

export async function leadBelongsToWorkspace(workspaceId: string, slug: string): Promise<LeadRow | null> {
  const rows = await query<LeadRow[]>(
    admin()
      .from("leads")
      .select("*, workspace_leads!inner(workspace_id)")
      .eq("workspace_leads.workspace_id", workspaceId)
      .eq("slug", slug)
      .is("deleted_at", null)
      .limit(1),
    "lead lookup",
  );
  return rows[0] ?? null;
}
