export type ErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "method_not_allowed"
  | "conflict"
  | "rate_limited"
  | "quota_exceeded"
  | "plan_required"
  | "not_configured"
  | "engine_error"
  | "provider_error"
  | "internal_error";

const STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  method_not_allowed: 405,
  conflict: 409,
  rate_limited: 429,
  quota_exceeded: 402,
  plan_required: 402,
  not_configured: 503,
  engine_error: 502,
  provider_error: 502,
  internal_error: 500,
};

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;
  readonly expose: boolean;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
    this.expose = true;
  }

  toJSON() {
    return { error: { code: this.code, message: this.message, ...(this.details ? { details: this.details } : {}) } };
  }
}

export const badRequest = (message: string, details?: unknown) => new ApiError("bad_request", message, details);
export const unauthorized = (message = "Authentication required") => new ApiError("unauthorized", message);
export const forbidden = (message = "You do not have access to this resource") => new ApiError("forbidden", message);
export const notFound = (message = "Resource not found") => new ApiError("not_found", message);
export const conflict = (message: string, details?: unknown) => new ApiError("conflict", message, details);
export const rateLimited = (message = "Too many requests", details?: unknown) => new ApiError("rate_limited", message, details);
export const quotaExceeded = (message: string, details?: unknown) => new ApiError("quota_exceeded", message, details);
export const planRequired = (message: string, details?: unknown) => new ApiError("plan_required", message, details);
export const notConfigured = (message: string) => new ApiError("not_configured", message);
export const providerError = (message: string, details?: unknown) => new ApiError("provider_error", message, details);
export const internalError = (message = "Unexpected server error") => new ApiError("internal_error", message);
