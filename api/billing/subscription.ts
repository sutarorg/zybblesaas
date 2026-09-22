import { z } from "zod";
import { route, ok } from "../_lib/http";
import { parse } from "../_lib/validate";
import { admin, query } from "../_lib/supabase";
import { entitlements } from "../_lib/entitlements";
import { razorpay } from "../_lib/razorpay";
import { planByCode, publicPlan } from "../_lib/plans";
import { audit } from "../_lib/audit";
import { conflict, planRequired } from "../_lib/errors";
import { toInvoice } from "../_lib/serialize";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("cancel"), atCycleEnd: z.boolean().default(true), reason: z.string().max(300).optional() }),
  z.object({ action: z.literal("resume") }),
  z.object({ action: z.literal("pause") }),
  z.object({ action: z.literal("refresh") }),
]);

export default route(
  { methods: ["GET", "POST"], auth: "both", scopes: ["searches:read"], limit: { bucket: "billing", perMinute: 60 } },
  async (ctx) => {
    const ent = await entitlements(ctx.workspaceId);

    const [invoices, payments, methods] = await Promise.all([
      query<Array<Parameters<typeof toInvoice>[0]>>(
        admin()
          .from("invoices")
          .select("id, number, amount_minor, currency, status, issued_at, paid_at, short_url, razorpay_invoice_id")
          .eq("workspace_id", ctx.workspaceId)
          .order("issued_at", { ascending: false })
          .limit(50),
        "invoices",
      ),
      query<Array<{ id: string; amount_minor: number; currency: string; status: string; method: string | null; captured_at: string | null; razorpay_payment_id: string }>>(
        admin()
          .from("payments")
          .select("id, amount_minor, currency, status, method, captured_at, razorpay_payment_id")
          .eq("workspace_id", ctx.workspaceId)
          .order("created_at", { ascending: false })
          .limit(50),
        "payments",
      ),
      query<Array<{ id: string; method_type: string | null; card_brand: string | null; card_last4: string | null; card_exp_month: number | null; card_exp_year: number | null; is_default: boolean }>>(
        admin()
          .from("payment_methods")
          .select("id, method_type, card_brand, card_last4, card_exp_month, card_exp_year, is_default")
          .eq("workspace_id", ctx.workspaceId)
          .order("is_default", { ascending: false })
          .limit(10),
        "payment methods",
      ),
    ]);

    if (ctx.req.method?.toUpperCase() === "GET") {
      const planRow = await planByCode(ent.plan.code);
      return ok({
        entitlements: ent,
        plan: publicPlan(planRow),
        provider: {
          name: "razorpay",
          configured: razorpay.configured(),
          region: process.env.RAZORPAY_REGION ?? "us",
        },
        invoices: invoices.map(toInvoice),
        payments,
        methods: methods.map((method) => ({
          id: method.id,
          type: method.method_type,
          brand: method.card_brand,
          last4: method.card_last4,
          expiry: method.card_exp_month && method.card_exp_year ? `${String(method.card_exp_month).padStart(2, "0")}/${method.card_exp_year}` : null,
          isDefault: method.is_default,
        })),
      });
    }

    const body = parse(actionSchema, ctx.body);
    if (!ent.subscription?.razorpay_subscription_id) {
      throw conflict("This workspace has no Razorpay subscription to manage");
    }
    if (!razorpay.configured()) throw planRequired("Billing is not configured on this deployment");

    const subscriptionId = ent.subscription.razorpay_subscription_id;

    if (body.action === "refresh") {
      const live = await razorpay.fetchSubscription(subscriptionId);
      await syncSubscription(ctx.workspaceId, ent.subscription.id, live);
      await audit(ctx, { action: "billing.refreshed", targetType: "subscription", targetId: ent.subscription.id });
      return ok({ status: live.status, refreshed: true });
    }

    if (body.action === "cancel") {
      const cancelled = await razorpay.cancelSubscription(subscriptionId, body.atCycleEnd);
      await syncSubscription(ctx.workspaceId, ent.subscription.id, cancelled);
      await query(
        admin()
          .from("subscriptions")
          .update({ cancel_at_cycle_end: body.atCycleEnd, cancelled_at: body.atCycleEnd ? null : new Date().toISOString() })
          .eq("id", ent.subscription.id)
          .select("id"),
        "subscription cancel flag",
      );
      await audit(ctx, {
        action: body.atCycleEnd ? "billing.cancel_at_cycle_end" : "billing.cancelled",
        targetType: "subscription",
        targetId: ent.subscription.id,
        metadata: { reason: body.reason ?? null },
      });
      return ok({
        status: cancelled.status,
        cancelAtCycleEnd: body.atCycleEnd,
        message: body.atCycleEnd
          ? "Your subscription stays active until the end of the paid period — no further charges after that."
          : "The subscription is cancelled and no further charges will be made.",
      });
    }

    if (body.action === "pause") {
      const paused = await razorpay.pauseSubscription(subscriptionId);
      await syncSubscription(ctx.workspaceId, ent.subscription.id, paused);
      await audit(ctx, { action: "billing.paused", targetType: "subscription", targetId: ent.subscription.id });
      return ok({ status: paused.status });
    }

    const resumed = await razorpay.resumeSubscription(subscriptionId);
    await syncSubscription(ctx.workspaceId, ent.subscription.id, resumed);
    await audit(ctx, { action: "billing.resumed", targetType: "subscription", targetId: ent.subscription.id });
    return ok({ status: resumed.status });
  },
);

export async function syncSubscription(
  workspaceId: string,
  localId: string,
  remote: {
    status: string;
    plan_id: string;
    current_start: number | null;
    current_end: number | null;
    ended_at: number | null;
    paid_count: number;
    remaining_count: number;
    customer_id: string | null;
    has_scheduled_changes?: boolean;
    id: string;
  },
): Promise<void> {
  const iso = (seconds: number | null) => (seconds ? new Date(seconds * 1000).toISOString() : null);

  // Keep the local plan row in sync when Razorpay reports a different plan.
  const planRows = await query<Array<{ id: string; code: string }>>(
    admin().from("plans").select("id, code").eq("razorpay_plan_id", remote.plan_id).limit(1),
    "billing plan sync",
  );

  await query(
    admin()
      .from("subscriptions")
      .update({
        status: remote.status,
        razorpay_plan_id: remote.plan_id,
        razorpay_customer_id: remote.customer_id,
        current_start: iso(remote.current_start),
        current_end: iso(remote.current_end),
        ended_at: iso(remote.ended_at),
        paid_count: remote.paid_count,
        remaining_count: remote.remaining_count,
        last_event_at: new Date().toISOString(),
        ...(planRows[0] ? { plan_id: planRows[0].id } : {}),
      })
      .eq("id", localId)
      .eq("workspace_id", workspaceId)
      .select("id"),
    "subscription sync",
  );
}
