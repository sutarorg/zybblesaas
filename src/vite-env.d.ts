/// <reference types="vite/client" />

/**
 * Every variable here is compiled into the browser bundle, so it must be
 * public by definition: the Supabase project URL and its publishable key.
 * Service-role keys, Gemini and Razorpay secrets live only in the Vercel and
 * Railway environments and are never referenced from `src/`.
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  /** New-style publishable key (`sb_publishable_…`). */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** Legacy anon key, still accepted for projects that have not rotated yet. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Optional: overrides the API base when the SPA is served from another host. */
  readonly VITE_API_BASE_URL?: string;
  // Note: the Razorpay key id is *not* a VITE_ variable. Checkout is created
  // server-side (api/billing/checkout.ts) and the key id arrives in that
  // response, so the id is never baked into the bundle.
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
