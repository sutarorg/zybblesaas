/**
 * Razorpay Checkout loader.
 *
 * The SDK is only ever loaded on demand, in the browser, when a customer
 * actually starts a checkout — never at app boot, and never on the server.
 */

type CheckoutSuccess = {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
};

type CheckoutFailure = {
  error?: { code?: string; description?: string; reason?: string; source?: string; step?: string };
};

type RazorpayOptions = {
  key: string;
  subscription_id: string;
  name: string;
  description?: string;
  image?: string;
  amount?: number;
  currency?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  handler: (response: CheckoutSuccess) => void;
  modal?: { ondismiss?: () => void; escape?: boolean; backdropclose?: boolean };
};

type RazorpayInstance = { open: () => void; on: (event: string, handler: (payload: CheckoutFailure) => void) => void };

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
let loading: Promise<boolean> | null = null;

function loadScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (loading) return loading;
  loading = new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => {
      loading = null;
      resolve(false);
    };
    document.head.appendChild(script);
  });
  return loading;
}

export class CheckoutDismissed extends Error {
  constructor() {
    super("Checkout was closed before it completed");
    this.name = "CheckoutDismissed";
  }
}

/**
 * Opens Razorpay's hosted checkout for a subscription created server-side.
 * Resolves with the payment references the server then verifies by signature;
 * rejects with CheckoutDismissed if the customer closes the modal.
 */
export async function openSubscriptionCheckout(options: Omit<RazorpayOptions, "handler" | "modal">): Promise<CheckoutSuccess> {
  const ready = await loadScript();
  if (!ready || !window.Razorpay) {
    throw new Error("Razorpay Checkout could not be loaded — check your connection and try again");
  }
  const Razorpay = window.Razorpay;
  return new Promise<CheckoutSuccess>((resolve, reject) => {
    const instance = new Razorpay({
      ...options,
      handler: (response) => resolve(response),
      modal: { ondismiss: () => reject(new CheckoutDismissed()) },
    });
    instance.on("payment.failed", (payload) => {
      reject(new Error(payload.error?.description ?? "The payment failed at the provider"));
    });
    instance.open();
  });
}
