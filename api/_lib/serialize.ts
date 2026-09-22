/**
 * Database rows → API payloads.
 *
 * These shapes are the contract with the React SPA (`src/app/data.ts`), so the
 * UI keeps working while the data underneath becomes real. Nothing here invents
 * values: every number comes from a column the worker maintains.
 */

export type SearchRow = {
  id: string;
  slug: string;
  workspace_id: string;
  name: string;
  query: string;
  location: string | null;
  language: string;
  status: string;
  phase: string;
  search_config: Record<string, unknown>;
  ai_plan: Record<string, unknown> | null;
  requested_count: number;
  discovered_count: number;
  unique_count: number;
  duplicate_count: number;
  filtered_count: number;
  enriched_count: number;
  email_found_count: number;
  error_count: number;
  progress_percent: number;
  eta_seconds: number | null;
  source: string;
  engine_version: string | null;
  worker_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  paused_at: string | null;
  failed_at: string | null;
  last_error?: string | null;
  created_at: string;
  updated_at: string;
};

export type LeadRow = {
  id: string;
  slug: string;
  business_name: string;
  category: string | null;
  categories: string[] | null;
  address: string | null;
  complete_address: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  country_code: string | null;
  postal_code: string | null;
  phone: string | null;
  email_primary: string | null;
  website: string | null;
  domain: string | null;
  rating: number | null;
  review_count: number | null;
  reviews_per_rating: Record<string, number> | null;
  latitude: number | null;
  longitude: number | null;
  plus_code: string | null;
  timezone: string | null;
  price_range: string | null;
  status: string | null;
  description: string | null;
  about: string | null;
  open_hours: Record<string, string[]> | null;
  popular_times: Record<string, Record<string, number>> | null;
  images: unknown[] | null;
  ai_score?: number | null;
  quality_score: number;
  data_id: string | null;
  cid: string | null;
  place_id: string | null;
  map_url: string | null;
  reviews_url: string | null;
  first_seen_at: string;
  updated_at: string;
};

export type EventRow = {
  id: number;
  event_type: string;
  level: string;
  message: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const STATUS_LABEL: Record<string, "queued" | "running" | "paused" | "complete" | "failed"> = {
  draft: "queued",
  queued: "queued",
  running: "running",
  enriching: "running",
  paused: "paused",
  partial: "complete",
  completed: "complete",
  cancelled: "failed",
  failed: "failed",
};

function clockLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function durationLabel(search: SearchRow): string {
  if (!search.started_at) return "—";
  const end = search.completed_at ?? (search.status === "running" || search.status === "enriching" ? null : search.updated_at);
  if (!end) return "—";
  const seconds = Math.max(0, Math.round((new Date(end).getTime() - new Date(search.started_at).getTime()) / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}m ${String(rest).padStart(2, "0")}s` : `${rest}s`;
}

export function toJob(search: SearchRow, events: EventRow[] = []) {
  const config = search.search_config ?? {};
  const radiusKm = Number(config.radiusKm ?? config.radius_km ?? 10);
  return {
    id: search.id,
    slug: search.slug,
    query: search.query,
    city: search.location ?? "",
    status: STATUS_LABEL[search.status] ?? "queued",
    rawStatus: search.status,
    phase: search.phase,
    planned: search.requested_count,
    processed: search.discovered_count,
    found: search.unique_count,
    emails: search.email_found_count,
    duplicates: search.duplicate_count,
    filtered: search.filtered_count,
    errors: search.error_count,
    progress: search.progress_percent,
    createdLabel: search.created_at,
    duration: durationLabel(search),
    etaMin: search.eta_seconds ? Math.max(1, Math.ceil(search.eta_seconds / 60)) : 0,
    etaSeconds: search.eta_seconds,
    source: search.source === "ai" ? ("ai" as const) : ("manual" as const),
    flags: {
      email: Boolean(config.emailExtraction ?? config.email_extraction ?? false),
      fastMode: Boolean(config.fastMode ?? config.fast_mode ?? false),
      depth: Number(config.depth ?? 10),
      radius: radiusKm,
      lang: search.language,
      grid: Boolean(config.grid ?? false),
      extraReviews: Boolean(config.extraReviews ?? false),
    },
    log: events.map((event) => `[${clockLabel(event.created_at)}] ${event.message}`),
    aiPlan: search.ai_plan,
    language: search.language,
    engineVersion: search.engine_version,
    workerId: search.worker_id,
    startedAt: search.started_at,
    completedAt: search.completed_at,
    createdAt: search.created_at,
    updatedAt: search.updated_at,
  };
}

export type JobPayload = ReturnType<typeof toJob>;

export function toLeadListItem(lead: LeadRow) {
  return {
    id: lead.id,
    slug: lead.slug,
    name: lead.business_name,
    category: lead.category ?? (lead.categories?.[0] ?? "Business"),
    address: lead.address ?? "",
    city: lead.city ?? "",
    country: lead.country ?? "",
    phone: lead.phone ?? "",
    email: lead.email_primary ?? "",
    website: lead.website ?? "",
    rating: lead.rating ?? 0,
    reviews: lead.review_count ?? 0,
    status: lead.status ?? "Open",
    qualityScore: lead.quality_score,
    aiScore: lead.ai_score ?? null,
    hasEmail: Boolean(lead.email_primary),
    hasPhone: Boolean(lead.phone),
    hasWebsite: Boolean(lead.website),
    firstSeenAt: lead.first_seen_at,
  };
}

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function openHoursRows(hours: Record<string, string[]> | null) {
  if (!hours) return [];
  const rows: Array<{ day: string; time: string }> = [];
  for (let i = 0; i < DAY_ORDER.length; i++) {
    const value = hours[DAY_KEYS[i]] ?? hours[DAY_ORDER[i]] ?? hours[DAY_ORDER[i].slice(0, 3)];
    rows.push({ day: DAY_ORDER[i], time: value && value.length > 0 ? value.join(", ") : "—" });
  }
  return rows;
}

function popularByHour(popular: Record<string, Record<string, number>> | null, day = "mon"): number[] {
  if (!popular) return [];
  const dayMap = popular[day] ?? {};
  const out: number[] = [];
  for (let hour = 0; hour < 24; hour += 2) out.push(Number(dayMap[String(hour)] ?? 0));
  return out;
}

export function toLeadDetail(
  lead: LeadRow,
  children: {
    emails: Array<{ email: string; source: string; status: string; is_primary: boolean; verified_at: string | null }>;
    socials: Array<{ platform: string; url: string; handle: string | null }>;
    reviews: Array<{ author_name: string | null; rating: number | null; text_original: string | null; published_at: string | null; when?: string | null }>;
    analyses: Array<{ summary: string | null; fit: string | null; score: number | null; reasons: unknown; opportunities: unknown; risks: unknown; outreach_angle: string | null; model: string | null }>;
  },
) {
  const base = toLeadListItem(lead);
  const analysis = children.analyses[0] ?? null;
  return {
    ...base,
    seed: lead.slug,
    idx: 0,
    plusCode: lead.plus_code ?? "",
    timezone: lead.timezone ?? "",
    priceRange: lead.price_range ?? "",
    lat: lead.latitude ?? 0,
    lng: lead.longitude ?? 0,
    openNow: false, // only set when the engine reported a machine-readable state
    claimed: false,
    images: Array.isArray(lead.images) ? lead.images.length : 0,
    hasBooking: false,
    hasOrdering: false,
    hours: openHoursRows(lead.open_hours),
    popular: popularByHour(lead.popular_times),
    about: lead.about ?? lead.description ?? "",
    description: lead.description ?? "",
    reviewsPerRating: lead.reviews_per_rating ?? {},
    addresses: {
      street: lead.street ?? "",
      postalCode: lead.postal_code ?? "",
      state: lead.state ?? "",
      countryCode: lead.country_code ?? "",
      complete: lead.complete_address ?? "",
    },
    mapUrl: lead.map_url ?? "",
    reviewsUrl: lead.reviews_url ?? "",
    emails: children.emails,
    socials: children.socials,
    reviewSamples: children.reviews.slice(0, 12).map((review) => ({
      author: review.author_name ?? "Google user",
      stars: review.rating ?? 0,
      text: review.text_original ?? "",
      when: review.when ?? (review.published_at ? new Date(review.published_at).toISOString().slice(0, 10) : ""),
    })),
    aiAnalysis: analysis
      ? {
          summary: analysis.summary,
          fit: analysis.fit,
          score: analysis.score,
          reasons: analysis.reasons ?? [],
          opportunities: analysis.opportunities ?? [],
          risks: analysis.risks ?? [],
          outreachAngle: analysis.outreach_angle,
          model: analysis.model,
        }
      : null,
    completeness: lead.quality_score,
  };
}

export function toList(list: {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  tag: string | null;
  lead_count: number;
  with_email_count: number;
  avg_rating: number | null;
  completeness: number | null;
  source_search_id: string | null;
  updated_at: string;
}) {
  return {
    id: list.id,
    slug: list.slug,
    name: list.name,
    seed: list.slug,
    count: list.lead_count,
    withEmail: list.with_email_count,
    avgRating: list.avg_rating ?? 0,
    completeness: list.completeness ?? 0,
    updatedAgo: list.updated_at,
    jobSlug: list.source_search_id,
    tag: list.tag ?? "List",
    description: list.description ?? "",
  };
}

export function toExport(row: {
  id: string;
  slug: string;
  name: string;
  format: string;
  status: string;
  row_count: number;
  byte_size: number;
  source_type: string;
  source_id: string | null;
  created_at: string;
  expires_at: string | null;
}) {
  const format = row.format.toUpperCase() as "CSV" | "JSON";
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    source: row.source_type,
    sourceId: row.source_id,
    format,
    rows: row.row_count,
    size: formatBytes(row.byte_size),
    byteSize: row.byte_size,
    status: row.status === "ready" ? ("ready" as const) : row.status === "expired" ? ("expired" as const) : ("generating" as const),
    rawStatus: row.status,
    createdLabel: row.created_at,
    expiresLabel: row.expires_at,
  };
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`;
}

export function toInvoice(row: {
  id: string;
  number: string | null;
  amount_minor: number;
  currency: string;
  status: string;
  issued_at: string | null;
  paid_at: string | null;
  short_url: string | null;
  razorpay_invoice_id: string | null;
}) {
  return {
    id: row.id,
    number: row.number ?? row.razorpay_invoice_id ?? "—",
    amount: row.amount_minor,
    currency: row.currency,
    status: row.status,
    issuedLabel: row.issued_at,
    paidAt: row.paid_at,
    url: row.short_url,
  };
}
