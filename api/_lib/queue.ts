import { rpc } from "./supabase.js";

export type JobType =
  | "scrape"
  | "email_enrichment"
  | "ai_search_plan"
  | "ai_lead_analysis"
  | "ai_lead_scoring"
  | "ai_list_analysis"
  | "ai_chat"
  | "export"
  | "notification"
  | "cleanup";

/**
 * Enqueue work for the Railway worker.
 *
 * `dedupeKey` makes enqueueing idempotent while a job with the same key is
 * pending or running — a double-clicked button or a retried request cannot
 * scrape the same search input twice.
 */
export async function enqueue(options: {
  jobType: JobType;
  workspaceId: string | null;
  payload: Record<string, unknown>;
  priority?: number;
  dedupeKey?: string | null;
  availableAt?: string | null;
  maxAttempts?: number;
  scheduledBy?: string;
}): Promise<string> {
  return rpc<string>("queue_enqueue", {
    p_job_type: options.jobType,
    p_payload: options.payload,
    p_workspace_id: options.workspaceId,
    p_priority: options.priority ?? 50,
    p_dedupe_key: options.dedupeKey ?? null,
    p_available_at: options.availableAt ?? new Date().toISOString(),
    p_max_attempts: options.maxAttempts ?? 3,
    p_scheduled_by: options.scheduledBy ?? "api",
  });
}

export async function enqueueMany(jobs: Array<Parameters<typeof enqueue>[0]>): Promise<string[]> {
  const ids: string[] = [];
  for (const job of jobs) ids.push(await enqueue(job));
  return ids;
}
