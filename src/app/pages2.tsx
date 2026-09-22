import { useMemo, useState } from "react";
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
import {
  findLead,
  leadCsv,
  download,
  poolFull,
  type FullLead,
} from "./data";
import { Card, EmptyState, Modal, PageHeader, QualityBar } from "./shell";
import { Stars } from "../components/ui";
import { cn } from "../utils/cn";

const MASTER_SEEDS: { seed: string; listSlug: string }[] = [
  { seed: "dentists in Berlin", listSlug: "berlin-dentists-q3" },
  { seed: "hvac companies in Dallas", listSlug: "austin-hvac-gap" },
  { seed: "gyms in Melbourne", listSlug: "melbourne-gyms" },
  { seed: "marketing agencies in London", listSlug: "archive-2025" },
];

/* ================================================================== */
/*  /leads                                                             */
/* ================================================================== */

export function LeadsPage() {
  const [queryInput, setQueryInput] = useState("");
  const [filter, setFilter] = useState<"all" | "email" | "rating" | "verified">("all");
  const [sort, setSort] = useState<"rating" | "reviews" | "quality">("rating");
  const [shown, setShown] = useState(12);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exportedFlash, setExportedFlash] = useState(false);

  const all = useMemo(
    () =>
      MASTER_SEEDS.flatMap(({ seed, listSlug }) =>
        poolFull(seed)
          .slice(0, 28)
          .map((l) => ({ ...l, listSlug, href: `#/lead/${l.seed.replace(" in ", "-in-").replace(/ /g, "-")}` }))
      ),
    []
  );

  const rows = useMemo(() => {
    let r = all;
    const q = queryInput.trim().toLowerCase();
    if (q) r = r.filter((l) => l.name.toLowerCase().includes(q) || l.email.toLowerCase().includes(q) || l.city.toLowerCase().includes(q) || l.category.toLowerCase().includes(q));
    if (filter === "email") r = r.filter((l) => !!l.email);
    if (filter === "rating") r = r.filter((l) => l.rating >= 4.5);
    if (filter === "verified") r = r.filter((l) => l.status === "Verified");
    return [...r].sort((a, b) => (sort === "rating" ? b.rating - a.rating : sort === "reviews" ? b.reviews - a.reviews : b.completeness - a.completeness));
  }, [all, queryInput, filter, sort]);

  const visible = rows.slice(0, shown);
  const slugOf = (l: FullLead) => `${l.seed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}__${l.idx}`;

  const toggleOne = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const exportSelected = () => {
    const chosen = rows.filter((l) => selected.has(`${l.seed}|${l.idx}`));
    download(`zybble-selected-${chosen.length}leads.csv`, leadCsv(chosen));
    setSelected(new Set());
    setExportedFlash(true);
    setTimeout(() => setExportedFlash(false), 2200);
  };

  return (
    <div>
      <PageHeader
        title={<>Leads</>}
        desc={`${rows.length.toLocaleString()} records across your lists — deduped, scored, exportable.`}
        actions={
          <>
            {exportedFlash && (
              <span className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-zest/40 bg-zest/10 px-3 font-mono text-[11px] text-zest">
                <CheckCircle2 className="size-3.5" /> exported
              </span>
            )}
            <button
              onClick={exportSelected}
              disabled={selected.size === 0}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-xl px-4 font-display text-[13px] font-semibold transition-all",
                selected.size > 0 ? "bg-zest text-ink hover:scale-[1.03] active:scale-95" : "cursor-not-allowed border border-line text-faint"
              )}
            >
              <Download className="size-4" /> Export {selected.size > 0 ? selected.size : ""} CSV
            </button>
          </>
        }
      />

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
          {(
            [
              ["all", "All"],
              ["email", "Has email"],
              ["rating", "★ 4.5+"],
              ["verified", "Verified"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-2 font-mono text-[11px] transition-all",
                filter === k ? "border-zest/50 bg-zest/10 text-zest" : "border-line text-sage hover:text-bone"
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
              <option value="rating">top rated</option>
              <option value="reviews">most reviewed</option>
              <option value="quality">most complete</option>
            </select>
            <Filter className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
          </div>
        </div>
      </div>

      {/* rows */}
      {rows.length === 0 ? (
        <EmptyState icon={Search} title="No leads match" desc="Loosen the filters or run a fresh search to fill this view." />
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[28px_1.5fr_1.2fr_0.5fr_0.8fr_0.7fr] items-center gap-3 border-b border-line bg-white/[0.02] px-4 py-3 font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint md:grid">
            <input
              type="checkbox"
              className="size-3.5 accent-[#c9f158]"
              checked={selected.size > 0 && selected.size === visible.length}
              onChange={() =>
                setSelected((s) => (s.size === visible.length ? new Set() : new Set(visible.map((l) => `${l.seed}|${l.idx}`))))
              }
            />
            <span>Business</span>
            <span>Contact</span>
            <span>Rating</span>
            <span>List</span>
            <span>Quality</span>
          </div>
          <div className="divide-y divide-line/60">
            {visible.map((l) => {
              const id = `${l.seed}|${l.idx}`;
              const slug = slugOf(l);
              const isSel = selected.has(id);
              return (
                <div key={id} className={cn("group relative transition-colors", isSel && "bg-zest/[0.04]")}>
                  <div className="relative grid grid-cols-[1fr] gap-3 px-4 py-3.5 md:grid-cols-[28px_1.5fr_1.2fr_0.5fr_0.8fr_0.7fr] md:items-center">
                    <a href={`#/lead/${slug}`} className="absolute inset-0" aria-label={l.name} />
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => toggleOne(id)}
                      className="relative z-10 mt-1 size-4 accent-[#c9f158] md:mt-0 md:size-3.5"
                    />
                    <div className="flex min-w-0 items-center gap-3 md:block">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-white/[0.03] font-display text-[11px] font-bold text-zest md:hidden">
                        {l.name.split(" ").slice(0, 2).map((w) => w[0]).join("")}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-medium text-bone">{l.name}</p>
                        <p className="mt-0.5 truncate font-mono text-[10.5px] text-faint">
                          {l.category} · {l.city}
                        </p>
                      </div>
                    </div>
                    <div className="min-w-0 space-y-0.5 pl-12 md:pl-0">
                      {l.email && (
                        <p className="flex items-center gap-1.5 truncate font-mono text-[11.5px] text-zest">
                          <Mail className="size-3 shrink-0" /> {l.email}
                        </p>
                      )}
                      <p className="flex items-center gap-1.5 truncate font-mono text-[11.5px] text-sage">
                        <Phone className="size-3 shrink-0" /> {l.phone}
                      </p>
                    </div>
                    <div className="pl-12 md:pl-0">
                      <Stars rating={l.rating} />
                      <span className="ml-1.5 font-mono text-[10px] text-faint">({l.reviews})</span>
                    </div>
                    <div className="pl-12 md:pl-0">
                      <span className="rounded-md border border-line px-2 py-1 font-mono text-[9.5px] text-sage">{l.listSlug.split("-")[0]}·{l.listSlug.split("-")[1]}</span>
                    </div>
                    <div className="pl-12 md:pl-0">
                      <QualityBar value={l.completeness} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {shown < rows.length && (
        <button
          onClick={() => setShown((s) => s + 12)}
          className="mt-5 h-11 w-full rounded-xl border border-line font-mono text-[12px] text-sage transition-colors hover:border-zest/30 hover:text-bone"
        >
          load more — {rows.length - shown} remaining
        </button>
      )}
    </div>
  );
}

/* ================================================================== */
/*  /lead/:slug — full 36-field record                                 */
/* ================================================================== */

function CopyBtn({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(text).catch(() => {});
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-xl border px-4 font-display text-[13px] font-medium transition-all",
        done ? "border-zest/50 bg-zest/10 text-zest" : "border-line-strong text-bone hover:border-zest/40 active:scale-95"
      )}
    >
      {done ? <Check className="size-4" /> : <Copy className="size-4" />}
      {done ? "Copied" : label}
    </button>
  );
}

function Field({ label, value, mono = true, zest = false, link }: { label: string; value: string; mono?: boolean; zest?: boolean; link?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line/60 py-3 last:border-0">
      <span className="pt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">{label}</span>
      {link ? (
        <a href={link} className="flex items-center gap-1.5 text-right font-mono text-[12px] text-zest hover:underline">
          <span className="max-w-[180px] truncate sm:max-w-[220px]">{value}</span>
          <ExternalLink className="size-3 shrink-0" />
        </a>
      ) : (
        <span className={cn("text-right", mono && "font-mono text-[12px]", zest ? "text-zest" : "text-bone")}>{value}</span>
      )}
    </div>
  );
}

export function LeadDetailPage({ slug }: { slug: string }) {
  const lead = useMemo(() => findLead(slug), [slug]);
  const [listModal, setListModal] = useState(false);
  const [added, setAdded] = useState(false);
  const [raw, setRaw] = useState(false);

  const others = useMemo(() => (lead ? poolFull(lead.seed).filter((l) => l.idx !== lead.idx).slice(1, 5) : []), [lead]);

  if (!lead) {
    return (
      <EmptyState
        icon={MapPin}
        title="Lead not found"
        desc="This record may belong to an archived list."
        action={<a href="#/leads" className="inline-flex h-10 items-center gap-2 rounded-xl bg-zest px-5 font-display text-sm font-semibold text-ink">Back to leads</a>}
      />
    );
  }

  const stars = [5, 4, 3, 2, 1].map((s) => ({
    s,
    pct: s === 5 ? Math.round(lead.rating * 12 + 38) : s === 4 ? Math.round((5 - lead.rating) * 30 + 10) : Math.round(12 - s * 2),
  }));

  return (
    <div>
      <a href="#/leads" className="mb-5 inline-flex items-center gap-2 font-mono text-[11.5px] text-sage transition-colors hover:text-zest">
        <ArrowLeft className="size-3.5" /> all leads
      </a>

      {/* header */}
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-5 p-5 sm:p-7 lg:flex-row lg:items-center">
          <span className="grid size-16 shrink-0 place-items-center rounded-2xl border border-zest/25 bg-gradient-to-br from-zest/15 to-graphite font-display text-xl font-bold text-zest">
            {lead.name.split(" ").slice(0, 2).map((w) => w[0]).join("")}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-xl font-bold tracking-tight text-bone sm:text-2xl">{lead.name}</h1>
              <span className="rounded-md border border-line px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-sage">{lead.category}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[11px] text-faint">
              <span className="flex items-center gap-1.5"><MapPin className="size-3" /> {lead.address}, {lead.city}</span>
              <span className="flex items-center gap-1.5 text-amber"><Star className="size-3 fill-amber" /> {lead.rating.toFixed(1)} · {lead.reviews} reviews</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-zest/30 bg-zest/[0.07] px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-wider text-zest">
                <BadgeCheck className="size-3" /> {lead.status}
              </span>
              {lead.openNow && <span className="rounded-full border border-line px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-wider text-sage">open now</span>}
              {lead.claimed && <span className="rounded-full border border-line px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-wider text-sage">owner-claimed</span>}
              <span className="rounded-full border border-line px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-wider text-sage">{lead.priceRange}</span>
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
            <div className="flex gap-2.5">
              <CopyBtn text={lead.email || lead.phone} label={lead.email ? "Copy email" : "Copy phone"} />
              <button
                onClick={() => setListModal(true)}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-line-strong px-4 font-display text-[13px] font-medium text-bone transition-all hover:border-zest/40 active:scale-95"
              >
                <FolderPlus className="size-4" /> {added ? "Added ✓" : "Add to list"}
              </button>
              <button
                onClick={() => download(`${lead.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-lead.csv`, leadCsv([lead]))}
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
          <Field label="website" value={lead.website.replace("https://", "")} link="#" />
          <Field label="maps listing" value="open listing view" link="#" />
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
            <span className="absolute bottom-2.5 right-3 font-mono text-[10px] text-faint">
              {lead.lat.toFixed(5)}, {lead.lng.toFixed(5)}
            </span>
          </div>
          <div className="p-5 sm:p-6">
            <Field label="city" value={lead.city} />
            <Field label="coordinates" value={`${lead.lat.toFixed(5)}° N, ${lead.lng.toFixed(5)}° E`} />
            <Field label="street view" value="360° storefront" link="#" />
          </div>
        </Card>

        {/* reputation */}
        <Card className="p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-bone">Reputation</h3>
            <span className="font-mono text-[10.5px] text-faint">{lead.reviews} reviews</span>
          </div>
          <div className="space-y-2">
            {stars.map(({ s, pct }) => (
              <div key={s} className="flex items-center gap-3">
                <span className="w-3 font-mono text-[11px] text-sage">{s}</span>
                <Star className="size-3 fill-amber" />
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(3, pct)}%` }} transition={{ duration: 0.7, delay: (5 - s) * 0.06 }} className="h-full rounded-full bg-amber/80" />
                </div>
                <span className="w-8 text-right font-mono text-[10px] text-faint">{Math.max(3, pct)}%</span>
              </div>
            ))}
          </div>
          <div className="mt-6 space-y-3">
            {lead.reviewSamples.map((r, i) => (
              <div key={i} className="rounded-xl border border-line bg-white/[0.015] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-medium text-bone">{r.author}</span>
                  <span className="font-mono text-[10px] text-amber">{"★".repeat(r.stars)}<span className="text-faint">{"★".repeat(5 - r.stars)}</span></span>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-sage">“{r.text}”</p>
                <p className="mt-2 font-mono text-[9.5px] uppercase tracking-wider text-faint">{r.when}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* context */}
        <Card className="p-5 sm:p-6">
          <h3 className="mb-4 font-display text-base font-semibold text-bone">Business context</h3>
          <p className="rounded-xl border border-line bg-white/[0.015] p-4 text-[13px] leading-relaxed text-sage">{lead.about}</p>
          <div className="mt-5">
            <p className="mb-2.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
              <Clock3 className="size-3.5 text-zest" /> opening hours
            </p>
            <div className="overflow-hidden rounded-xl border border-line">
              {lead.hours.map((h, i) => (
                <div key={h.day} className={cn("flex justify-between px-4 py-2 font-mono text-[11.5px]", i % 2 === 0 && "bg-white/[0.012]")}>
                  <span className="text-sage">{h.day}</span>
                  <span className={h.time === "Closed" ? "text-faint" : "text-bone"}>{h.time}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-5">
            <p className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">popular times · today</p>
            <div className="flex h-14 items-end gap-1">
              {lead.popular.map((v, i) => (
                <motion.div
                  key={i}
                  initial={{ height: 2 }}
                  animate={{ height: `${Math.max(6, v)}%` }}
                  transition={{ delay: i * 0.03, duration: 0.5 }}
                  className={cn("flex-1 rounded-sm", i === 7 ? "bg-zest" : "bg-zest-dim/40")}
                  title={`${8 + i}:00`}
                />
              ))}
            </div>
            <div className="mt-1 flex justify-between font-mono text-[9px] text-faint"><span>8am</span><span>1pm</span><span>7pm</span></div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {[
              lead.hasBooking ? "online booking ✓" : "no online booking",
              lead.hasOrdering ? "online ordering ✓" : "no online ordering",
              `${lead.images} photos`,
              `menu linked`,
            ].map((t) => (
              <span key={t} className={cn("rounded-md border px-2.5 py-1.5 font-mono text-[10px]", t.includes("no ") ? "border-amber/30 text-amber" : "border-line text-sage")}>
                {t}
              </span>
            ))}
          </div>
        </Card>
      </div>

      {/* raw + others */}
      <div className="mt-4">
        <button onClick={() => setRaw(!raw)} className="flex w-full items-center justify-between rounded-xl border border-line bg-coal px-4 py-3.5 text-[12.5px] font-medium text-sage transition-colors hover:text-bone">
          <span className="flex items-center gap-2"><Braces className="size-4 text-zest" /> raw record (36 fields)</span>
          <span className="font-mono text-[11px] text-zest">{raw ? "hide" : "show"}</span>
        </button>
        {raw && (
          <motion.pre initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 overflow-x-auto rounded-xl border border-line bg-[#0a0d0b] p-4 font-mono text-[11.5px] leading-[1.8] text-sage">
{JSON.stringify({
  name: lead.name, category: lead.category, address: lead.address, city: lead.city,
  phone: lead.phone, email: lead.email || null, website: lead.website,
  rating: lead.rating, review_count: lead.reviews, price_range: lead.priceRange,
  lat: lead.lat, lng: lead.lng, plus_code: lead.plusCode, timezone: lead.timezone,
  status: lead.status, open_now: lead.openNow, owner_claimed: lead.claimed,
  online_booking: lead.hasBooking, online_ordering: lead.hasOrdering, photos: lead.images,
}, null, 2)}
          </motion.pre>
        )}
      </div>

      <div className="mt-6">
        <h3 className="mb-3 font-display text-base font-semibold text-bone">More from this segment</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {others.map((l) => (
            <a key={l.name} href={`#/lead/${l.seed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}__${l.idx}`} className="group flex items-center gap-3.5 rounded-xl border border-line bg-coal p-4 transition-colors hover:border-zest/30">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-white/[0.03] font-display text-[11px] font-bold text-zest">
                {l.name.split(" ").slice(0, 2).map((w) => w[0]).join("")}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-bone">{l.name}</p>
                <p className="truncate font-mono text-[10.5px] text-zest/80">{l.email || l.phone}</p>
              </div>
              <span className="font-mono text-[11px] text-amber">★ {l.rating.toFixed(1)}</span>
            </a>
          ))}
        </div>
      </div>

      {/* add-to-list modal */}
      <Modal open={listModal} onClose={() => setListModal(false)} title="Add to list">
        <div className="space-y-2">
          {["berlin-dentists-q3", "austin-hvac-gap", "melbourne-gyms", "archive-2025", "+ new list…"].map((l) => (
            <button
              key={l}
              onClick={() => {
                setAdded(true);
                setTimeout(() => setListModal(false), 350);
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-xl border px-4 py-3.5 text-left font-mono text-[12.5px] transition-all",
                added ? "border-zest/40 bg-zest/[0.06] text-zest" : "border-line text-sage hover:border-zest/30 hover:text-bone"
              )}
            >
              {l}
              {added ? <CheckCircle2 className="size-4" /> : <FolderPlus className="size-4 text-faint" />}
            </button>
          ))}
        </div>
        <p className="mt-4 font-mono text-[10.5px] text-faint">dedupe runs automatically — adding an existing lead never burns quota.</p>
      </Modal>
    </div>
  );
}
