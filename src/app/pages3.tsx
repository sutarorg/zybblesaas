import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CopyX,
  Download,
  FolderKanban,
  Hourglass,
  Play,
  Pause,
  Plus,
  Radar,
  RefreshCw,
  Sparkles,
  Timer,
  Trash2,
  User,
} from "lucide-react";
import { useEngine } from "./engine";
import {
  INITIAL_LISTS,
  download,
  leadCsv,
  poolFull,
  slugify,
  type ListMeta,
} from "./data";
import { Card, EmptyState, Meter, Modal, PageHeader, QualityBar, StatusChip } from "./shell";
import { cn } from "../utils/cn";

/* ================================================================== */
/*  /lists                                                             */
/* ================================================================== */

export function ListsPage() {
  const [extra, setExtra] = useState<ListMeta[]>([]);
  const [modal, setModal] = useState(false);
  const [name, setName] = useState("");
  const lists = [...extra, ...INITIAL_LISTS];

  const create = () => {
    if (!name.trim()) return;
    setExtra((e) => [
      {
        slug: slugify(name),
        name: slugify(name),
        seed: "dentists in Berlin",
        count: 0,
        withEmail: 0,
        avgRating: 0,
        completeness: 0,
        updatedAgo: "just now",
        tag: "draft",
        description: "Empty list — add leads from any search or use Add to list on any record.",
      },
      ...e,
    ]);
    setName("");
    setModal(false);
  };

  return (
    <div>
      <PageHeader
        title={<>Lists</>}
        desc={`${lists.length} lists · deduped automatically across all of them.`}
        actions={
          <button onClick={() => setModal(true)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-zest px-4 font-display text-[13px] font-semibold text-ink transition-transform hover:scale-[1.03] active:scale-95">
            <Plus className="size-4" /> New list
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {lists.map((l, i) => (
          <motion.a
            key={l.slug}
            href={`#/list/${l.slug}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.05, 0.3), duration: 0.5 }}
            className="group flex flex-col rounded-2xl border border-line bg-coal p-5 transition-all duration-300 hover:-translate-y-1 hover:border-zest/30"
          >
            <div className="flex items-center justify-between gap-2">
              <span className={cn(
                "rounded-full border px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest",
                l.tag === "ai-built" ? "border-zest/40 bg-zest/10 text-zest" : l.tag === "archive" ? "border-line text-faint" : l.tag === "draft" ? "border-amber/40 bg-amber/10 text-amber" : "border-line text-sage"
              )}>
                {l.tag}
              </span>
              <span className="font-mono text-[10px] text-faint">{l.updatedAgo}</span>
            </div>
            <h3 className="mt-3.5 font-display text-lg font-semibold tracking-tight text-bone transition-colors group-hover:text-zest">
              {l.name}
            </h3>
            <p className="mt-1 line-clamp-2 flex-1 text-[12px] leading-relaxed text-sage">{l.description}</p>
            <div className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line">
              {[
                [l.count.toLocaleString(), "leads"],
                [l.count ? `${Math.round((l.withEmail / Math.max(1, l.count)) * 100)}%` : "—", "emails"],
                [l.count ? l.avgRating.toFixed(1) + "★" : "—", "avg rating"],
              ].map(([v, k]) => (
                <div key={k} className="bg-ink/50 px-2 py-2.5 text-center">
                  <p className="font-display text-[15px] font-bold text-bone">{v}</p>
                  <p className="font-mono text-[8px] uppercase tracking-wider text-faint">{k}</p>
                </div>
              ))}
            </div>
            {l.count > 0 && (
              <div className="mt-3.5 flex items-center justify-between">
                <QualityBar value={l.completeness} />
                <span className="inline-flex items-center gap-1 font-mono text-[10.5px] text-zest opacity-0 transition-opacity group-hover:opacity-100">
                  open <ArrowRight className="size-3" />
                </span>
              </div>
            )}
          </motion.a>
        ))}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Create list">
        <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">List name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
          placeholder="denver-roofers-q2"
          className="h-11 w-full rounded-xl border border-line bg-ink/60 px-4 text-sm text-bone placeholder:text-faint outline-none focus:border-zest/50"
        />
        <button onClick={create} className="mt-5 h-11 w-full rounded-xl bg-zest font-display text-sm font-semibold text-ink transition-transform hover:scale-[1.02] active:scale-95">
          Create list
        </button>
      </Modal>
    </div>
  );
}

/* ================================================================== */
/*  /list/:slug                                                        */
/* ================================================================== */

export function ListDetailPage({ slug }: { slug: string }) {
  const { jobs } = useEngine();
  const [shown, setShown] = useState(10);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const meta: ListMeta | null = useMemo(() => {
    const found = INITIAL_LISTS.find((l) => l.slug === slug);
    if (found) return found;
    const job = jobs.find((j) => j.listSlug === slug);
    if (job)
      return {
        slug,
        name: slug,
        seed: job.query,
        count: job.found,
        withEmail: job.emails,
        avgRating: 4.5,
        completeness: 90,
        updatedAgo: "just now",
        jobSlug: job.slug,
        tag: job.source === "ai" ? "ai-built" : "outbound",
        description: `Auto-saved when “${job.query}” completed.`,
      };
    return null;
  }, [slug, jobs]);

  const leads = useMemo(() => (meta ? poolFull(meta.seed).slice(0, Math.min(meta.count, 28)) : []), [meta]);

  if (!meta) {
    return (
      <EmptyState
        icon={FolderKanban}
        title="List not found"
        desc="It may have been deleted or never saved."
        action={<a href="#/lists" className="inline-flex h-10 items-center rounded-xl bg-zest px-5 font-display text-sm font-semibold text-ink">All lists</a>}
      />
    );
  }

  const seedSlug = meta.seed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  return (
    <div>
      <a href="#/lists" className="mb-5 inline-flex items-center gap-2 font-mono text-[11.5px] text-sage transition-colors hover:text-zest">
        <ArrowLeft className="size-3.5" /> all lists
      </a>

      {/* header */}
      <Card className="p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-xl font-bold tracking-tight text-bone sm:text-2xl">{meta.name}</h1>
              <span className="rounded-full border border-zest/30 bg-zest/[0.07] px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-wider text-zest">{meta.tag}</span>
            </div>
            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-sage">{meta.description}</p>
            {meta.jobSlug && (
              <a href={`#/search/${meta.jobSlug}`} className="mt-2.5 inline-flex items-center gap-1.5 font-mono text-[11px] text-zest hover:underline">
                <Radar className="size-3" /> source search →
              </a>
            )}
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={() => download(`${meta.name}.csv`, leadCsv(leads))}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-zest px-4 font-display text-[13px] font-semibold text-ink transition-transform hover:scale-[1.03] active:scale-95"
            >
              <Download className="size-4" /> Export CSV
            </button>
            <button onClick={() => setConfirmDelete(true)} className="grid size-10 place-items-center rounded-xl border border-line text-faint transition-colors hover:border-red-400/40 hover:text-red-300">
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
          {[
            [meta.count.toLocaleString(), "leads"],
            [`${meta.count ? Math.round((meta.withEmail / Math.max(1, meta.count)) * 100) : 0}%`, "with email"],
            [meta.count ? meta.avgRating.toFixed(1) + "★" : "—", "avg rating"],
            [meta.count ? meta.completeness + "%" : "—", "completeness"],
          ].map(([v, k]) => (
            <div key={k} className="bg-coal px-4 py-4 text-center">
              <p className="font-display text-xl font-bold text-bone">{v}</p>
              <p className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-faint">{k}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* dedupe card */}
      <Card className="mt-4 flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-zest/25 bg-zest/[0.07]">
          <CopyX className="size-5 text-zest" />
        </span>
        <div className="flex-1">
          <h3 className="font-display text-[15px] font-semibold text-bone">Dedupe report</h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-sage">
            Fingerprinted against {meta.count ? Math.round(meta.count * 1.14).toLocaleString() : "0"} records —{" "}
            <span className="text-bone">{Math.round(meta.count * 0.06)} duplicates merged</span>, zero quota burned twice.
          </p>
        </div>
        <span className="rounded-md bg-zest/10 px-2.5 py-1.5 font-mono text-[10.5px] font-semibold text-zest">clean ✓</span>
      </Card>

      {/* leads */}
      <Card className="mt-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="font-display text-base font-semibold text-bone">Records</h3>
          <span className="font-mono text-[10.5px] text-faint">top {Math.min(shown, leads.length)} of {meta.count}</span>
        </div>
        <div className="divide-y divide-line/60">
          {leads.slice(0, shown).map((l) => (
            <a key={`${l.seed}|${l.idx}`} href={`#/lead/${seedSlug}__${l.idx}`} className="flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-white/[0.02]">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-white/[0.03] font-display text-[11px] font-bold text-zest">
                {l.name.split(" ").slice(0, 2).map((w) => w[0]).join("")}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium text-bone">{l.name}</p>
                <p className="truncate font-mono text-[10.5px] text-zest/80">{l.email || l.phone}</p>
              </div>
              <QualityBar value={l.completeness} />
              <span className="hidden font-mono text-[11px] text-amber sm:inline">★ {l.rating.toFixed(1)}</span>
            </a>
          ))}
        </div>
        {shown < leads.length && (
          <button onClick={() => setShown((s) => s + 10)} className="h-11 w-full border-t border-line font-mono text-[11.5px] text-sage transition-colors hover:text-bone">
            show more
          </button>
        )}
      </Card>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title={`Delete “${meta.name}”?`}>
        <p className="text-[13.5px] leading-relaxed text-sage">
          This removes the list shell only — constituent leads stay in your workspace and exports already generated remain valid for 30 days.
        </p>
        <div className="mt-6 flex gap-2.5">
          <button onClick={() => setConfirmDelete(false)} className="h-11 flex-1 rounded-xl border border-line font-display text-sm font-medium text-sage hover:text-bone">Keep list</button>
          <button onClick={() => (window.location.hash = "#/lists")} className="h-11 flex-1 rounded-xl bg-red-400/90 font-display text-sm font-semibold text-ink transition-transform hover:scale-[1.02] active:scale-95">
            Delete
          </button>
        </div>
      </Modal>
    </div>
  );
}

/* ================================================================== */
/*  /searches                                                          */
/* ================================================================== */

const FILTERS = ["all", "running", "queued", "paused", "complete", "failed"] as const;

export function SearchesPage() {
  const { jobs, toggle, rerun } = useEngine();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const rows = filter === "all" ? jobs : jobs.filter((j) => j.status === filter);

  return (
    <div>
      <PageHeader
        title={<>Searches</>}
        desc="Every extraction job — live progress, logs and results."
        actions={
          <a href="#/findleads" className="inline-flex h-10 items-center gap-2 rounded-xl bg-zest px-4 font-display text-[13px] font-semibold text-ink transition-transform hover:scale-[1.03] active:scale-95">
            <Plus className="size-4" /> New search
          </a>
        }
      />

      <div className="mb-5 flex gap-2 overflow-x-auto no-bar">
        {FILTERS.map((f) => {
          const n = f === "all" ? jobs.length : jobs.filter((j) => j.status === f).length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 font-mono text-[11px] transition-all",
                filter === f ? "border-zest/50 bg-zest/10 text-zest" : "border-line text-sage hover:text-bone"
              )}
            >
              {f}
              <span className={cn("rounded-md px-1.5 py-0.5 text-[9.5px]", filter === f ? "bg-zest text-ink" : "bg-white/[0.06]")}>{n}</span>
            </button>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Radar} title={`No ${filter} searches`} desc="Launch one and it will land here with live telemetry." action={<a href="#/findleads" className="inline-flex h-10 items-center rounded-xl bg-zest px-5 font-display text-sm font-semibold text-ink">New search</a>} />
      ) : (
        <div className="grid gap-3">
          {rows.map((j) => (
            <div key={j.slug} className="flex flex-col gap-4 rounded-2xl border border-line bg-coal p-5 transition-colors hover:border-line-strong sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <a href={`#/search/${j.slug}`} className="truncate font-display text-[15.5px] font-semibold text-bone transition-colors hover:text-zest">
                    {j.query}
                  </a>
                  {j.source === "ai" && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-zest/30 bg-zest/[0.06] px-1.5 py-0.5 font-mono text-[9px] text-zest">
                      <Sparkles className="size-2.5" /> AI
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10.5px] text-faint">
                  <span><User className="mr-1 inline size-3" />{j.found} found</span>
                  {j.flags.email && <span>· {j.emails} emails</span>}
                  <span>· {j.createdLabel}</span>
                  {j.status === "running" && <span className="text-zest">· eta ~{j.etaMin}m</span>}
                </div>
                <div className="mt-3 sm:max-w-md">
                  <Meter value={j.processed} max={j.planned} tone={j.status === "paused" ? "amber" : "zest"} />
                  <p className="mt-1.5 font-mono text-[9.5px] text-faint">{j.processed} / {j.planned} processed</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 sm:flex-col sm:items-end">
                <StatusChip status={j.status} />
                <div className="flex gap-2">
                  {(j.status === "running" || j.status === "paused") && (
                    <button
                      onClick={() => toggle(j.slug)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 font-mono text-[11px] text-sage transition-colors hover:border-zest/40 hover:text-bone"
                    >
                      {j.status === "running" ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                      {j.status === "running" ? "pause" : "resume"}
                    </button>
                  )}
                  {(j.status === "failed" || j.status === "complete" || j.status === "paused") && (
                    <button
                      onClick={() => rerun(j.slug)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 font-mono text-[11px] text-sage transition-colors hover:border-zest/40 hover:text-bone"
                    >
                      <RefreshCw className="size-3.5" /> rerun
                    </button>
                  )}
                  <a href={`#/search/${j.slug}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/[0.04] px-3 font-mono text-[11px] text-bone transition-colors hover:bg-white/[0.08]">
                    details <ArrowRight className="size-3.5" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  /search/:slug — job detail with live log                           */
/* ================================================================== */

export function SearchDetailPage({ slug }: { slug: string }) {
  const { get, toggle, rerun } = useEngine();
  const job = get(slug);
  const logRef = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(8);

  const leads = useMemo(() => (job ? poolFull(job.query).slice(0, Math.min(job.found, 24)) : []), [job]);

  if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;

  if (!job) {
    return <EmptyState icon={Radar} title="Search not found" desc="It may have been cleaned from the job history." action={<a href="#/searches" className="inline-flex h-10 items-center rounded-xl bg-zest px-5 font-display text-sm font-semibold text-ink">All searches</a>} />;
  }

  const seedSlug = job.query.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const pct = Math.round((job.processed / Math.max(1, job.planned)) * 100);

  return (
    <div>
      <a href="#/searches" className="mb-5 inline-flex items-center gap-2 font-mono text-[11.5px] text-sage transition-colors hover:text-zest">
        <ArrowLeft className="size-3.5" /> all searches
      </a>

      {/* header */}
      <Card className="p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-xl font-bold tracking-tight text-bone sm:text-2xl">{job.query}</h1>
              <StatusChip status={job.status} />
              {job.source === "ai" && (
                <span className="inline-flex items-center gap-1 rounded-md border border-zest/30 bg-zest/[0.06] px-2 py-1 font-mono text-[9.5px] text-zest">
                  <Sparkles className="size-3" /> AI-assisted
                </span>
              )}
            </div>
            <p className="mt-1.5 font-mono text-[11px] text-faint">
              created {job.createdLabel} · duration {job.duration} · job #{slug.slice(0, 8)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {(job.status === "running" || job.status === "paused") && (
              <button onClick={() => toggle(job.slug)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line px-4 font-display text-[13px] font-medium text-bone transition-colors hover:border-zest/40">
                {job.status === "running" ? <Pause className="size-4" /> : <Play className="size-4" />}
                {job.status === "running" ? "Pause" : "Resume"}
              </button>
            )}
            {(job.status === "failed" || job.status === "complete" || job.status === "paused") && (
              <button onClick={() => rerun(job.slug)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line px-4 font-display text-[13px] font-medium text-bone transition-colors hover:border-zest/40">
                <RefreshCw className="size-4" /> Rerun
              </button>
            )}
            {job.status === "complete" && (
              <>
                {job.listSlug && (
                  <a href={`#/list/${job.listSlug}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-zest/40 bg-zest/10 px-4 font-display text-[13px] font-medium text-zest">
                    <FolderKanban className="size-4" /> Open list
                  </a>
                )}
                <button onClick={() => download(`${seedSlug}-${job.found}leads.csv`, leadCsv(leads))} className="inline-flex h-10 items-center gap-2 rounded-xl bg-zest px-4 font-display text-[13px] font-semibold text-ink transition-transform hover:scale-[1.03] active:scale-95">
                  <Download className="size-4" /> Export
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
          {[
            [`${pct}%`, `${job.processed} / ${job.planned} processed`],
            [job.found.toString(), "leads found"],
            [job.flags.email ? job.emails.toString() : "off", "emails captured"],
            [job.status === "running" ? `~${job.etaMin}m` : job.duration, job.status === "running" ? "eta remaining" : "total runtime"],
          ].map(([v, k], i) => (
            <div key={i} className="bg-coal px-4 py-4 text-center">
              <p className={cn("font-display text-xl font-bold", i === 0 ? "text-zest" : "text-bone")}>{v}</p>
              <p className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-faint">{k}</p>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <Meter value={job.processed} max={job.planned} tone={job.status === "paused" ? "amber" : "zest"} />
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        {/* engine log */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h3 className="flex items-center gap-2 font-display text-[15px] font-semibold text-bone">
              <Timer className="size-4 text-zest" /> engine log
            </h3>
            <span className="font-mono text-[10px] text-faint">{job.log.length} events</span>
          </div>
          <div ref={logRef} className="h-64 space-y-1.5 overflow-y-auto bg-[#0a0d0b] p-4 font-mono text-[11px] leading-relaxed sm:text-[11.5px]">
            {job.log.map((l, i) => (
              <motion.p key={`${i}-${job.log.length}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={l.includes("✔") ? "text-zest" : l.includes("✖") ? "text-red-300" : l.includes("⏸") ? "text-amber" : "text-sage"}>
                {l}
              </motion.p>
            ))}
            {job.status === "running" && <p><span className="inline-block h-3 w-1.5 animate-blink bg-zest/80" /></p>}
          </div>
        </Card>

        {/* flags */}
        <Card className="p-5">
          <h3 className="font-display text-[15px] font-semibold text-bone">Run configuration</h3>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {[
              ["email crawl", job.flags.email ? "on" : "off"],
              ["mode", job.flags.fastMode ? "fast (beta)" : "standard"],
              ["depth", `${job.flags.depth} levels`],
              ["radius", `${job.flags.radius} km`],
              ["language", job.flags.lang],
              ["resume-safe", "checkpointed"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-line bg-white/[0.02] px-3 py-2.5">
                <p className="font-mono text-[9px] uppercase tracking-widest text-faint">{k}</p>
                <p className={cn("mt-0.5 font-mono text-[12px]", v === "on" ? "text-zest" : "text-bone")}>{v}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 rounded-lg border border-line bg-white/[0.02] px-3 py-2.5 font-mono text-[10px] leading-relaxed text-faint">
            interrupted runs resume from the last completed sector — nothing is re-fetched.
          </p>
        </Card>
      </div>

      {/* results preview */}
      <Card className="mt-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="flex items-center gap-2 font-display text-base font-semibold text-bone">
            <CheckCircle2 className="size-4 text-zest" /> Results
          </h3>
          <span className="font-mono text-[10.5px] text-faint">{job.found > 0 ? `showing ${Math.min(shown, leads.length)} of ${job.found}` : "awaiting first sector"}</span>
        </div>
        {job.found === 0 ? (
          <div className="grid place-items-center px-6 py-14 text-center">
            <Hourglass className="size-6 animate-spin text-zest" />
            <p className="mt-4 text-[13px] text-sage">Engine is sweeping sectors — first candidates arrive any second.</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-line/60">
              {leads.slice(0, shown).map((l) => (
                <a key={`${l.seed}|${l.idx}`} href={`#/lead/${seedSlug}__${l.idx}`} className="flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-white/[0.02]">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-white/[0.03] font-display text-[11px] font-bold text-zest">
                    {l.name.split(" ").slice(0, 2).map((w) => w[0]).join("")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-bone">{l.name}</p>
                    <p className="truncate font-mono text-[10.5px] text-zest/80">{l.email || l.phone}</p>
                  </div>
                  <span className="hidden font-mono text-[11px] text-amber sm:inline">★ {l.rating.toFixed(1)}</span>
                  <ArrowRight className="size-3.5 text-faint" />
                </a>
              ))}
            </div>
            {shown < leads.length && (
              <button onClick={() => setShown((s) => s + 8)} className="h-11 w-full border-t border-line font-mono text-[11.5px] text-sage hover:text-bone">
                show more
              </button>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
