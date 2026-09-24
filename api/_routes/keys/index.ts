import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { route, ok, created } from "../../_lib/http.js";
import { parse } from "../../_lib/validate.js";
import { admin, query } from "../../_lib/supabase.js";
import { entitlements } from "../../_lib/entitlements.js";
import { audit } from "../../_lib/audit.js";
import { planRequired } from "../../_lib/errors.js";

const SCOPES = ["searches:read", "searches:write", "leads:read", "leads:write", "lists:read", "lists:write", "exports:read", "exports:write"] as const;

const createSchema = z.object({
  name: z.string().min(1).max(80),
  scopes: z.array(z.enum(SCOPES)).min(1).default(["searches:read", "leads:read", "lists:read", "exports:read"]),
  expiresInDays: z.number().int().min(1).max(730).nullable().default(null),
});

export function generateApiKey(): { prefix: string; secret: string; hash: string } {
  const prefix = `zyb_live_${randomBytes(4).toString("hex")}`;
  const secret = `${prefix}_${randomBytes(24).toString("base64url")}`;
  return { prefix, secret, hash: createHash("sha256").update(secret, "utf8").digest("hex") };
}

export default route(
  { methods: ["GET", "POST"], auth: "session", roles: ["owner", "admin"], limit: { bucket: "api-keys", perMinute: 60 } },
  async (ctx) => {
    if (ctx.req.method?.toUpperCase() === "GET") {
      const rows = await query<Array<Record<string, unknown>>>(
        admin()
          .from("api_keys")
          .select("id, name, prefix, scopes, rate_limit_per_minute, last_used_at, request_count, expires_at, revoked_at, created_at")
          .eq("workspace_id", ctx.workspaceId)
          .order("created_at", { ascending: false })
          .limit(100),
        "api keys",
      );

      return ok({
        items: rows.map((row) => ({
          id: row.id,
          name: row.name,
          // The prefix is the only part that can safely be shown again.
          prefix: row.prefix,
          masked: `${row.prefix}••••••••`,
          scopes: row.scopes,
          rateLimitPerMinute: row.rate_limit_per_minute,
          lastUsedAt: row.last_used_at,
          requestCount: row.request_count,
          expiresAt: row.expires_at,
          revokedAt: row.revoked_at,
          active: !row.revoked_at && (!row.expires_at || new Date(String(row.expires_at)).getTime() > Date.now()),
          createdAt: row.created_at,
        })),
        availableScopes: SCOPES,
      });
    }

    const body = parse(createSchema, ctx.body);
    const ent = await entitlements(ctx.workspaceId);
    if (!ent.plan.api_access) {
      throw planRequired(`API access is not included in the ${ent.plan.name} plan`, { plan: ent.plan.code, upgrade: "/billing" });
    }

    const key = generateApiKey();
    const expiresAt = body.expiresInDays ? new Date(Date.now() + body.expiresInDays * 86_400_000).toISOString() : null;

    const rows = await query<Array<{ id: string }>>(
      admin()
        .from("api_keys")
        .insert({
          workspace_id: ctx.workspaceId,
          created_by: ctx.caller?.userId ?? null,
          name: body.name,
          prefix: key.prefix,
          key_hash: key.hash,
          scopes: body.scopes,
          expires_at: expiresAt,
        })
        .select("id"),
      "api key insert",
    );

    await audit(ctx, { action: "api_key.created", targetType: "api_key", targetId: rows[0]?.id ?? null, metadata: { name: body.name, scopes: body.scopes } });

    return created({
      key: { id: rows[0]?.id, name: body.name, prefix: key.prefix, scopes: body.scopes, expiresAt },
      // Shown once; only the SHA-256 hash is stored.
      secret: key.secret,
      warning: "Copy this key now — Zybble stores only its hash and cannot show it again.",
    });
  },
);
