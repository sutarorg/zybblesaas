import { z } from "zod";
import { route, ok } from "../_lib/http";
import { parse } from "../_lib/validate";
import { admin, query } from "../_lib/supabase";
import { entitlements } from "../_lib/entitlements";
import { razorpay, verifyCheckoutSignature } from "../_lib/razorpay";
import { audit } from "../_lib/audit";
import { badRequest, conflict, planRequired } from "../_lib/errors";
import { syncSubscription } from "./subscription";

const bodySchema = z.object({
  razorpay_payment_id: z.string().min(5).max(64),
  razorpay_subscription_id: z.string().min(5).max(64),
  razorpay_signature: z.string().min(16).max(256),
});

/**
 * Standard Checkout hands the browser three values. A subscription is only
 * treated as live after this signature check succeeds AND Razorpay reports the
 * subscription state — Zybble never trusts the redirect alone.
 */
export default route(
  { methods: ["POST"], auth: "session", roles: ["owner", "admin"], limit: { bucket: "checkout-verify", perMinute: 30 } },
  async (ctx) => {
    const body = parse(bodySchema, ctx.body);

    if (!razorpay.configured()) throw planRequired("Billing is not configured on this deployment");

    try {
      verifyCheckoutSignature(body.razorpay_payment_id, body.razorpay_subscription_id, body.razorpay_signature);
    } catch (error) {
      await audit(ctx, {
        action: "billing.checkout_signature_invalid",
        targetType: "subscription",
        targetId: body.razorpay_subscription_id,
        metadata: { payment_id: body.razorpay_payment_id },
      });
      throw badRequest("We could not verify that payment. Nothing has been activated — contact support with the payment id.", {
        payment_id: body.razorpay_payment_id,
        cause: error instanceof Error ? error.message : "signature mismatch",
      });
    }

    const local = await query<Array<{ id: string }>>(
      admin()
        .from("subscriptions")
        .select("id")
        .eq("workspace_id", ctx.workspaceId)
        .eq("razorpay_subscription_id", body.razorpay_subscription_id)
        .limit(1),
      "checkout subscription lookup",
    );
    const row = local[0];
    if (!row) throw conflict("This subscription does not belong to your workspace");

    // Authoritative state comes from Razorpay, not from the browser payload.
    const live = await razorpay.fetchSubscription(body.razorpay_subscription_id);
    await syncSubscription(ctx.workspaceId, row.id, live);

    await query(
      admin()
        .from("payments")
        .upsert(
          {
            workspace_id: ctx.workspaceId,
            subscription_id: row.id,
            razorpay_payment_id: body.razorpay_payment_id,
            amount_minor: 0,
            currency: "USD",
            status: "authorized",
            method: "card",
            notes: { verified_via: "checkout_callback" },
          },
          { onConflict: "razorpay_payment_id" },
        )
        .select("id"),
      "checkout payment record",
    ).catch((error: unknown) => console.error("[billing] payment record upsert failed", error));

    await audit(ctx, {
      action: "billing.checkout_verified",
      targetType: "subscription",
      targetId: row.id,
      metadata: { status: live.status, payment_id: body.razorpay_payment_id },
    });

    const ent = await entitlements(ctx.workspaceId);
    return ok({
      verified: true,
      // "active" only when Razorpay says so; webhooks/refresh settle the rest.
      status: live.status,
      plan: ent.plan.code,
      entitlements: ent,
    });
  },
);
