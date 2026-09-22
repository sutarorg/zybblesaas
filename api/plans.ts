import { route, ok } from "./_lib/http";
import { listPlans, publicPlan } from "./_lib/plans";
import { features } from "./_lib/env";

/**
 * Public pricing data. The pricing page renders exactly what the database says,
 * so a plan change is a migration, never a copy edit.
 */
export default route({ methods: ["GET"], auth: "none", limit: { bucket: "plans", perMinute: 120 } }, async () => {
  const plans = await listPlans();
  return ok({
    plans: plans.map(publicPlan),
    currency: plans[0]?.currency ?? "USD",
    billing: { provider: "razorpay", configured: features().billing },
    trialDays: plans.reduce((max, plan) => Math.max(max, plan.trial_days), 0),
  });
});
