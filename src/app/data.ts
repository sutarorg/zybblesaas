import { generateLeads, type Lead } from "../lib/data";

/* ================================================================== */
/*  types                                                              */
/* ================================================================== */

export type JobStatus = "queued" | "running" | "paused" | "complete" | "failed";

export type Job = {
  slug: string;
  query: string;
  city: string;
  status: JobStatus;
  planned: number;
  processed: number;
  found: number;
  emails: number;
  createdLabel: string;
  duration: string;
  etaMin: number;
  source: "manual" | "ai";
  flags: { email: boolean; fastMode: boolean; depth: number; radius: number; lang: string };
  log: string[];
  listSlug?: string;
};

export type ListMeta = {
  slug: string;
  name: string;
  seed: string;
  count: number;
  withEmail: number;
  avgRating: number;
  completeness: number;
  updatedAgo: string;
  jobSlug?: string;
  tag: string;
  description: string;
};

export type ExportRow = {
  slug: string;
  name: string;
  source: string;
  format: "CSV" | "JSON";
  rows: number;
  size: string;
  status: "ready" | "generating" | "expired";
  createdLabel: string;
  expiresLabel: string;
  seed?: string;
};

export type FullLead = Lead & {
  seed: string;
  idx: number;
  plusCode: string;
  timezone: string;
  priceRange: string;
  lat: number;
  lng: number;
  openNow: boolean;
  claimed: boolean;
  images: number;
  hasBooking: boolean;
  hasOrdering: boolean;
  hours: { day: string; time: string }[];
  popular: number[];
  about: string;
  reviewSamples: { author: string; stars: number; text: string; when: string }[];
  completeness: number;
};

/* ================================================================== */
/*  helpers                                                            */
/* ================================================================== */

export function slugify(s: string): string {
  return s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* stable lead pool per seed — always same size so indices are stable */
const POOL_SIZE = 64;
const poolCache = new Map<string, Lead[]>();
export function pool(seed: string): Lead[] {
  if (!poolCache.has(seed)) poolCache.set(seed, generateLeads(seed, POOL_SIZE));
  return poolCache.get(seed)!;
}

export function leadSlug(seed: string, idx: number): string {
  return `${slugify(seed)}__${idx}`;
}

export function findLead(slug: string): FullLead | null {
  const parts = slug.split("__");
  if (parts.length !== 2) return null;
  const idx = parseInt(parts[1], 10);
  if (Number.isNaN(idx)) return null;
  // find the seed among known searches/lists
  const seeds = new Set<string>([...INITIAL_JOBS.map((j) => j.query), ...INITIAL_LISTS.map((l) => l.seed), ...EXTRA_SEEDS]);
  for (const s of seeds) {
    if (slugify(s) === parts[0]) {
      const p = pool(s);
      if (idx >= 0 && idx < p.length) return fullLead(s, idx);
    }
  }
  return null;
}

const EXTRA_SEEDS = ["roofing contractors in Denver", "marketing agencies in London", "pilates studios in Melbourne", "auto repair shops in Munich"];

const CITY_COORDS: Record<string, [number, number, string]> = {
  Berlin: [52.52, 13.405, "Europe/Berlin"],
  Austin: [30.267, -97.743, "America/Chicago"],
  London: [51.507, -0.128, "Europe/London"],
  Toronto: [43.653, -79.383, "America/Toronto"],
  Amsterdam: [52.373, 4.9, "Europe/Amsterdam"],
  Denver: [39.739, -104.99, "America/Denver"],
  Munich: [48.137, 11.576, "Europe/Berlin"],
  Lisbon: [38.722, -9.139, "Europe/Lisbon"],
  Chicago: [41.878, -87.63, "America/Chicago"],
  Melbourne: [-37.814, 144.963, "Australia/Melbourne"],
  Lyon: [45.764, 4.836, "Europe/Paris"],
  Portland: [45.515, -122.679, "America/Los_Angeles"],
  Dublin: [53.35, -6.26, "Europe/Dublin"],
  Barcelona: [41.387, 2.169, "Europe/Madrid"],
  Leeds: [53.8, -1.549, "Europe/London"],
  Dallas: [32.777, -96.797, "America/Chicago"],
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const REVIEW_PEOPLE = ["Hannah S.", "Marcus T.", "Olivia R.", "James K.", "Priya N.", "Lucas B.", "Emma W.", "Noah F.", "Sofia M.", "Ethan C."];
const REVIEW_GOOD = [
  "Outstanding experience from start to finish. The team really knows their craft and the place is spotless.",
  "Been coming here for two years — consistently excellent. Booking was easy and staff is genuinely friendly.",
  "Best in the neighborhood by a mile. Fair prices, zero wait, and they actually listen.",
  "Super professional. They explained everything upfront and delivered exactly on time.",
];
const REVIEW_OK = [
  "Solid overall. Service was good though I had to wait a bit longer than expected.",
  "Good quality but parking is a nightmare in this area. Would still recommend.",
  "Decent experience. A little pricey, but you can tell they care about the details.",
];
const TIMES_AGO = ["2 days ago", "last week", "2 weeks ago", "last month", "3 months ago"];

export function fullLead(seed: string, idx: number): FullLead {
  const base = pool(seed)[idx % POOL_SIZE];
  const rnd = mulberry(hash(`ext:${seed}:${idx}`));
  const [baseLat, baseLng, tz] = CITY_COORDS[base.city] ?? [52.52, 13.405, "Europe/Berlin"];
  const lat = +(baseLat + (rnd() - 0.5) * 0.09).toFixed(5);
  const lng = +(baseLng + (rnd() - 0.5) * 0.13).toFixed(5);
  const priceIdx = Math.min(3, Math.floor(rnd() * 3.4));
  const closed1 = Math.floor(rnd() * 7);
  const closed2 = rnd() > 0.5 ? Math.floor(rnd() * 7) : -1;
  const hours = DAYS.map((day, i) => {
    if (i === closed1 || i === closed2) return { day, time: "Closed" };
    const open = 7 + Math.floor(rnd() * 3);
    const close = 17 + Math.floor(rnd() * 4);
    return { day, time: `${open}:00 – ${close}:00` };
  });
  const popular = Array.from({ length: 12 }, (_, i) =>
    Math.round(Math.max(4, Math.sin(((i + 4) / 12) * Math.PI) * (55 + rnd() * 40)))
  );
  const reviewSamples = Array.from({ length: 3 }, (_, i) => {
    const good = rnd() > 0.3;
    const when = TIMES_AGO[Math.min(TIMES_AGO.length - 1, (i + 1) * Math.floor(rnd() * 2))] || "last week";
    return {
      author: REVIEW_PEOPLE[Math.floor(rnd() * REVIEW_PEOPLE.length)],
      stars: good ? 4 + Math.round(rnd()) : 3,
      text: (good ? REVIEW_GOOD : REVIEW_OK)[Math.floor(rnd() * 4)],
      when,
    };
  });
  const plus = `9F${"4XWQV3M2P7HRJ6"[Math.floor(rnd() * 16)]}${Math.floor(rnd() * 90 + 10)}${String.fromCharCode(65 + Math.floor(rnd() * 26))}3V+${Math.floor(rnd() * 90 + 10)}`;
  const claimed = rnd() > 0.35;
  const completeness = Math.round(78 + rnd() * 22);

  return {
    ...base,
    seed,
    idx,
    plusCode: plus,
    timezone: tz,
    priceRange: "$".repeat(priceIdx + 1),
    lat,
    lng,
    openNow: rnd() > 0.25,
    claimed,
    images: 2 + Math.floor(rnd() * 14),
    hasBooking: rnd() > 0.55,
    hasOrdering: rnd() > 0.5,
    hours,
    popular,
    about: `${base.category} serving ${base.city} since ${2008 + Math.floor(rnd() * 14)}. Known for attentive service, fair pricing and a loyal local following — currently ranked #${3 + Math.floor(rnd() * 18)} in its category across the metro.`,
    reviewSamples,
    completeness,
  };
}

export function poolFull(seed: string): FullLead[] {
  return pool(seed).map((_, i) => fullLead(seed, i));
}

export function leadCsv(contents: FullLead[]): string {
  const esc = (v: string | number | boolean) => `"${String(v).replace(/"/g, '""')}"`;
  const header = ["name", "category", "address", "city", "phone", "email", "website", "rating", "reviews", "price_range", "lat", "lng", "status"].join(",");
  return [
    header,
    ...contents.map((l) =>
      [l.name, l.category, l.address, l.city, l.phone, l.email, l.website, l.rating, l.reviews, l.priceRange, l.lat, l.lng, l.status].map(esc).join(",")
    ),
  ].join("\n");
}

export function download(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ================================================================== */
/*  seeds: jobs, lists, exports, invoices, conversations               */
/* ================================================================== */

export const INITIAL_JOBS: Job[] = [
  {
    slug: "dentists-in-berlin",
    query: "dentists in Berlin",
    city: "Berlin",
    status: "complete",
    planned: 320,
    processed: 320,
    found: 312,
    emails: 276,
    createdLabel: "Mar 24 · 09:12",
    duration: "4m 12s",
    etaMin: 0,
    source: "manual",
    flags: { email: true, fastMode: false, depth: 10, radius: 10, lang: "de" },
    log: ["[09:12:04] run queued — plan: 12 sectors × zoom 15", "[09:12:19] sweep started — concurrency 8", "[09:14:02] 204 candidates captured, enriching emails…", "[09:16:11] dedupe: 8 duplicates merged", "[09:16:19] ✔ complete — 312 leads · 276 emails · saved to list berlin-dentists-q3"],
    listSlug: "berlin-dentists-q3",
  },
  {
    slug: "hvac-companies-in-dallas",
    query: "hvac companies in Dallas",
    city: "Dallas",
    status: "complete",
    planned: 340,
    processed: 340,
    found: 312,
    emails: 268,
    createdLabel: "Mar 23 · 14:05",
    duration: "3m 58s",
    etaMin: 0,
    source: "ai",
    flags: { email: true, fastMode: false, depth: 10, radius: 12, lang: "en" },
    log: ["[14:05:11] brief planned by AI — 14 sector searches", "[14:06:02] sample validated — proceeding", "[14:08:47] filters applied — rating ≥4.5 · no booking link", "[14:09:03] ✔ complete — 312 leads · saved to list austin-hvac-gap"],
    listSlug: "austin-hvac-gap",
  },
  {
    slug: "coffee-roasters-in-lisbon",
    query: "coffee roasters in Lisbon",
    city: "Lisbon",
    status: "running",
    planned: 260,
    processed: 158,
    found: 151,
    emails: 112,
    createdLabel: "Today · 11:41",
    duration: "1m 24s",
    etaMin: 2,
    source: "manual",
    flags: { email: true, fastMode: false, depth: 8, radius: 8, lang: "pt" },
    log: ["[11:41:02] run started — 10 sectors × zoom 15", "[11:41:38] sector 4 returned dense cluster, re-splitting", "[11:42:12] 151 candidates so far — enriching emails…", "[11:42:34] email hit-rate holding at 74%"],
  },
  {
    slug: "boutique-hotels-in-lyon",
    query: "boutique hotels in Lyon",
    city: "Lyon",
    status: "queued",
    planned: 180,
    processed: 0,
    found: 0,
    emails: 0,
    createdLabel: "Today · 11:44",
    duration: "—",
    etaMin: 3,
    source: "manual",
    flags: { email: true, fastMode: false, depth: 10, radius: 6, lang: "fr" },
    log: ["[11:44:01] queued — position #1 (engine capacity 2/2 in use)"],
  },
  {
    slug: "law-firms-in-toronto",
    query: "law firms in Toronto",
    city: "Toronto",
    status: "paused",
    planned: 420,
    processed: 142,
    found: 138,
    emails: 96,
    createdLabel: "Mar 22 · 18:31",
    duration: "1m 58s",
    etaMin: 4,
    source: "manual",
    flags: { email: true, fastMode: false, depth: 12, radius: 14, lang: "en" },
    log: ["[18:31:12] run started — 16 sectors", "[18:33:04] 138 candidates captured", "[18:33:10] ⏸ paused by user — resumable from sector 6"],
  },
  {
    slug: "rooftop-bars-in-chicago",
    query: "rooftop bars in Chicago",
    city: "Chicago",
    status: "failed",
    planned: 210,
    processed: 64,
    found: 58,
    emails: 12,
    createdLabel: "Mar 21 · 16:02",
    duration: "0m 41s",
    etaMin: 0,
    source: "manual",
    flags: { email: false, fastMode: true, depth: 4, radius: 5, lang: "en" },
    log: ["[16:02:33] fast mode sweep started", "[16:03:01] upstream throttling detected (fast-mode beta)", "[16:03:14] ✖ failed — recovered 58 partial leads · retry with standard mode"],
  },
];

export const INITIAL_LISTS: ListMeta[] = [
  { slug: "berlin-dentists-q3", name: "berlin-dentists-q3", seed: "dentists in Berlin", count: 312, withEmail: 276, avgRating: 4.6, completeness: 94, updatedAgo: "2h ago", jobSlug: "dentists-in-berlin", tag: "outbound", description: "Dental clinics across Berlin-Mitte, Kreuzberg and Prenzlauer Berg. Rating ≥ 4.2, has website." },
  { slug: "austin-hvac-gap", name: "austin-hvac-gap", seed: "hvac companies in Dallas", count: 312, withEmail: 268, avgRating: 4.7, completeness: 91, updatedAgo: "yesterday", jobSlug: "hvac-companies-in-dallas", tag: "ai-built", description: "HVAC companies missing online booking — scheduling-software pitch queue. Built by AI brief." },
  { slug: "lyon-boutique-hotels", name: "lyon-boutique-hotels", seed: "boutique hotels in Lyon", count: 247, withEmail: 201, avgRating: 4.5, completeness: 89, updatedAgo: "3d ago", tag: "partner", description: "Boutique stays for the channel-partner program. Reviews ≥ 50." },
  { slug: "toronto-law", name: "toronto-law", seed: "law firms in Toronto", count: 421, withEmail: 334, avgRating: 4.4, completeness: 87, updatedAgo: "5d ago", jobSlug: "law-firms-in-toronto", tag: "outbound", description: "Law firms with unclaimed listings — reputation product angle." },
  { slug: "melbourne-gyms", name: "melbourne-gyms", seed: "gyms in Melbourne", count: 268, withEmail: 229, avgRating: 4.6, completeness: 92, updatedAgo: "1w ago", tag: "experiment", description: "Gyms rated < 4.2 with 30+ reviews — reputation-rescue test segment." },
  { slug: "archive-2025", name: "archive-2025", seed: "marketing agencies in London", count: 1240, withEmail: 903, avgRating: 4.3, completeness: 81, updatedAgo: "3mo ago", tag: "archive", description: "Everything from the 2025 outbound season. Do not sequence without re-verification." },
];

export const INITIAL_EXPORTS: ExportRow[] = [
  { slug: "berlin-dentists-csv", name: "berlin-dentists-q3.csv", source: "berlin-dentists-q3", format: "CSV", rows: 312, size: "96 KB", status: "ready", createdLabel: "2h ago", expiresLabel: "in 29 days", seed: "dentists in Berlin" },
  { slug: "austin-hvac-json", name: "austin-hvac-gap.json", source: "austin-hvac-gap", format: "JSON", rows: 312, size: "210 KB", status: "ready", createdLabel: "yesterday", expiresLabel: "in 29 days", seed: "hvac companies in Dallas" },
  { slug: "toronto-law-csv", name: "toronto-law.csv", source: "toronto-law", format: "CSV", rows: 421, size: "128 KB", status: "ready", createdLabel: "5d ago", expiresLabel: "in 26 days", seed: "law firms in Toronto" },
  { slug: "q3-digest", name: "q3-master-digest.csv", source: "3 lists merged", format: "CSV", rows: 871, size: "294 KB", status: "expired", createdLabel: "Feb 4", expiresLabel: "expired", seed: "dentists in Berlin" },
];

export const INVOICES = [
  { id: "INV-2026-0042", date: "Mar 1, 2026", plan: "Growth · monthly", amount: "$49.00", status: "paid" },
  { id: "INV-2026-0018", date: "Feb 1, 2026", plan: "Growth · monthly", amount: "$49.00", status: "paid" },
  { id: "INV-2026-0004", date: "Jan 1, 2026", plan: "Growth · monthly", amount: "$49.00", status: "paid" },
  { id: "INV-2025-0187", date: "Dec 1, 2025", plan: "Starter · free", amount: "$0.00", status: "paid" },
];

export const WEEK_ACTIVITY = [146, 320, 214, 468, 402, 612, 264];

export const AI_CONVS = [
  { id: "c3", title: "HVAC booking gap — Dallas", leads: 312, when: "Mar 23" },
  { id: "c2", title: "Roofers with storm damage angle", leads: 189, when: "Mar 18" },
  { id: "c1", title: "Boutique hotels pilot — Lyon", leads: 247, when: "Feb 27" },
];

export const PLAN_USAGE = {
  plan: "Growth",
  used: 3214,
  quota: 10000,
  resetsLabel: "Apr 1",
  aiBriefs: { used: 6, quota: 40 },
  seats: { used: 2, quota: 3 },
  exportsThisMonth: 11,
};

export const NOTIF_DEFAULTS = [
  { id: "run-done", title: "Search completed", desc: "Ping when a sweep finishes or fails.", on: true },
  { id: "export-ready", title: "Export ready", desc: "Files are kept 30 days — get reminded before expiry.", on: true },
  { id: "quota", title: "Quota warnings", desc: "At 80% and 100% of monthly quota.", on: true },
  { id: "digest", title: "Weekly digest", desc: "Leads found, hit-rates and deliverability every Monday.", on: false },
  { id: "product", title: "Product updates", desc: "Changelog highlights — at most one email per month.", on: false },
  { id: "marketing", title: "Tips & playbooks", desc: "Prospecting tactics from the blog.", on: false },
];

export const TEAM = [
  { name: "Mara Voss", email: "mara@zybble.io", role: "Owner", status: "active" },
  { name: "Devin Cole", email: "devin@studio-nova.com", role: "Member", status: "active" },
  { name: "ops@studio-nova.com", email: "ops@studio-nova.com", role: "Member", status: "invited" },
];

export const PAYMENT_CARDS = [
  { id: "card-1", brand: "Visa", last4: "4242", exp: "04 / 28", holder: "Mara Voss", isDefault: true },
  { id: "card-2", brand: "Mastercard", last4: "5544", exp: "11 / 27", holder: "Mara Voss", isDefault: false },
];
