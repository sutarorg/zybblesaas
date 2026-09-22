import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BadgeCheck,
  Braces,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  Filter,
  FolderPlus,
  Mail,
  MapPin,
  Phone,
  Search,
  Star,
} from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useLead, useLeads, useLists } from "./hooks";
import { initials, recordsToCsv, downloadText, relTime } from "./data";
import { Card, EmptyState, Modal, PageHeader, QualityBar } from "./shell";
import { Stars } from "../components/ui";
import { cn } from "../utils/cn";

/* ================================================================== */
/*  /leads                                                             */
/* ================================================================== */

type Filter = "all" | "email" | "rating" | "verified";

export function LeadsPage() {
  const [queryInput, setQueryInput] = useState("");
  const [debounced, setDebounced] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<"rating" | "reviews" | "quality">("quality");
  const [limit, setLimit] = useState(25);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [flash, setFlash] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(queryInput.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [queryInput]);

  const page = useLeads({
    q: debounced || undefined,
    has_email: filter === "email" ? true : undefined,
    min_rating: filter === "rating" ? 4.5 : undefined,
    sort,
    limit,
    offset: 0,
  });

  const rows = page.data?.items ?? [];
  const total = page.data?.total ?? 0;

  const toggleOne = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /** A selection becomes a real list, then a real server-side export. */
  const exportSelected = async () => {
    const chosen = rows.filter((row) => selected.has(row.id));
    if (chosen.length === 0) return;
    setProblem(null);
    try {
      const list = await api.lists.create({
        name: `Selection · ${new Date().toLocaleDateString("en-GB")} · ${chosen.length} leads`,
        description: "Created from the leads table selection.",
        tag: "selection",
        leadIds: chosen.map((row) => row.id),
      });
      await api.exports.create({
        name: list.list.name,
        format: "csv",
        sourceType: "list",
        sourceId: list.list.id,
      });
      setSelected(new Set());
      setFlash(`${chosen.length} leads queued for export — it appears under Exports when the worker finishes.`);
      window.setTimeout(() => setFlash(null), 5000);
    } catch (cause) {
      setProblem(cause instanceof ApiError ? cause.message : "The export could not be queued");
    }
  };

  const filters: Array<[Filter, string]> = [
    ["all", "All"],
    ["email", "Has email"],
    ["rating", "★ 4.5+"],
    ["verified", "Verified"],
  ];

  return (
    <div>
      <PageHeader
        title={<>Leads</>}
        desc={`${total.toLocaleString()} records in this workspace — deduped, scored, exportable.`}
        actions={
          <>
            {flash && (
              <span className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-zest/40 bg-zest/10 px-3 font-mono text-[11px] text-zest">
                <CheckCircle2 className="size-3.5" /> export queued
              </span>
            )}
            <button
              onClick={exportSelected}
              disabled={selected.size === 0}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-xl px-4 font-display text-[13px] font-semibold transition-all",
                selected.size > 0 ? "bg-zest text-ink hover:scale-[1.03] active:scale-95" : "cursor-not-allowed border border-line text-faint",
              )}
            >
              <Download className="size-4" /> Export {selected.size > 0 ? selected.size : ""} CSV
            </button>
          </>
        }
      />

      {(problem || page.error) && (
        <Card className="mb-4 border-amber/40 p-4 text-[13px] text-amber">{problem ?? page.error}</Card>
      )}

      {/* controls */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="Search name, email, city or category…"
            className="h-11 w-full rounded-xl border border-line bg-coal pl-10 pr-4 text-sm text-bone placeholder:text-faint outline-none transition-colors focus:border-zest/50"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto no-bar">
          {filters.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-2 font-mono text-[11px] transition-all",
                filter === key ? "border-zest/50 bg-zest/10 text-zest" : "border-line text-sage hover:text-bone",
              )}
            >
              {label}
            </button>
          ))}
          <span className="mx-1 hidden w-px bg-line lg:block" />
          <div className="relative shrink-0">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="h-9 appearance-none rounded-full border border-line bg-coal pl-9 pr-3.5 font-mono text-[11px] text-sage outline-none"
            >
              <option value="quality">most complete</option>
              <option value="rating">top rated</option>
              <option value="reviews">most reviewed</option>
              <option value="newest">newest first</option>
            </select>
            <Filter className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
          </div>
        </div>
      </div>

      {/* rows */}
      {page.loading ? (
        <Card className="p-10 text-center font-mono text-[11.5px] text-faint">loading leads…</Card>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Search}
          title={total === 0 ? "No leads yet" : "No leads match"}
          desc={total === 0 ? "Run a search and results will appear here as the engine finds them." : "Loosen the filters or run a fresh search to fill this view."}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[28px_1.5fr_1.2fr_0.5fr_0.7fr] items-center gap-3 border-b border-line bg-white/[0.02] px-4 py-3 font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint md:grid">
            <input
              type="checkbox"
              className="size-3.5 accent-[#c9f158]"
              checked={selected.size > 0 && selected.size === rows.length}
              onChange={() => setSelected((current) => (current.size === rows.length ? new Set() : new Set(rows.map((row) => row.id))))}
            />
            <span>Business</span>
            <span>Contact</span>
            <span>Rating</span>
            <span>Quality</span>
          </div>
          <div className="divide-y divide-line/60">
            {rows.map((lead) => {
              const isSelected = selected.has(lead.id);
              return (
                <div key={lead.id} className={cn("group relative transition-colors", isSelected && "bg-zest/[0.04]")}>
                  <div className="relative grid grid-cols-[1fr] gap-3 px-4 py-3.5 md:grid-cols-[28px_1.5fr_1.2fr_0.5fr_0.7fr] md:items-center">
                    <a href={`#/lead/${lead.slug}`} className="absolute inset-0" aria-label={lead.name} />
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(lead.id)}
                      className="relative z-10 mt-1 size-4 accent-[#c9f158] md:mt-0 md:size-3.5"
                    />
                    <div className="flex min-w-0 items-center gap-3 md:block">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-white/[0.03] font-display text-[11px] font-bold text-zest md:hidden">
                        {initials(lead.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-medium text-bone">{lead.name}</p>
                        <p className="mt-0.5 truncate font-mono text-[10.5px] text-faint">
                          {lead.category} · {lead.city}
                        </p>
                      </div>
                    </div>
                    <div className="min-w-0 space-y-0.5 pl-12 md:pl-0">
                      {lead.email && (
                        <p className="flex items-center gap-1.5 truncate font-mono text-[11.5px] text-zest">
                          <Mail className="size-3 shrink-0" /> {lead.email}
                        </p>
                      )}
                      <p className="flex items-center gap-1.5 truncate font-mono text-[11.5px] text-sage">
                        <Phone className="size-3 shrink-0" /> {lead.phone || "no phone captured"}
                      </p>
                    </div>
                    <div className="pl-12 md:pl-0">
                      {lead.rating > 0 ? (
                        <>
                          <Stars rating={lead.rating} />
                          <span className="ml-1.5 font-mono text-[10px] text-faint">({lead.reviews})</span>
                        </>
                      ) : (
                        <span className="font-mono text-[10.5px] text-faint">not rated</span>
                      )}
                    </div>
                    <div className="pl-12 md:pl-0">
                      <QualityBar value={lead.qualityScore} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {rows.length < total && (
        <button
          onClick={() => setLimit((current) => current + 25)}
          className="mt-5 h-11 w-full rounded-xl border border-line font-mono text-[12px] text-sage transition-colors hover:border-zest/30 hover:text-bone"
        >
          load more — {(total - rows.length).toLocaleString()} remaining
        </button>
      )}
    </div>
  );
}

/* ================================================================== */
/*  /lead/:slug — full record                                          */
/* ================================================================== */

function CopyBtn({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          window.setTimeout(() => setDone(false), 1600);
        } catch {
          setDone(false);
        }
      }}
      className="inline-flex h-10 items-center gap-2 rounded-xl border border-line px-4 font-display text-[13px] font-medium text-sage transition-colors hover:border-zest/30 hover:text-bone"
    >
      {done ? <Check className="size-3.5 text-zest" /> : <Copy className="size-3.5" />} {done ? "Copied" : label}
    </button>
  );
}

function Field({ label, value, mono = true, zest = false, link }: { label: string; value: string; mono?: boolean; zest?: boolean; link?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line/60 py-3 last:border-0">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">{label}</span>
      {link ? (
        <a href={link} target="_blank" rel="noreferrer" className={cn("max-w-[62%] truncate text-right text-[12.5px] hover:underline", zest ? "text-zest" : "text-bone")}>
          {value} <ExternalLink className="inline size-3" />
        </a>
      ) : (
        <span className={cn("max-w-[62%] truncate text-right", mono && "font-mono text-[11.5px]", zest ? "text-zest" : "text-bone")}>{value || "—"}</span>
      )}
    </div>
  );
}

export function LeadDetailPage({ slug }: { slug: string }) {
  const { data, error, loading } = useLead(slug);
  const lead = data?.lead ?? null;
  const [listModal, setListModal] = useState(false);
  const [addedToList, setAddedToList] = useState<string | null>(null);
  const [raw, setRaw] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const lists = useLists();
  const related = useLeads(lead ? { city: lead.city || undefined, limit: 5 } : { limit: 0 });

  const reviewBuckets = useMemo(() => {
    const distribution = lead?.reviewsPerRating ?? {};
    const total = Object.values(distribution).reduce((sum, value) => sum + value, 0);
    return [5, 4, 3, 2, 1].map((stars) => {
      const count = Number(distribution[String(stars)] ?? 0);
      return { stars, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 };
    });
  }, [lead]);

  if (loading) {
    return <Card className="p-10 text-center font-mono text-[11.5px] text-faint">loading lead…</Card>;
  }

  if (error || !lead) {
    return (
      <EmptyState
        icon={MapPin}
        title="Lead not found"
        desc={error ?? "This record is not part of your workspace."}
        action={
          <a href="#/leads" className="inline-flex h-10 items-center gap-2 rounded-xl bg-zest px-5 font-display text-sm font-semibold text-ink">
            Back to leads
          </a>
        }
      />
    );
  }

  const others = (related.data?.items ?? []).filter((row) => row.slug !== lead.slug).slice(0, 4);

  const addToList = async (listSlug: string) => {
    setProblem(null);
    try {
      await api.leads.addToList(lead.slug, { listSlug });
      setAddedToList(listSlug);
      window.setTimeout(() => setListModal(false), 400);
    } catch (cause) {
      setProblem(cause instanceof ApiError ? cause.message : "Could not add this lead to the list");
    }
  };

  const exportLead = async () => {
    setProblem(null);
    try {
      // A single lead is exported through a list of one, so the file is built
      // server-side by the same code path as every other export.
      const created = await api.lists.create({
        name: `${lead.name} · export`,
        description: "Single-lead export created from the lead page.",
        tag: "single",
        leadIds: [lead.id],
      });
      await api.exports.create({ name: created.list.name, format: "csv", sourceType: "list", sourceId: created.list.id });
      window.location.hash = "#/exports";
    } catch (cause) {
      setProblem(cause instanceof ApiError ? cause.message : "The export could not be queued");
    }
  };

  const copyRow = () =>
    downloadText(
      `${lead.slug}.csv`,
      recordsToCsv([
        {
          business_name: lead.name,
          category: lead.category,
          email: lead.email || null,
          phone: lead.phone,
          website: lead.website,
          address: lead.address,
          city: lead.city,
          country: lead.country,
          rating: lead.rating,
          review_count: lead.reviews,
          profile_completeness: lead.qualityScore,
        },
      ]),
    );

  return (
    <div>
      <a href="#/leads" className="mb-5 inline-flex items-center gap-2 font-mono text-[11.5px] text-sage transition-colors hover:text-zest">
        <ArrowLeft className="size-3.5" /> all leads
      </a>

      {problem && <Card className="mb-4 border-amber/40 p-4 text-[13px] text-amber">{problem}</Card>}

      {/* header */}
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-5 p-5 sm:p-7 lg:flex-row lg:items-center">
          <span className="grid size-16 shrink-0 place-items-center rounded-2xl border border-zest/25 bg-gradient-to-br from-zest/15 to-graphite font-display text-xl font-bold text-zest">
            {initials(lead.name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-xl font-bold tracking-tight text-bone sm:text-2xl">{lead.name}</h1>
              <span className="rounded-md border border-line px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-sage">{lead.category}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[11px] text-faint">
              <span className="flex items-center gap-1.5">
                <MapPin className="size-3" /> {[lead.address, lead.city].filter(Boolean).join(", ") || "no address on the listing"}
              </span>
              {lead.rating > 0 && (
                <span className="flex items-center gap-1.5 text-amber">
                  <Star className="size-3 fill-amber" /> {lead.rating.toFixed(1)} · {lead.reviews} reviews
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-zest/30 bg-zest/[0.07] px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-wider text-zest">
                <BadgeCheck className="size-3" /> {lead.status || "listed"}
              </span>
              {lead.priceRange && (
                <span className="rounded-full border border-line px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-wider text-sage">{lead.priceRange}</span>
              )}
              <span className="rounded-full border border-line px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-wider text-sage">
                first seen {relTime(lead.firstSeenAt)}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2.5 lg:flex-col lg:items-end">
            <div className="w-full lg:w-44">
              <div className="mb-1.5 flex justify-between font-mono text-[9.5px] uppercase tracking-widest text-faint">
                <span>record quality</span>
                <span className="text-zest">{lead.completeness}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                <motion.div initial={{ width: 0 }} animate={{ width: `${lead.completeness}%` }} transition={{ duration: 0.8 }} className="h-full rounded-full bg-zest" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <CopyBtn text={lead.email || lead.phone} label={lead.email ? "Copy email" : "Copy phone"} />
              <button
                onClick={() => setListModal(true)}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-line-strong px-4 font-display text-[13px] font-medium text-bone transition-all hover:border-zest/40 active:scale-95"
              >
                <FolderPlus className="size-4" /> {addedToList ? "Added ✓" : "Add to list"}
              </button>
              <button
                onClick={exportLead}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-zest px-4 font-display text-[13px] font-semibold text-ink transition-transform hover:scale-[1.03] active:scale-95"
              >
                <Download className="size-4" /> Export
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* grid */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* contact */}
        <Card className="p-5 sm:p-6">
          <h3 className="mb-3 font-display text-base font-semibold text-bone">Contact & identity</h3>
          {lead.email ? <Field label="email" value={lead.email} zest /> : <Field label="email" value="not published — try phone" />}
          <Field label="phone" value={lead.phone} />
          {lead.website ? <Field label="website" value={lead.website.replace(/^https?:\/\//, "")} link={lead.website} /> : <Field label="website" value="no website on the listing" />}
          {lead.mapUrl && <Field label="maps listing" value="open listing view" link={lead.mapUrl} />}
          <Field label="plus code" value={lead.plusCode} />
          <Field label="timezone" value={lead.timezone} />
        </Card>

        {/* location */}
        <Card className="overflow-hidden">
          <div className="relative h-44 border-b border-line bg-[#0a0d0b]">
            <div className="absolute inset-0 map-streets opacity-70" />
            <div className="absolute inset-0 map-grid" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
              <span className="relative block">
                <span className="absolute -inset-2.5 animate-ping-soft rounded-full bg-zest/25" />
                <MapPin className="size-6 fill-zest text-ink drop-shadow-[0_0_10px_rgba(201,241,88,0.8)]" />
              </span>
            </div>
            {lead.lat !== 0 || lead.lng !== 0 ? (
              <span className="absolute bottom-2.5 right-3 font-mono text-[10px] text-faint">
                {lead.lat.toFixed(5)}, {lead.lng.toFixed(5)}
              </span>
            ) : (
              <span className="absolute bottom-2.5 right-3 font-mono text-[10px] text-faint">coordinates not reported</span>
            )}
          </div>
          <div className="p-5 sm:p-6">
            <Field label="city" value={lead.city} />
            <Field label="street" value={lead.addresses.street} />
            <Field label="postal code" value={lead.addresses.postalCode} />
            <Field label="country" value={lead.addresses.countryCode || lead.country} />
            {lead.lat !== 0 || lead.lng !== 0 ? (
              <Field label="open in maps" value="google.com/maps" link={`https://www.google.com/maps/search/?api=1&query=${lead.lat},${lead.lng}`} />
            ) : null}
          </div>
        </Card>

        {/* reputation */}
        <Card className="p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-bone">Reputation</h3>
            <span className="font-mono text-[10.5px] text-faint">{lead.reviews} reviews</span>
          </div>
          <div className="space-y-2">
            {reviewBuckets.map(({ stars, count, pct }) => (
              <div key={stars} className="flex items-center gap-3">
                <span className="w-3 font-mono text-[11px] text-sage">{stars}</span>
                <Star className="size-3 fill-amber" />
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(2, pct)}%` }}
                    transition={{ duration: 0.7, delay: (5 - stars) * 0.06 }}
                    className="h-full rounded-full bg-amber/80"
                  />
                </div>
                <span className="w-10 text-right font-mono text-[10px] text-faint">{count}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 space-y-3">
            {lead.reviewSamples.length === 0 ? (
              <p className="rounded-xl border border-line bg-white/[0.015] p-4 font-mono text-[11.5px] text-faint">
                No review text was captured for this business
                {lead.reviews > 0 ? " (enable review extraction to collect it)" : ""}.
              </p>
            ) : (
              lead.reviewSamples.map((review, index) => (
                <div key={index} className="rounded-xl border border-line bg-white/[0.015] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium text-bone">{review.author}</span>
                    <span className="font-mono text-[10px] text-amber">
                      {"★".repeat(Math.max(0, Math.min(5, review.stars)))}
                      <span className="text-faint">{"★".repeat(Math.max(0, 5 - review.stars))}</span>
                    </span>
                  </div>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-sage">“{review.text}”</p>
                  {review.when && <p className="mt-2 font-mono text-[9.5px] uppercase tracking-wider text-faint">{review.when}</p>}
                </div>
              ))
            )}
          </div>
        </Card>

        {/* context */}
        <Card className="p-5 sm:p-6">
          <h3 className="mb-4 font-display text-base font-semibold text-bone">Business context</h3>
          <p className="rounded-xl border border-line bg-white/[0.015] p-4 text-[13px] leading-relaxed text-sage">
            {lead.about || "The listing did not expose a description."}
          </p>
          <div className="mt-5">
            <p className="mb-2.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
              <Clock3 className="size-3.5 text-zest" /> opening hours
            </p>
            <div className="overflow-hidden rounded-xl border border-line">
              {lead.hours.length === 0 ? (
                <p className="px-4 py-3 font-mono text-[11.5px] text-faint">no hours published</p>
              ) : (
                lead.hours.map((hour, index) => (
                  <div key={hour.day} className={cn("flex justify-between px-4 py-2 font-mono text-[11.5px]", index % 2 === 0 && "bg-white/[0.012]")}>
                    <span className="text-sage">{hour.day}</span>
                    <span className={hour.time === "—" ? "text-faint" : "text-bone"}>{hour.time}</span>
                  </div>
                ))
              )}
            </div>
          </div>
          {lead.popular.length > 0 && (
            <div className="mt-5">
              <p className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">popular times · today</p>
              <div className="flex h-14 items-end gap-1">
                {lead.popular.map((value, index) => (
                  <motion.div
                    key={index}
                    initial={{ height: 2 }}
                    animate={{ height: `${Math.max(4, Math.min(100, value))}%` }}
                    transition={{ delay: index * 0.03, duration: 0.5 }}
                    className={cn("flex-1 rounded-sm", index === 7 ? "bg-zest" : "bg-zest-dim/40")}
                    title={`${index * 2}:00`}
                  />
                ))}
              </div>
            </div>
          )}
          <div className="mt-5 space-y-2">
            {lead.emails.length > 0 && (
              <p className="font-mono text-[11px] text-sage">
                emails captured: {lead.emails.map((email) => `${email.email} (${email.status})`).join(", ")}
              </p>
            )}
            {lead.socials.length > 0 && (
              <p className="flex flex-wrap gap-2">
                {lead.socials.map((social) => (
                  <a
                    key={social.url}
                    href={social.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-line px-2.5 py-1.5 font-mono text-[10px] text-sage hover:border-zest/40 hover:text-bone"
                  >
                    {social.platform} ↗
                  </a>
                ))}
              </p>
            )}
          </div>
          {lead.aiAnalysis && (
            <div className="mt-5 rounded-xl border border-zest/25 bg-zest/[0.05] p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zest">
                AI analysis {lead.aiAnalysis.fit ? `· ${lead.aiAnalysis.fit}` : ""} {lead.aiAnalysis.score !== null ? `· ${lead.aiAnalysis.score}/100` : ""}
              </p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-sage">{lead.aiAnalysis.summary}</p>
            </div>
          )}
        </Card>
      </div>

      {/* raw + others */}
      <div className="mt-4">
        <button
          onClick={() => setRaw(!raw)}
          className="flex w-full items-center justify-between rounded-xl border border-line bg-coal px-4 py-3.5 text-[12.5px] font-medium text-sage transition-colors hover:text-bone"
        >
          <span className="flex items-center gap-2">
            <Braces className="size-4 text-zest" /> record fields
          </span>
          <span className="font-mono text-[11px] text-zest">{raw ? "hide" : "show"}</span>
        </button>
        {raw && (
          <motion.pre initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 overflow-x-auto rounded-xl border border-line bg-[#0a0d0b] p-4 font-mono text-[11.5px] leading-[1.8] text-sage">
{JSON.stringify(
  {
    slug: lead.slug,
    name: lead.name,
    category: lead.category,
    address: lead.address,
    city: lead.city,
    country: lead.country,
    phone: lead.phone,
    email: lead.email || null,
    emails: lead.emails,
    website: lead.website,
    rating: lead.rating,
    review_count: lead.reviews,
    reviews_per_rating: lead.reviewsPerRating,
    price_range: lead.priceRange || null,
    lat: lead.lat,
    lng: lead.lng,
    plus_code: lead.plusCode || null,
    timezone: lead.timezone || null,
    status: lead.status || null,
    quality_score: lead.qualityScore,
    ai_score: lead.aiScore,
    socials: lead.socials,
  },
  null,
  2,
)}
          </motion.pre>
        )}
        <div className="mt-3 flex justify-end">
          <button onClick={copyRow} className="font-mono text-[11px] text-faint hover:text-zest">
            download this record as CSV
          </button>
        </div>
      </div>

      {others.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 font-display text-base font-semibold text-bone">More from this city</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {others.map((other) => (
              <a key={other.id} href={`#/lead/${other.slug}`} className="group flex items-center gap-3.5 rounded-xl border border-line bg-coal p-4 transition-colors hover:border-zest/30">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-white/[0.03] font-display text-[11px] font-bold text-zest">
                  {initials(other.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-bone">{other.name}</p>
                  <p className="truncate font-mono text-[10.5px] text-zest/80">{other.email || other.phone || "no contact captured"}</p>
                </div>
                {other.rating > 0 && <span className="font-mono text-[11px] text-amber">★ {other.rating.toFixed(1)}</span>}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* add-to-list modal */}
      <Modal open={listModal} onClose={() => setListModal(false)} title="Add to list">
        <div className="space-y-2">
          {lists.loading && <p className="font-mono text-[11.5px] text-faint">loading lists…</p>}
          {!lists.loading && (lists.data?.items ?? []).length === 0 && (
            <p className="rounded-xl border border-line px-4 py-3.5 font-mono text-[11.5px] text-faint">
              No lists yet — create one from a search or the lists page first.
            </p>
          )}
          {(lists.data?.items ?? []).map((list) => (
            <button
              key={list.id}
              onClick={() => addToList(list.slug)}
              className={cn(
                "flex w-full items-center justify-between rounded-xl border px-4 py-3.5 text-left font-mono text-[12.5px] transition-all",
                addedToList === list.slug ? "border-zest/40 bg-zest/[0.06] text-zest" : "border-line text-sage hover:border-zest/30 hover:text-bone",
              )}
            >
              <span className="truncate">
                {list.name} <span className="text-faint">· {list.count} leads</span>
              </span>
              {addedToList === list.slug ? <CheckCircle2 className="size-4" /> : <FolderPlus className="size-4 text-faint" />}
            </button>
          ))}
        </div>
        <p className="mt-4 font-mono text-[10.5px] text-faint">dedupe runs automatically — adding an existing lead never burns quota.</p>
      </Modal>
    </div>
  );
}
