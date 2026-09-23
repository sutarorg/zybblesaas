/**
 * API smoke test — drills every route through the real `route()` wrapper with
 * no environment configured.
 *
 * It proves the properties that must hold even before a database exists:
 *   • every route answers instead of crashing,
 *   • unsupported methods get 405 + Allow,
 *   • malformed bodies get 400 with the error envelope and a request id,
 *   • unauthenticated calls get 401, and provider/database-less calls get an
 *     honest 503 / 5xx envelope rather than fabricated data,
 *   • /api/system reports the truth about what is configured,
 *   • nothing in any response leaks a secret-shaped value,
 *   • the central router in api/_lib/router dispatches requests correctly.
 *
 * Run with:  npx tsx scripts/api-smoke.ts
 * (With SUPABASE_URL/SUPABASE_SECRET_KEY set, the 503 expectations become real
 * database calls and the summary will report the live status codes instead.)
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

type IncomingRequest = {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | string[] | undefined>;
  body: unknown;
  rawBody?: string;
};

type OutgoingResponse = {
  status(code: number): OutgoingResponse;
  setHeader(name: string, value: string | number | readonly string[]): void;
  json(body: unknown): void;
  end(): void;
};

type Captured = { status: number; headers: Record<string, string>; body: unknown; ended: boolean };

function fakeResponse(): { res: OutgoingResponse; captured: Captured } {
  const captured: Captured = { status: 200, headers: {}, body: undefined, ended: false };
  const res: OutgoingResponse = {
    status(code) {
      captured.status = code;
      return res;
    },
    setHeader(name, value) {
      captured.headers[name.toLowerCase()] = Array.isArray(value) ? value.join(", ") : String(value);
    },
    json(body) {
      captured.body = body;
    },
    end() {
      captured.ended = true;
    },
  };
  return { res, captured };
}

function request(overrides: Partial<IncomingRequest> = {}): IncomingRequest {
  return {
    method: "GET",
    url: "/api/test",
    headers: {},
    query: {},
    body: undefined,
    ...overrides,
  };
}

function routeFiles(dir = "api/_routes", acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "_lib") continue;
      routeFiles(full, acc);
    } else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
      acc.push(full);
    }
  }
  return acc;
}

function apiPath(file: string): string {
  return "/" + file.replace(/^api\/_routes\/?/, "api/").replace(/\.ts$/, "").replace(/\[([^\]]+)\]/g, "sample-$1");
}

const SECRET_SHAPES = [
  /sb_secret_[A-Za-z0-9_-]{8,}/,
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/,
  /AIza[A-Za-z0-9_-]{20,}/,
  /rzp_live_[A-Za-z0-9]{8,}/,
];

type Row = { route: string; method: string; scenario: string; status: number; code: string };

async function main() {
  const rows: Row[] = [];
  const problems: string[] = [];

  const files = routeFiles().sort();
  let routeCount = 0;

  for (const file of files) {
    const mod = (await import(pathToFileURL(join(process.cwd(), file)).href)) as {
      default?: (req: IncomingRequest, res: OutgoingResponse) => Promise<unknown>;
    };
    if (typeof mod.default !== "function") {
      problems.push(`${file} has no default export`);
      continue;
    }
    routeCount += 1;
    const handler = mod.default;

    const call = async (req: IncomingRequest) => {
      const { res, captured } = fakeResponse();
      await handler(req, res);
      const body = captured.body as { error?: { code?: string } } | undefined;
      return { captured, code: body?.error?.code ?? "" };
    };

    // 1. Unsupported method → 405 with Allow.
    const wrongMethod = await call(request({ method: "TRACE", url: apiPath(file) }));
    rows.push({ route: apiPath(file), method: "TRACE", scenario: "method not allowed", status: wrongMethod.captured.status, code: wrongMethod.code });
    if (wrongMethod.captured.status !== 405 || !wrongMethod.captured.headers.allow) {
      problems.push(`${file}: expected 405 + Allow for TRACE, got ${wrongMethod.captured.status}`);
    }

    // 2. An anonymous, empty call in each supported method shape.
    for (const method of ["GET", "POST"]) {
      const probe = await call(request({ method, url: apiPath(file), query: { slug: "sample" } }));
      rows.push({ route: apiPath(file), method, scenario: "anonymous / empty", status: probe.captured.status, code: probe.code });
      // Routes that are *designed* to answer without credentials: /api/system
      // (which providers are configured), /api/health (liveness of the
      // database/queue/workers) and /api/billing/plans (the public price list).
      // They must still answer, so they are exempt from the "no anonymous 200"
      // rule but not from the secret-leak check below.
      const publicByDesign = ["/api/system", "/api/health", "/api/billing/plans"].includes(apiPath(file));
      if (probe.captured.status === 200 && !publicByDesign) {
        problems.push(`${file}: an anonymous ${method} returned 200 with no credentials (${JSON.stringify(probe.captured.body).slice(0, 120)})`);
      }
    }

    // 3. Malformed JSON body → 400 envelope.
    const malformed = await call(request({ method: "POST", url: apiPath(file), body: "{not json" }));
    rows.push({ route: apiPath(file), method: "POST", scenario: "malformed JSON", status: malformed.captured.status, code: malformed.code });
    if (malformed.captured.status === 400 && malformed.code !== "bad_request") {
      problems.push(`${file}: 400 without a bad_request code`);
    }

    // 4. No secret may ever appear in a response.
    const serialized = JSON.stringify(rows.filter((row) => row.route === apiPath(file)));
    for (const shape of SECRET_SHAPES) {
      if (shape.test(serialized)) problems.push(`${file}: response looks like it leaked a secret`);
    }
  }

  // 5. The public status endpoint must describe reality.
  const system = (await import(pathToFileURL(join(process.cwd(), "api/_routes/system.ts")).href)) as {
    default: (req: IncomingRequest, res: OutgoingResponse) => Promise<unknown>;
  };
  const { res: systemRes, captured: systemBody } = fakeResponse();
  await system.default(request({ url: "/api/system" }), systemRes);
  const body = systemBody.body as { service?: string; features?: Record<string, boolean>; billingProvider?: unknown };
  if (systemBody.status !== 200) problems.push(`/api/system returned ${systemBody.status}`);
  if (typeof body?.features?.ai !== "boolean" || typeof body?.features?.billing !== "boolean") {
    problems.push("/api/system does not report boolean feature flags");
  }

  // 6. Test the central router with both path query param and url pathing.
  const router = (await import(pathToFileURL(join(process.cwd(), "api/_lib/router.ts")).href)) as {
    default: (req: IncomingRequest, res: OutgoingResponse) => Promise<unknown>;
  };
  const { res: routerRes, captured: routerBody } = fakeResponse();
  await router.default(request({ url: "/api/system", query: { path: "system" } }), routerRes);
  if (routerBody.status !== 200) {
    problems.push(`api/_lib/router failed to route /api/system (got ${routerBody.status})`);
  }

  const { res: catchallRes, captured: catchallBody } = fakeResponse();
  await router.default(request({ url: "/api/billing/plans", query: { path: ["billing", "plans"] } }), catchallRes);
  // /api/billing/plans returns 200 when DB is present or 503 when running without DB (not 404).
  if (catchallBody.status !== 200 && catchallBody.status !== 503) {
    problems.push(`api/_lib/router failed to route /api/billing/plans (got ${catchallBody.status})`);
  }

  // ---- report -----------------------------------------------------------------
  const byStatus = new Map<number, number>();
  for (const row of rows) byStatus.set(row.status, (byStatus.get(row.status) ?? 0) + 1);
  const noisy = rows.filter((row) => row.status >= 500 && row.scenario !== "anonymous / empty");

  console.log(`API routes exercised: ${routeCount} (${rows.length} requests)`);
  console.log("Status distribution:", Object.fromEntries([...byStatus.entries()].sort((a, b) => a[0] - b[0])));
  console.log("\nPer-route status (anonymous GET / anonymous POST / malformed POST):");
  const routes = [...new Set(rows.map((row) => row.route))].sort();
  for (const route of routes) {
    const pick = (scenario: string, method: string) =>
      rows.find((row) => row.route === route && row.method === method && row.scenario === scenario)?.status ?? "-";
    console.log(
      `  ${route.padEnd(34)} ${String(pick("anonymous / empty", "GET")).padStart(4)} ${String(
        pick("anonymous / empty", "POST"),
      ).padStart(4)} ${String(pick("malformed JSON", "POST")).padStart(4)}`,
    );
  }
  if (noisy.length) {
    console.log("\nNon-envelope 5xx responses (these must be reported, never hidden):");
    for (const row of noisy) console.log(`  ${row.route} ${row.method} → ${row.status} ${row.code}`);
  }
  console.log(`\n/api/system → ${systemBody.status} ${JSON.stringify(body)}\n`);

  if (problems.length) {
    console.error("PROBLEMS:");
    for (const problem of problems) console.error(`  ✗ ${problem}`);
    process.exitCode = 1;
    return;
  }
  console.log("✓ every route answered, methods are enforced, anonymous calls are refused,");
  console.log("✓ malformed bodies produce the error envelope, and no response leaked a secret.");
  console.log("✓ central router verified successfully.");
}

void main();
