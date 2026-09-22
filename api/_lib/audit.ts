import { createHash } from "node:crypto";
import { admin } from "./supabase";
import type { RouteContext } from "./http";

function compact(ip: string | undefined): string | null {
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

export type AuditInput = {
  action: string;
  targetType?: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Audit trail for every state change that matters. Written with the service
 * role: profiles can never edit or delete their own audit rows.
 */
export async function audit(ctx: RouteContext, input: AuditInput): Promise<void> {
  const caller = ctx.caller;
  if (!caller) return;

  const forwarded = ctx.req.headers["x-forwarded-for"];
  const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded;

  const { error } = await admin().from("audit_logs").insert({
    workspace_id: caller.workspaceId,
    actor_id: caller.userId,
    actor_type: caller.via === "api_key" ? "api_key" : "user",
    action: input.action,
    target_type: input.targetType ?? null,
    target_id: input.targetId ?? null,
    metadata: { ...(input.metadata ?? {}), api_key_id: caller.apiKeyId ?? null },
    ip_hash: compact(ip?.split(",")[0]?.trim()),
    user_agent: (Array.isArray(ctx.req.headers["user-agent"]) ? ctx.req.headers["user-agent"][0] : ctx.req.headers["user-agent"]) ?? null,
  });

  if (error) {
    // An audit failure must be visible but must not lose the user's action.
    console.error("[audit] failed to write entry", { action: input.action, error: error.message });
  }
}
