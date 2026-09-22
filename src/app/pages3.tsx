import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CopyX,
  Download,
  FolderKanban,
  Hourglass,
  Pause,
  Play,
  Plus,
  Radar,
  RefreshCw,
  Sparkles,
  Timer,
  Trash2,
  User,
} from "lucide-react";
import { api, ApiError, type LeadListItem } from "../lib/api";
import { useEngine } from "./engine";
import { useList, useLists } from "./hooks";
import { initials, relTime } from "./data";
import { Card, EmptyState, Meter, Modal, PageHeader, QualityBar, StatusChip } from "./shell";
import { cn } from "../utils/cn";

/* ================================================================== */
/*  /lists                                                             */
/* ================================================================== */

export function ListsPage() {
  const { data, error, loading, reload } = useLists({ limit: 100 });
  const [modal, setModal] = useState(false);
  const [name, setName] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lists = data?.items ?? [];

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setProblem(null);
    try {
      await api.lists.create({ name: name.trim() });
      setName("");
      setModal(false);
      await reload();
    } catch (cause) {
      setProblem(cause instanceof ApiError ? cause.message : "The list could not be created");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={<>Lists</>}
        desc={`${lists.length} list${lists.length === 1 ? "" : "s"} · deduped automatically across all of them.`}
        actions={
          <button
            onClick={() => setModal(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-zest px-4 font-display text-[13px] font-semibold text-ink transition-transform hover:scale-[1.03] active:scale-95"
          >
            <Plus className="size-4" /> New list
          </button>
        }
      />

      {error && <Card className="mb-4 border-amber/40 p-4 text-[13px] text-amber">{error}</Card>}

      {loading ? (
        <Card className="p-10 text-center font-mono text-[11.5px] text-faint">loading lists…</Card>
      ) : lists.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No lists yet"
          desc="Create a list, or save the results of a search — every list shares the same dedupe."
          action={
            <a href="#/findleads" className="inline-flex h-10 items-center rounded-xl bg-zest px-5 font-display text-sm font-semibold text-ink">
              Run a search
            </a>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map((list, index) => (
            <motion.a
              key={list.id}
              href={`#/list/${list.slug}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.05, 0.3), duration: 0.5 }}
              className="group flex flex-col rounded-2xl border border-line bg-coal p-5 transition-all duration-300 hover:-translate-y-1 hover:border-zest/30"
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest",
                    list.tag === "ai" ? "border-zest/40 bg-zest/10 text-zest" : list.tag === "selection" ? "border-zest/40 bg-zest/10 text-zest" : "border-line text-sage",
                  )}
                >
                  {list.tag}
                </span>
                <span className="font-mono text-[10px] text-faint">{relTime(list.updatedAgo)}</span>
              </div>
              <h3 className="mt-3.5 font-display text-lg font-semibold tracking-tight text-bone transition-colors group-hover:text-zest">{list.name}</h3>
              <p className="mt-1 line-clamp-2 flex-1 text-[12px] leading-relaxed text-sage">{list.description || "No description yet."}</p>
              <div className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line">
                {[
                  [list.count.toLocaleString(), "leads"],
                  [list.count ? `${Math.round((list.withEmail / Math.max(1, list.count)) * 100)}%` : "—", "emails"],
                  [list.count ? `${list.avgRating.toFixed(1)}★` : "—", "avg rating"],
                ].map(([value, key]) => (
                  <div key={key} className="bg-ink/50 px-2 py-2.5 text-center">
                    <p className="font-display text-[15px] font-bold text-bone">{value}</p>
                    <p className="font-mono text-[8px] uppercase tracking-wider text-faint">{key}</p>
                  </div>
                ))}
              </div>
              {list.count > 0 && (
                <div className="mt-3.5 flex items-center justify-between">
                  <QualityBar value={list.completeness} />
                  <span className="inline-flex items-center gap-1 font-mono text-[10.5px] text-zest opacity-0 transition-opacity group-hover:opacity-100">
                    open <ArrowRight className="size-3" />
                  </span>
                </div>
              )}
            </motion.a>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Create list">
        <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">List name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void create()}
          placeholder="denver-roofers-q2"
          className="h-11 w-full rounded-xl border border-line bg-ink/60 px-4 text-sm text-bone placeholder:text-faint outline-none focus:border-zest/50"
        />
        {problem && <p className="mt-3 font-mono text-[11.5px] text-amber">{problem}</p>}
        <button
          onClick={() => void create()}
          disabled={busy || !name.trim()}
          className="mt-5 h-11 w-full rounded-xl bg-zest font-display text-sm font-semibold text-ink transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-40"
        >
          {busy ? "Creating…" : "Create list"}
        </button>
      </Modal>
    </div>
  );
}

/* ================================================================== */
/*  /list/:slug                                                        */
/* ================================================================== */

export function ListDetailPage({ slug }: { slug: string }) {
  const [offset, setOffset] = useState(0);
  const pageSize = 25;
  const [queryInput, setQueryInput] = useState("");
  const [debounced, setDebounced] = useState("");
  const [onlyEmail, setOnlyEmail] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(queryInput.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [queryInput]);

  const { data, error, loading } = useList(slug, {
    q: debounced || undefined,
    has_email: onlyEmail || undefined,
    limit: pageSize,
    offset,
  });

  const list = data?.list ?? null;
  const leads = data?.items ?? [];
  const total = data?.total ?? 0;
  const loadingLeads = loading || !list;

  const exportList = async () => {
    if (!list) return;
    setBusy(true);
    setProblem(null);
    try {
      await api.exports.create({ name: list.name, format: "csv", sourceType: "list", sourceId: list.id });
      window.location.hash = "#/exports";
    } catch (cause) {
      setProblem(cause instanceof ApiError ? cause.message : "The export could not be queued");
    } finally {
      setBusy(false);
    }
  };

  const removeList = async () => {
    if (!list) return;
    setBusy(true);
    try {
      await api.lists.remove(list.slug);
      window.location.hash = "#/lists";
    } catch (cause) {
      setProblem(cause instanceof ApiError ? cause.message : "The list could not be deleted");
      setBusy(false);
    }
  };

  if (!loadingLeads && (error || !list)) {
    return (
      <EmptyState
        icon={FolderKanban}
        title="List not found"
        desc={error ?? "It may have been deleted or never saved."}
        action={
          <a href="#/lists" className="inline-flex h-10 items-center rounded-xl bg-zest px-5 font-display text-sm font-semibold text-ink">
            All lists
          </a>
        }
      />
    );
  }

  return (
    <div>
      <a href="#/lists" className="mb-5 inline-flex items-center gap-2 font-mono text-[11.5px] text-sage transition-colors hover:text-zest">
        <ArrowLeft className="size-3.5" /> all lists
      </a>

      {problem && <Card className="mb-4 border-amber/40 p-4 text-[13px] text-amber">{problem}</Card>}

      {/* header */}
      <Card className="p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-xl font-bold tracking-tight text-bone sm:text-2xl">{list?.name ?? "…"}</h1>
              {list && (
                <span className="rounded-full border border-zest/30 bg-zest/[0.07] px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-wider text-zest">{list.tag}</span>
              )}
            </div>
            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-sage">{list?.description || "No description yet."}</p>
            {list?.jobSlug && (
              <a href={`#/search/${list.jobSlug}`} className="mt-2.5 inline-flex items-center gap-1.5 font-mono text-[11px] text-zest hover:underline">
                <Radar className="size-3" /> source search →
              </a>
            )}
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={() => void exportList()}
              disabled={busy || !list}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-zest px-4 font-display text-[13px] font-semibold text-ink transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-40"
            >
              <Download className="size-4" /> Export CSV
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="grid size-10 place-items-center rounded-xl border border-line text-faint transition-colors hover:border-red-400/40 hover:text-red-300"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
          {[
            [(list?.count ?? 0).toLocaleString(), "leads"],
            [`${list && list.count ? Math.round((list.withEmail / Math.max(1, list.count)) * 100) : 0}%`, "with email"],
            [list && list.count ? `${list.avgRating.toFixed(1)}★` : "—", "avg rating"],
            [list && list.count ? `${list.completeness}%` : "—", "completeness"],
          ].map(([value, key]) => (
            <div key={key} className="bg-coal px-4 py-4 text-center">
              <p className="font-display text-xl font-bold text-bone">{value}</p>
              <p className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-faint">{key}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* dedupe note — real status only */}
      <Card className="mt-4 flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-zest/25 bg-zest/[0.07]">
          <CopyX className="size-5 text-zest" />
        </span>
        <div className="flex-1">
          <h3 className="font-display text-[15px] font-semibold text-bone">Dedupe</h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-sage">
            Membership is unique per (list, lead) and the engine dedupes against your whole workspace, so a business that is already in{" "}
            <span className="text-bone">any</span> of your lists or searches is never billed again.
            {list?.jobSlug ? " The source search's own duplicate count is on its detail page." : ""}
          </p>
        </div>
        <span className="rounded-md bg-zest/10 px-2.5 py-1.5 font-mono text-[10.5px] font-semibold text-zest">active</span>
      </Card>

      {/* leads */}
      <Card className="mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h3 className="font-display text-base font-semibold text-bone">Records</h3>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={queryInput}
              onChange={(e) => {
                setQueryInput(e.target.value);
                setOffset(0);
              }}
              placeholder="filter this list…"
              className="h-9 rounded-lg border border-line bg-ink/60 px-3 font-mono text-[11.5px] text-bone placeholder:text-faint outline-none focus:border-zest/50"
            />
            <button
              onClick={() => {
                setOnlyEmail((value) => !value);
                setOffset(0);
              }}
              className={cn(
                "h-9 rounded-lg border px-3 font-mono text-[11px] transition-colors",
                onlyEmail ? "border-zest/50 bg-zest/10 text-zest" : "border-line text-sage hover:text-bone",
              )}
            >
              has email
            </button>
            <span className="font-mono text-[10.5px] text-faint">
              {leads.length} of {total}
            </span>
          </div>
        </div>
        <div className="divide-y divide-line/60">
          {leads.length === 0 ? (
            <p className="px-5 py-10 text-center font-mono text-[11.5px] text-faint">
              {loadingLeads ? "loading records…" : total === 0 ? "This list is empty — add leads from any search or record." : "No lead in this list matches the filter."}
            </p>
          ) : (
            leads.map((lead: LeadListItem) => (
              <a key={lead.id} href={`#/lead/${lead.slug}`} className="flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-white/[0.02]">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-white/[0.03] font-display text-[11px] font-bold text-zest">
                  {initials(lead.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium text-bone">{lead.name}</p>
                  <p className="truncate font-mono text-[10.5px] text-zest/80">{lead.email || lead.phone || "no contact captured"}</p>
                </div>
                <QualityBar value={lead.qualityScore} />
                {lead.rating > 0 && <span className="hidden font-mono text-[11px] text-amber sm:inline">★ {lead.rating.toFixed(1)}</span>}
              </a>
            ))
          )}
        </div>
        {(offset > 0 || offset + leads.length < total) && (
          <div className="flex border-t border-line">
            <button
              onClick={() => setOffset((value) => Math.max(0, value - pageSize))}
              disabled={offset === 0}
              className="h-11 flex-1 font-mono text-[11.5px] text-sage transition-colors hover:text-bone disabled:opacity-30"
            >
              ← previous
            </button>
            <span className="grid h-11 place-items-center px-4 font-mono text-[10.5px] text-faint">
              {Math.floor(offset / pageSize) + 1} / {Math.max(1, Math.ceil(total / pageSize))}
            </span>
            <button
              onClick={() => setOffset((value) => value + pageSize)}
              disabled={offset + leads.length >= total}
              className="h-11 flex-1 font-mono text-[11.5px] text-sage transition-colors hover:text-bone disabled:opacity-30"
            >
              next →
            </button>
          </div>
        )}
      </Card>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title={`Delete “${list?.name ?? "list"}”?`}>
        <p className="text-[13.5px] leading-relaxed text-sage">
          This removes the list shell only — constituent leads stay in your workspace and exports already generated remain valid until they expire.
        </p>
        <div className="mt-6 flex gap-2.5">
          <button onClick={() => setConfirmDelete(false)} className="h-11 flex-1 rounded-xl border border-line font-display text-sm font-medium text-sage hover:text-bone">
            Keep list
          </button>
          <button
            onClick={() => void removeList()}
            disabled={busy}
            className="h-11 flex-1 rounded-xl bg-red-400/90 font-display text-sm font-semibold text-ink transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-40"
          >
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
  const rows = filter === "all" ? jobs : jobs.filter((job) => job.status === filter);

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
        {FILTERS.map((key) => {
          const count = key === "all" ? jobs.length : jobs.filter((job) => job.status === key).length;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 font-mono text-[11px] transition-all",
                filter === key ? "border-zest/50 bg-zest/10 text-zest" : "border-line text-sage hover:text-bone",
              )}
            >
              {key}
              <span className={cn("rounded-md px-1.5 py-0.5 text-[9.5px]", filter === key ? "bg-zest text-ink" : "bg-white/[0.06]")}>{count}</span>
            </button>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Radar}
          title={`No ${filter} searches`}
          desc="Launch one and it will land here with live telemetry."
          action={
            <a href="#/findleads" className="inline-flex h-10 items-center rounded-xl bg-zest px-5 font-display text-sm font-semibold text-ink">
              New search
            </a>
          }
        />
      ) : (
        <div className="grid gap-3">
          {rows.map((job) => (
            <div key={job.slug} className="flex flex-col gap-4 rounded-2xl border border-line bg-coal p-5 transition-colors hover:border-line-strong sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <a href={`#/search/${job.slug}`} className="truncate font-display text-[15.5px] font-semibold text-bone transition-colors hover:text-zest">
                    {job.query}
                  </a>
                  {job.source === "ai" && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-zest/30 bg-zest/[0.06] px-1.5 py-0.5 font-mono text-[9px] text-zest">
                      <Sparkles className="size-2.5" /> AI
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10.5px] text-faint">
                  <span>
                    <User className="mr-1 inline size-3" />
                    {job.found} found
                  </span>
                  {job.flags.email && <span>· {job.emails} emails</span>}
                  <span>· {relTime(job.createdAt)}</span>
                  {job.status === "running" && job.etaMin > 0 && <span className="text-zest">· eta ~{job.etaMin}m</span>}
                </div>
                <div className="mt-3 sm:max-w-md">
                  <Meter value={job.processed} max={Math.max(1, job.planned)} tone={job.status === "paused" ? "amber" : "zest"} />
                  <p className="mt-1.5 font-mono text-[9.5px] text-faint">
                    {job.processed} / {job.planned} processed · {job.progress}%
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 sm:flex-col sm:items-end">
                <StatusChip status={job.status} />
                <div className="flex gap-2">
                  {(job.status === "running" || job.status === "paused") && (
                    <button
                      onClick={() => void toggle(job.slug)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 font-mono text-[11px] text-sage transition-colors hover:border-zest/40 hover:text-bone"
                    >
                      {job.status === "running" ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                      {job.status === "running" ? "pause" : "resume"}
                    </button>
                  )}
                  {(job.status === "failed" || job.status === "complete" || job.status === "paused") && (
                    <button
                      onClick={() => void rerun(job.slug)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 font-mono text-[11px] text-sage transition-colors hover:border-zest/40 hover:text-bone"
                    >
                      <RefreshCw className="size-3.5" /> rerun
                    </button>
                  )}
                  <a href={`#/search/${job.slug}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/[0.04] px-3 font-mono text-[11px] text-bone transition-colors hover:bg-white/[0.08]">
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
  const { toggle, rerun } = useEngine();
  const [detail, setDetail] = useState<{
    search: import("../lib/api").Job;
    inputs: Array<{ id: string; seq: number; query_text: string; status: string; places_discovered: number; places_completed: number; last_error: string | null }>;
    events: Array<{ id: number; type: string; level: string; message: string; at: string }>;
    leads: LeadListItem[];
    pendingInputs: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const [showAllLeads, setShowAllLeads] = useState(8);

  const load = useMemo(
    () => async () => {
      try {
        const payload = await api.searches.get(slug);
        setDetail(payload);
        setError(null);
      } catch (cause) {
        setError(cause instanceof ApiError ? cause.message : "The search could not be loaded");
      }
    },
    [slug],
  );

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 4_000);
    return () => window.clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [detail?.events.length]);

  const job = detail?.search;

  const exportSearch = async () => {
    if (!job) return;
    setBusy(true);
    setProblem(null);
    try {
      await api.exports.create({ name: job.query, format: "csv", sourceType: "search", sourceId: job.id });
      window.location.hash = "#/exports";
    } catch (cause) {
      setProblem(cause instanceof ApiError ? cause.message : "The export could not be queued");
    } finally {
      setBusy(false);
    }
  };

  const saveToList = async () => {
    if (!job) return;
    setBusy(true);
    setProblem(null);
    try {
      const created = await api.lists.create({
        name: job.query,
        description: `Saved from the search “${job.query}”.`,
        tag: job.source === "ai" ? "ai" : "search",
        sourceSearchId: job.id,
      });
      window.location.hash = `#/list/${created.list.slug}`;
    } catch (cause) {
      setProblem(cause instanceof ApiError ? cause.message : "The list could not be created");
    } finally {
      setBusy(false);
    }
  };

  if (error && !job) {
    return (
      <EmptyState
        icon={Radar}
        title="Search not found"
        desc={error}
        action={
          <a href="#/searches" className="inline-flex h-10 items-center rounded-xl bg-zest px-5 font-display text-sm font-semibold text-ink">
            All searches
          </a>
        }
      />
    );
  }

  if (!job) return <Card className="p-10 text-center font-mono text-[11.5px] text-faint">loading search…</Card>;

  const leads = detail?.leads ?? [];
  const events = detail?.events ?? [];

  return (
    <div>
      <a href="#/searches" className="mb-5 inline-flex items-center gap-2 font-mono text-[11.5px] text-sage transition-colors hover:text-zest">
        <ArrowLeft className="size-3.5" /> all searches
      </a>

      {problem && <Card className="mb-4 border-amber/40 p-4 text-[13px] text-amber">{problem}</Card>}

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
              created {relTime(job.createdAt)} · duration {job.duration} · {job.rawStatus}
              {job.workerId ? ` · worker ${job.workerId}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {(job.status === "running" || job.status === "paused") && (
              <button
                onClick={() => void toggle(job.slug)}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-line px-4 font-display text-[13px] font-medium text-bone transition-colors hover:border-zest/40"
              >
                {job.status === "running" ? <Pause className="size-4" /> : <Play className="size-4" />}
                {job.status === "running" ? "Pause" : "Resume"}
              </button>
            )}
            {(job.status === "failed" || job.status === "complete" || job.status === "paused") && (
              <button
                onClick={() => void rerun(job.slug)}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-line px-4 font-display text-[13px] font-medium text-bone transition-colors hover:border-zest/40"
              >
                <RefreshCw className="size-4" /> Rerun
              </button>
            )}
            {job.found > 0 && (
              <>
                <button
                  onClick={() => void saveToList()}
                  disabled={busy}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-zest/40 bg-zest/10 px-4 font-display text-[13px] font-medium text-zest disabled:opacity-40"
                >
                  <FolderKanban className="size-4" /> Save to list
                </button>
                <button
                  onClick={() => void exportSearch()}
                  disabled={busy}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-zest px-4 font-display text-[13px] font-semibold text-ink transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-40"
                >
                  <Download className="size-4" /> Export
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
          {[
            [`${job.progress}%`, `${job.processed} / ${job.planned} processed`],
            [job.found.toString(), "unique leads"],
            [job.flags.email ? job.emails.toString() : "off", "emails captured"],
            [
              job.status === "running" ? (job.etaMin > 0 ? `~${job.etaMin}m` : "measuring") : job.duration,
              job.status === "running" ? "eta remaining" : "total runtime",
            ],
          ].map(([value, key], index) => (
            <div key={key} className="bg-coal px-4 py-4 text-center">
              <p className={cn("font-display text-xl font-bold", index === 0 ? "text-zest" : "text-bone")}>{value}</p>
              <p className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-faint">{key}</p>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <Meter value={job.processed} max={Math.max(1, job.planned)} tone={job.status === "paused" ? "amber" : "zest"} />
        </div>
        <p className="mt-3 font-mono text-[10.5px] text-faint">
          {job.duplicates} duplicate{job.duplicates === 1 ? "" : "s"} skipped · {job.filtered} filtered · {job.errors} error{job.errors === 1 ? "" : "s"} ·{" "}
          {detail?.pendingInputs ?? 0} input{detail?.pendingInputs === 1 ? "" : "s"} still queued
        </p>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        {/* engine log */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h3 className="flex items-center gap-2 font-display text-[15px] font-semibold text-bone">
              <Timer className="size-4 text-zest" /> engine log
            </h3>
            <span className="font-mono text-[10px] text-faint">{events.length} events</span>
          </div>
          <div ref={logRef} className="h-64 space-y-1.5 overflow-y-auto bg-[#0a0d0b] p-4 font-mono text-[11px] leading-relaxed sm:text-[11.5px]">
            {events.length === 0 && <p className="text-faint">No events yet — the worker writes here as it runs.</p>}
            {events.map((event) => (
              <motion.p
                key={event.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={
                  event.level === "success" ? "text-zest" : event.level === "error" ? "text-red-300" : event.level === "warn" ? "text-amber" : "text-sage"
                }
              >
                [{new Date(event.at).toLocaleTimeString("en-GB")}] {event.message}
              </motion.p>
            ))}
            {job.status === "running" && (
              <p>
                <span className="inline-block h-3 w-1.5 animate-blink bg-zest/80" />
              </p>
            )}
          </div>
        </Card>

        {/* flags + inputs */}
        <Card className="p-5">
          <h3 className="font-display text-[15px] font-semibold text-bone">Run configuration</h3>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {[
              ["email crawl", job.flags.email ? "on" : "off"],
              ["mode", job.flags.fastMode ? "fast" : "standard"],
              ["depth", `${job.flags.depth} levels`],
              ["radius", `${job.flags.radius} km`],
              ["language", job.flags.lang],
              ["engine", job.engineVersion ?? "pending"],
            ].map(([key, value]) => (
              <div key={key} className="rounded-lg border border-line bg-white/[0.02] px-3 py-2.5">
                <p className="font-mono text-[9px] uppercase tracking-widest text-faint">{key}</p>
                <p className={cn("mt-0.5 font-mono text-[12px]", value === "on" ? "text-zest" : "text-bone")}>{value}</p>
              </div>
            ))}
          </div>
          {(detail?.inputs.length ?? 0) > 0 && (
            <div className="mt-4">
              <p className="mb-2 font-mono text-[9px] uppercase tracking-widest text-faint">inputs</p>
              <div className="max-h-40 space-y-1.5 overflow-y-auto">
                {(detail?.inputs ?? []).map((input) => (
                  <div key={input.id} className="flex items-center justify-between rounded-lg border border-line bg-white/[0.02] px-3 py-2">
                    <span className="truncate font-mono text-[11px] text-sage">
                      {input.seq + 1}. {input.query_text}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-faint">
                      {input.status} · {input.places_completed}/{input.places_discovered}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="mt-4 rounded-lg border border-line bg-white/[0.02] px-3 py-2.5 font-mono text-[10px] leading-relaxed text-faint">
            Completed inputs are never refetched: a rerun or a worker restart continues from the inputs that are still pending.
          </p>
        </Card>
      </div>

      {/* results preview */}
      <Card className="mt-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="flex items-center gap-2 font-display text-base font-semibold text-bone">
            <CheckCircle2 className="size-4 text-zest" /> Results
          </h3>
          <span className="font-mono text-[10.5px] text-faint">
            {job.found > 0 ? `showing ${Math.min(showAllLeads, leads.length)} of ${job.found}` : "awaiting first result"}
          </span>
        </div>
        {leads.length === 0 ? (
          <div className="grid place-items-center px-6 py-14 text-center">
            {job.status === "running" ? (
              <>
                <Hourglass className="size-6 animate-spin text-zest" />
                <p className="mt-4 text-[13px] text-sage">The engine is sweeping — candidates appear here as soon as they are written.</p>
              </>
            ) : (
              <p className="text-[13px] text-sage">This search has no leads yet.</p>
            )}
          </div>
        ) : (
          <>
            <div className="divide-y divide-line/60">
              {leads.slice(0, showAllLeads).map((lead) => (
                <a key={lead.id} href={`#/lead/${lead.slug}`} className="flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-white/[0.02]">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-white/[0.03] font-display text-[11px] font-bold text-zest">
                    {initials(lead.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-bone">{lead.name}</p>
                    <p className="truncate font-mono text-[10.5px] text-zest/80">{lead.email || lead.phone || "no contact captured"}</p>
                  </div>
                  {lead.rating > 0 && <span className="hidden font-mono text-[11px] text-amber sm:inline">★ {lead.rating.toFixed(1)}</span>}
                  <ArrowRight className="size-3.5 text-faint" />
                </a>
              ))}
            </div>
            {showAllLeads < leads.length && (
              <button onClick={() => setShowAllLeads((value) => value + 8)} className="h-11 w-full border-t border-line font-mono text-[11.5px] text-sage hover:text-bone">
                show more
              </button>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
