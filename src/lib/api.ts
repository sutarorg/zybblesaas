import { supabase, supabaseConfigured } from "./supabase";

/**
 * The only way the app talks to the backend.
 *
 * Every call goes to the same-origin `/api/*` routes (Vercel functions), which
 * authenticate with the Supabase session token. Nothing here invents data: a
 * failed call throws an ApiError that the UI renders as-is.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(status: number, code: string, message: string, details?: unknown, requestId?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }

  /** True when the caller simply needs to sign in (or the session expired). */
  get isAuthError(): boolean {
    return this.status === 401;
  }

  /** True when the plan/quota blocks the action (upgrade prompt). */
  get isPlanError(): boolean {
    return this.status === 402 || this.code === "quota_exceeded" || this.code === "plan_required";
  }
}

export type QueryValue = string | number | boolean | null | undefined;

function toSearchParams(query?: Record<string, QueryValue>): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const serialised = params.toString();
  return serialised ? `?${serialised}` : "";
}

async function authHeaders(): Promise<Record<string, string>> {
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { authorization: `Bearer ${token}` } : {};
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
};

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  const url = `/api${path}${toSearchParams(options.query)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        accept: "application/json",
        ...(options.body === undefined ? {} : { "content-type": "application/json" }),
        ...(await authHeaders()),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
      credentials: "same-origin",
    });
  } catch (error) {
    throw new ApiError(
      0,
      "network_error",
      error instanceof Error && error.name === "AbortError"
        ? "The request was cancelled"
        : "Zybblesaas could not reach the API. Check your connection and try again.",
    );
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const body = payload as { error?: { code?: string; message?: string; details?: unknown }; request_id?: string } | null;
    throw new ApiError(
      response.status,
      body?.error?.code ?? "request_failed",
      body?.error?.message ?? `Request failed (${response.status})`,
      body?.error?.details,
      body?.request_id,
    );
  }

  return payload as T;
}

/* ------------------------------------------------------------------ shapes */

export type PlanPayload = {
  code: string;
  name: string;
  description: string | null;
  price_minor?: number;
  priceMajor?: number;
  currency: string;
  billing_interval?: string;
  trial_days?: number;
  features?: Array<{ label: string; included: boolean }>;
  limits?: Record<string, unknown>;
  is_active?: boolean;
  [key: string]: unknown;
};

export type Quota = {
  leads: { used: number; included: number; remaining: number };
  ai_runs: { used: number; included: number; remaining: number };
  seats: { used: number; included: number };
  concurrent_searches: { active: number; included: number };
  exports_created: number;
  emails_found: number;
};

export type StatsPayload = {
  stats: {
    period: { start: string; end: string };
    usage: Record<string, number | string>;
    active_searches: number;
    completed_searches: number;
    total_leads: number;
    leads_with_email: number;
    lists_count: number;
    exports_ready: number;
    unread_notifications: number;
    weekly_activity: Array<{ day: string; leads: number }>;
    recent_searches: Array<Record<string, unknown>>;
    recent_leads: Array<{ slug: string; business_name: string; email_primary: string | null; quality_score: number; created_at: string }>;
  };
  entitlements: Entitlements;
  quota: Quota;
  generatedAt: string;
};

export type Entitlements = {
  workspace: { id: string; name: string; slug: string; plan_id?: string | null; [key: string]: unknown };
  plan: {
    code: string;
    name: string;
    leads_per_period: number;
    ai_runs_per_period: number;
    seats: number;
    concurrent_searches: number;
    max_search_depth: number;
    max_radius_km: number;
    queue_priority: number;
    ai_enabled: boolean;
    api_access: boolean;
    grid_coverage: boolean;
    priority_queue: boolean;
    export_formats: string[];
    export_retention_days: number;
    [key: string]: unknown;
  };
  subscription: {
    id: string;
    status: string;
    razorpay_subscription_id: string | null;
    cancel_at_period_end?: boolean;
    current_period_end?: string | null;
    [key: string]: unknown;
  } | null;
  usage: {
    leads_generated: number;
    searches_created: number;
    ai_runs: number;
    exports_created: number;
    emails_found: number;
    [key: string]: unknown;
  };
  seats_used: number;
  active_searches: number;
  [key: string]: unknown;
};

export type MePayload = {
  caller: { userId: string | null; email: string | null; via: string; role: string | null; scopes: string[]; isPlatformAdmin: boolean };
  profile: { id: string; email: string; full_name: string | null; company: string | null; timezone: string | null; avatar_url: string | null } | null;
  workspace: Entitlements["workspace"];
  workspaces: Array<{ workspace_id: string; role: string; status: string; name: string | null; slug: string | null }>;
  plan: PlanPayload | null;
  subscription: Entitlements["subscription"];
  entitlements: Entitlements;
  quota: Quota;
  capabilities: { ai: boolean; billing: boolean; exports: boolean; apiKeys: boolean; [key: string]: boolean };
  [key: string]: unknown;
};

export type Job = {
  id: string;
  slug: string;
  query: string;
  city: string;
  status: "queued" | "running" | "paused" | "complete" | "failed";
  rawStatus: string;
  phase: string;
  planned: number;
  processed: number;
  found: number;
  emails: number;
  duplicates: number;
  filtered: number;
  errors: number;
  progress: number;
  createdLabel: string;
  duration: string;
  etaMin: number;
  etaSeconds: number | null;
  source: "manual" | "ai";
  flags: { email: boolean; fastMode: boolean; depth: number; radius: number; lang: string; grid: boolean; extraReviews: boolean };
  log: string[];
  aiPlan: Record<string, unknown> | null;
  language: string;
  engineVersion: string | null;
  workerId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LeadListItem = {
  id: string;
  slug: string;
  name: string;
  category: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  rating: number;
  reviews: number;
  status: string;
  qualityScore: number;
  aiScore: number | null;
  hasEmail: boolean;
  hasPhone: boolean;
  hasWebsite: boolean;
  firstSeenAt: string;
  billable?: boolean;
};

export type LeadDetail = LeadListItem & {
  seed: string;
  idx: number;
  plusCode: string;
  timezone: string;
  priceRange: string;
  lat: number;
  lng: number;
  hours: Array<{ day: string; time: string }>;
  popular: number[];
  about: string;
  description: string;
  reviewsPerRating: Record<string, number>;
  addresses: { street: string; postalCode: string; state: string; countryCode: string; complete: string };
  mapUrl: string;
  reviewsUrl: string;
  images: number;
  emails: Array<{ email: string; source: string; status: string; is_primary: boolean; verified_at: string | null }>;
  socials: Array<{ platform: string; url: string; handle: string | null }>;
  reviewSamples: Array<{ author: string; stars: number; text: string; when: string }>;
  aiAnalysis: {
    summary: string | null;
    fit: string | null;
    score: number | null;
    reasons: unknown;
    opportunities: unknown;
    risks: unknown;
    outreachAngle: string | null;
    model: string | null;
  } | null;
  completeness: number;
};

export type ListPayload = {
  id: string;
  slug: string;
  name: string;
  seed: string;
  count: number;
  withEmail: number;
  avgRating: number;
  completeness: number;
  updatedAgo: string;
  jobSlug: string | null;
  tag: string;
  description: string;
};

export type ExportPayload = {
  id: string;
  slug: string;
  name: string;
  source: string;
  sourceId: string | null;
  format: "CSV" | "JSON";
  rows: number;
  size: string;
  byteSize: number;
  status: "ready" | "generating" | "expired";
  rawStatus: string;
  createdLabel: string;
  expiresLabel: string | null;
};

export type NotificationPayload = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  severity: string;
  read: boolean;
  createdAt: string;
};

export type ApiKeyPayload = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at?: string | null;
  created_at?: string;
};

export type Page<T> = { items: T[]; total: number; limit: number; offset: number };

/* ------------------------------------------------------------------- routes */

export const api = {
  /* identity */
  me: () => apiFetch<MePayload>("/me"),
  stats: () => apiFetch<StatsPayload>("/stats"),
  system: () =>
    apiFetch<{ version: string; features: Record<string, boolean>; billing: Record<string, unknown>; [key: string]: unknown }>("/system"),
  health: () => apiFetch<Record<string, unknown>>("/health"),
  geo: (q: string, limit = 8) => apiFetch<{ places: Array<{ name: string; latitude: number; longitude: number; country_code: string | null }> }>("/geo", { query: { q, limit } }),

  /* searches */
  searches: {
    list: (query?: { status?: string; limit?: number; offset?: number }) => apiFetch<Page<Job>>("/searches", { query }),
    get: (slug: string) =>
      apiFetch<{
        search: Job;
        inputs: Array<{ id: string; seq: number; query_text: string; status: string; places_discovered: number; places_completed: number; last_error: string | null }>;
        events: Array<{ id: number; type: string; level: string; message: string; metadata: Record<string, unknown> | null; at: string }>;
        leads: LeadListItem[];
        pendingInputs: number;
      }>(`/searches/${encodeURIComponent(slug)}`),
    create: (body: {
      query: string;
      name?: string;
      location?: string;
      requestedCount?: number;
      source?: "manual" | "ai";
      config?: Record<string, unknown>;
      aiPlan?: Record<string, unknown> | null;
    }) => apiFetch<{ search: Job; inputs: number; queued: boolean; message?: string }>("/searches", { method: "POST", body }),
    rename: (slug: string, name: string) => apiFetch<{ search: Job }>(`/searches/${encodeURIComponent(slug)}`, { method: "PATCH", body: { name } }),
    action: (slug: string, action: "pause" | "resume" | "cancel" | "rerun") =>
      apiFetch<{ search: Job; queued?: boolean; message?: string }>(`/searches/${encodeURIComponent(slug)}`, { method: "POST", body: { action } }),
    remove: (slug: string) => apiFetch<{ deleted: boolean }>(`/searches/${encodeURIComponent(slug)}`, { method: "DELETE" }),
  },

  /* leads */
  leads: {
    list: (query?: {
      q?: string;
      city?: string;
      country?: string;
      category?: string;
      has_email?: boolean;
      has_phone?: boolean;
      has_website?: boolean;
      min_rating?: number;
      sort?: string;
      limit?: number;
      offset?: number;
    }) => apiFetch<Page<LeadListItem>>("/leads", { query }),
    get: (slug: string) => apiFetch<{ lead: LeadDetail }>(`/leads/${encodeURIComponent(slug)}`),
    addToList: (slug: string, target: { listId?: string; listSlug?: string }) =>
      apiFetch<{ ok: boolean; listId: string }>(`/leads/${encodeURIComponent(slug)}`, { method: "POST", body: { action: "add_to_list", ...target } }),
    removeFromList: (slug: string, target: { listId?: string; listSlug?: string }) =>
      apiFetch<{ ok: boolean; listId: string }>(`/leads/${encodeURIComponent(slug)}`, { method: "POST", body: { action: "remove_from_list", ...target } }),
  },

  /* lists */
  lists: {
    list: (query?: { limit?: number; offset?: number; q?: string }) => apiFetch<Page<ListPayload>>("/lists", { query }),
    get: (slug: string, query?: { limit?: number; offset?: number; q?: string; has_email?: boolean }) =>
      apiFetch<{ list: ListPayload; items: LeadListItem[]; total: number; limit: number; offset: number }>(
        `/lists/${encodeURIComponent(slug)}`,
        { query },
      ),
    create: (body: { name: string; description?: string; tag?: string; sourceSearchId?: string; leadIds?: string[] }) =>
      apiFetch<{ list: ListPayload }>("/lists", { method: "POST", body }),
    update: (slug: string, body: { name?: string; description?: string; tag?: string }) =>
      apiFetch<{ list: ListPayload }>(`/lists/${encodeURIComponent(slug)}`, { method: "PATCH", body }),
    remove: (slug: string) => apiFetch<{ deleted: boolean }>(`/lists/${encodeURIComponent(slug)}`, { method: "DELETE" }),
    addLeads: (slug: string, leadIds: string[]) =>
      apiFetch<{ added: number; total?: number; message?: string }>(`/lists/${encodeURIComponent(slug)}`, { method: "POST", body: { action: "add_leads", leadIds } }),
    removeLeads: (slug: string, leadIds: string[]) =>
      apiFetch<{ removed: number }>(`/lists/${encodeURIComponent(slug)}`, { method: "POST", body: { action: "remove_leads", leadIds } }),
  },

  /* exports */
  exports: {
    list: (query?: { limit?: number; offset?: number; status?: string }) => apiFetch<Page<ExportPayload>>("/exports", { query }),
    get: (slug: string) => apiFetch<{ export: ExportPayload }>(`/exports/${encodeURIComponent(slug)}`),
    create: (body: {
      name?: string;
      format?: "csv" | "json";
      sourceType?: "search" | "list" | "filter" | "all";
      sourceId?: string;
      filters?: Record<string, unknown>;
      columns?: string[];
    }) => apiFetch<{ export: ExportPayload; queued: boolean; message?: string }>("/exports", { method: "POST", body }),
    download: (slug: string) => apiFetch<{ url: string; expiresInSeconds: number; name: string; format: string }>(`/exports/${encodeURIComponent(slug)}`, { query: { download: 1 } }),
    remove: (slug: string) => apiFetch<{ deleted: boolean }>(`/exports/${encodeURIComponent(slug)}`, { method: "DELETE" }),
  },

  /* ai */
  ai: {
    plan: (body: { brief: string; city?: string; targetCount?: number; emailExtraction?: boolean; conversationSlug?: string }) =>
      apiFetch<{ plan: Record<string, unknown>; conversationSlug?: string; quota: Record<string, unknown>; cached?: boolean }>("/ai/plan", { method: "POST", body }),
    chat: (body: { message: string; conversationSlug?: string; leadSlug?: string; searchSlug?: string }) =>
      apiFetch<{ reply: string; conversationSlug: string; suggestions?: string[]; quota: Record<string, unknown> }>("/ai/chat", { method: "POST", body }),
    analyze: (body: { leadSlug: string; force?: boolean }) =>
      apiFetch<{ analysis: Record<string, unknown>; cached: boolean; quota: Record<string, unknown> }>("/ai/analyze", { method: "POST", body }),
    score: (body: { listSlug?: string; leadSlugs?: string[]; force?: boolean }) =>
      apiFetch<{ queued: number; skipped: number; batches?: number; note?: string; quota?: Record<string, unknown> }>("/ai/score", { method: "POST", body }),
    listAnalysis: (body: { listSlug: string; question?: string }) =>
      apiFetch<{ list: { slug: string; name: string; leads: number }; stats: Record<string, unknown>; analysis: Record<string, unknown>; meta: Record<string, unknown> }>("/ai/list-analysis", { method: "POST", body }),
  },

  /* billing */
  billing: {
    plans: () =>
      apiFetch<{
        plans: Array<PlanPayload & { is_active: boolean }>;
        currency: string;
        provider: string;
        region: string | null;
        capabilities: { checkout: boolean; webhooks: boolean; international: boolean };
        message: string | null;
      }>("/billing/plans"),
    subscription: () =>
      apiFetch<{
        entitlements: Entitlements;
        plan: PlanPayload | null;
        provider: { name: string; configured: boolean; region: string | null };
        invoices: Array<{ id: string; number: string; amount: number; currency: string; status: string; issuedLabel: string | null; paidAt: string | null; url: string | null }>;
        payments: Array<{
          id: string;
          amount: number;
          currency: string;
          status: string;
          method: string | null;
          email: string | null;
          createdAt: string;
          failureReason: string | null;
        }>;
        methods: Array<{ id: string; type: string; brand: string | null; last4: string | null; expiry: string | null; isDefault: boolean }>;
      }>("/billing/subscription"),
    action: (body: { action: "cancel" | "resume" | "pause" | "refresh"; atCycleEnd?: boolean; reason?: string }) =>
      apiFetch<Record<string, unknown>>("/billing/subscription", { method: "POST", body }),
    checkout: (planCode: "growth" | "scale", quantity = 1) =>
      apiFetch<{
        subscriptionId: string;
        keyId: string;
        amount: number;
        currency: string;
        name: string;
        description: string;
        plan: PlanPayload;
        prefill: { name?: string; email?: string; contact?: string };
        notes: Record<string, string>;
        shortUrl: string | null;
      }>("/billing/checkout", { method: "POST", body: { planCode, quantity } }),
    verify: (body: { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }) =>
      apiFetch<{ verified: boolean; status: string; plan: string; entitlements: Entitlements }>("/billing/verify", { method: "POST", body }),
  },

  /* notifications */
  notifications: {
    list: (query?: { unread?: boolean; limit?: number }) =>
      apiFetch<{ items: NotificationPayload[]; unread: number; total: number }>("/notifications", { query }),
    mark: (body: { ids?: string[]; all?: boolean; read?: boolean }) => apiFetch<{ updated: number }>("/notifications", { method: "PATCH", body }),
  },

  /* api keys */
  keys: {
    list: () => apiFetch<{ items: ApiKeyPayload[]; limit: number; message?: string }>("/keys"),
    create: (body: { name: string; scopes?: string[]; expiresInDays?: number | null }) =>
      apiFetch<{ key: ApiKeyPayload; secret: string; warning: string }>("/keys", { method: "POST", body }),
    update: (id: string, body: { name?: string; revoke?: boolean }) => apiFetch<{ key: ApiKeyPayload }>(`/keys/${encodeURIComponent(id)}`, { method: "PATCH", body }),
    rotate: (id: string) => apiFetch<{ key: ApiKeyPayload; secret: string; warning: string }>(`/keys/${encodeURIComponent(id)}`, { method: "POST" }),
    remove: (id: string) => apiFetch<{ revoked: boolean }>(`/keys/${encodeURIComponent(id)}`, { method: "DELETE" }),
  },

  /* settings */
  settings: {
    get: () => apiFetch<Record<string, unknown>>("/settings"),
    update: (body: Record<string, unknown>) => apiFetch<Record<string, unknown>>("/settings", { method: "PATCH", body }),
    team: () => apiFetch<Record<string, unknown>>("/settings/team"),
    invite: (body: { email: string; role?: "admin" | "member" | "viewer" }) => apiFetch<Record<string, unknown>>("/settings/team", { method: "POST", body: { action: "invite", ...body } }),
    setRole: (memberId: string, role: "owner" | "admin" | "member" | "viewer") =>
      apiFetch<Record<string, unknown>>("/settings/team", { method: "POST", body: { action: "role", memberId, role } }),
    removeMember: (memberId: string) => apiFetch<Record<string, unknown>>("/settings/team", { method: "POST", body: { action: "remove", memberId } }),
    revokeInvite: (inviteId: string) => apiFetch<Record<string, unknown>>("/settings/team", { method: "POST", body: { action: "revoke_invite", inviteId } }),
    acceptInvite: (token: string) => apiFetch<Record<string, unknown>>("/settings/team", { method: "POST", body: { action: "accept", token } }),
  },
};

export { supabaseConfigured };
