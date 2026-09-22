import { z } from "zod";
import { route, created } from "../_lib/http";
import { parse } from "../_lib/validate";
import { admin, query } from "../_lib/supabase";
import { entitlements } from "../_lib/entitlements";
import { ensureRazorpayPlan, planByCode } from "../_lib/plans";
import { razorpay } from "../_lib/razorpay";
import { env } from "../_lib/env";
import { audit } from "../_lib/audit";
import { conflict, planRequired } from "../_lib/errors";

const bodySchema = z.object({ planCode: z.enum(["growth", "scale"]), quantity: z.number().int().min(1).max(50).default(1) });

/**
 * Creates (or reuses) a Razorpay subscription and hands the browser everything
 * it needs for Standard Checkout. Card data never touches Zybble: the browser
 * talks to Razorpay directly and the result is verified server-side in
 * /api/billing/verify.
 */
export default route(
  { methods: ["POST"], auth: "session", roles: ["owner", "admin"], limit: { bucket: "checkout", perMinute: 20 } },
  async (ctx) => {
    const body = parse(bodySchema, ctx.body);
    const ent = await entitlements(ctx.workspaceId);

    if (!razorpay.configured()) {
      throw planRequired(
        "Billing is not switched on for this deployment yet. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the Vercel project settings.",
        { reason: "provider_not_configured" },
      );
    }

    const plan = await planByCode(body.planCode);
    if (ent.subscription && ["active", "authenticated", "pending", "created", "paused", "halted"].includes(ent.subscription.status)) {
      if (ent.subscription.status === "active" && ent.plan.code === plan.code) {
        throw conflict(`This workspace is already on ${plan.name}`);
      }
      // Switching plans updates the existing subscription instead of stacking a second one.
      if (ent.subscription.razorpay_subscription_id && ent.subscription.status === "active") {
        const razorpayPlanId = await ensureRazorpayPlan(plan);
        const updated = await razorpay.updateSubscription(ent.subscription.razorpay_subscription_id, {
          planId: razorpayPlanId,
          quantity: body.quantity,
          scheduleChangeAt: "cycle_end",
        });
        await query(
          admin()
            .from("subscriptions")
            .update({
              plan_id: plan.id,
              razorpay_plan_id: razorpayPlanId,
              quantity: body.quantity,
              status: updated.status,
              cancel_at_cycle_end: updated.has_scheduled_changes,
              provider_payload: updated as unknown as Record<string, unknown>,
            })
            .eq("id", ent.subscription.id)
            .select("id"),
          "subscription plan change",
        );
        await audit(ctx, { action: "billing.plan_change_scheduled", targetType: "subscription", targetId: ent.subscription.id, metadata: { to: plan.code } });
        return created({
          mode: "plan_change",
          effective: "cycle_end",
          message: `Your plan switches to ${plan.name} at the end of the current billing cycle.`,
        });
      }
    }

    const razorpayPlanId = await ensureRazorpayPlan(plan);
    const subscription = await razorpay.createSubscription({
      planId: razorpayPlanId,
      quantity: body.quantity,
      totalCount: 120,
      notes: {
        zybble_workspace_id: ctx.workspaceId,
        zybble_plan: plan.code,
        zybble_user_id: ctx.caller?.userId ?? "",
      },
    });

    const rows = await query<Array<{ id: string }>>(
      admin()
        .from("subscriptions")
        .insert({
          workspace_id: ctx.workspaceId,
          plan_id: plan.id,
          provider: "razorpay",
          razorpay_subscription_id: subscription.id,
          razorpay_plan_id: razorpayPlanId,
          status: normalizeStatus(subscription.status),
          currency: plan.currency,
          amount_minor: plan.price_minor * body.quantity,
          quantity: body.quantity,
          total_count: subscription.total_count ?? 120,
          remaining_count: subscription.remaining_count ?? 120,
          current_start: subscription.current_start ? new Date(subscription.current_start * 1000).toISOString() : null,
          current_end: subscription.current_end ? new Date(subscription.current_end * 1000).toISOString() : null,
          created_by: ctx.caller?.userId ?? null,
          provider_payload: subscription as unknown as Record<string, unknown>,
        })
        .select("id"),
      "subscription insert",
    );

    await audit(ctx, {
      action: "billing.checkout_started",
      targetType: "subscription",
      targetId: rows[0]?.id ?? subscription.id,
      metadata: { plan: plan.code, amount_minor: plan.price_minor, currency: plan.currency },
    });

    return created({
      mode: "checkout",
      keyId: env.razorpayKeyId,
      subscriptionId: subscription.id,
      shortUrl: subscription.short_url,
      amount: plan.price_minor * body.quantity,
      currency: plan.currency,
      plan: { code: plan.code, name: plan.name },
      trialDays: plan.trial_days,
      // Billing is only "active" once Razorpay says so — Zybble never fakes it.
      status: normalizeStatus(subscription.status),
    });
  },
);

function normalizeStatus(status: string): string {
  const allowed = ["created", "pending", "authenticated", "active", "paused", "halted", "cancelled", "completed", "expired"];
  return allowed.includes(status) ? status : "pending";
}
