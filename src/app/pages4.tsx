import { useEffect, useRef, useState } from "react";
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
  User,
} from "lucide-react";
import { useEngine } from "./engine";
import {
  INITIAL_EXPORTS,
  INITIAL_LISTS,
  download,
  leadCsv,
  poolFull,
  type ExportRow,
} from "./data";
import { detectCity } from "../lib/data";
import { useTheme } from "../lib/theme";
import { Card, Modal, PageHeader, StatusChip } from "./shell";
import { cn } from "../utils/cn";

/* ================================================================== */
/*  /zybbleai                                                          */
/* ================================================================== */

type Msg =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "ai"; kind: "plan"; brief: string; sectors: string[]; filters: string[]; est: number; approved: boolean }
  | { id: number; role: "ai"; kind: "diary"; lines: string[]; done: boolean; jobSlug: string; found: number; emails: number };

const AI_ID = { n: 1 };
const nextId = () => AI_ID.n++;

const SUGGESTIONS = [
  "Find HVAC companies in Dallas with 4.5+ stars and no online booking",
  "Find wedding photographers in Austin rated above 4.7",
  "Find gyms in Melbourne rated below 4.2 with 30+ reviews",
  "Find boutique hotels in Lyon without a booking engine",
];

function planFor(brief: string) {
  const city = detectCity(brief);
  const est = 220 + (brief.length * 13) % 160;
  const sectors = [`${city} center · 4 cells`, `${city} north/south · 5 cells`, `${city} metro ring · 3 cells`];
  const filters = [
    brief.match(/4\.[0-9]/) ? `rating ≥ ${brief.match(/4\.[0-9]/)![0]}` : "rating signal attached",
    /email/i.test(brief) ? "email required" : "email crawl on",
    /book/i.test(brief) ? "no booking link" : /website/i.test(brief) ? "has website" : "status = open",
  ];
  return { city, est, sectors, filters };
}

export function ZybbleAiPage() {
  const { theme } = useTheme();
  const { createJob, jobs } = useEngine();
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      id: 0,
      role: "ai",
      kind: "plan",
      brief: "welcome",
      sectors: [],
      filters: [],
      est: 0,
      approved: true,
    },
  ] as Msg[]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    const preset = sessionStorage.getItem("zybble_brief");
    if (preset) {
      sessionStorage.removeItem("zybble_brief");
      setInput(preset);
      setTimeout(() => submit(preset), 500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [msgs, busy]);

  const submit = (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    setMsgs((m) => [...m, { id: nextId(), role: "user", text }]);
    timers.current.push(
      setTimeout(() => {
        const { est, sectors, filters } = planFor(text);
        setMsgs((m) => [...m, { id: nextId(), role: "ai", kind: "plan", brief: text, sectors, filters, est, approved: false }]);
        setBusy(false);
      }, 850)
    );
  };

  const approve = (id: number, brief: string) => {
    setMsgs((m) => m.map((msg) => (msg.id === id && msg.role === "ai" && msg.kind === "plan" ? { ...msg, approved: true } : msg)));
    const m = brief.toLowerCase().match(/find\s+(.+)/);
    const query = m ? m[1].replace(/ rated .*/, "").replace(/ with .*/, "").replace(/ without .*/, "") : brief;
    const { est } = planFor(brief);
    const job = createJob({ query, city: detectCity(brief), planned: est, source: "ai", flags: { email: true } });

    const diaryId = nextId();
    const lines = [
      "search plan approved — 12 sector cells queued",
      "sample run: 12/12 valid, quality gate passed",
      "full sweep running in background…",
      "email crawl active — official sites being visited",
      "QA: dedupe + completeness scoring continuous",
      "list will save automatically on completion",
    ];
    setMsgs((m) => [...m, { id: diaryId, role: "ai", kind: "diary", lines: [], done: false, jobSlug: job.slug, found: job.found, emails: job.emails }]);
    lines.forEach((l, i) => {
      timers.current.push(
        setTimeout(() => {
          setMsgs((all) =>
            all.map((msg) =>
              msg.id === diaryId && msg.role === "ai" && msg.kind === "diary"
                ? { ...msg, lines: [...msg.lines, l], done: i === lines.length - 1 }
                : msg
            )
          );
        }, 900 * (i + 1))
      );
    });
  };

  const hasContent = msgs.some((m) => m.role === "user");

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
        desc="Brief in plain English. Approve the plan. The engine does the rest — diary included."
      />

      <div className="flex-1 space-y-4 pb-6">
        {msgs.map((msg) => {
          if (msg.role === "user")
            return (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end gap-2.5">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-zest px-4 py-3 text-[13.5px] font-medium leading-relaxed text-ink">
                  {msg.text}
                </div>
                <span className="mt-1 grid size-7 shrink-0 place-items-center rounded-lg border border-line text-sage">
                  <User className="size-3.5" />
                </span>
              </motion.div>
            );

          if (msg.kind === "plan" && msg.brief === "welcome")
            return (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2.5">
                <span className="mt-1 grid size-7 shrink-0 place-items-center rounded-lg border border-zest/30 bg-zest/10 text-zest">
                  <Bot className="size-3.5" />
                </span>
                <div className="max-w-[88%] rounded-2xl rounded-bl-md border border-line bg-coal px-4 py-3.5 text-[13.5px] leading-relaxed text-sage">
                  I'm your lead-gen ops teammate. Describe the leads you want — niche, city, any signals
                  like <span className="font-mono text-[12px] text-zest">rating ≥ 4.5</span> or{" "}
                  <span className="font-mono text-[12px] text-zest">no online booking</span> — and I'll plan, validate and run the extraction.
                  <div className="mt-3.5 grid gap-2 sm:grid-cols-2">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} onClick={() => submit(s)} className="rounded-lg border border-line bg-white/[0.02] px-3 py-2.5 text-left font-mono text-[10.5px] leading-relaxed text-sage transition-colors hover:border-zest/30 hover:text-bone">
                        “{s}”
                      </button>
                    ))}
                  </div>
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
                    {msg.sectors.map((s, i) => (
                      <p key={s} className="flex items-center gap-2.5 font-mono text-[11px] text-sage">
                        <span className="grid size-5 place-items-center rounded-md border border-line font-mono text-[9px] text-faint">{i + 1}</span>
                        {s}
                      </p>
                    ))}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {msg.filters.map((f) => (
                        <span key={f} className="rounded-md border border-zest/30 bg-zest/[0.06] px-2 py-1 font-mono text-[10px] text-zest">{f}</span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-line bg-white/[0.02] px-3 py-2.5 font-mono text-[10.5px] text-sage">
                      <span>est. yield</span>
                      <span className="text-bone">~{msg.est} leads · ~{Math.round(msg.est * 0.86)} emails · ≤ 4 min</span>
                    </div>
                  </div>
                  <div className="border-t border-line bg-white/[0.015] px-4 py-3">
                    {msg.approved ? (
                      <p className="flex items-center gap-2 font-mono text-[11px] text-zest">
                        <CheckCircle2 className="size-4" /> approved — job running
                      </p>
                    ) : (
                      <button
                        onClick={() => approve(msg.id, msg.brief)}
                        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-zest font-display text-[13px] font-semibold text-ink transition-transform hover:scale-[1.02] active:scale-[0.98]"
                      >
                        <Play className="size-4" /> Approve & run
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );

          // diary
          const job = jobs.find((j) => j.slug === msg.jobSlug);
          return (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2.5">
              <span className="mt-1 grid size-7 shrink-0 place-items-center rounded-lg border border-zest/30 bg-zest/10 text-zest">
                <Bot className="size-3.5" />
              </span>
              <div className="w-full max-w-[88%] overflow-hidden rounded-2xl rounded-bl-md border border-line bg-coal">
                <div className="space-y-2 bg-[#0a0d0b] px-4 py-3.5">
                  {(msg as Extract<Msg, { kind: "diary" }>).lines.map((l, i) => (
                    <motion.p key={l} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 font-mono text-[10.5px] text-sage">
                      {i === (msg as Extract<Msg, { kind: "diary" }>).lines.length - 1 && !(msg as Extract<Msg, { kind: "diary" }>).done ? (
                        <Loader2 className="size-3 animate-spin text-zest" />
                      ) : (
                        <Check className="size-3 text-zest" />
                      )}
                      {l}
                    </motion.p>
                  ))}
                </div>
                {(msg as Extract<Msg, { kind: "diary" }>).done && job && (
                  <div className="space-y-3 border-t border-line px-4 py-3.5">
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="text-sage">live job status</span>
                      <StatusChip status={job.status} />
                    </div>
                    <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line">
                      {[
                        [job.found, "found"],
                        [job.emails, "emails"],
                        [job.status === "running" ? `~${job.etaMin}m` : "done", "eta"],
                      ].map(([v, k]) => (
                        <div key={k as string} className="bg-ink/60 px-2 py-2.5 text-center">
                          <p className="font-display text-[15px] font-bold text-zest">{v}</p>
                          <p className="font-mono text-[8.5px] uppercase tracking-wider text-faint">{k}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <a href={`#/search/${job.slug}`} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-zest font-display text-[13px] font-semibold text-ink transition-transform hover:scale-[1.02] active:scale-95">
                        <Radar className="size-4" /> Watch it live
                      </a>
                      <a href="#/searches" className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-line font-display text-[13px] font-medium text-bone hover:border-zest/40">
                        All searches
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}

        {busy && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2.5">
            <span className="grid size-7 place-items-center rounded-lg border border-zest/30 bg-zest/10 text-zest">
              <Loader2 className="size-3.5 animate-spin" />
            </span>
            <p className="mt-1.5 font-mono text-[11px] text-faint">planning sectors…</p>
          </motion.div>
        )}
        <div ref={endRef} />
      </div>

      {/* input dock */}
      <div className="sticky bottom-24 lg:bottom-8">
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-2xl border border-line-strong bg-graphite/95 p-2.5 backdrop-blur-xl",
            theme === "dark" ? "shadow-[0_-8px_40px_rgba(0,0,0,0.5)]" : "shadow-[0_-10px_36px_rgba(16,22,15,0.14)]"
          )}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={hasContent ? "Refine, or brief a new search…" : "Describe your ideal customer…"}
            className="h-11 flex-1 rounded-xl bg-ink/60 px-4 text-[13.5px] text-bone placeholder:text-faint outline-none"
          />
          <button
            onClick={() => submit()}
            disabled={!input.trim() || busy}
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-xl transition-all",
              input.trim() && !busy ? "bg-zest text-ink hover:scale-105 active:scale-95" : "bg-white/[0.05] text-faint"
            )}
            aria-label="Send"
          >
            <Send className="size-4" />
          </button>
        </div>
        <p className="mt-2 text-center font-mono text-[9px] uppercase tracking-[0.2em] text-faint">
          plans never spend quota until you approve
        </p>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  /exports                                                           */
/* ================================================================== */

export function ExportsPage() {
  const [rows, setRows] = useState<ExportRow[]>(INITIAL_EXPORTS);
  const [modal, setModal] = useState(false);
  const [source, setSource] = useState(INITIAL_LISTS[0].slug);
  const [format, setFormat] = useState<"CSV" | "JSON">("CSV");

  const readyCount = rows.filter((r) => r.status === "ready").length;

  const create = () => {
    const list = INITIAL_LISTS.find((l) => l.slug === source) ?? INITIAL_LISTS[0];
    const slug = `${list.slug}-${Date.now() % 1000}`;
    const row: ExportRow = {
      slug,
      name: `${list.name}.${format.toLowerCase()}`,
      source: list.name,
      format,
      rows: list.count,
      size: "…",
      status: "generating",
      createdLabel: "just now",
      expiresLabel: "in 30 days",
      seed: list.seed,
    };
    setRows((r) => [row, ...r]);
    setModal(false);
    setTimeout(() => {
      setRows((r) => r.map((x) => (x.slug === slug ? { ...x, status: "ready", size: `${Math.round(list.count * 0.31)} KB` } : x)));
    }, 2400);
  };

  const regenerate = (slug: string) => {
    setRows((r) => r.map((x) => (x.slug === slug ? { ...x, status: "generating", expiresLabel: "in 30 days" } : x)));
    setTimeout(() => {
      setRows((r) => r.map((x) => (x.slug === slug ? { ...x, status: "ready" } : x)));
    }, 2000);
  };

  const downloadRow = (r: ExportRow) => {
    if (r.status !== "ready" || !r.seed) return;
    const leads = poolFull(r.seed).slice(0, Math.min(50, r.rows));
    if (r.format === "JSON") download(r.name, JSON.stringify(leads.slice(0, 24), null, 2), "application/json");
    else download(r.name, leadCsv(leads));
  };

  return (
    <div>
      <PageHeader
        title={<>Exports</>}
        desc={`${readyCount} ready files · generated files are kept for 30 days, always re-generatable.`}
        actions={
          <button onClick={() => setModal(true)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-zest px-4 font-display text-[13px] font-semibold text-ink transition-transform hover:scale-[1.03] active:scale-95">
            <FileDown className="size-4" /> New export
          </button>
        }
      />

      <Card className="overflow-hidden">
        <div className="hidden grid-cols-[1.6fr_1fr_0.5fr_0.5fr_0.5fr_0.6fr_0.6fr] gap-3 border-b border-line bg-white/[0.02] px-5 py-3 font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint lg:grid">
          <span>File</span><span>Source</span><span>Format</span><span>Rows</span><span>Size</span><span>Status</span><span className="text-right">Action</span>
        </div>
        <div className="divide-y divide-line/60">
          {rows.map((r) => (
            <div key={r.slug} className="grid gap-3 px-4 py-4 sm:px-5 lg:grid-cols-[1.6fr_1fr_0.5fr_0.5fr_0.5fr_0.6fr_0.6fr] lg:items-center lg:gap-3 lg:py-3.5">
              <div className="flex min-w-0 items-center gap-3">
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg border", r.format === "CSV" ? "border-zest/25 bg-zest/[0.06] text-zest" : "border-amber/25 bg-amber/[0.06] text-amber")}>
                  {r.format === "CSV" ? <FileDown className="size-4" /> : <FileJson className="size-4" />}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-mono text-[12.5px] font-medium text-bone">{r.name}</p>
                  <p className="font-mono text-[10px] text-faint">{r.createdLabel} · {r.expiresLabel}</p>
                </div>
              </div>
              <p className="truncate font-mono text-[11px] text-sage lg:pl-0">{r.source}</p>
              <div><span className={cn("rounded-md border px-1.5 py-0.5 font-mono text-[10px]", r.format === "CSV" ? "border-zest/30 text-zest" : "border-amber/30 text-amber")}>{r.format}</span></div>
              <p className="font-mono text-[11px] text-sage">{r.rows}</p>
              <p className="font-mono text-[11px] text-sage">{r.size}</p>
              <div className="flex items-center justify-between gap-2 lg:justify-end">
                <StatusChip status={r.status} />
                {r.status === "ready" ? (
                  <button onClick={() => downloadRow(r)} className="grid size-8 place-items-center rounded-lg border border-line text-sage transition-colors hover:border-zest/40 hover:text-zest" aria-label="Download">
                    <Download className="size-3.5" />
                  </button>
                ) : r.status === "expired" ? (
                  <button onClick={() => regenerate(r.slug)} className="font-mono text-[10.5px] text-zest hover:underline">regenerate</button>
                ) : (
                  <Loader2 className="size-3.5 animate-spin text-amber" />
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mt-4 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
        <Clock3 className="size-6 shrink-0 text-zest" />
        <p className="text-[13px] leading-relaxed text-sage">
          <span className="font-semibold text-bone">Retention policy:</span> files age out after 30 days to
          keep data fresh and storage lean. The underlying lists never expire — one click re-generates
          any file with the then-current data.
        </p>
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title="New export">
        <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Source list</label>
        <select value={source} onChange={(e) => setSource(e.target.value)} className="h-11 w-full appearance-none rounded-xl border border-line bg-ink/60 px-4 text-sm text-bone outline-none focus:border-zest/50">
          {INITIAL_LISTS.map((l) => (
            <option key={l.slug} value={l.slug} className="bg-coal">
              {l.name} · {l.count} leads
            </option>
          ))}
        </select>
        <label className="mb-1.5 mt-4 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Format</label>
        <div className="grid grid-cols-2 gap-2">
          {(["CSV", "JSON"] as const).map((f) => (
            <button key={f} onClick={() => setFormat(f)} className={cn("h-11 rounded-xl border font-mono text-[12px] transition-all", format === f ? "border-zest/50 bg-zest/10 text-zest" : "border-line text-sage hover:text-bone")}>
              .{f.toLowerCase()}
            </button>
          ))}
        </div>
        <button onClick={create} className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-zest font-display text-sm font-semibold text-ink transition-transform hover:scale-[1.02] active:scale-95">
          <FolderKanban className="size-4" /> Generate file
        </button>
        <p className="mt-3 text-center font-mono text-[10px] text-faint">generating takes a few seconds and never costs quota</p>
      </Modal>
    </div>
  );
}
