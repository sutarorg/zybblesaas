import { ApiError } from "./errors.js";

/**
 * Server-side configuration.
 *
 * Secrets live only in the Vercel server environment (and, for the worker, in
 * Railway). Nothing in this file may ever be imported from `src/` — the browser
 * bundle gets the publishable key through VITE_* variables instead.
 */

function read(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim() !== "") return value.trim();
  }
  return undefined;
}

function required(name: string, ...aliases: string[]): string {
  const value = read(name, ...aliases);
  if (!value) {
    throw new ApiError(
      "not_configured",
      `${name} is not configured on the server. Set it in the Vercel project environment variables.`,
    );
  }
  return value;
}

export const env = {
  get supabaseUrl(): string {
    return required("SUPABASE_URL", "VITE_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
  },

  /**
   * Server key. Supabase's new secret keys (`sb_secret_…`) replace the legacy
   * service-role JWT; both map to `service_role` and bypass RLS. It must never
   * reach the browser.
   */
  get supabaseSecretKey(): string {
    return required("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  },

  get appUrl(): string {
    return read("APP_URL", "PUBLIC_APP_URL") ?? "https://zybble.com";
  },

  get geminiApiKey(): string | undefined {
    return read("GEMINI_API_KEY", "GOOGLE_GENAI_API_KEY");
  },

  get geminiModel(): string {
    return read("GEMINI_MODEL") ?? "gemini-2.5-pro";
  },

  get geminiFastModel(): string {
    return read("GEMINI_FAST_MODEL") ?? "gemini-2.5-flash";
  },

  get geminiBaseUrl(): string {
    return read("GEMINI_BASE_URL") ?? "https://generativelanguage.googleapis.com";
  },

  get razorpayKeyId(): string | undefined {
    return read("RAZORPAY_KEY_ID");
  },

  get razorpayKeySecret(): string | undefined {
    return read("RAZORPAY_KEY_SECRET");
  },

  get razorpayWebhookSecret(): string | undefined {
    return read("RAZORPAY_WEBHOOK_SECRET");
  },

  /** Razorpay account region: "in" (default docs) or "us" (international USD). */
  get razorpayRegion(): string {
    return read("RAZORPAY_REGION") ?? "us";
  },

  /** Pre-provisioned Razorpay plan ids, one per Zybble plan code. */
  get razorpayPlanIds(): Record<string, string> {
    return {
      growth: read("RAZORPAY_PLAN_GROWTH") ?? "",
      scale: read("RAZORPAY_PLAN_SCALE") ?? "",
    };
  },

  get isProduction(): boolean {
    return read("VERCEL_ENV") === "production" || read("NODE_ENV") === "production";
  },
};

export function features() {
  return {
    ai: Boolean(env.geminiApiKey),
    billing: Boolean(env.razorpayKeyId && env.razorpayKeySecret),
    billingWebhooks: Boolean(env.razorpayWebhookSecret),
  };
}
