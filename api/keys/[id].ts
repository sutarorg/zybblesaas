import { z } from "zod";
import { route, ok, created } from "../_lib/http";
import { parse } from "../_lib/validate";
import { admin, query } from "../_lib/supabase";
import { audit } from "../_lib/audit";
import { conflict, notFound } from "../_lib/errors";
import { generateApiKey } from "./index";

const patchSchema = z.object({ name: z.string().min(1).max(80).optional(), revoke: z.boolean().optional() });

type KeyRow = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  expires_at: string | null;
  revoked_at: string | null;
  rate_limit_per_minute: number;
};

async function loadKey(workspaceId: string, id: string): Promise<KeyRow> {
  const rows = await query<KeyRow[]>(
    admin()
      .from("api_keys")
      .select("id, name, prefix, scopes, expires_at, revoked_at, rate_limit_per_minute")
      .eq("workspace_id", workspaceId)
      .eq("id", id)
      .limit(1),
    "api key lookup",
  );
  const key = rows[0];
  if (!key) throw notFound("API key not found");
  return key;
}

export default route(
  { methods: ["PATCH", "DELETE", "POST"], auth: "session", roles: ["owner", "admin"], limit: { bucket: "api-key-mutations", perMinute: 60 } },
  async (ctx) => {
    const id = ctx.params.id;
    if (!id) throw notFound("API key not found");
    const key = await loadKey(ctx.workspaceId, id);
    const method = ctx.req.method?.toUpperCase();

    // POST rotates: a new secret is issued and the old one stops working.
    if (method === "POST") {
      if (key.revoked_at) throw conflict("This key is already revoked — create a new one instead");
      const replacement = generateApiKey();
      const rows = await query<Array<{ id: string }>>(
        admin()
          .from("api_keys")
          .insert({
            workspace_id: ctx.workspaceId,
            created_by: ctx.caller?.userId ?? null,
            name: key.name,
            prefix: replacement.prefix,
            key_hash: replacement.hash,
            scopes: key.scopes,
            rate_limit_per_minute: key.rate_limit_per_minute,
            expires_at: key.expires_at,
            rotated_from: key.id,
          })
          .select("id"),
        "api key rotate",
      );
      await query(admin().from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", key.id).select("id"), "api key revoke old");

      await audit(ctx, { action: "api_key.rotated", targetType: "api_key", targetId: rows[0]?.id ?? null, metadata: { rotated_from: key.prefix } });

      return created({
        key: { id: rows[0]?.id, name: key.name, prefix: replacement.prefix, scopes: key.scopes, expiresAt: key.expires_at },
        secret: replacement.secret,
        previousRevoked: true,
        warning: "The previous key stopped working immediately. Copy this secret now — it cannot be shown again.",
      });
    }

    if (method === "DELETE") {
      await query(admin().from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", key.id).select("id"), "api key revoke");
      await audit(ctx, { action: "api_key.revoked", targetType: "api_key", targetId: key.id, metadata: { prefix: key.prefix } });
      return ok({ revoked: true, id: key.id });
    }

    const body = parse(patchSchema, ctx.body);
    const patch: Record<string, unknown> = {};
    if (body.name) patch.name = body.name;
    if (body.revoke) patch.revoked_at = new Date().toISOString();
    if (Object.keys(patch).length === 0) return ok({ updated: false, key: { id: key.id, name: key.name } });

    await query(admin().from("api_keys").update(patch).eq("id", key.id).select("id"), "api key patch");
    await audit(ctx, { action: "api_key.updated", targetType: "api_key", targetId: key.id, metadata: patch });
    return ok({ updated: true, key: { id: key.id, name: body.name ?? key.name } });
  },
);
