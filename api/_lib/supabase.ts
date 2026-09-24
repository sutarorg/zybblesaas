import { createClient, type SupabaseClient, type PostgrestError } from "@supabase/supabase-js";
import { env } from "./env.js";
import { ApiError, internalError } from "./errors.js";

/**
 * Server-side Supabase client (secret key → `service_role`).
 *
 * The database is the source of truth and every mutation goes through either
 * PostgREST or an RPC. There is deliberately no raw `pg` pool here: keeping
 * connections out of short-lived serverless functions is what PostgREST is for.
 */

let client: SupabaseClient | null = null;

export function admin(): SupabaseClient {
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseSecretKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { "x-application-name": "zybble-api" } },
    });
  }
  return client;
}

function wrap(error: PostgrestError | null, context: string): never {
  if (!error) throw internalError(`${context}: unknown database error`);
  const code = error.code ?? "";
  if (code === "P0002" || code === "02000") {
    throw new ApiError("not_found", error.message || "Resource not found");
  }
  if (code === "42501") {
    throw new ApiError("forbidden", "The database refused this operation");
  }
  if (code === "23505") {
    throw new ApiError("conflict", "That record already exists");
  }
  if (code === "23514" || code === "22P02" || code === "22023") {
    throw new ApiError("bad_request", error.message || "Invalid value");
  }
  throw new ApiError("internal_error", `${context}: ${error.message}`);
}

/** PostgREST query builder result → data, or a typed ApiError. */
export async function query<T>(
  builder: PromiseLike<{ data: T | null; error: PostgrestError | null }>,
  context = "query",
): Promise<T> {
  const { data, error } = await builder;
  if (error) wrap(error, context);
  return data as T;
}

/** RPC returning a single scalar/row (first row when a set is returned). */
export async function rpc<T>(fn: string, args: Record<string, unknown> = {}, context = fn): Promise<T> {
  const { data, error } = await admin().rpc(fn, args);
  if (error) wrap(error, context);
  if (Array.isArray(data)) return (data[0] ?? null) as T;
  return data as T;
}

/** RPC returning a set of rows. */
export async function rpcRows<T>(fn: string, args: Record<string, unknown> = {}, context = fn): Promise<T[]> {
  const { data, error } = await admin().rpc(fn, args);
  if (error) wrap(error, context);
  return (data ?? []) as T[];
}

export function currentMonthPeriod(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}
