import { admin, query } from "./supabase";
import { env } from "./env";
import { notFound, planRequired } from "./errors";
import { razorpay } from "./razorpay";

export type PlanRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price_minor: number;
  currency: string;
  billing_interval: "day" | "week" | "month" | "year";
  billing_interval_count: number;
  trial_days: number;
  razorpay_plan_id: string | null;
  is_public: boolean;
  is_active: boolean;
  sort_order: number;
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
  best_export_format: string;
  export_retention_days: number;
  features: unknown;
};

export function publicPlan(plan: PlanRow) {
  return {
    code: plan.code,
    name: plan.name,
    description: plan.description,
    price_minor: plan.price_minor,
    currency: plan.currency,
    billing_interval: plan.billing_interval,
    billing_interval_count: plan.billing_interval_count,
    trial_days: plan.trial_days,
    limits: {
      leads_per_period: plan.leads_per_period,
      ai_runs_per_period: plan.ai_runs_per_period,
      seats: plan.seats,
      concurrent_searches: plan.concurrent_searches,
      max_search_depth: plan.max_search_depth,
      max_radius_km: plan.max_radius_km,
      export_formats: plan.export_formats,
      export_retention_days: plan.export_retention_days,
    },
    features: plan.features,
    purchasable: plan.price_minor > 0,
  };
}

export async function listPlans(includePrivate = false): Promise<PlanRow[]> {
  let builder = admin().from("plans").select("*").eq("is_active", true).order("sort_order", { ascending: true });
  if (!includePrivate) builder = builder.eq("is_public", true);
  return query<PlanRow[]>(builder, "plan list");
}

export async function planByCode(code: string): Promise<PlanRow> {
  const rows = await query<PlanRow[]>(admin().from("plans").select("*").eq("code", code).limit(1), "plan lookup");
  if (!rows[0]) throw notFound(`Unknown plan “${code}”`);
  return rows[0];
}

/**
 * Razorpay plans are immutable, so Zybble creates one per paid Zybble plan and
 * caches the id in `plans.razorpay_plan_id`. Operators can pre-provision ids via
 * RAZORPAY_PLAN_GROWTH / RAZORPAY_PLAN_SCALE to avoid creating them at runtime.
 */
export async function ensureRazorpayPlan(plan: PlanRow): Promise<string> {
  if (plan.razorpay_plan_id) return plan.razorpay_plan_id;

  const configured = env.razorpayPlanIds[plan.code];
  if (configured) {
    await admin().from("plans").update({ razorpay_plan_id: configured }).eq("id", plan.id);
    return configured;
  }

  if (plan.price_minor <= 0) throw planRequired(`${plan.name} is the free plan — there is nothing to check out`);

  if (!razorpay.configured()) {
    throw planRequired(
      "Razorpay is not configured on this deployment yet. Add RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET in Vercel to enable checkout.",
      { reason: "provider_not_configured" },
    );
  }

  const created = await razorpay.createPlan({
    name: `Zybble ${plan.name}`,
    amountMinor: plan.price_minor,
    currency: plan.currency,
    description: plan.description ?? `Zybble ${plan.name} — ${plan.leads_per_period.toLocaleString()} leads/month`,
    period: plan.billing_interval === "month" ? "monthly" : plan.billing_interval === "year" ? "yearly" : "monthly",
    interval: plan.billing_interval_count,
    notes: { zybble_plan: plan.code },
  });

  await admin().from("plans").update({ razorpay_plan_id: created.id }).eq("id", plan.id);
  return created.id;
}

/** Minor-unit formatting shared by API responses and receipts. */
export function formatMoney(minor: number, currency: string): string {
  const zeroDecimal = ["JPY", "KRW", "VND"];
  const value = zeroDecimal.includes(currency) ? minor : minor / 100;
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: zeroDecimal.includes(currency) ? 0 : 2 }).format(value);
}
