/**
 * Minimal request/response contracts.
 *
 * The API is deployed as Vercel Node functions, but the code stays free of
 * framework types so it can be typechecked and tested anywhere.
 */

export type IncomingRequest = {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | string[] | undefined>;
  body: unknown;
  /** raw request body, required for webhook signature verification */
  rawBody?: string;
};

export type OutgoingResponse = {
  status(code: number): OutgoingResponse;
  setHeader(name: string, value: string | number | readonly string[]): void;
  json(body: unknown): void;
  end(): void;
};

export type Handler<T> = (req: IncomingRequest, res: OutgoingResponse) => Promise<T> | T;

export type RouteOptions = {
  methods: string[];
  /** auth requirement: none (public), session/api-key (both), session only, api-key only */
  auth?: "none" | "both" | "session" | "api_key";
  /** scopes required when the caller authenticates with an API key */
  scopes?: string[];
  /** roles allowed inside a workspace (owner/admin/member/viewer) */
  roles?: Array<"owner" | "admin" | "member" | "viewer">;
  /** rate limit applied per caller */
  limit?: { bucket: string; perMinute: number };
};
