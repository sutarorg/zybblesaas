import { route, ok } from "./_lib/http";
import { rpc } from "./_lib/supabase";
import { admin, query } from "./_lib/supabase";
import { features } from "./_lib/env";

export const WORKER_VERSION = "1.0.0";

type QueueStats = {
  pending: number;
  running: number;
  failed_last_hour: number;
  expired_leases: number;
  oldest_pending_age_seconds: number;
};

/**
 * Liveness for the API. Deliberately boring: it reports what it can measure and
 * says "unknown" instead of inventing status. Secrets are never echoed.
 */
export default route({ methods: ["GET"], auth: "none", limit: { bucket: "health", perMinute: 600 } }, async () => {
  const started = Date.now();

  let database: { ok: boolean; latencyMs?: number; error?: string } = { ok: false };
  let queue: QueueStats | null = null;
  let workers: { total: number; online: number; newestHeartbeat: string | null } = { total: 0, online: 0, newestHeartbeat: null };

  try {
    const plans = await query<Array<{ id: string }>>(admin().from("plans").select("id").limit(1), "health plans");
    database = { ok: true, latencyMs: Date.now() - started };

    if (plans.length === 0) {
      database = { ok: false, error: "plans table is empty — migrations 0010_seed.sql has not been applied" };
    }
  } catch (error) {
    database = { ok: false, error: error instanceof Error ? error.message : "database unreachable" };
  }

  if (database.ok) {
    try {
      queue = await rpc<QueueStats>("queue_stats");
    } catch {
      queue = null;
    }
  }

  if (database.ok) {
    try {
      // ops.workers is readable by the service key only; the worker heartbeats
      // every 15 s, so "online" means a heartbeat inside the last minute.
      const rows = await query<Array<{ worker_id: string; status: string; last_heartbeat_at: string }>>(
        admin().schema("ops").from("workers").select("worker_id, status, last_heartbeat_at").limit(50),
        "health workers",
      );
      const cutoff = Date.now() - 60_000;
      workers = {
        total: rows.length,
        online: rows.filter((row) => new Date(row.last_heartbeat_at).getTime() >= cutoff).length,
        newestHeartbeat: rows.map((row) => row.last_heartbeat_at).sort().at(-1) ?? null,
      };
    } catch {
      workers = { total: 0, online: 0, newestHeartbeat: null };
    }
  }

  const okOverall = database.ok;
  return ok(
    {
      ok: okOverall,
      service: "zybble-api",
      time: new Date().toISOString(),
      database,
      queue,
      workers,
      features: features(),
    },
    okOverall ? 200 : 503,
  );
});
