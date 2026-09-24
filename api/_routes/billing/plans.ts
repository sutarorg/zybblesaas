import { route, ok } from "../../_lib/http.js";
import { listPlans, publicPlan } from "../../_lib/plans.js";
import { features, env } from "../../_lib/env.js";

/**
 * Plan catalogue for the pricing page and /billing.
 *
 * Prices come from the database (single source of truth). When Razorpay is not
 * configured the response says so — the UI shows "billing unavailable" instead
 * of a checkout button that cannot work.
 */
export default route({ methods: ["GET"], auth: "none", limit: { bucket: "billing-plans", perMinute: 120 } }, async () => {
  const plans = await listPlans(true);
  const billing = features();

  return ok({
    plans: plans.map((plan) => ({ ...publicPlan(plan), is_active: plan.is_active })),
    currency: plans[0]?.currency ?? "USD",
    provider: "razorpay",
    region: env.razorpayRegion,
    capabilities: {
      checkout: billing.billing,
      webhooks: billing.billingWebhooks,
      // International recurring USD needs the capability enabled on the
      // Razorpay account; the operator flips this per deployment.
      international: process.env.RAZORPAY_INTERNATIONAL !== "0",
    },
    message: billing.billing
      ? null
      : "Online billing is not switched on for this deployment yet — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to enable checkout.",
  });
});
