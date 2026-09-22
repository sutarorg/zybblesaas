import { route, ok } from "../_lib/http";
import { readRawBody } from "../_lib/http";
import { admin, query } from "../_lib/supabase";
import { verifyWebhookSignature } from "../_lib/razorpay";
import { badRequest, notConfigured } from "../_lib/errors";
import { env } from "../_lib/env";

/**
 * Razorpay → Zybble subscription webhook.
 *
 * Guarantees:
 *  1. the raw body is signature-verified before anything is parsed,
 *  2. every delivery is stored in ops.billing_events keyed by the provider event
 *     id, so a retried delivery is a no-op (Razorpay retries aggressively),
 *  3. local state is only changed from provider payloads, never from the browser.
 */

type RazorpaySubscriptionEntity = {
  id: string;
  plan_id: string;
  status: string;
  current_start: number | null;
  current_end: number | null;
  ended_at?: number | null;
  quantity: number;
  total_count: number;
  paid_count: number;
  remaining_count: number;
  customer_id: string | null;
  charge_at?: number | null;
  short_url?: string | null;
  has_scheduled_changes?: boolean;
  notes?: Record<string, string>;
};

type RazorpayPaymentEntity = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  method: string | null;
  captured: boolean;
  created_at: number;
  invoice_id: string | null;
  order_id: string | null;
  international?: boolean;
  fee?: number | null;
  tax?: number | null;
  error_code?: string | null;
  error_description?: string | null;
  notes?: Record<string, string>;
};

type RazorpayInvoiceEntity = {
  id: string;
  receipt?: string | null;
  invoice_number?: string | null;
  subscription_id?: string | null;
  payment_id?: string | null;
  status: string;
  amount: number;
  currency: string;
  issued_at: number | null;
  paid_at: number | null;
  short_url?: string | null;
};

const iso = (seconds: number | null | undefined) => (seconds ? new Date(seconds * 1000).toISOString() : null);

export default route({ methods: ["POST"], auth: "none", limit: { bucket: "razorpay-webhook", perMinute: 600 } }, async (ctx) => {
  if (!env.razorpayWebhookSecret) {
    throw notConfigured("RAZORPAY_WEBHOOK_SECRET is not set — webhook deliveries are rejected rather than trusted blindly");
  }

  const raw = await readRawBody(ctx.req);
  const signature = headerFrom(ctx.req, "x-razorpay-signature");
  verifyWebhookSignature(raw, signature);

  let event: { event?: string; payload?: Record<string, Record<string, unknown>>; created_at?: number };
  try {
    event = JSON.parse(raw) as typeof event;
  } catch {
    throw badRequest("Webhook body is not valid JSON");
  }

  const eventType = event.event ?? "unknown";
  const eventId =
    headerFrom(ctx.req, "x-razorpay-event-id") ??
    `${eventType}:${String((event.payload?.subscription?.entity as { id?: string } | undefined)?.id ?? (event.payload?.payment?.entity as { id?: string } | undefined)?.id ?? "unknown")}:${event.created_at ?? Date.now()}`;

  // Claim the event id; a duplicate delivery returns immediately.
  const inserted = await query<Array<{ id: number }>>(
    admin()
      .schema("ops")
      .from("billing_events")
      .upsert(
        { provider: "razorpay", provider_event_id: eventId, event_type: eventType, payload: event as unknown as Record<string, unknown>, signature_valid: true },
        { onConflict: "provider,provider_event_id", ignoreDuplicates: true },
      )
      .select("id"),
    "billing event insert",
  );

  if (inserted.length === 0) {
    return ok({ received: true, duplicate: true, event: eventType });
  }

  const eventRowId = inserted[0]?.id ?? null;

  try {
    const summary = await applyEvent(eventType, event);
    await query(
      admin()
        .schema("ops")
        .from("billing_events")
        .update({ processed_at: new Date().toISOString(), attempts: 1, workspace_id: summary.workspaceId, subscription_id: summary.subscriptionId })
        .eq("id", eventRowId)
        .select("id"),
      "billing event mark processed",
    );
    return ok({ received: true, event: eventType, applied: summary.applied });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    await query(
      admin()
        .schema("ops")
        .from("billing_events")
        .update({ attempts: 1, process_error: message.slice(0, 500) })
        .eq("id", eventRowId)
        .select("id"),
      "billing event mark failed",
    ).catch(() => undefined);

    // Returning 500 makes Razorpay retry; the event row makes the retry safe.
    console.error("[billing] webhook processing failed", eventType, message);
    throw badRequest(`Webhook stored but not applied yet: ${message}`);
  }
});

function headerFrom(req: { headers?: Record<string, unknown> }, name: string): string | undefined {
  const headers = req.headers ?? {};
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0];
  return typeof value === "string" ? value : undefined;
}

async function applyEvent(
  eventType: string,
  event: { payload?: Record<string, Record<string, unknown>> },
): Promise<{ applied: string; workspaceId: string | null; subscriptionId: string | null }> {
  const subscription = event.payload?.subscription?.entity as RazorpaySubscriptionEntity | undefined;
  const payment = event.payload?.payment?.entity as RazorpayPaymentEntity | undefined;
  const invoice = event.payload?.invoice?.entity as RazorpayInvoiceEntity | undefined;

  if (subscription) {
    const local = await applySubscription(subscription, eventType);
    const workspaceId = local.workspaceId || null;
    if (payment) await applyPayment(payment, workspaceId, local.subscriptionId || null);
    if (invoice) await applyInvoice(invoice, workspaceId, local.subscriptionId || null);
    return { applied: local.applied, workspaceId, subscriptionId: local.subscriptionId || null };
  }

  if (payment) {
    const local = await subscriptionByPaymentNotes(payment);
    await applyPayment(payment, local?.workspaceId ?? null, local?.subscriptionId ?? null);
    return { applied: `payment:${payment.status}`, workspaceId: local?.workspaceId ?? null, subscriptionId: local?.subscriptionId ?? null };
  }

  if (invoice) {
    const local = invoice.subscription_id ? await subscriptionByRazorpayId(invoice.subscription_id) : null;
    await applyInvoice(invoice, local?.workspaceId ?? null, local?.subscriptionId ?? null);
    return { applied: `invoice:${invoice.status}`, workspaceId: local?.workspaceId ?? null, subscriptionId: local?.subscriptionId ?? null };
  }

  return { applied: `ignored:${eventType}`, workspaceId: null, subscriptionId: null };
}

type LocalSubscription = { id: string; workspaceId: string; subscriptionId: string; planId: string; status: string };

async function subscriptionByRazorpayId(razorpayId: string): Promise<LocalSubscription | null> {
  const rows = await query<Array<{ id: string; workspace_id: string; plan_id: string; status: string; razorpay_subscription_id: string }>>(
    admin()
      .from("subscriptions")
      .select("id, workspace_id, plan_id, status, razorpay_subscription_id")
      .eq("razorpay_subscription_id", razorpayId)
      .limit(1),
    "webhook subscription lookup",
  );
  const row = rows[0];
  if (!row) return null;
  return { id: row.id, workspaceId: row.workspace_id, subscriptionId: row.id, planId: row.plan_id, status: row.status };
}

async function subscriptionByPaymentNotes(payment: RazorpayPaymentEntity): Promise<LocalSubscription | null> {
  const subscriptionId = (payment.notes?.subscription_id as string | undefined) ?? null;
  if (subscriptionId) {
    const byId = await subscriptionByRazorpayId(subscriptionId);
    if (byId) return byId;
  }
  const workspaceId = payment.notes?.zybble_workspace_id as string | undefined;
  if (workspaceId) {
    const rows = await query<Array<{ id: string; plan_id: string; status: string }>>(
      admin().from("subscriptions").select("id, plan_id, status").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(1),
      "webhook workspace subscription",
    );
    if (rows[0]) return { id: rows[0].id, workspaceId, subscriptionId: rows[0].id, planId: rows[0].plan_id, status: rows[0].status };
  }
  return null;
}

async function applySubscription(entity: RazorpaySubscriptionEntity, eventType: string): Promise<LocalSubscription & { applied: string }> {
  const local = await subscriptionByRazorpayId(entity.id);
  if (!local) {
    // A subscription Zybble does not know about (created in the Razorpay
    // dashboard). Record it in the log only — never attach it to a tenant.
    console.warn("[billing] unknown subscription in webhook", entity.id, eventType);
    return { id: "", workspaceId: "", subscriptionId: "", planId: "", status: "unknown", applied: "unknown_subscription" };
  }

  const planRows = await query<Array<{ id: string; code: string }>>(
    admin().from("plans").select("id, code").eq("razorpay_plan_id", entity.plan_id).limit(1),
    "webhook plan lookup",
  );
  const plan = planRows[0];

  await query(
    admin()
      .from("subscriptions")
      .update({
        status: entity.status,
        razorpay_plan_id: entity.plan_id,
        razorpay_customer_id: entity.customer_id,
        current_start: iso(entity.current_start),
        current_end: iso(entity.current_end),
        ended_at: iso(entity.ended_at),
        paid_count: entity.paid_count ?? 0,
        remaining_count: entity.remaining_count ?? 0,
        total_count: entity.total_count ?? null,
        quantity: entity.quantity ?? 1,
        last_event_id: null,
        last_event_at: new Date().toISOString(),
        ...(plan ? { plan_id: plan.id } : {}),
        provider_payload: entity as unknown as Record<string, unknown>,
      })
      .eq("id", local.id)
      .select("id"),
    "webhook subscription update",
  );

  const activeStates = ["active", "authenticated", "pending", "created", "paused", "halted"];
  const planIdForWorkspace = plan?.id ?? local.planId;

  if (activeStates.includes(entity.status) && planIdForWorkspace) {
    // Plan changes take effect exactly when the provider says they are live.
    await query(admin().from("workspaces").update({ plan_id: planIdForWorkspace }).eq("id", local.workspaceId).select("id"), "webhook workspace plan");
  } else if (["cancelled", "completed", "expired"].includes(entity.status)) {
    const free = await query<Array<{ id: string }>>(admin().from("plans").select("id").eq("code", "starter").limit(1), "webhook free plan");
    if (free[0]) {
      await query(admin().from("workspaces").update({ plan_id: free[0].id }).eq("id", local.workspaceId).select("id"), "webhook workspace downgrade");
    }
  }

  await notify(local.workspaceId, entity.status, eventType, local.id);

  await query(
    admin()
      .from("audit_logs")
      .insert({
        workspace_id: local.workspaceId,
        actor_type: "system",
        action: `billing.${eventType}`,
        target_type: "subscription",
        target_id: local.id,
        metadata: { status: entity.status, plan_id: entity.plan_id, paid_count: entity.paid_count },
      })
      .select("id"),
    "webhook audit",
  );

  return {
    id: local.id,
    workspaceId: local.workspaceId,
    subscriptionId: local.subscriptionId,
    planId: entity.plan_id,
    status: entity.status,
    applied: `subscription:${entity.status}`,
  };
}

async function applyPayment(entity: RazorpayPaymentEntity, workspaceId: string | null, subscriptionId: string | null): Promise<void> {
  if (!workspaceId) return;
  await query(
    admin()
      .from("payments")
      .upsert(
        {
          workspace_id: workspaceId,
          subscription_id: subscriptionId,
          razorpay_payment_id: entity.id,
          razorpay_invoice_id: entity.invoice_id,
          razorpay_order_id: entity.order_id,
          amount_minor: entity.amount,
          currency: entity.currency,
          status: entity.captured || entity.status === "captured" ? "captured" : entity.status,
          method: entity.method,
          international: Boolean(entity.international),
          fee_minor: entity.fee ?? null,
          tax_minor: entity.tax ?? null,
          error_code: entity.error_code ?? null,
          error_description: entity.error_description ?? null,
          captured_at: entity.captured || entity.status === "captured" ? iso(entity.created_at) : null,
          provider_created_at: iso(entity.created_at),
          notes: entity.notes ?? {},
        },
        { onConflict: "razorpay_payment_id" },
      )
      .select("id"),
    "webhook payment upsert",
  );

  if (entity.status === "failed") {
    await query(
      admin()
        .from("notifications")
        .insert({
          workspace_id: workspaceId,
          type: "payment_failed",
          title: "A subscription payment failed",
          body: entity.error_description ?? "Razorpay could not charge the card on file. Update the payment method to avoid losing access.",
          severity: "error",
          link: "/billing",
          metadata: { payment_id: entity.id, amount: entity.amount, currency: entity.currency },
        })
        .select("id"),
      "webhook payment failed notification",
    );
  }
}

async function applyInvoice(entity: RazorpayInvoiceEntity, workspaceId: string | null, subscriptionId: string | null): Promise<void> {
  if (!workspaceId) return;
  await query(
    admin()
      .from("invoices")
      .upsert(
        {
          workspace_id: workspaceId,
          subscription_id: subscriptionId,
          razorpay_invoice_id: entity.id,
          razorpay_payment_id: entity.payment_id ?? null,
          number: entity.invoice_number ?? entity.receipt ?? null,
          amount_minor: entity.amount,
          currency: entity.currency,
          status: normalizeInvoiceStatus(entity.status),
          issued_at: iso(entity.issued_at),
          paid_at: iso(entity.paid_at),
          short_url: entity.short_url ?? null,
          provider_payload: entity as unknown as Record<string, unknown>,
        },
        { onConflict: "razorpay_invoice_id" },
      )
      .select("id"),
    "webhook invoice upsert",
  );
}

function normalizeInvoiceStatus(status: string): string {
  const map: Record<string, string> = { paid: "paid", issued: "issued", draft: "draft", cancelled: "cancelled", expired: "expired", partially_paid: "issued" };
  return map[status] ?? "issued";
}

async function notify(workspaceId: string, status: string, eventType: string, subscriptionId: string): Promise<void> {
  const templates: Record<string, { type: string; title: string; body: string; severity: string }> = {
    active: { type: "subscription_changed", title: "Your subscription is active", body: "Payment confirmed — the plan limits are live now.", severity: "success" },
    authenticated: { type: "subscription_changed", title: "Subscription authorised", body: "Your card is authorised and the first charge is on its way.", severity: "info" },
    charged: { type: "payment_succeeded", title: "Payment received", body: "Thanks — your subscription renewal went through.", severity: "success" },
    halted: { type: "payment_failed", title: "Subscription halted", body: "Razorpay could not charge your card. Update the payment method to restore access.", severity: "error" },
    cancelled: { type: "subscription_changed", title: "Subscription cancelled", body: "No further charges will be made.", severity: "warn" },
    completed: { type: "subscription_changed", title: "Subscription completed", body: "All billing cycles for this subscription have been charged.", severity: "info" },
    paused: { type: "subscription_changed", title: "Subscription paused", body: "Charges are paused until you resume.", severity: "warn" },
    resumed: { type: "subscription_changed", title: "Subscription resumed", body: "Charges will continue as scheduled.", severity: "info" },
    pending: { type: "subscription_changed", title: "Payment pending", body: "Razorpay is waiting on the payment to clear.", severity: "warn" },
  };

  const template = templates[status];
  if (!template) return;

  await query(
    admin()
      .from("notifications")
      .insert({
        workspace_id: workspaceId,
        type: template.type,
        title: template.title,
        body: template.body,
        severity: template.severity,
        link: "/billing",
        metadata: { event: eventType, status, subscription_id: subscriptionId },
      })
      .select("id"),
    "webhook notification",
  );
}
