import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  ChevronDown,
  Clock3,
  FileDown,
  Gauge,
  Globe2,
  Languages,
  MailCheck,
  MapPin,
  Play,
  Plus,
  SearchCheck,
  SlidersHorizontal,
  Sparkles,
  Timer,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useEngine } from "./engine";
import { PLAN_USAGE, WEEK_ACTIVITY, fullLead, slugify } from "./data";
import { detectCity } from "../lib/data";
import { Card, Meter, PageHeader, StatusChip } from "./shell";
import { Send } from "lucide-react";
import { cn } from "../utils/cn";

/* ================================================================== */
/*  /dashboard                                                         */
/* ================================================================== */

export function DashboardPage() {
  const { jobs } = useEngine();
  const live = jobs.filter((j) => j.status === "running" || j.status === "queued");
  const recent = jobs.slice(0, 4);
  const recentLeads = useMemo(() => Array.from({ length: 5 }, (_, i) => fullLead("dentists in Berlin", i * 3 + 2)), []);
  const maxWeek = Math.max(...WEEK_ACTIVITY);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 sm:mb-8">
        <div>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-faint">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-bone sm:text-3xl">
            {greet}, Mara.
          </h1>
          <p className="mt-1 flex items-center gap-2 text-[13px] text-sage">
            <span className="relative flex size-2">
              <span className="absolute size-full animate-ping-soft rounded-full bg-zest" />
              <span className="relative size-2 rounded-full bg-zest" />
            </span>
            Engine healthy · {live.length} search{live.length === 1 ? "" : "es"} in flight
          </p>
        </div>
        <a
          href="#/findleads"
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-zest px-5 font-display text-sm font-semibold text-ink transition-transform hover:scale-[1.03] active:scale-95"
        >
          <Plus className="size-4" /> New search
        </a>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { icon: TrendingUp, label: "Leads this month", value: PLAN_USAGE.used.toLocaleString(), sub: `of ${PLAN_USAGE.quota.toLocaleString()} quota` },
          { icon: MailCheck, label: "Email hit-rate", value: "87.2%", sub: "+2.1 vs last month" },
          { icon: Activity, label: "Active searches", value: String(live.length), sub: live.length ? "engine at work" : "engine idle", live: true },
          { icon: FileDown, label: "Exports this month", value: String(PLAN_USAGE.exportsThisMonth), sub: "CSV & JSON" },
        ].map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.5 }}>
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <k.icon className="size-4.5 text-zest" />
                {k.live && live.length > 0 && <span className="size-1.5 rounded-full bg-zest" />}
              </div>
              <p className="mt-3.5 font-display text-[26px] font-bold tracking-tight text-bone sm:text-3xl">{k.value}</p>
              <p className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">{k.label}</p>
              <p className="mt-1 font-mono text-[10px] text-zest-dim">{k.sub}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* weekly activity */}
        <Card className="p-5 sm:p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-bone">This week's sweep</h3>
            <span className="font-mono text-[10.5px] text-faint">leads found / day</span>
          </div>
          <div className="mt-6 flex h-36 items-end gap-2.5 sm:gap-3">
            {WEEK_ACTIVITY.map((v, i) => (
              <div key={i} className="group flex h-full flex-1 flex-col items-center justify-end" title={`${v} leads`}>
                <span className="mb-1.5 font-mono text-[10px] text-sage opacity-0 transition-opacity group-hover:opacity-100">{v}</span>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: Math.max(5, Math.round((v / maxWeek) * 96)) }}
                  transition={{ delay: 0.2 + i * 0.06, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  className={cn(
                    "w-full rounded-t-md transition-colors",
                    i === WEEK_ACTIVITY.length - 2 ? "bg-zest" : "bg-gradient-to-t from-zest-dim/30 to-zest/60 group-hover:to-zest"
                  )}
                />
                <span className="mt-2 font-mono text-[9.5px] uppercase text-faint">{["M", "T", "W", "T", "F", "S", "S"][i]}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
            <p className="font-mono text-[11px] text-sage">2,426 leads · best day Saturday</p>
            <span className="rounded-md bg-zest/10 px-2 py-1 font-mono text-[10.5px] font-semibold text-zest">+18% WoW</span>
          </div>
        </Card>

        {/* quota */}
        <Card className="p-5 sm:p-6">
          <h3 className="font-display text-base font-semibold text-bone">Cycle usage</h3>
          <p className="mt-1 font-mono text-[10.5px] text-faint">resets {PLAN_USAGE.resetsLabel}</p>
          <div className="mt-5 space-y-5">
            {[
              { label: "Enriched leads", used: PLAN_USAGE.used, max: PLAN_USAGE.quota },
              { label: "AI briefs", used: PLAN_USAGE.aiBriefs.used, max: PLAN_USAGE.aiBriefs.quota },
              { label: "Seats", used: PLAN_USAGE.seats.used, max: PLAN_USAGE.seats.quota },
            ].map((m) => (
              <div key={m.label}>
                <div className="mb-1.5 flex items-center justify-between text-[12px]">
                  <span className="text-sage">{m.label}</span>
                  <span className="font-mono text-[11px] text-bone">
                    {m.used.toLocaleString()}<span className="text-faint">/{m.max.toLocaleString()}</span>
                  </span>
                </div>
                <Meter value={m.used} max={m.max} />
              </div>
            ))}
          </div>
          <a href="#/billing" className="mt-6 flex items-center justify-between rounded-xl border border-line bg-white/[0.02] px-4 py-3 text-[12.5px] font-medium text-sage transition-colors hover:border-zest/30 hover:text-bone">
            Need more headroom? <span className="font-mono text-zest">Scale →</span>
          </a>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* recent searches */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h3 className="font-display text-base font-semibold text-bone">Recent searches</h3>
            <a href="#/searches" className="font-mono text-[11px] text-zest hover:underline">all →</a>
          </div>
          <div className="divide-y divide-line/70">
            {recent.map((j) => (
              <a key={j.slug} href={`#/search/${j.slug}`} className="flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-white/[0.02]">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium text-bone">{j.query}</p>
                  <div className="mt-1 flex items-center gap-2.5 font-mono text-[10px] text-faint">
                    <span>{j.found} found</span>
                    {j.flags.email && <span>· {j.emails} emails</span>}
                    <span className="hidden sm:inline">· {j.createdLabel}</span>
                  </div>
                </div>
                {j.status === "running" && (
                  <div className="hidden w-20 sm:block">
                    <Meter value={j.processed} max={j.planned} />
                  </div>
                )}
                <StatusChip status={j.status} />
              </a>
            ))}
          </div>
        </Card>

        {/* recent leads */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h3 className="font-display text-base font-semibold text-bone">Fresh leads</h3>
            <a href="#/leads" className="font-mono text-[11px] text-zest hover:underline">all →</a>
          </div>
          <div className="divide-y divide-line/70">
            {recentLeads.map((l) => (
              <a key={l.name} href={`#/lead/dentists-in-berlin__${l.idx}`} className="flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-white/[0.02]">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-white/[0.03] font-display text-[11px] font-bold text-zest">
                  {l.name.split(" ").slice(0, 2).map((w) => w[0]).join("")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium text-bone">{l.name}</p>
                  <p className="truncate font-mono text-[10.5px] text-zest/80">{l.email || l.phone}</p>
                </div>
                <span className="font-mono text-[11px] text-amber">★ {l.rating.toFixed(1)}</span>
              </a>
            ))}
          </div>
        </Card>
      </div>

      {/* quick actions */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { icon: SearchCheck, label: "Guided search", href: "#/findleads" },
          { icon: Sparkles, label: "Ask Zybble AI", href: "#/zybbleai" },
          { icon: FileDown, label: "Export center", href: "#/exports" },
          { icon: Timer, label: "Lists workspace", href: "#/lists" },
        ].map((a) => (
          <a key={a.label} href={a.href} className="group flex items-center gap-3 rounded-xl border border-line bg-coal px-4 py-3.5 transition-colors hover:border-zest/30">
            <a.icon className="size-4.5 shrink-0 text-zest" />
            <span className="text-[12.5px] font-medium text-sage transition-colors group-hover:text-bone">{a.label}</span>
            <ArrowRight className="ml-auto size-3.5 text-faint transition-transform group-hover:translate-x-0.5" />
          </a>
        ))}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  /findleads — search builder                                        */
/* ================================================================== */

const selectCls =
  "h-11 w-full appearance-none rounded-xl border border-line bg-ink/60 px-3.5 text-sm text-bone outline-none transition-colors focus:border-zest/50";

function Toggle({ on, onChange, label, desc }: { on: boolean; onChange: (v: boolean) => void; label: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-line bg-ink/40 px-4 py-3.5 text-left transition-colors hover:border-line-strong"
    >
      <span>
        <span className="block text-[13px] font-medium text-bone">{label}</span>
        <span className="mt-0.5 block text-[11.5px] text-sage">{desc}</span>
      </span>
      <span className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", on ? "bg-zest" : "bg-faint/35")}>
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-ink transition-all", on ? "left-[22px]" : "left-0.5 bg-bone")} />
      </span>
    </button>
  );
}

export function FindLeadsPage() {
  const { createJob } = useEngine();
  const [mode, setMode] = useState<"guided" | "ai">("guided");
  const [niche, setNiche] = useState("dentists");
  const [city, setCity] = useState("Berlin");
  const [radius, setRadius] = useState(10);
  const [depth, setDepth] = useState(10);
  const [lang, setLang] = useState("en");
  const [email, setEmail] = useState(true);
  const [fastMode, setFastMode] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [minRating, setMinRating] = useState("any");
  const [minReviews, setMinReviews] = useState("any");
  const [brief, setBrief] = useState("");

  const q = `${niche.trim() || "dentists"} in ${city.trim() || "Berlin"}`;
  const est = useMemo(() => {
    const base = 180 + ((slugify(q).split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 7) % 180);
    return Math.min(1200, Math.round((base * (radius / 10) * (fastMode ? 0.3 : 1)) / 4) * 4);
  }, [q, radius, fastMode]);
  const sectors = Math.max(4, Math.round((est / 28) * (radius / 10)));
  const estEmails = email ? Math.round(est * 0.86) : 0;
  const etaLabel = `~${Math.max(1, Math.round(est / 110))} min`;

  const launch = () => {
    const job = createJob({
      query: q,
      city: detectCity(q),
      planned: fastMode ? Math.min(est, 84) : est,
      flags: { email, fastMode, depth, radius, lang },
      firstLog: [`[setup] filters — rating ${minRating}, reviews ${minReviews}, radius ${radius}km, depth ${depth}`],
    });
    window.location.hash = `#/search/${job.slug}`;
  };

  const launchAi = () => {
    if (brief.trim()) sessionStorage.setItem("zybble_brief", brief.trim());
    window.location.hash = "#/zybbleai";
  };

  return (
    <div>
      <PageHeader
        title={<>Find leads</>}
        desc="One sentence or one form — the engine plans sectors, sweeps the map and enriches every match."
      />

      {/* mode tabs */}
      <div className="mb-6 flex w-fit items-center gap-1 rounded-full border border-line-strong bg-coal p-1.5">
        {(["guided", "ai"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2 font-display text-[13px] font-medium transition-all",
              mode === m ? "bg-zest text-ink" : "text-sage hover:text-bone"
            )}
          >
            {m === "guided" ? <SearchCheck className="size-4" /> : <Sparkles className="size-4" />}
            {m === "guided" ? "Guided" : "AI brief"}
          </button>
        ))}
      </div>

      {mode === "ai" ? (
        <Card className="p-5 sm:p-7">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl border border-zest/25 bg-zest/[0.07]">
              <Sparkles className="size-4.5 text-zest" />
            </span>
            <div>
              <h3 className="font-display text-base font-semibold text-bone">Describe your ideal customer</h3>
              <p className="text-[12.5px] text-sage">The Assistant plans the searches — you approve, it runs.</p>
            </div>
          </div>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={4}
            placeholder="Find HVAC companies in Dallas with 4.5+ stars that have a website but no online booking…"
            className="mt-5 w-full resize-none rounded-xl border border-line bg-ink/60 px-4 py-3.5 text-sm text-bone placeholder:text-faint outline-none transition-colors focus:border-zest/50"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {["dentists without booking links", "roofers after storm season", "top-rated cafés, no loyalty app"].map((s) => (
              <button key={s} onClick={() => setBrief(`Find ${s} in Berlin`)} className="rounded-full border border-line px-3 py-1.5 font-mono text-[10.5px] text-sage transition-colors hover:border-zest/30 hover:text-bone">
                {s}
              </button>
            ))}
          </div>
          <button
            onClick={launchAi}
            className="group mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-zest font-display text-[15px] font-semibold text-ink transition-transform hover:scale-[1.02] active:scale-[0.98] sm:w-auto sm:px-7"
          >
            Plan with AI <Send className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          {/* form */}
          <Card className="p-5 sm:p-7">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Niche</label>
                <div className="relative">
                  <SearchCheck className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
                  <input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="dentists" className={cn(selectCls, "pl-10")} />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Location</label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
                  <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Berlin" className={cn(selectCls, "pl-10")} />
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Radius · {radius} km</label>
                <input type="range" min={2} max={25} value={radius} onChange={(e) => setRadius(+e.target.value)} className="h-11 w-full accent-[#c9f158]" />
              </div>
              <div>
                <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Depth</label>
                <div className="relative">
                  <select value={depth} onChange={(e) => setDepth(+e.target.value)} className={selectCls}>
                    {[4, 8, 10, 12, 16].map((d) => <option key={d} className="bg-coal">{d} levels</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Language</label>
                <div className="relative">
                  <select value={lang} onChange={(e) => setLang(e.target.value)} className={selectCls}>
                    {["en", "de", "fr", "pt", "es", "nl"].map((l) => <option key={l} className="bg-coal">{l}</option>)}
                  </select>
                  <Languages className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Toggle on={email} onChange={setEmail} label="Email extraction" desc="Crawl official sites for direct emails (slower, worth it)" />
              <Toggle on={fastMode} onChange={setFastMode} label="Fast mode · beta" desc="Quick capture, up to 21 results per query" />
            </div>

            <button onClick={() => setAdvanced(!advanced)} className="mt-4 flex w-full items-center justify-between rounded-xl border border-line px-4 py-3 text-[12.5px] font-medium text-sage transition-colors hover:text-bone">
              <span className="flex items-center gap-2"><SlidersHorizontal className="size-4 text-zest" /> Advanced filters</span>
              <ChevronDown className={cn("size-4 transition-transform", advanced && "rotate-180")} />
            </button>
            {advanced && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="overflow-hidden">
                <div className="grid gap-4 pt-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Min rating</label>
                    <select value={minRating} onChange={(e) => setMinRating(e.target.value)} className={selectCls}>
                      {["any", "4.0", "4.2", "4.5", "4.8"].map((r) => <option key={r} className="bg-coal">{r === "any" ? "any rating" : `≥ ${r} stars`}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Min reviews</label>
                    <select value={minReviews} onChange={(e) => setMinReviews(e.target.value)} className={selectCls}>
                      {["any", "10", "25", "50", "100"].map((r) => <option key={r} className="bg-coal">{r === "any" ? "any count" : `≥ ${r} reviews`}</option>)}
                    </select>
                  </div>
                </div>
              </motion.div>
            )}

            <button
              onClick={launch}
              disabled={!niche.trim() || !city.trim()}
              className="group mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-zest font-display text-[15px] font-semibold text-ink transition-all hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Play className="size-4" /> Launch search — {est.toLocaleString()} leads
            </button>
          </Card>

          {/* live plan preview */}
          <Card className="h-fit p-5 sm:p-6 lg:sticky lg:top-10">
            <div className="flex items-center gap-2.5">
              <span className="relative flex size-2">
                <span className="absolute size-full animate-ping-soft rounded-full bg-zest" />
                <span className="relative size-2 rounded-full bg-zest" />
              </span>
              <h3 className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-sage">Sector plan · live preview</h3>
            </div>
            <p className="mt-4 truncate rounded-xl border border-line bg-ink/50 px-4 py-3 font-mono text-[12.5px] text-bone">
              “{q}”
            </p>
            <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line">
              {[
                [`~${est}`, "leads est."],
                [email ? `~${estEmails}` : "off", "emails"],
                [etaLabel, "runtime"],
              ].map(([v, l]) => (
                <div key={l} className="bg-coal px-2 py-3.5 text-center">
                  <p className="font-display text-lg font-bold text-zest">{v}</p>
                  <p className="mt-0.5 font-mono text-[8.5px] uppercase tracking-wider text-faint">{l}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2.5 font-mono text-[11px]">
              {[
                [Globe2, `${sectors} sector cells · zoom ${fastMode ? 16 : 15}`],
                [Gauge, `radius ${radius} km · depth ${depth}`],
                [MailCheck, email ? "email crawl: every official site" : "email crawl: disabled"],
                [Clock3, fastMode ? "fast mode — partial fields, throttle risk" : "standard mode — full 36 fields"],
                [Zap, minRating !== "any" || minReviews !== "any" ? `filters: rating ${minRating} · reviews ${minReviews}` : "no attribute filters"],
              ].map(([Icon, text], i) => (
                <p key={i} className="flex items-center gap-2.5 text-sage">
                  {/* @ts-expect-error icon tuple */}
                  <Icon className="size-3.5 shrink-0 text-zest/70" /> {text}
                </p>
              ))}
            </div>
            <div className="mt-5 rounded-xl border border-zest/20 bg-zest/[0.04] px-4 py-3 font-mono text-[10.5px] leading-relaxed text-sage">
              quota impact: <span className="text-zest">only unique enriched leads</span> count — dedupe is on by default.
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
