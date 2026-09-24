import { rpc } from "./supabase.js";
import { quotaExceeded, planRequired, notFound } from "./errors.js";
import { features } from "./env.js";

export type PlanSnapshot = {
  id: string;
  code: string;
  name: string;
  price_minor: number;
  currency: string;
  leads_per_period: number;
  ai_runs_per_period: number;
  seats: number;
  concurrent_searches: number;
  max_search_depth: number;
  max_radius_km: number;
  queue_priority: number;
  ai_enabled: boolean;
  api_access: boolean;
  grid_coverage: boolean;
  priority_queue: boolean;
  export_formats: string[];
  export_retention_days: number;
  trial_days: number;
  features: Record<string, unknown>;
};

export type SubscriptionSnapshot = {
  id: string;
  status: string;
  razorpay_subscription_id: string | null;
  razorpay_plan_id: string | null;
  currency: string;
  amount_minor: number;
  current_start: string | null;
  current_end: string | null;
  cancel_at_cycle_end: boolean;
  razorpay_customer_id: string | null;
  paid_count: number;
  remaining_count: number | null;
} | null;

export type UsageSnapshot = {
  period_start: string;
  period_end: string;
  leads_generated: number;
  searches_created: number;
  ai_runs: number;
  exports_created: number;
  emails_found: number;
};

export type Entitlements = {
  workspace: { id: string; name: string; slug: string; created_at: string };
  plan: PlanSnapshot;
  subscription: SubscriptionSnapshot;
  usage: UsageSnapshot;
  seats_used: number;
  active_searches: number;
};

export async function entitlements(workspaceId: string): Promise<Entitlements> {
  const data = await rpc<Entitlements | null>("workspace_entitlements", { p_workspace_id: workspaceId });
  if (!data || !data.plan) throw notFound("Workspace not found");
  return data;
}

export type UsageKind = "lead_generated" | "search_created" | "ai_run" | "export_created" | "email_found";

export const usageField: Record<UsageKind, keyof UsageSnapshot> = {
  lead_generated: "leads_generated",
  search_created: "searches_created",
  ai_run: "ai_runs",
  export_created: "exports_created",
  email_found: "emails_found",
};

export function planLimit(plan: PlanSnapshot, kind: UsageKind): number {
  switch (kind) {
    case "lead_generated":
      return plan.leads_per_period;
    case "ai_run":
      return plan.ai_runs_per_period;
    default:
      // searches and exports are governed by concurrency / retention rules,
      // not by a monthly count
      return -1;
  }
}

/**
 * Atomically reserve quota. Returns false when the workspace has exhausted the
 * plan for the current period — callers must refuse the work instead of
 * pretending it started.
 */
export async function reserveUsage(
  workspaceId: string,
  kind: UsageKind,
  limit: number,
  options: { quantity?: number; dedupeKey?: string; refType?: string; refId?: string; metadata?: Record<string, unknown> } = {},
): Promise<boolean> {
  return rpc<boolean>("usage_reserve", {
    p_workspace_id: workspaceId,
    p_kind: kind,
    p_limit: limit < 0 ? null : limit,
    p_quantity: options.quantity ?? 1,
    p_dedupe_key: options.dedupeKey ?? null,
    p_ref_type: options.refType ?? null,
    p_ref_id: options.refId ?? null,
    p_metadata: options.metadata ?? {},
  });
}

export async function recordUsage(
  workspaceId: string,
  kind: UsageKind,
  options: { quantity?: number; dedupeKey?: string; refType?: string; refId?: string; metadata?: Record<string, unknown> } = {},
): Promise<boolean> {
  return rpc<boolean>("usage_record", {
    p_workspace_id: workspaceId,
    p_kind: kind,
    p_quantity: options.quantity ?? 1,
    p_dedupe_key: options.dedupeKey ?? null,
    p_ref_type: options.refType ?? null,
    p_ref_id: options.refId ?? null,
    p_metadata: options.metadata ?? {},
  });
}

/** Plan gates used by the API before doing expensive work. */
export function assertAiEnabled(plan: PlanSnapshot): void {
  if (!features().ai) {
    throw planRequired("AI features are not configured on this deployment", { reason: "provider_not_configured" });
  }
  if (!plan.ai_enabled) {
    throw planRequired(`AI assistance is not included in the ${plan.name} plan`, { plan: plan.code, upgrade: "/billing" });
  }
}

export function assertGridCoverage(plan: PlanSnapshot, requested: boolean): void {
  if (requested && !plan.grid_coverage) {
    throw planRequired(`Grid coverage is not included in the ${plan.name} plan`, { plan: plan.code, upgrade: "/billing" });
  }
}

export function assertSearchParams(plan: PlanSnapshot, depth: number, radiusKm: number): void {
  if (depth > plan.max_search_depth) {
    throw planRequired(`Depth ${depth} exceeds the ${plan.name} plan limit of ${plan.max_search_depth}`, {
      plan: plan.code,
      max_depth: plan.max_search_depth,
    });
  }
  if (radiusKm > plan.max_radius_km) {
    throw planRequired(`Radius ${radiusKm} km exceeds the ${plan.name} plan limit of ${plan.max_radius_km} km`, {
      plan: plan.code,
      max_radius_km: plan.max_radius_km,
    });
  }
}

export function assertConcurrency(plan: PlanSnapshot, activeSearches: number): void {
  if (activeSearches >= plan.concurrent_searches) {
    throw quotaExceeded(
      `Your plan allows ${plan.concurrent_searches} concurrent searches — wait for one to finish or upgrade`,
      { plan: plan.code, concurrent_searches: plan.concurrent_searches, active: activeSearches },
    );
  }
}

export async function quotaSummary(workspaceId: string) {
  const ent = await entitlements(workspaceId);
  return {
    plan: ent.plan.code,
    period: { start: ent.usage.period_start, end: ent.usage.period_end },
    leads: { used: ent.usage.leads_generated, included: ent.plan.leads_per_period },
    ai_runs: { used: ent.usage.ai_runs, included: ent.plan.ai_runs_per_period },
    exports_created: ent.usage.exports_created,
    seats: { used: ent.seats_used, included: ent.plan.seats },
  };
}

/** Queue priority for new work: paid plans jump ahead, never below 0. */
export function queuePriority(plan: PlanSnapshot): number {
  return Math.max(0, Math.min(1000, plan.queue_priority));
}
