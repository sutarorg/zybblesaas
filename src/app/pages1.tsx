import { useEffect, useMemo, useState } from "react";
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
import { Send } from "lucide-react";
import { ApiError } from "../lib/api";
import { useEngine } from "./engine";
import { useStats } from "./hooks";
import { useSession } from "./session";
import { Card, Meter, PageHeader, StatusChip } from "./shell";
import { initials, relTime } from "./data";
import { cn } from "../utils/cn";

/* ================================================================== */
/*  /dashboard                                                         */
/* ================================================================== */

export function DashboardPage() {
  const { jobs, liveCount } = useEngine();
  const { data, error, loading } = useStats();
  const { user, me } = useSession();

  const recentSearches = jobs.slice(0, 4);
  const stats = data?.stats;
  const quota = data?.quota;
  const weekly = stats?.weekly_activity ?? [];
  const maxWeek = Math.max(1, ...weekly.map((day) => day.leads));
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = (user?.fullName ?? "").trim().split(/\s+/)[0] || user?.email?.split("@")[0] || "there";

  const weekTotal = weekly.reduce((sum, day) => sum + day.leads, 0);
  const totalLeads = stats?.total_leads ?? 0;
  const withEmail = stats?.leads_with_email ?? 0;
  const emailShare = totalLeads > 0 ? Math.round((withEmail / totalLeads) * 1000) / 10 : 0;

  const kpis = [
    {
      icon: TrendingUp,
      label: "Leads this month",
      value: (quota?.leads.used ?? 0).toLocaleString(),
      sub: `of ${(quota?.leads.included ?? 0).toLocaleString()} quota`,
    },
    {
      icon: MailCheck,
      label: "Leads with email",
      value: `${emailShare}%`,
      sub: `${withEmail.toLocaleString()} of ${totalLeads.toLocaleString()} leads`,
    },
    { icon: Activity, label: "Active searches", value: String(liveCount), sub: liveCount ? "engine at work" : "engine idle", live: true },
    {
      icon: FileDown,
      label: "Exports this month",
      value: String(quota?.exports_created ?? 0),
      sub: `${stats?.exports_ready ?? 0} ready to download`,
    },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 sm:mb-8">
        <div>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-faint">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-bone sm:text-3xl">{greet}, {firstName}.</h1>
          <p className="mt-1 flex items-center gap-2 text-[13px] text-sage">
            <span className={cn("relative flex size-2", liveCount === 0 && "opacity-40")}>
              <span className="absolute size-full animate-ping-soft rounded-full bg-zest" />
              <span className="relative size-2 rounded-full bg-zest" />
            </span>
            {liveCount === 0
              ? "Engine idle — no searches running"
              : `Engine at work · ${liveCount} search${liveCount === 1 ? "" : "es"} in flight`}
          </p>
        </div>
        <a
          href="#/findleads"
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-zest px-5 font-display text-sm font-semibold text-ink transition-transform hover:scale-[1.03] active:scale-95"
        >
          <Plus className="size-4" /> New search
        </a>
      </div>

      {error && (
        <Card className="mb-4 border-amber/40 p-4 text-[13px] text-amber">
          {error} — numbers below may be out of date.
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.5 }}>
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <k.icon className="size-4.5 text-zest" />
                {k.live && liveCount > 0 && <span className="size-1.5 rounded-full bg-zest" />}
              </div>
              <p className="mt-3.5 font-display text-[26px] font-bold tracking-tight text-bone sm:text-3xl">
                {loading ? "—" : k.value}
              </p>
              <p className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">{k.label}</p>
              <p className="mt-1 font-mono text-[10px] text-zest-dim">{loading ? "loading…" : k.sub}</p>
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
          {weekly.length === 0 ? (
            <div className="mt-6 flex h-36 items-center justify-center rounded-xl border border-dashed border-line">
              <p className="font-mono text-[11px] text-faint">{loading ? "loading activity…" : "No leads recorded in the last 7 days"}</p>
            </div>
          ) : (
            <div className="mt-6 flex h-36 items-end gap-2.5 sm:gap-3">
              {weekly.map((day, i) => (
                <div key={day.day} className="group flex h-full flex-1 flex-col items-center justify-end" title={`${day.leads} leads`}>
                  <span className="mb-1.5 font-mono text-[10px] text-sage opacity-0 transition-opacity group-hover:opacity-100">{day.leads}</span>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: Math.max(5, Math.round((day.leads / maxWeek) * 96)) }}
                    transition={{ delay: 0.2 + i * 0.06, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    className={cn(
                      "w-full rounded-t-md transition-colors",
                      day.leads === maxWeek && day.leads > 0 ? "bg-zest" : "bg-gradient-to-t from-zest-dim/30 to-zest/60 group-hover:to-zest",
                    )}
                  />
                  <span className="mt-2 font-mono text-[9.5px] uppercase text-faint">{day.day}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
            <p className="font-mono text-[11px] text-sage">{weekTotal.toLocaleString()} leads in the last 7 days</p>
            <span className="rounded-md bg-zest/10 px-2 py-1 font-mono text-[10.5px] font-semibold text-zest">
              {me?.entitlements?.plan?.code ?? "starter"} plan
            </span>
          </div>
        </Card>

        {/* quota */}
        <Card className="p-5 sm:p-6">
          <h3 className="font-display text-base font-semibold text-bone">Cycle usage</h3>
          <p className="mt-1 font-mono text-[10.5px] text-faint">
            {stats?.period?.end ? `resets ${new Date(stats.period.end).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "current billing period"}
          </p>
          <div className="mt-5 space-y-5">
            {[
              { label: "Enriched leads", used: quota?.leads.used ?? 0, max: quota?.leads.included ?? 0 },
              { label: "AI briefs", used: quota?.ai_runs.used ?? 0, max: quota?.ai_runs.included ?? 0 },
              { label: "Seats", used: quota?.seats.used ?? 0, max: quota?.seats.included ?? 1 },
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
          <a
            href="#/billing"
            className="mt-6 flex items-center justify-between rounded-xl border border-line bg-white/[0.02] px-4 py-3 text-[12.5px] font-medium text-sage transition-colors hover:border-zest/30 hover:text-bone"
          >
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
            {recentSearches.length === 0 ? (
              <p className="px-5 py-8 text-center font-mono text-[11px] text-faint">
                No searches yet —{" "}
                <a href="#/findleads" className="text-zest hover:underline">launch your first sweep</a>
              </p>
            ) : (
              recentSearches.map((j) => (
                <a key={j.slug} href={`#/search/${j.slug}`} className="flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-white/[0.02]">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-bone">{j.query}</p>
                    <div className="mt-1 flex items-center gap-2.5 font-mono text-[10px] text-faint">
                      <span>{j.found} found</span>
                      {j.flags.email && <span>· {j.emails} emails</span>}
                      <span className="hidden sm:inline">· {relTime(j.createdAt)}</span>
                    </div>
                  </div>
                  {j.status === "running" && (
                    <div className="hidden w-20 sm:block">
                      <Meter value={j.processed} max={Math.max(1, j.planned)} />
                    </div>
                  )}
                  <StatusChip status={j.status} />
                </a>
              ))
            )}
          </div>
        </Card>

        {/* recent leads */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h3 className="font-display text-base font-semibold text-bone">Fresh leads</h3>
            <a href="#/leads" className="font-mono text-[11px] text-zest hover:underline">all →</a>
          </div>
          <div className="divide-y divide-line/70">
            {(stats?.recent_leads ?? []).length === 0 ? (
              <p className="px-5 py-8 text-center font-mono text-[11px] text-faint">No leads yet — results appear here as the engine writes them.</p>
            ) : (
              (stats?.recent_leads ?? []).map((lead) => (
                <a key={lead.slug} href={`#/lead/${lead.slug}`} className="flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-white/[0.02]">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-white/[0.03] font-display text-[11px] font-bold text-zest">
                    {initials(lead.business_name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-bone">{lead.business_name}</p>
                    <p className="truncate font-mono text-[10.5px] text-zest/80">{lead.email_primary ?? "no email captured yet"}</p>
                  </div>
                  <span className="font-mono text-[11px] text-amber">score {lead.quality_score}</span>
                </a>
              ))
            )}
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
  const { me } = useSession();
  const [mode, setMode] = useState<"guided" | "ai">("guided");
  const [niche, setNiche] = useState("");
  const [city, setCity] = useState("");
  const [radius, setRadius] = useState(10);
  const [depth, setDepth] = useState(10);
  const [lang, setLang] = useState("en");
  const [email, setEmail] = useState(true);
  const [fastMode, setFastMode] = useState(false);
  const [requested, setRequested] = useState(250);
  const [advanced, setAdvanced] = useState(false);
  const [minRating, setMinRating] = useState("any");
  const [minReviews, setMinReviews] = useState("any");
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const plan = me?.entitlements?.plan;
  const quota = me?.quota;
  const q = `${niche.trim()} in ${city.trim()}`.trim();

  // The plan caps depth/radius; reflect that in the form instead of letting the
  // server reject a launch the UI could have prevented.
  const maxDepth = plan?.max_search_depth ?? 10;
  const maxRadius = plan?.max_radius_km ?? 10;
  // Every option carries an explicit numeric `value` — without it the browser
  // reports the label ("8 levels"), which parsed to NaN and was sent as `null`,
  // so the API rejected the search with "Some fields are invalid".
  const depthOptions = useMemo(() => {
    const options = [4, 8, 10, 12, 16, 20].filter((d) => d <= maxDepth);
    if (!options.includes(maxDepth) && maxDepth >= 1) options.push(maxDepth);
    return options.sort((a, b) => a - b);
  }, [maxDepth]);
  useEffect(() => {
    if (!Number.isFinite(depth) || depth < 1) setDepth(Math.min(10, maxDepth));
    else if (depth > maxDepth) setDepth(maxDepth);
    else if (!depthOptions.includes(depth)) setDepth(depthOptions.filter((d) => d <= depth).pop() ?? depthOptions[0] ?? maxDepth);
  }, [depth, depthOptions, maxDepth]);
  useEffect(() => {
    if (radius > maxRadius) setRadius(maxRadius);
  }, [radius, maxRadius]);

  const launch = async () => {
    if (!niche.trim() || !city.trim()) return;
    setBusy(true);
    setProblem(null);
    const safeDepth = Number.isFinite(depth) ? Math.min(Math.max(1, Math.round(depth)), maxDepth) : Math.min(10, maxDepth);
    const safeRadius = Number.isFinite(radius) ? Math.min(Math.max(1, radius), maxRadius) : Math.min(10, maxRadius);
    try {
      const job = await createJob({
        query: q,
        city: city.trim(),
        planned: requested,
        source: "manual",
        flags: { email, fastMode, depth: safeDepth, radius: safeRadius, lang },
        filters: {
          ...(minRating !== "any" ? { minRating: Number(minRating) } : {}),
          ...(minReviews !== "any" ? { minReviews: Number(minReviews) } : {}),
        },
      });
      window.location.hash = `#/search/${job.slug}`;
    } catch (cause) {
      setProblem(cause instanceof ApiError ? cause.message : "The search could not be created");
    } finally {
      setBusy(false);
    }
  };

  const launchAi = () => {
    if (brief.trim()) sessionStorage.setItem("zybble_brief", brief.trim());
    window.location.hash = "#/zybbleai";
  };

  const remaining = quota ? Math.max(0, quota.leads.remaining) : null;

  return (
    <div>
      <PageHeader
        title={<>Find leads</>}
        desc="One sentence or one form — the engine sweeps the map, dedupes against your workspace and enriches every new match."
      />

      {/* mode tabs */}
      <div className="mb-6 flex w-fit items-center gap-1 rounded-full border border-line-strong bg-coal p-1.5">
        {(["guided", "ai"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2 font-display text-[13px] font-medium transition-all",
              mode === m ? "bg-zest text-ink" : "text-sage hover:text-bone",
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
              <p className="text-[12.5px] text-sage">The Assistant plans the searches — you review and approve before anything runs.</p>
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
          <p className="mt-3 font-mono text-[10.5px] text-faint">
            Planning is a review step: a search only starts after you approve the plan, and planning alone does not consume lead quota.
          </p>
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
                <input type="range" min={1} max={maxRadius} value={radius} onChange={(e) => setRadius(+e.target.value)} className="h-11 w-full accent-[#c9f158]" />
              </div>
              <div>
                <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Depth</label>
                <div className="relative">
                  <select value={String(depth)} onChange={(e) => setDepth(Number(e.target.value))} className={selectCls}>
                    {depthOptions.map((d) => (
                      <option key={d} value={String(d)} className="bg-coal">
                        {d} levels
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Language</label>
                <div className="relative">
                  <select value={lang} onChange={(e) => setLang(e.target.value)} className={selectCls}>
                    {["en", "de", "fr", "pt", "es", "nl"].map((l) => (
                      <option key={l} value={l} className="bg-coal">{l}</option>
                    ))}
                  </select>
                  <Languages className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
                </div>
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                Leads to collect · {requested.toLocaleString()}
              </label>
              <input type="range" min={10} max={5000} step={10} value={requested} onChange={(e) => setRequested(+e.target.value)} className="h-11 w-full accent-[#c9f158]" />
              <p className="mt-1 font-mono text-[10.5px] text-faint">
                Previously seen businesses are recognised and skipped — they are not billed twice.
              </p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Toggle on={email} onChange={setEmail} label="Email extraction" desc="Crawl official sites for direct emails (slower, runs after Maps results arrive)" />
              <Toggle
                on={fastMode}
                onChange={setFastMode}
                label="Fast mode"
                desc={fastMode ? "Off by default — fewer fields, less reliable" : "Standard mode · full field extraction"}
              />
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
                      {["any", "4.0", "4.2", "4.5", "4.8"].map((r) => (
                        <option key={r} value={r} className="bg-coal">{r === "any" ? "any rating" : `≥ ${r} stars`}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Min reviews</label>
                    <select value={minReviews} onChange={(e) => setMinReviews(e.target.value)} className={selectCls}>
                      {["any", "10", "25", "50", "100"].map((r) => (
                        <option key={r} value={r} className="bg-coal">{r === "any" ? "any count" : `≥ ${r} reviews`}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="mt-3 font-mono text-[10.5px] leading-relaxed text-faint">
                  Attribute filters are applied to the results that reach your workspace.
                </p>
              </motion.div>
            )}

            {problem && <p className="mt-4 rounded-xl border border-red-400/40 bg-red-400/[0.06] px-4 py-3 text-[12.5px] text-red-300">{problem}</p>}

            <button
              onClick={launch}
              disabled={busy || !niche.trim() || !city.trim()}
              className="group mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-zest font-display text-[15px] font-semibold text-ink transition-all hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Play className="size-4" /> {busy ? "Starting…" : "Launch search"}
            </button>
          </Card>

          {/* plan facts */}
          <Card className="h-fit p-5 sm:p-6 lg:sticky lg:top-10">
            <div className="flex items-center gap-2.5">
              <span className="relative flex size-2">
                <span className="absolute size-full animate-ping-soft rounded-full bg-zest" />
                <span className="relative size-2 rounded-full bg-zest" />
              </span>
              <h3 className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-sage">What will run</h3>
            </div>
            <p className="mt-4 truncate rounded-xl border border-line bg-ink/50 px-4 py-3 font-mono text-[12.5px] text-bone">
              “{q || "niche in city"}”
            </p>
            <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line">
              {[
                [requested.toLocaleString(), "leads requested"],
                [email ? "on" : "off", "email crawl"],
                [fastMode ? "fast" : "standard", "engine mode"],
              ].map(([v, l]) => (
                <div key={l} className="bg-coal px-2 py-3.5 text-center">
                  <p className="font-display text-lg font-bold text-zest">{v}</p>
                  <p className="mt-0.5 font-mono text-[8.5px] uppercase tracking-wider text-faint">{l}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2.5 font-mono text-[11px]">
              {[
                [Globe2, `radius ${radius} km · depth ${depth}`],
                [Gauge, `plan limits: depth ≤ ${maxDepth}, radius ≤ ${maxRadius} km`],
                [MailCheck, email ? "email crawl: every official site, after Maps results" : "email crawl: disabled"],
                [Clock3, "runtime is reported by the worker once it starts"],
                [Zap, minRating !== "any" || minReviews !== "any" ? `result filters: rating ${minRating} · reviews ${minReviews}` : "no attribute filters"],
              ].map(([Icon, text], i) => (
                <p key={i} className="flex items-center gap-2.5 text-sage">
                  {/* @ts-expect-error icon tuple */}
                  <Icon className="size-3.5 shrink-0 text-zest/70" /> {text}
                </p>
              ))}
            </div>
            <div className="mt-5 rounded-xl border border-zest/20 bg-zest/[0.04] px-4 py-3 font-mono text-[10.5px] leading-relaxed text-sage">
              quota impact: <span className="text-zest">only workspace-new leads</span> count
              {remaining !== null && <> · {remaining.toLocaleString()} left this period</>}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
