import { createHash } from "node:crypto";
import { admin, query } from "./supabase.js";
import type { Entitlements } from "./entitlements.js";

/** Values allowed by ai_runs_task_check (migration 0005). */
export type AiTask = "SEARCH_PLAN" | "LEAD_ANALYSIS" | "LEAD_SCORING" | "LIST_ANALYSIS" | "AI_CHAT";

export function inputHash(parts: unknown[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 40);
}

/** Opens the audit row for an AI call so cost and provenance are always recorded. */
export async function startRun(input: {
  workspaceId: string;
  task: AiTask;
  model: string;
  promptVersion: string;
  hash: string;
  createdBy?: string | null;
  conversationId?: string | null;
  leadId?: string | null;
  searchId?: string | null;
  listId?: string | null;
}): Promise<string | null> {
  try {
    const rows = await query<Array<{ id: string }>>(
      admin()
        .from("ai_runs")
        .insert({
          workspace_id: input.workspaceId,
          conversation_id: input.conversationId ?? null,
          lead_id: input.leadId ?? null,
          search_id: input.searchId ?? null,
          list_id: input.listId ?? null,
          task: input.task,
          status: "running",
          model: input.model,
          prompt_version: input.promptVersion,
          input_hash: input.hash,
          created_by: input.createdBy ?? null,
          started_at: new Date().toISOString(),
        })
        .select("id"),
      "ai run start",
    );
    return rows[0]?.id ?? null;
  } catch (error) {
    // A missing audit row must never block the customer's work, but it is loud.
    console.error("[ai] could not record run", error);
    return null;
  }
}

export type RunOutcome =
  | {
      status: "succeeded";
      result?: unknown;
      usage?: { promptTokens: number; candidateTokens: number; totalTokens: number };
      latencyMs?: number;
    }
  | { status: "failed"; code?: string; error: string };

export async function finishRun(runId: string | null, outcome: RunOutcome): Promise<void> {
  if (!runId) return;
  const patch =
    outcome.status === "succeeded"
      ? {
          status: "succeeded",
          input_tokens: outcome.usage?.promptTokens ?? null,
          output_tokens: outcome.usage?.candidateTokens ?? null,
          total_tokens: outcome.usage?.totalTokens ?? null,
          latency_ms: outcome.latencyMs ?? null,
          result: outcome.result ?? null,
          finished_at: new Date().toISOString(),
        }
      : {
          status: "failed",
          error_code: outcome.code ?? "provider_error",
          error_message: outcome.error.slice(0, 1000),
          finished_at: new Date().toISOString(),
        };

  try {
    await query(admin().from("ai_runs").update(patch).eq("id", runId).select("id"), "ai run finish");
  } catch (error) {
    console.error("[ai] could not finish run", error);
  }
}

export function aiQuota(ent: Entitlements) {
  return { used: ent.usage.ai_runs, included: ent.plan.ai_runs_per_period, plan: ent.plan.code };
}
