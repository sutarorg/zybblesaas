import { route, ok } from "../../_lib/http";
import { readRawBody } from "../../_lib/http";
import { admin, query, rpc } from "../../_lib/supabase";
import { verifyWebhookSignature } from "../../_lib/razorpay";
import { badRequest } from "../../_lib/errors";

/**
 * Razorpay webhook receiver.
 *
 * Rules honoured here:
 *  * the **raw** body is verified against X-Razorpay-Signature before parsing;
 *  * every delivery is stored in ops.billing_events with a unique
 *    (provider, provider_event_id) key, so retries are idempotent;
 *  * entitlement changes are derived from provider state only — never from the
 *    browser — and are written to `subscriptions` plus `workspaces.plan_id`;
 *  * a halted subscription keeps access during the retry window and is only
 *    downgraded on cancellation/expiry, so a card hiccup does not delete work.
 */

type RazorpaySubscription = {
  id: string;
  plan_id: string;
  status: string;
  current_start?: number | null;
  current_end?: number | null;
  ended_at?: number | null;
  charge_at?: number | null;
  paid_count?: number;
  remaining_count?: number;
  total_count?: number;
  customer_id?: string | null;
  notes?: Record<string, string>;
};

type RazorpayPayment = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  method?: string | null;
  international?: boolean;
  fee?: number | null;
  tax?: number | null;
  error_code?: string | null;
  error_description?: string | null;
  invoice_id?: string | null;
  order_id?: string | null;
  created_at?: number;
  notes?: Record<string, string>;
};

type RazorpayInvoice = {
  id: string;
  invoice_number?: string | null;
  amount?: number;
  currency?: string;
  status?: string;
  issued_at?: number | null;
  paid_at?: number | null;
  short_url?: string | null;
  payment_id?: string | null;
  subscription_id?: string | null;
};

type WebhookBody = {
  event?: string;
  payload?: {
    subscription?: { entity?: RazorpaySubscription };
    payment?: { entity?: RazorpayPayment };
    invoice?: { entity?: RazorpayInvoice };
    refund?: { entity?: { id: string; payment_id: string; amount: number; status: string } };
  };
  created_at?: number;
};

export default route({ methods: ["POST"], auth: "none", limit: { bucket: "razorpay-webhook", perMinute: 600 } }, async (ctx) => {
  const raw = await readRawBody(ctx.req);
  const signature = headerFrom(ctx.req, "x-razorpay-signature");
  const eventId = headerFrom(ctx.req, "x-razorpay-event-id");

  verifyWebhookSignature(raw, signature);

  let body: WebhookBody;
  try {
    body = JSON.parse(raw) as WebhookBody;
  } catch {
    throw badRequest("Webhook body is not valid JSON");
  }

  const event = body.event ?? "unknown";
  const providerEventId = eventId ?? `${event}:${body.created_at ?? Date.now()}`;

  // Idempotency: the unique index on (provider, provider_event_id) makes a
  // retried delivery a no-op instead of a double charge/plan flip.
  const claimed = await query<Array<{ id: number }>>(
    admin()
      .schema("ops")
      .from("billing_events")
      .upsert(
        {
          provider: "razorpay",
          provider_event_id: providerEventId,
          event_type: event,
          payload: body as unknown as Record<string, unknown>,
          signature_valid: true,
        },
        { onConflict: "provider,provider_event_id", ignoreDuplicates: true },
      )
      .select("id"),
    "billing event claim",
  );

  if (claimed.length === 0) {
    return ok({ received: true, duplicate: true, event });
  }

  const subscription = body.payload?.subscription?.entity;
  const payment = body.payload?.payment?.entity;
  const invoice = body.payload?.invoice?.entity;

  let workspaceId: string | null = null;
  let subscriptionId: string | null = null;

  if (subscription) {
    const result = await syncSubscription(subscription, event, providerEventId);
    workspaceId = result.workspaceId;
    subscriptionId = result.localId;
  }

  if (payment && workspaceId) {
    await upsertPayment(workspaceId, subscriptionId, payment);
    if (payment.status === "failed") {
      await notify(workspaceId, "payment_failed", "Payment failed", payment.error_description ?? "Razorpay could not charge the card on your subscription.", "error", { payment_id: payment.id });
    } else if (payment.status === "captured") {
      await notify(workspaceId, "payment_succeeded", "Payment received", `${formatAmount(payment.amount, payment.currency)} was charged successfully.`, "success", { payment_id: payment.id });
    }
  }

  if (invoice && workspaceId) {
    await upsertInvoice(workspaceId, subscriptionId, invoice);
  }

  await query(
    admin()
      .schema("ops")
      .from("billing_events")
      .update({
        workspace_id: workspaceId,
        subscription_id: subscriptionId,
        processed_at: new Date().toISOString(),
        attempts: 1,
      })
      .eq("id", claimed[0]?.id ?? 0)
      .select("id"),
    "billing event finish",
  );

  return ok({ received: true, event, workspace_id: workspaceId });
});

function headerFrom(req: { headers?: Record<string, unknown> }, name: string): string | undefined {
  const headers = req.headers ?? {};
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0];
  return typeof value === "string" ? value : undefined;
}

const STATUS_MAP: Record<string, string> = {
  created: "created",
  authenticated: "authenticated",
  active: "active",
  pending: "pending",
  halted: "halted",
  paused: "paused",
  cancelled: "cancelled",
  completed: "completed",
  expired: "expired",
};

async function syncSubscription(
  entity: RazorpaySubscription,
  event: string,
  providerEventId: string,
): Promise<{ workspaceId: string | null; localId: string | null }> {
  const rows = await query<
    Array<{ id: string; workspace_id: string; status: string; plan_id: string }>
  >(
    admin()
      .from("subscriptions")
      .select("id, workspace_id, status, plan_id")
      .eq("razorpay_subscription_id", entity.id)
      .limit(1),
    "webhook subscription lookup",
  );

  const local = rows[0];
  if (!local) {
    // An operator-created subscription that Zybble never sold: record it in the
    // event log, but do not attach it to a workspace blindly.
    console.warn("[billing] webhook for unknown subscription", entity.id, event);
    return { workspaceId: null, localId: null };
  }

  const status = STATUS_MAP[entity.status] ?? local.status;
  const patch: Record<string, unknown> = {
    status,
    razorpay_plan_id: entity.plan_id,
    razorpay_customer_id: entity.customer_id ?? null,
    paid_count: entity.paid_count ?? 0,
    remaining_count: entity.remaining_count ?? null,
    total_count: entity.total_count ?? null,
    current_start: toIso(entity.current_start),
    current_end: toIso(entity.current_end),
    ended_at: toIso(entity.ended_at),
    last_event_id: providerEventId,
    last_event_at: new Date().toISOString(),
    provider_payload: entity as unknown as Record<string, unknown>,
  };
  if (status === "cancelled") patch.cancelled_at = new Date().toISOString();
  if (status === "paused") patch.paused_at = new Date().toISOString();
  if (status === "active" && !entity.current_start) patch.started_at = new Date().toISOString();

  await query(admin().from("subscriptions").update(patch).eq("id", local.id).select("id"), "webhook subscription update");

  // Plan membership follows provider state.
  if (["active", "authenticated", "charged"].includes(event) || status === "active") {
    const planRows = await query<Array<{ id: string }>>(
      admin().from("plans").select("id").eq("razorpay_plan_id", entity.plan_id).limit(1),
      "webhook plan lookup",
    );
    if (planRows[0]) {
      await query(admin().from("workspaces").update({ plan_id: planRows[0].id }).eq("id", local.workspace_id).select("id"), "webhook plan apply");
    }
    await notify(local.workspace_id, "subscription_changed", "Subscription active", "Your plan is active — limits have been updated.", "success", { subscription_id: entity.id });
  } else if (["cancelled", "completed", "expired"].includes(status)) {
    const free = await query<Array<{ id: string }>>(admin().from("plans").select("id").eq("code", "starter").limit(1), "webhook free plan");
    if (free[0]) {
      await query(admin().from("workspaces").update({ plan_id: free[0].id }).eq("id", local.workspace_id).select("id"), "webhook plan reset");
    }
    await notify(local.workspace_id, "subscription_changed", "Subscription ended", "The subscription is no longer active. Your data stays available on the free plan.", "warn", { status });
  } else if (status === "halted" || status === "paused") {
    // Access is intentionally kept during the retry/pause window.
    await notify(local.workspace_id, "payment_failed", status === "halted" ? "Payment needs attention" : "Subscription paused", "Razorpay could not complete the charge. Update the payment method to avoid losing access.", "warn", { status });
  }

  await query(
    admin()
      .from("audit_logs")
      .insert({
        workspace_id: local.workspace_id,
        actor_type: "system",
        action: `billing.${event}`,
        target_type: "subscription",
        target_id: local.id,
        metadata: { status, razorpay_event: providerEventId },
      })
      .select("id"),
    "webhook audit",
  );

  return { workspaceId: local.workspace_id, localId: local.id };
}

async function upsertPayment(workspaceId: string, subscriptionId: string | null, payment: RazorpayPayment): Promise<void> {
  await query(
    admin()
      .from("payments")
      .upsert(
        {
          workspace_id: workspaceId,
          subscription_id: subscriptionId,
          razorpay_payment_id: payment.id,
          razorpay_order_id: payment.order_id ?? null,
          razorpay_invoice_id: payment.invoice_id ?? null,
          amount_minor: payment.amount,
          currency: payment.currency,
          status: payment.status,
          method: payment.method ?? null,
          international: Boolean(payment.international),
          fee_minor: payment.fee ?? null,
          tax_minor: payment.tax ?? null,
          error_code: payment.error_code ?? null,
          error_description: payment.error_description ?? null,
          captured_at: payment.status === "captured" ? toIso(payment.created_at) : null,
          provider_created_at: toIso(payment.created_at),
          notes: payment.notes ?? {},
        },
        { onConflict: "razorpay_payment_id" },
      )
      .select("id"),
    "webhook payment upsert",
  );
}

async function upsertInvoice(workspaceId: string, subscriptionId: string | null, invoice: RazorpayInvoice): Promise<void> {
  await query(
    admin()
      .from("invoices")
      .upsert(
        {
          workspace_id: workspaceId,
          subscription_id: subscriptionId,
          razorpay_invoice_id: invoice.id,
          number: invoice.invoice_number ?? null,
          amount_minor: invoice.amount ?? 0,
          currency: invoice.currency ?? "USD",
          status: invoice.status ?? "issued",
          issued_at: toIso(invoice.issued_at),
          paid_at: toIso(invoice.paid_at),
          short_url: invoice.short_url ?? null,
          provider_payload: invoice as unknown as Record<string, unknown>,
        },
        { onConflict: "razorpay_invoice_id" },
      )
      .select("id"),
    "webhook invoice upsert",
  );
}

async function notify(
  workspaceId: string,
  type: string,
  title: string,
  body: string,
  severity: "info" | "success" | "warn" | "error",
  metadata: Record<string, unknown>,
): Promise<void> {
  await rpc("notify_workspace", {
    p_workspace_id: workspaceId,
    p_type: type,
    p_title: title,
    p_body: body,
    p_link: "/billing",
    p_severity: severity,
    p_metadata: metadata,
  }).catch((error) => console.error("[billing] notification failed", error));
}

function toIso(seconds?: number | null): string | null {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

function formatAmount(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}
