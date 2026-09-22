import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Bot,
  Check,
  CheckCircle2,
  Clock3,
  Download,
  FileDown,
  FileJson,
  FolderKanban,
  Loader2,
  Play,
  Radar,
  Send,
  Sparkles,
  Trash2,
  User,
} from "lucide-react";
import { api, ApiError, type ExportPayload, type Job } from "../lib/api";
import { useEngine } from "./engine";
import { useExports, useLists } from "./hooks";
import { downloadUrl, relTime } from "./data";
import { useTheme } from "../lib/theme";
import { Card, Modal, PageHeader, StatusChip } from "./shell";
import { cn } from "../utils/cn";

/* ================================================================== */
/*  /zybbleai                                                          */
/* ================================================================== */

type Plan = {
  summary: string;
  segments: Array<{ name: string; why: string }>;
  queries: Array<{ text: string; location?: string; rationale: string }>;
  recommended: { depth: number; radiusKm: number; requestedCount: number; emailExtraction: boolean; grid: boolean };
  nextSteps: string[];
  preview: { inputs: number; ceiling: number; resultsPerInput: number };
};

type Msg =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "ai"; kind: "welcome" }
  | {
      id: number;
      role: "ai";
      kind: "plan";
      brief: string;
      plan: Plan;
      approved: boolean;
      searches: string[];
      running: boolean;
      error?: string;
    }
  | { id: number; role: "ai"; kind: "chat"; text: string }
  | { id: number; role: "ai"; kind: "diary"; searchSlugs: string[] };

let messageIds = 1;
const nextId = () => messageIds++;

const SUGGESTIONS = [
  "Find HVAC companies in Dallas with 4.5+ stars and no online booking",
  "Find wedding photographers in Austin rated above 4.7",
  "Find gyms in Melbourne rated below 4.2 with 30+ reviews",
  "Find boutique hotels in Lyon without a booking engine",
];

export function ZybbleAiPage() {
  const { theme } = useTheme();
  const { createJob, jobs, refresh } = useEngine();
  const [msgs, setMsgs] = useState<Msg[]>([{ id: 0, role: "ai", kind: "welcome" }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const preset = sessionStorage.getItem("zybble_brief");
    if (preset) {
      sessionStorage.removeItem("zybble_brief");
      setInput(preset);
      void submit(preset);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [msgs, busy]);

  /** Planning is a real Gemini call. It consumes an AI run, never lead quota. */
  const submit = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    setProblem(null);
    setMsgs((current) => [...current, { id: nextId(), role: "user", text }]);
    try {
      const response = await api.ai.plan({ brief: text, targetCount: 250 });
      setMsgs((current) => [
        ...current,
        { id: nextId(), role: "ai", kind: "plan", brief: text, plan: response.plan as unknown as Plan, approved: false, searches: [], running: false },
      ]);
    } catch (cause) {
      const message = cause instanceof ApiError ? cause.message : "The planner is unavailable right now";
      setProblem(message);
      setMsgs((current) => [...current, { id: nextId(), role: "ai", kind: "chat", text: `I could not plan that search: ${message}` }]);
    } finally {
      setBusy(false);
    }
  };

  /** Approval is what actually creates the searches — the plan alone does nothing. */
  const approve = async (id: number, brief: string, plan: Plan) => {
    const message = msgs.find((entry) => entry.id === id);
    if (!message || message.role !== "ai" || message.kind !== "plan") return;

    setMsgs((current) => current.map((entry) => (entry.id === id && "kind" in entry && entry.kind === "plan" ? { ...entry, approved: true, running: true } : entry)));

    try {
      const slugs: string[] = [];
      for (const query of plan.queries.slice(0, 6)) {
        const job = await createJob({
          query: query.text,
          city: query.location?.trim() || undefined,
          planned: Math.max(10, Math.round(plan.recommended.requestedCount / Math.max(1, plan.queries.length))),
          source: "ai",
          name: query.text,
          flags: {
            email: plan.recommended.emailExtraction,
            depth: plan.recommended.depth,
            radius: Math.max(1, Math.round(plan.recommended.radiusKm)),
            grid: plan.recommended.grid,
          },
          aiPlan: { ...plan, brief } as unknown as Record<string, unknown>,
        });
        slugs.push(job.slug);
      }
      await refresh();
      setMsgs((current) => [
        ...current.map((entry) => (entry.id === id && "kind" in entry && entry.kind === "plan" ? { ...entry, running: false, searches: slugs } : entry)),
        { id: nextId(), role: "ai", kind: "diary", searchSlugs: slugs },
      ]);
    } catch (cause) {
      const message = cause instanceof ApiError ? cause.message : "The searches could not be created";
      setMsgs((current) => current.map((entry) => (entry.id === id && "kind" in entry && entry.kind === "plan" ? { ...entry, running: false, approved: false, error: message } : entry)));
    }
  };

  const hasContent = msgs.some((message) => message.role === "user");

  return (
    <div className="mx-auto flex max-w-3xl flex-col">
      <PageHeader
        title={
          <span className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl border border-zest/25 bg-zest/[0.08]">
              <Sparkles className="size-4.5 text-zest" />
            </span>
            Zybble AI
          </span>
        }
        desc="Brief in plain English. Review the plan. Nothing runs — and no quota is spent — until you approve it."
      />

      {problem && <Card className="mb-4 border-amber/40 p-4 text-[13px] text-amber">{problem}</Card>}

      <div className="flex-1 space-y-4 pb-6">
        {msgs.map((msg) => {
          if (msg.role === "user")
            return (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end gap-2.5">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-zest px-4 py-3 text-[13.5px] font-medium leading-relaxed text-ink">{msg.text}</div>
                <span className="mt-1 grid size-7 shrink-0 place-items-center rounded-lg border border-line text-sage">
                  <User className="size-3.5" />
                </span>
              </motion.div>
            );

          if (msg.kind === "welcome")
            return (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2.5">
                <span className="mt-1 grid size-7 shrink-0 place-items-center rounded-lg border border-zest/30 bg-zest/10 text-zest">
                  <Bot className="size-3.5" />
                </span>
                <div className="max-w-[88%] rounded-2xl rounded-bl-md border border-line bg-coal px-4 py-3.5 text-[13.5px] leading-relaxed text-sage">
                  I plan Google Maps searches from a brief. Tell me the niche, the area and any signals like{" "}
                  <span className="font-mono text-[12px] text-zest">rating ≥ 4.5</span> or <span className="font-mono text-[12px] text-zest">no online booking</span> —
                  you review the plan, then approve it to run.
                  <div className="mt-3.5 grid gap-2 sm:grid-cols-2">
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => void submit(suggestion)}
                        className="rounded-lg border border-line bg-white/[0.02] px-3 py-2.5 text-left font-mono text-[10.5px] leading-relaxed text-sage transition-colors hover:border-zest/30 hover:text-bone"
                      >
                        “{suggestion}”
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            );

          if (msg.kind === "chat")
            return (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2.5">
                <span className="mt-1 grid size-7 shrink-0 place-items-center rounded-lg border border-zest/30 bg-zest/10 text-zest">
                  <Bot className="size-3.5" />
                </span>
                <div className="max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-bl-md border border-line bg-coal px-4 py-3.5 text-[13.5px] leading-relaxed text-sage">
                  {msg.text}
                </div>
              </motion.div>
            );

          if (msg.kind === "plan")
            return (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2.5">
                <span className="mt-1 grid size-7 shrink-0 place-items-center rounded-lg border border-zest/30 bg-zest/10 text-zest">
                  <Bot className="size-3.5" />
                </span>
                <div className="w-full max-w-[88%] overflow-hidden rounded-2xl rounded-bl-md border border-line bg-coal">
                  <div className="border-b border-line px-4 py-3">
                    <p className="font-display text-[13.5px] font-semibold text-bone">Proposed search plan</p>
                    <p className="mt-0.5 font-mono text-[10px] text-faint">review before it spends quota</p>
                  </div>
                  <div className="space-y-3 px-4 py-3.5">
                    <p className="text-[12.5px] leading-relaxed text-sage">{msg.plan.summary}</p>
                    {msg.plan.queries.map((query, index) => (
                      <p key={`${query.text}-${index}`} className="flex items-center gap-2.5 font-mono text-[11px] text-sage">
                        <span className="grid size-5 shrink-0 place-items-center rounded-md border border-line font-mono text-[9px] text-faint">{index + 1}</span>
                        <span className="truncate">
                          {query.text}
                          {query.location ? ` · ${query.location}` : ""}
                        </span>
                      </p>
                    ))}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {[
                        `depth ${msg.plan.recommended.depth}`,
                        `radius ${msg.plan.recommended.radiusKm} km`,
                        msg.plan.recommended.emailExtraction ? "email crawl on" : "email crawl off",
                        msg.plan.recommended.grid ? "grid coverage" : "single cell",
                      ].map((filter) => (
                        <span key={filter} className="rounded-md border border-zest/30 bg-zest/[0.06] px-2 py-1 font-mono text-[10px] text-zest">
                          {filter}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-line bg-white/[0.02] px-3 py-2.5 font-mono text-[10.5px] text-sage">
                      <span>planned</span>
                      <span className="text-bone">
                        {msg.plan.queries.length} search{msg.plan.queries.length === 1 ? "" : "es"} ·{" "}
                        {msg.plan.recommended.requestedCount.toLocaleString()} leads · {msg.plan.preview.inputs} input cells
                      </span>
                    </div>
                  </div>
                  <div className="border-t border-line bg-white/[0.015] px-4 py-3">
                    {msg.error && <p className="mb-2 font-mono text-[11px] text-amber">{msg.error}</p>}
                    {msg.approved ? (
                      <p className="flex items-center gap-2 font-mono text-[11px] text-zest">
                        <CheckCircle2 className="size-4" /> approved — {msg.searches.length} search{msg.searches.length === 1 ? "" : "es"} queued
                      </p>
                    ) : (
                      <button
                        onClick={() => void approve(msg.id, msg.brief, msg.plan)}
                        disabled={msg.running}
                        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-zest font-display text-[13px] font-semibold text-ink transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                      >
                        {msg.running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                        {msg.running ? "Creating searches…" : "Approve & run"}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );

          // diary: the real engine log of the approved searches
          const tracked = msg.searchSlugs.map((slug) => jobs.find((job) => job.slug === slug)).filter((job): job is Job => Boolean(job));
          const allDone = tracked.length > 0 && tracked.every((job) => job.status === "complete" || job.status === "failed");
          return (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2.5">
              <span className="mt-1 grid size-7 shrink-0 place-items-center rounded-lg border border-zest/30 bg-zest/10 text-zest">
                <Bot className="size-3.5" />
              </span>
              <div className="w-full max-w-[88%] overflow-hidden rounded-2xl rounded-bl-md border border-line bg-coal">
                <div className="space-y-2 bg-[#0a0d0b] px-4 py-3.5">
                  {tracked.length === 0 && <p className="font-mono text-[10.5px] text-sage">waiting for the worker to pick these up…</p>}
                  {tracked.map((job) => (
                    <div key={job.id} className="space-y-1">
                      <p className="flex items-center gap-2 font-mono text-[10.5px] text-sage">
                        {job.status === "running" || job.status === "queued" ? (
                          <Loader2 className="size-3 animate-spin text-zest" />
                        ) : (
                          <Check className="size-3 text-zest" />
                        )}
                        {job.query} · {job.status}
                      </p>
                      {job.log.slice(-3).map((line, index) => (
                        <p key={`${job.id}-${index}`} className="pl-5 font-mono text-[10px] text-faint">
                          {line}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="space-y-3 border-t border-line px-4 py-3.5">
                  <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line">
                    {[
                      [tracked.reduce((sum, job) => sum + job.found, 0).toLocaleString(), "unique leads"],
                      [tracked.reduce((sum, job) => sum + job.emails, 0).toLocaleString(), "emails"],
                      [allDone ? "done" : "running", "state"],
                    ].map(([value, key]) => (
                      <div key={key} className="bg-ink/60 px-2 py-2.5 text-center">
                        <p className="font-display text-[15px] font-bold text-zest">{value}</p>
                        <p className="font-mono text-[8.5px] uppercase tracking-wider text-faint">{key}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tracked.map((job) => (
                      <a
                        key={job.id}
                        href={`#/search/${job.slug}`}
                        className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-zest px-3 font-display text-[13px] font-semibold text-ink transition-transform hover:scale-[1.02] active:scale-95"
                      >
                        <Radar className="size-4" /> <span className="truncate">{job.query}</span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}

        {busy && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2.5">
            <span className="grid size-7 place-items-center rounded-lg border border-zest/30 bg-zest/10 text-zest">
              <Loader2 className="size-3.5 animate-spin" />
            </span>
            <p className="mt-1.5 font-mono text-[11px] text-faint">planning with Gemini…</p>
          </motion.div>
        )}
        <div ref={endRef} />
      </div>

      {/* input dock */}
      <div className="sticky bottom-24 lg:bottom-8">
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-2xl border border-line-strong bg-graphite/95 p-2.5 backdrop-blur-xl",
            theme === "dark" ? "shadow-[0_-8px_40px_rgba(0,0,0,0.5)]" : "shadow-[0_-10px_36px_rgba(16,22,15,0.14)]",
          )}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void submit()}
            placeholder={hasContent ? "Refine, or brief a new search…" : "Describe your ideal customer…"}
            className="h-11 flex-1 rounded-xl bg-ink/60 px-4 text-[13.5px] text-bone placeholder:text-faint outline-none"
          />
          <button
            onClick={() => void submit()}
            disabled={!input.trim() || busy}
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-xl transition-all",
              input.trim() && !busy ? "bg-zest text-ink hover:scale-105 active:scale-95" : "bg-white/[0.05] text-faint",
            )}
            aria-label="Send"
          >
            <Send className="size-4" />
          </button>
        </div>
        <p className="mt-2 text-center font-mono text-[9px] uppercase tracking-[0.2em] text-faint">plans never spend lead quota — approval does</p>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  /exports                                                           */
/* ================================================================== */

export function ExportsPage() {
  const { data, error, loading, reload } = useExports({ limit: 50 });
  const lists = useLists({ limit: 100 });
  const [modal, setModal] = useState(false);
  const [source, setSource] = useState("");
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const rows = data?.items ?? [];
  const ready = rows.filter((row) => row.status === "ready").length;

  const availableLists = lists.data?.items ?? [];
  const currentSource = useMemo(() => availableLists.find((list) => list.id === source) ?? availableLists[0] ?? null, [availableLists, source]);

  const create = async () => {
    if (!currentSource) return;
    setBusy(true);
    setProblem(null);
    try {
      const response = await api.exports.create({
        name: `${currentSource.name}.${format}`,
        format,
        sourceType: "list",
        sourceId: currentSource.id,
      });
      setNotice(response.queued ? "Queued — the worker generates the file in the background." : response.message ?? "Export created.");
      setModal(false);
      await reload();
    } catch (cause) {
      setProblem(cause instanceof ApiError ? cause.message : "The export could not be created");
    } finally {
      setBusy(false);
    }
  };

  const download = async (row: ExportPayload) => {
    setProblem(null);
    try {
      const signed = await api.exports.download(row.slug);
      downloadUrl(signed.url, signed.name);
      window.setTimeout(() => void reload(), 2_000);
    } catch (cause) {
      setProblem(cause instanceof ApiError ? cause.message : "The download link could not be created");
    }
  };

  const regenerate = async (row: ExportPayload) => {
    setProblem(null);
    try {
      await api.exports.create({
        name: row.name,
        format: row.format.toLowerCase() as "csv" | "json",
        sourceType: "list",
        sourceId: row.sourceId ?? undefined,
      });
      await reload();
    } catch (cause) {
      setProblem(cause instanceof ApiError ? cause.message : "This export could not be regenerated");
    }
  };

  const remove = async (row: ExportPayload) => {
    setProblem(null);
    try {
      await api.exports.remove(row.slug);
      await reload();
    } catch (cause) {
      setProblem(cause instanceof ApiError ? cause.message : "This export could not be deleted");
    }
  };

  return (
    <div>
      <PageHeader
        title={<>Exports</>}
        desc={`${ready} ready file${ready === 1 ? "" : "s"} · generated server-side, delivered as short-lived signed links.`}
        actions={
          <button
            onClick={() => setModal(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-zest px-4 font-display text-[13px] font-semibold text-ink transition-transform hover:scale-[1.03] active:scale-95"
          >
            <FileDown className="size-4" /> New export
          </button>
        }
      />

      {(problem || error) && <Card className="mb-4 border-amber/40 p-4 text-[13px] text-amber">{problem ?? error}</Card>}
      {notice && <Card className="mb-4 border-zest/40 p-4 text-[13px] text-zest">{notice}</Card>}

      <Card className="overflow-hidden">
        <div className="hidden grid-cols-[1.6fr_1fr_0.5fr_0.5fr_0.5fr_0.6fr_0.7fr] gap-3 border-b border-line bg-white/[0.02] px-5 py-3 font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint lg:grid">
          <span>File</span>
          <span>Source</span>
          <span>Format</span>
          <span>Rows</span>
          <span>Size</span>
          <span>Status</span>
          <span className="text-right">Action</span>
        </div>
        <div className="divide-y divide-line/60">
          {loading && <p className="px-5 py-10 text-center font-mono text-[11.5px] text-faint">loading exports…</p>}
          {!loading && rows.length === 0 && (
            <p className="px-5 py-10 text-center font-mono text-[11.5px] text-faint">
              No exports yet — create one from a list, a search, or the leads table.
            </p>
          )}
          {rows.map((row) => (
            <div
              key={row.id}
              className="grid gap-3 px-4 py-4 sm:px-5 lg:grid-cols-[1.6fr_1fr_0.5fr_0.5fr_0.5fr_0.6fr_0.7fr] lg:items-center lg:gap-3 lg:py-3.5"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-lg border",
                    row.format === "CSV" ? "border-zest/25 bg-zest/[0.06] text-zest" : "border-amber/25 bg-amber/[0.06] text-amber",
                  )}
                >
                  {row.format === "CSV" ? <FileDown className="size-4" /> : <FileJson className="size-4" />}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-mono text-[12.5px] font-medium text-bone">{row.name}</p>
                  <p className="font-mono text-[10px] text-faint">
                    {relTime(row.createdLabel)}
                    {row.expiresLabel ? ` · expires ${relTime(row.expiresLabel)}` : ""}
                  </p>
                </div>
              </div>
              <p className="truncate font-mono text-[11px] text-sage">{row.source}</p>
              <div>
                <span className={cn("rounded-md border px-1.5 py-0.5 font-mono text-[10px]", row.format === "CSV" ? "border-zest/30 text-zest" : "border-amber/30 text-amber")}>
                  {row.format}
                </span>
              </div>
              <p className="font-mono text-[11px] text-sage">{row.rows.toLocaleString()}</p>
              <p className="font-mono text-[11px] text-sage">{row.size}</p>
              <div className="flex items-center gap-2 lg:justify-end">
                <StatusChip status={row.status} />
              </div>
              <div className="flex items-center gap-2 lg:justify-end">
                {row.status === "ready" ? (
                  <button
                    onClick={() => void download(row)}
                    className="grid size-8 place-items-center rounded-lg border border-line text-sage transition-colors hover:border-zest/40 hover:text-zest"
                    aria-label="Download"
                  >
                    <Download className="size-3.5" />
                  </button>
                ) : row.status === "expired" ? (
                  <button onClick={() => void regenerate(row)} className="font-mono text-[10.5px] text-zest hover:underline">
                    regenerate
                  </button>
                ) : row.rawStatus === "failed" ? (
                  <button onClick={() => void regenerate(row)} className="font-mono text-[10.5px] text-amber hover:underline">
                    retry
                  </button>
                ) : (
                  <Loader2 className="size-3.5 animate-spin text-amber" />
                )}
                <button
                  onClick={() => void remove(row)}
                  className="grid size-8 place-items-center rounded-lg border border-line text-faint transition-colors hover:border-red-400/40 hover:text-red-300"
                  aria-label="Delete"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mt-4 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
        <Clock3 className="size-6 shrink-0 text-zest" />
        <p className="text-[13px] leading-relaxed text-sage">
          <span className="font-semibold text-bone">Retention:</span> generated files expire after your plan's retention window and the worker removes
          them from storage. The underlying lists never expire — regenerating a file always reflects the current data.
        </p>
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title="New export">
        <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Source list</label>
        <select
          value={currentSource?.id ?? ""}
          onChange={(e) => setSource(e.target.value)}
          className="h-11 w-full appearance-none rounded-xl border border-line bg-ink/60 px-4 text-sm text-bone outline-none focus:border-zest/50"
        >
          {availableLists.length === 0 && <option value="">No lists yet</option>}
          {availableLists.map((list) => (
            <option key={list.id} value={list.id} className="bg-coal">
              {list.name} · {list.count} leads
            </option>
          ))}
        </select>
        <label className="mb-1.5 mt-4 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Format</label>
        <div className="grid grid-cols-2 gap-2">
          {(["csv", "json"] as const).map((option) => (
            <button
              key={option}
              onClick={() => setFormat(option)}
              className={cn(
                "h-11 rounded-xl border font-mono text-[12px] transition-all",
                format === option ? "border-zest/50 bg-zest/10 text-zest" : "border-line text-sage hover:text-bone",
              )}
            >
              .{option}
            </button>
          ))}
        </div>
        <button
          onClick={() => void create()}
          disabled={busy || !currentSource}
          className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-zest font-display text-sm font-semibold text-ink transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-40"
        >
          <FolderKanban className="size-4" /> {busy ? "Queuing…" : "Generate file"}
        </button>
        <p className="mt-3 text-center font-mono text-[10px] text-faint">the worker builds the file asynchronously — exports never consume lead quota</p>
      </Modal>
    </div>
  );
}
