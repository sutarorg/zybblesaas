import { createHash, timingSafeEqual } from "node:crypto";
import { admin, query, rpcRows } from "./supabase.js";
import { unauthorized, forbidden, badRequest, rateLimited } from "./errors.js";
import type { IncomingRequest, RouteOptions } from "./types.js";

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

export type CallerContext = {
  /** authenticated user id (null when an API key is used) */
  userId: string | null;
  email: string | null;
  workspaceId: string;
  role: WorkspaceRole | "api_key";
  via: "session" | "api_key";
  scopes: string[];
  apiKeyId?: string;
  isPlatformAdmin: boolean;
};

type ProfileRow = { id: string; email: string; is_platform_admin: boolean };
type MemberRow = { workspace_id: string; role: WorkspaceRole; status: string };

function header(req: IncomingRequest, name: string): string | undefined {
  const raw = req.headers[name.toLowerCase()] ?? req.headers[name];
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

function bearer(req: IncomingRequest): string | undefined {
  const value = header(req, "authorization");
  if (!value) return undefined;
  const [scheme, token] = value.split(" ");
  if (!token || scheme.toLowerCase() !== "bearer") return undefined;
  return token.trim();
}

export function requestedWorkspaceId(req: IncomingRequest): string | undefined {
  const fromHeader = header(req, "x-workspace-id");
  if (fromHeader) return fromHeader;
  const queryValue = req.query.workspace_id ?? req.query.workspace;
  if (Array.isArray(queryValue)) return queryValue[0];
  return queryValue;
}

async function fromSession(req: IncomingRequest): Promise<CallerContext> {
  const token = bearer(req);
  if (!token) throw unauthorized();

  const { data, error } = await admin().auth.getUser(token);
  if (error || !data?.user) throw unauthorized("Your session has expired — sign in again");

  const user = data.user;
  const profile = await query<ProfileRow[]>(
    admin().from("profiles").select("id, email, is_platform_admin").eq("id", user.id).limit(1),
    "profile lookup",
  );

  const workspaces = await query<MemberRow[]>(
    admin()
      .from("workspace_members")
      .select("workspace_id, role, status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: true }),
    "membership lookup",
  );

  if (workspaces.length === 0) {
    // The signup trigger creates the workspace; if it is missing the account was
    // created outside of Zybble's flow and needs repair instead of a fake one.
    throw forbidden("No workspace is linked to this account yet — finish onboarding first");
  }

  const requested = requestedWorkspaceId(req);
  const membership = requested
    ? workspaces.find((w) => w.workspace_id === requested)
    : workspaces[0];

  if (!membership) throw forbidden("You are not a member of that workspace");

  return {
    userId: user.id,
    email: profile[0]?.email ?? user.email ?? null,
    workspaceId: membership.workspace_id,
    role: membership.role,
    via: "session",
    scopes: [],
    isPlatformAdmin: Boolean(profile[0]?.is_platform_admin),
  };
}

export function hashKey(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

type ApiKeyRow = {
  id: string;
  workspace_id: string;
  key_hash: string;
  scopes: string[];
  rate_limit_per_minute: number;
  revoked_at: string | null;
  expires_at: string | null;
};

async function fromApiKey(secret: string): Promise<CallerContext> {
  // Public prefix is stored for lookups; the secret itself is never persisted.
  const prefix = secret.slice(0, 16);
  const rows = await query<ApiKeyRow[]>(
    admin()
      .from("api_keys")
      .select("id, workspace_id, key_hash, scopes, rate_limit_per_minute, revoked_at, expires_at")
      .eq("prefix", prefix)
      .is("revoked_at", null)
      .limit(1),
    "api key lookup",
  );

  const key = rows[0];
  if (!key) throw unauthorized("Unknown API key");

  const expected = Buffer.from(key.key_hash, "hex");
  const actual = Buffer.from(hashKey(secret), "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw unauthorized("Invalid API key");
  }

  if (key.expires_at && new Date(key.expires_at).getTime() < Date.now()) {
    throw unauthorized("This API key has expired");
  }

  const limit = await rpcRows<{ allowed: boolean; remaining: number; reset_seconds: number }>("rate_limit_hit", {
    p_bucket: `api_key:${key.id}`,
    p_limit: key.rate_limit_per_minute,
    p_window_seconds: 60,
  });
  if (limit[0] && !limit[0].allowed) {
    throw rateLimited("API key rate limit reached", { retry_after_seconds: limit[0].reset_seconds });
  }

  // Usage bookkeeping must never slow down or fail the actual request.
  void admin()
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", key.id)
    .then(() => undefined, () => undefined);

  return {
    userId: null,
    email: null,
    workspaceId: key.workspace_id,
    role: "api_key",
    via: "api_key",
    scopes: key.scopes ?? [],
    apiKeyId: key.id,
    isPlatformAdmin: false,
  };
}

export async function resolveCaller(req: IncomingRequest, options: RouteOptions): Promise<CallerContext | null> {
  const mode = options.auth ?? "session";
  if (mode === "none") return null;

  const token = bearer(req) ?? header(req, "x-api-key");
  if (!token) {
    if (mode === "both" || mode === "session") throw unauthorized();
    throw unauthorized("An API key is required for this endpoint");
  }

  const looksLikeApiKey = token.startsWith("zyb_");

  if (looksLikeApiKey) {
    if (mode === "session") throw unauthorized("This endpoint requires a signed-in user, not an API key");
    const ctx = await fromApiKey(token);
    if (options.scopes && options.scopes.length > 0) {
      const missing = options.scopes.filter((s) => !ctx.scopes.includes(s));
      if (missing.length > 0) throw forbidden(`This API key is missing the ${missing.join(", ")} scope`);
    }
    return ctx;
  }

  if (mode === "api_key") throw unauthorized("This endpoint requires an API key");
  return fromSession(req);
}

/** Role check inside the workspace (owner > admin > member > viewer). */
export function assertRole(ctx: CallerContext, roles: Array<WorkspaceRole>): void {
  if (ctx.role === "api_key") {
    // API keys act with the scopes that were granted to them.
    return;
  }
  if (!roles.includes(ctx.role)) {
    throw forbidden(`This action requires the ${roles.join(" or ")} role`);
  }
}

export function requireUserId(ctx: CallerContext): string {
  if (!ctx.userId) throw badRequest("This action requires a signed-in user");
  return ctx.userId;
}
