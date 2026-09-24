import { route, ok } from "../_lib/http.js";
import { features, env } from "../_lib/env.js";

/**
 * Public runtime configuration for the browser bundle. Only values that are
 * safe to publish live here: the Razorpay **key id** is public by design,
 * secrets never are.
 */
export default route({ methods: ["GET"], auth: "none", limit: { bucket: "system", perMinute: 600 } }, async () => {
  const billing = features().billing;
  return ok({
    service: "zybble",
    apiVersion: "1",
    appUrl: env.appUrl,
    environment: env.isProduction ? "production" : "development",
    features: {
      ai: features().ai,
      billing,
      webhooks: features().billingWebhooks,
    },
    billingProvider: billing
      ? { name: "razorpay", keyId: env.razorpayKeyId, region: env.razorpayRegion, currency: "USD" }
      : null,
    support: { email: process.env.SUPPORT_EMAIL ?? "support@zybble.com" },
    time: new Date().toISOString(),
  });
});
