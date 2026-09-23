/**
 * Cross-language contract test.
 *
 * The API (TypeScript) and the worker (Go) meet in the job queue and in shared
 * AI cache keys, and neither compiler can see across that boundary. These tests
 * read both sides as text and assert the invariants that only hold if the two
 * stay in step:
 *
 *   * quota is reserved *before* an `ai_runs` row is opened, so a refused call
 *     cannot leave a permanently `running` run behind;
 *   * every job type the API enqueues is one the worker actually handles;
 *   * every job type the worker enables by default is allowed by the queue's
 *     check constraint and has a seeded priority.
 *   * the number of Serverless Functions in api/ stays <= 12 to respect Vercel's
 *     Hobby plan deployment limit.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const MIGRATIONS = join(ROOT, "supabase/migrations");

function read(relative: string): string {
  return readFileSync(join(ROOT, relative), "utf8");
}

function tsFiles(dir: string): Array<{ path: string; text: string }> {
  const out: Array<{ path: string; text: string }> = [];
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...tsFiles(path));
    else if (entry.name.endsWith(".ts")) out.push({ path, text: read(path) });
  }
  return out;
}

const aiFiles = tsFiles("api/_routes/ai");
const apiFiles = [...tsFiles("api"), ...tsFiles("api/_lib"), ...tsFiles("api/_routes")];
const workerText = read("worker/internal/jobs/jobs.go");
const workerConfig = read("worker/internal/config/config.go");

describe("AI quota ordering", () => {
  it("reserves quota before opening an ai_runs row", () => {
    const problems: string[] = [];
    for (const file of aiFiles) {
      const reserve = file.text.indexOf("reserveUsage(");
      const start = file.text.indexOf("startRun(");
      if (reserve === -1 && start === -1) continue;
      if (reserve === -1) {
        problems.push(`${file.path}: opens a run row without reserving quota`);
        continue;
      }
      if (start !== -1 && start < reserve) {
        problems.push(`${file.path}: startRun() is called before reserveUsage()`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("covers every AI route that spends quota", () => {
    // Files with their own reserveUsage call sites. A new route that spends AI
    // runs must show up here, otherwise the ordering check above is decorative.
    const reserving = aiFiles.filter((file) => file.text.includes("reserveUsage(")).map((file) => file.path);
    expect(reserving.sort()).toEqual([
      "api/_routes/ai/analyze.ts",
      "api/_routes/ai/chat.ts",
      "api/_routes/ai/list-analysis.ts",
      "api/_routes/ai/plan.ts",
    ]);
  });
});

describe("job type contract", () => {
  const enqueuedByApi = [
    ...new Set(apiFiles.flatMap((file) => [...file.text.matchAll(/jobType:\s*"([a-z_]+)"/g)].map((m) => m[1]!))),
  ].sort();

  // The worker's dispatch switch. Types listed as "handled: false" are answered,
  // not executed — they say so out loud instead of vanishing.
  const workerHandled = [...new Set([...workerText.matchAll(/case "([a-z_]+)"/g)].map((m) => m[1]!))];

  const workerDefaults = (
    /WORKER_JOB_TYPES",\s*"([^"]+)"/.exec(workerConfig)?.[1] ?? ""
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .sort();

  const migrationText = readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => read(`supabase/migrations/${name}`))
    .join("\n");

  it("only enqueues job types the worker knows about", () => {
    expect(enqueuedByApi).toEqual(["ai_lead_scoring", "export", "scrape"]);
    const unknown = enqueuedByApi.filter((type) => !workerHandled.includes(type));
    expect(unknown).toEqual([]);
  });

  it("keeps the worker's default job types valid in the database", () => {
    const allowed = /job_queue_type_check check \(job_type in \(([^)]+)\)\)/.exec(migrationText)?.[1];
    expect(allowed, "job_queue_type_check not found in migrations").toBeTruthy();
    const allowedTypes = [...allowed!.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!);
    const priorities = /'job_priorities', jsonb_build_object\(([^)]+)\)/.exec(migrationText)?.[1] ?? "";
    const priorityTypes = [...priorities.matchAll(/'([a-z_]+)'\s*,/g)].map((m) => m[1]!);

    expect(workerDefaults.length).toBeGreaterThan(3);
    expect(workerDefaults.filter((type) => !allowedTypes.includes(type))).toEqual([]);
    expect(workerDefaults.filter((type) => !priorityTypes.includes(type))).toEqual([]);
  });

  it("documents the job types the HTTP API does not enqueue", () => {
    // `cleanup` is queued by the worker's own maintenance ticker and
    // `notification` by `public.notify_workspace` from inside Postgres, so they
    // legitimately never appear as `jobType:` in api/.
    //
    // `ai_lead_analysis` is different: nothing enqueues it today. The API does a
    // single-lead analysis synchronously and enqueues only `ai_lead_scoring`, so
    // the worker's analysis mode is reachable only by queueing a job by hand.
    // It stays because it executes for real when that happens — and this list is
    // here so that adding or removing an enqueuer is a deliberate act.
    const workerOnly = workerDefaults.filter((type) => !enqueuedByApi.includes(type)).sort();
    expect(workerOnly).toEqual(["ai_lead_analysis", "cleanup", "notification"]);
  });
});

describe("Vercel Hobby plan limit", () => {
  it("keeps serverless functions under the 12 functions limit", () => {
    // Vercel Hobby plan rejects deployments with > 12 serverless functions during patchBuild.
    // Subdirectories starting with _ (like _lib and _routes) are ignored by Vercel's
    // function scanner.
    const functions = tsFiles("api").filter((f) => !f.path.startsWith("api/_"));
    expect(functions.length).toBeLessThanOrEqual(12);
  });
});
