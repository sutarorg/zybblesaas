import { route, ok } from "../_lib/http.js";
import { admin, query, rpc } from "../_lib/supabase.js";
import { entitlements } from "../_lib/entitlements.js";

type Dashboard = {
  period: { start: string; end: string };
  usage: Record<string, number | string>;
  active_searches: number;
  completed_searches: number;
  total_leads: number;
  leads_with_email: number;
  lists_count: number;
  exports_ready: number;
  unread_notifications: number;
  weekly_activity: Array<{ day: string; leads: number }>;
  recent_searches: Array<Record<string, unknown>>;
  recent_leads: Array<Record<string, unknown>>;
};

/**
 * Dashboard numbers. Everything here is aggregated in Postgres from real rows;
 * the API adds nothing but the entitlement snapshot, so the UI cannot show a
 * number the database disagrees with.
 */
export default route({ methods: ["GET"], auth: "both", scopes: ["searches:read"], limit: { bucket: "stats", perMinute: 240 } }, async (ctx) => {
  const [stats, ent] = await Promise.all([rpc<Dashboard>("dashboard_stats", { p_workspace_id: ctx.workspaceId }), entitlements(ctx.workspaceId)]);

  const recentLeads = await query<Array<{ slug: string; business_name: string; email_primary: string | null; quality_score: number; created_at: string }>>(
    admin()
      .from("leads")
      .select("slug, business_name, email_primary, quality_score, created_at, workspace_leads!inner(workspace_id)")
      .eq("workspace_leads.workspace_id", ctx.workspaceId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(5),
    "recent leads",
  );

  return ok({
    stats: { ...stats, recent_leads: recentLeads },
    entitlements: ent,
    quota: {
      leads: { used: ent.usage.leads_generated, included: ent.plan.leads_per_period, remaining: Math.max(0, ent.plan.leads_per_period - ent.usage.leads_generated) },
      ai_runs: { used: ent.usage.ai_runs, included: ent.plan.ai_runs_per_period, remaining: Math.max(0, ent.plan.ai_runs_per_period - ent.usage.ai_runs) },
      seats: { used: ent.seats_used, included: ent.plan.seats },
      concurrent_searches: { active: ent.active_searches, included: ent.plan.concurrent_searches },
      exports_created: ent.usage.exports_created,
      emails_found: ent.usage.emails_found,
    },
    generatedAt: new Date().toISOString(),
  });
});
