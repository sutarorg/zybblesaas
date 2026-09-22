import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client.
 *
 * Only the publishable (anon) key is ever used here — it is safe to ship
 * because every table is protected by row level security. The service-role key
 * and every provider secret stay on the Vercel/Railway side.
 */

const url = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const publishableKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  ""
).trim();

export const supabaseConfigured = Boolean(url && publishableKey);

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true, // recovery / invite links
        flowType: "pkce",
      },
      global: { headers: { "x-client-info": "zybble-web" } },
    })
  : null;

/** Where Supabase should send the user back to after email links. */
export function authRedirectTo(path = "/dashboard"): string {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${window.location.pathname}#${path}`;
}
