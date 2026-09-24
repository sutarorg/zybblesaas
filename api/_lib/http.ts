import { ApiError, internalError } from "./errors.js";
import { assertRole, resolveCaller, type CallerContext, type WorkspaceRole } from "./auth.js";
import { rpcRows } from "./supabase.js";
import type { Handler, IncomingRequest, OutgoingResponse, RouteOptions } from "./types.js";

export type RouteContext = {
  req: IncomingRequest;
  res: OutgoingResponse;
  caller: CallerContext | null;
  /** workspace id (never trust a client-supplied value without this) */
  workspaceId: string;
  body: Record<string, unknown>;
  query: Record<string, string>;
  params: Record<string, string>;
};

export type Payload = { status?: number; body: unknown; headers?: Record<string, string> };

function normalizeQuery(req: IncomingRequest): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.query ?? {})) {
    if (Array.isArray(value)) out[key] = value[0] ?? "";
    else if (typeof value === "string") out[key] = value;
  }
  return out;
}

function normalizeBody(req: IncomingRequest): Record<string, unknown> {
  const body = req.body;
  if (!body) return {};
  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body);
      return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
    } catch {
      throw new ApiError("bad_request", "Request body must be valid JSON");
    }
  }
  if (typeof body === "object") return body as Record<string, unknown>;
  return {};
}

function headers(): Record<string, string> {
  return {
    "cache-control": "no-store, max-age=0",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
  };
}

/**
 * Wraps a handler with: method check, body parsing, authentication,
 * workspace scoping, per-caller rate limiting and uniform error responses.
 *
 * `params` receives the dynamic segments resolved by the router in `_lib/router.ts`.
 */
export function route(
  options: RouteOptions,
  handler: (ctx: RouteContext) => Promise<Payload | void> | Payload | void,
): Handler<void> {
  return async (req: IncomingRequest, res: OutgoingResponse) => {
    const requestId = Math.random().toString(36).slice(2, 10);
    try {
      const method = (req.method ?? "GET").toUpperCase();
      if (!options.methods.includes(method)) {
        res.setHeader("allow", options.methods.join(", "));
        const error = new ApiError("method_not_allowed", `${method} is not supported here`);
        res.status(error.status);
        for (const [k, v] of Object.entries(headers())) res.setHeader(k, v);
        res.json({ ...error.toJSON(), request_id: requestId });
        return;
      }

      const caller = await resolveCaller(req, options);
      if (caller && options.roles) assertRole(caller, options.roles as WorkspaceRole[]);

      if (caller && options.limit) {
        const rows = await rpcRows<{ allowed: boolean; remaining: number; reset_seconds: number }>("rate_limit_hit", {
          p_bucket: `${caller.via}:${caller.userId ?? caller.apiKeyId}:${options.limit.bucket}`,
          p_limit: options.limit.perMinute,
          p_window_seconds: 60,
        });
        const limited = rows[0];
        if (limited && !limited.allowed) {
          res.status(429);
          for (const [k, v] of Object.entries(headers())) res.setHeader(k, v);
          res.json({
            error: { code: "rate_limited", message: "Too many requests — slow down for a moment" },
            retry_after_seconds: limited.reset_seconds,
            request_id: requestId,
          });
          return;
        }
      }

      // Vercel merges dynamic route segments ([slug]) into req.query, so the
      // same map serves both purposes.
      const query = normalizeQuery(req);
      const ctx: RouteContext = {
        req,
        res,
        caller,
        workspaceId: caller?.workspaceId ?? "",
        body: normalizeBody(req),
        query,
        params: query,
      };

      const result = await handler(ctx);
      const status = result?.status ?? 200;
      res.status(status);
      for (const [k, v] of Object.entries(headers())) res.setHeader(k, v);
      for (const [k, v] of Object.entries(result?.headers ?? {})) res.setHeader(k, v);
      if (result?.body === undefined) res.end();
      else res.json(result.body);
    } catch (error) {
      const apiError = error instanceof ApiError ? error : internalError();
      for (const [k, v] of Object.entries(headers())) res.setHeader(k, v);
      res.status(apiError.status);
      res.json({ ...apiError.toJSON(), request_id: requestId });

      if (!(error instanceof ApiError)) {
        // Never swallow unexpected errors: they are the signal that something
        // is broken in production.
        console.error(`[api:${requestId}]`, error);
      }
    }
  };
}

export function ok(body: unknown, status = 200): Payload {
  return { status, body };
}

export function created(body: unknown): Payload {
  return { status: 201, body };
}

export function noContent(): Payload {
  return { status: 204, body: undefined };
}

/** Reads the raw body (webhook signature verification needs the exact bytes). */
export async function readRawBody(req: unknown): Promise<string> {
  const request = req as {
    body?: unknown;
    on?: (event: string, cb: (chunk?: unknown) => void) => void;
    [key: string]: unknown;
  };

  if (typeof request.body === "string") return request.body;
  if (Buffer.isBuffer(request.body)) return request.body.toString("utf8");
  if (request.body && typeof request.body === "object") {
    // Body parser already ran: re-serialising preserves the values but not the
    // original byte sequence, so signature verification must use `bodyParser:false`.
    return JSON.stringify(request.body);
  }
  if (typeof request.on !== "function") return "";

  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    request.on!("data", (chunk) => {
      if (typeof chunk === "string") chunks.push(Buffer.from(chunk));
      else if (Buffer.isBuffer(chunk)) chunks.push(chunk);
    });
    request.on!("end", () => resolve());
    request.on!("error", (err) => reject(err instanceof Error ? err : new Error("stream error")));
  });
  return Buffer.concat(chunks).toString("utf8");
}
