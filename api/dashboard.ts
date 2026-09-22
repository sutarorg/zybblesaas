import { route, ok } from "./_lib/http";
import { rpc } from "./_lib/supabase";
import { entitlements } from "./_lib/entitlements";

export type DashboardStats = {
  period: { start: string; end: string };
  usage: {
    period_start: string;
    period_end: string;
    leads_generated: number;
    searches_created: number;
    ai_runs: number;
    exports_created: number;
    emails_found: number;
  };
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
 * One round trip for the dashboard: every number comes from Postgres
 * aggregates over real rows (no client-side estimation, no placeholders).
 */
export default route(
  { methods: ["GET"], auth: "both", scopes: ["searches:read"], limit: { bucket: "dashboard", perMinute: 600 } },
  async (ctx) => {
    const [stats, ent] = await Promise.all([
      rpc<DashboardStats>("dashboard_stats", { p_workspace_id: ctx.workspaceId }),
      entitlements(ctx.workspaceId),
    ]);

    return ok({
      stats,
      entitlements: ent,
      quota: {
        leads: { used: ent.usage.leads_generated, included: ent.plan.leads_per_period },
        ai_runs: { used: ent.usage.ai_runs, included: ent.plan.ai_runs_per_period },
        seats: { used: ent.seats_used, included: ent.plan.seats },
        searches: { active: ent.active_searches, concurrent: ent.plan.concurrent_searches },
      },
      generatedAt: new Date().toISOString(),
    });
  },
);
