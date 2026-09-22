import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Download,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Radar as RadarIcon,
  Search,
  Sparkles,
} from "lucide-react";
import { generateLeads, leadsToCsv, detectCity, detectNiche, type Lead } from "../lib/data";
import { DEMO_QUERIES } from "../lib/data";
import { SectionHead, Stars } from "./ui";
import { cn } from "../utils/cn";

type Phase = "idle" | "scan" | "enrich" | "done";

const SCAN_STEPS = [
  "parsing query → niche + geo",
  "splitting city into sectors",
  "sweeping map sectors…",
];

export default function Demo() {
  const [query, setQuery] = useState("dentists in Berlin");
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState(0);
  const [rows, setRows] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const pool = useRef<Lead[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clear, []);

  const run = (q: string) => {
    if (phase === "scan" || phase === "enrich") return;
    clear();
    const clean = q.trim() || "dentists in Berlin";
    pool.current = generateLeads(clean, 64);
    setRows([]);
    setTotal(0);
    setElapsed(0);
    setPhase("scan");
    setStep(0);

    SCAN_STEPS.forEach((_, i) => {
      timers.current.push(setTimeout(() => setStep(i + 1), 620 * (i + 1)));
    });

    timers.current.push(
      setTimeout(() => {
        setPhase("enrich");
        const batch = pool.current.slice(0, 8);
        batch.forEach((l, i) => {
          timers.current.push(
            setTimeout(() => {
              setRows((r) => [...r, l]);
              setTotal(pool.current.length * 6 + 30 + i * 11);
              setElapsed(+(1.2 + i * 0.21).toFixed(2));
            }, 240 * (i + 1))
          );
        });
        timers.current.push(setTimeout(() => setPhase("done"), 240 * 8 + 700));
      }, 620 * SCAN_STEPS.length + 300)
    );
  };

  const exportCsv = () => {
    const csv = leadsToCsv(pool.current, query);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zybble-${query.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "leads"}-64leads.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const niche = detectNiche(query);
  const city = detectCity(query);
  const running = phase === "scan" || phase === "enrich";

  return (
    <section id="demo" className="relative mt-24 scroll-mt-24 py-20 sm:mt-36 sm:py-24">
      {/* ambient */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_30%,rgba(201,241,88,0.05),transparent_70%)]" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHead
          eyebrow="Guided preview"
          title={
            <>
              Don’t take our word for it.
              <br />
              <span className="text-zest">Pull a list right now.</span>
            </>
          }
          copy="An in-browser simulation of the workspace, filled with synthetic sample records so you can try the flow without an account. Nothing here touches Google Maps — your real searches run on the Zybble worker and every number you see in the app comes from your own workspace."
        />

        <div className="mx-auto mt-12 max-w-4xl">
          <div className="always-dark sheen overflow-hidden rounded-2xl border border-line-strong bg-coal shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)] sm:rounded-3xl">
            {/* search bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(query);
              }}
              className="border-b border-line p-3 sm:p-4"
            >
              <div className="flex flex-col gap-2.5 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 size-4.5 -translate-y-1/2 text-faint" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Try “coffee shops in Lisbon”…"
                    className="h-12 w-full rounded-xl border border-line bg-ink/60 pl-11 pr-4 font-mono text-sm text-bone placeholder:text-faint outline-none transition-colors focus:border-zest/50"
                  />
                </div>
                <button
                  type="submit"
                  disabled={running}
                  className={cn(
                    "group inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-zest px-5 font-display text-[15px] font-semibold text-ink transition-all duration-300",
                    running ? "cursor-wait opacity-70" : "hover:scale-[1.03] active:scale-95"
                  )}
                >
                  {running ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Extracting…
                    </>
                  ) : (
                    <>
                      Find leads <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </button>
              </div>
              <div className="mt-3 flex gap-2 overflow-x-auto no-bar sm:flex-wrap">
                {DEMO_QUERIES.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => {
                      setQuery(q);
                      run(q);
                    }}
                    className={cn(
                      "shrink-0 rounded-full border px-3 py-1.5 font-mono text-[11px] transition-colors",
                      query === q
                        ? "border-zest/40 bg-zest/10 text-zest"
                        : "border-line text-sage hover:border-line-strong hover:text-bone"
                    )}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </form>

            {/* status line */}
            <div className="flex items-center justify-between gap-3 border-b border-line bg-ink/40 px-4 py-3 sm:px-5">
              <div className="flex min-w-0 items-center gap-2.5 font-mono text-[11px] text-sage">
                {phase === "idle" && (
                  <>
                    <Sparkles className="size-3.5 shrink-0 text-zest" />
                    <span className="truncate">ready — waiting for your query</span>
                  </>
                )}
                {phase === "scan" && (
                  <>
                    <RadarIcon className="size-3.5 shrink-0 animate-spin text-zest" />
                    <span className="truncate">{SCAN_STEPS[Math.min(step, SCAN_STEPS.length - 1)]}</span>
                  </>
                )}
                {phase === "enrich" && (
                  <>
                    <Loader2 className="size-3.5 shrink-0 animate-spin text-zest" />
                    <span className="truncate">visiting official sites → emails & phones…</span>
                  </>
                )}
                {phase === "done" && (
                  <>
                    <Check className="size-3.5 shrink-0 text-zest" />
                    <span className="truncate">
                      {total} {niche.label.toLowerCase()} found near {city} in {elapsed.toFixed(1)}s — {Math.round(total * 0.88)} with direct email
                    </span>
                  </>
                )}
              </div>
              {phase === "done" && (
                <span className="shrink-0 rounded-md bg-zest/10 px-2 py-1 font-mono text-[10.5px] font-semibold text-zest">
                  88% email hit-rate
                </span>
              )}
            </div>

            {/* results */}
            <div className="min-h-[300px] p-3 sm:p-4">
              <AnimatePresence mode="wait">
                {phase === "idle" && (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="grid min-h-[280px] place-items-center rounded-xl border border-dashed border-line"
                  >
                    <div className="max-w-xs px-6 text-center">
                      <div className="mx-auto mb-4 grid size-12 place-items-center rounded-xl border border-zest/25 bg-zest/[0.07]">
                        <Search className="size-5 text-zest" />
                      </div>
                      <p className="text-sm font-medium text-bone">Your leads will stream in here</p>
                      <p className="mt-1.5 text-[12.5px] leading-relaxed text-sage">
                        Hit “Find leads” — this preview animates synthetic rows so you can see the shape of the result table.
                      </p>
                    </div>
                  </motion.div>
                )}

                {(phase !== "idle") && (
                  <motion.ul key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                    {rows.length === 0 && (
                      <div className="grid min-h-[240px] place-items-center">
                        <Loader2 className="size-6 animate-spin text-zest" />
                      </div>
                    )}
                    <AnimatePresence initial={false}>
                      {rows.map((l) => (
                        <motion.li
                          key={l.name}
                          initial={{ opacity: 0, y: 18, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                          className="group grid gap-3 rounded-xl border border-line bg-white/[0.02] p-3.5 transition-colors hover:border-zest/25 sm:grid-cols-[1.3fr_1fr_auto] sm:items-center sm:gap-4 sm:p-4"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-[14px] font-medium text-bone">{l.name}</p>
                              <span className="hidden shrink-0 rounded border border-line px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-faint sm:inline-block">
                                {l.status}
                              </span>
                            </div>
                            <p className="mt-1 flex items-center gap-1.5 truncate font-mono text-[11px] text-faint">
                              <MapPin className="size-3 shrink-0" />
                              {l.address}, {l.city}
                            </p>
                          </div>
                          <div className="min-w-0 space-y-1">
                            {l.email && (
                              <p className="flex items-center gap-1.5 truncate font-mono text-[11.5px] text-zest">
                                <Mail className="size-3 shrink-0" /> {l.email}
                              </p>
                            )}
                            <p className="flex items-center gap-1.5 truncate font-mono text-[11.5px] text-sage">
                              <Phone className="size-3 shrink-0" /> {l.phone}
                            </p>
                          </div>
                          <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-center sm:gap-1">
                            <Stars rating={l.rating} />
                            <span className="flex items-center gap-1 font-mono text-[10.5px] text-faint">
                              <Globe className="size-3" />
                              {l.reviews} reviews
                            </span>
                          </div>
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>

            {/* footer */}
            <div className="flex flex-col gap-3 border-t border-line bg-ink/40 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">
                simulated rows · nothing is scraped in your browser
              </p>
              <button
                onClick={exportCsv}
                disabled={phase !== "done"}
                className={cn(
                  "inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-5 font-display text-sm font-semibold transition-all duration-300",
                  phase === "done"
                    ? "border-zest/40 bg-zest/10 text-zest hover:scale-[1.03] hover:bg-zest/15 active:scale-95"
                    : "cursor-not-allowed border-line text-faint"
                )}
              >
                <Download className="size-4" />
                Download sample CSV (64 synthetic rows)
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
