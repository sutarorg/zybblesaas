import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env.js";
import { notConfigured, providerError, badRequest } from "./errors.js";

/**
 * Razorpay REST client (subscriptions / plans / invoices) plus signature
 * verification.
 *
 * Stripe is intentionally absent: Zybble bills through Razorpay only. All
 * amounts are integer minor units (USD 49.00 → 4900) and the currency is
 * always explicit.
 */

const API_BASE = "https://api.razorpay.com/v1";

export type RazorpayPlan = {
  id: string;
  entity: "plan";
  interval: number;
  period: string;
  item: { id: string; name: string; amount: number; currency: string; description?: string };
  notes?: Record<string, string>;
};

export type RazorpaySubscription = {
  id: string;
  entity: "subscription";
  plan_id: string;
  status:
    | "created"
    | "authenticated"
    | "active"
    | "pending"
    | "halted"
    | "cancelled"
    | "completed"
    | "expired"
    | "paused";
  current_start: number | null;
  current_end: number | null;
  ended_at: number | null;
  quantity: number;
  charge_at: number | null;
  start_at: number | null;
  end_at: number | null;
  auth_attempts: number;
  total_count: number;
  paid_count: number;
  customer_id: string | null;
  short_url: string | null;
  has_scheduled_changes: boolean;
  schedule_change_at: string | null;
  remaining_count: number;
  notes?: Record<string, string>;
};

export type RazorpayInvoice = {
  id: string;
  entity: "invoice";
  receipt: string | null;
  invoice_number: string | null;
  customer_id: string | null;
  subscription_id: string | null;
  payment_id: string | null;
  status: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  issued_at: number | null;
  paid_at: number | null;
  short_url: string | null;
  description: string | null;
};

export type RazorpayPayment = {
  id: string;
  entity: "payment";
  amount: number;
  currency: string;
  status: string;
  method: string;
  captured: boolean;
  created_at: number;
  invoice_id: string | null;
  order_id: string | null;
  card?: { last4?: string; network?: string; expiry_month?: number; expiry_year?: number };
  bank?: string | null;
  wallet?: string | null;
  error_description?: string | null;
};

function credentials(): { id: string; secret: string } {
  const id = env.razorpayKeyId;
  const secret = env.razorpayKeySecret;
  if (!id || !secret) {
    throw notConfigured("Razorpay is not configured on this deployment (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)");
  }
  return { id, secret };
}

async function request<T>(method: "GET" | "POST" | "PATCH", path: string, body?: Record<string, unknown>): Promise<T> {
  const { id, secret } = credentials();
  const auth = Buffer.from(`${id}:${secret}`, "utf8").toString("base64");

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      authorization: `Basic ${auth}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text };
  }

  if (!response.ok) {
    const error = (parsed as { error?: { description?: string; code?: string } } | null)?.error;
    throw providerError(error?.description ?? `Razorpay request failed (${response.status})`, {
      status: response.status,
      code: error?.code ?? null,
      path,
    });
  }

  return parsed as T;
}

export const razorpay = {
  configured(): boolean {
    return Boolean(env.razorpayKeyId && env.razorpayKeySecret);
  },

  createPlan(input: {
    name: string;
    amountMinor: number;
    currency: string;
    description: string;
    period?: "daily" | "weekly" | "monthly" | "yearly";
    interval?: number;
    notes?: Record<string, string>;
  }): Promise<RazorpayPlan> {
    return request<RazorpayPlan>("POST", "/plans", {
      period: input.period ?? "monthly",
      interval: input.interval ?? 1,
      item: {
        name: input.name,
        amount: input.amountMinor,
        currency: input.currency,
        description: input.description,
      },
      notes: input.notes ?? {},
    });
  },

  fetchPlan(planId: string): Promise<RazorpayPlan> {
    return request<RazorpayPlan>("GET", `/plans/${planId}`);
  },

  createSubscription(input: {
    planId: string;
    totalCount?: number;
    quantity?: number;
    customerNotify?: boolean;
    startAt?: number;
    notes?: Record<string, string>;
    offerId?: string;
  }): Promise<RazorpaySubscription> {
    return request<RazorpaySubscription>("POST", "/subscriptions", {
      plan_id: input.planId,
      // Razorpay caps the charge horizon at ~10 years; 120 monthly cycles is ample.
      total_count: input.totalCount ?? 120,
      quantity: input.quantity ?? 1,
      customer_notify: input.customerNotify === false ? 0 : 1,
      ...(input.startAt ? { start_at: input.startAt } : {}),
      ...(input.offerId ? { offer_id: input.offerId } : {}),
      notes: input.notes ?? {},
    });
  },

  fetchSubscription(id: string): Promise<RazorpaySubscription> {
    return request<RazorpaySubscription>("GET", `/subscriptions/${id}`);
  },

  cancelSubscription(id: string, atCycleEnd: boolean): Promise<RazorpaySubscription> {
    return request<RazorpaySubscription>("POST", `/subscriptions/${id}/cancel`, {
      cancel_at_cycle_end: atCycleEnd ? 1 : 0,
    });
  },

  pauseSubscription(id: string): Promise<RazorpaySubscription> {
    return request<RazorpaySubscription>("POST", `/subscriptions/${id}/pause`, { pause_at: "now" });
  },

  resumeSubscription(id: string): Promise<RazorpaySubscription> {
    return request<RazorpaySubscription>("POST", `/subscriptions/${id}/resume`, { resume_at: "now" });
  },

  updateSubscription(id: string, input: { planId?: string; quantity?: number; scheduleChangeAt?: "now" | "cycle_end" }): Promise<RazorpaySubscription> {
    return request<RazorpaySubscription>("PATCH", `/subscriptions/${id}`, {
      ...(input.planId ? { plan_id: input.planId } : {}),
      ...(input.quantity ? { quantity: input.quantity } : {}),
      ...(input.scheduleChangeAt ? { schedule_change_at: input.scheduleChangeAt } : {}),
    });
  },

  listSubscriptionInvoices(subscriptionId: string, count = 50): Promise<{ entity: string; count: number; items: RazorpayInvoice[] }> {
    return request<{ entity: string; count: number; items: RazorpayInvoice[] }>(
      "GET",
      `/invoices?subscription_id=${encodeURIComponent(subscriptionId)}&count=${count}`,
    );
  },

  listSubscriptionPayments(subscriptionId: string, count = 50): Promise<{ entity: string; count: number; items: RazorpayPayment[] }> {
    return request<{ entity: string; count: number; items: RazorpayPayment[] }>(
      "GET",
      `/payments?subscription_id=${encodeURIComponent(subscriptionId)}&count=${count}`,
    );
  },
};

function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/**
 * Webhook authenticity: HMAC-SHA256 of the **raw** request body keyed with the
 * webhook secret, compared against `X-Razorpay-Signature`. The body must not be
 * parsed before this check.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | undefined): void {
  const secret = env.razorpayWebhookSecret;
  if (!secret) throw notConfigured("RAZORPAY_WEBHOOK_SECRET is not set — webhooks are rejected");
  if (!signature) throw badRequest("Missing X-Razorpay-Signature header");

  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  if (!safeEqual(expected, signature)) throw badRequest("Invalid webhook signature");
}

/**
 * Checkout handoff verification: `razorpay_signature` is
 * HMAC-SHA256(`razorpay_payment_id|razorpay_subscription_id`, key_secret).
 */
export function verifyCheckoutSignature(paymentId: string, subscriptionId: string, signature: string): void {
  const { secret } = credentials();
  const expected = createHmac("sha256", secret).update(`${paymentId}|${subscriptionId}`, "utf8").digest("hex");
  if (!safeEqual(expected, signature)) throw badRequest("Payment verification failed — the signature does not match");
}
