import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "framer-motion";
import { Bot, Check, Download, Loader2, Send, Sparkles, User } from "lucide-react";
import { SectionHead } from "./ui";
import { cn } from "../utils/cn";

const USER_MSG = "Find HVAC companies in Dallas with 4.5+ stars that have a website but no online booking.";
const AI_LINES = [
  "Planning searches → 14 queries across the Dallas metro",
  "Validating sample… sample looks clean",
  "Enriching emails from official sites…",
  "Applying your filters: rating ≥4.5 · has website · no online booking",
];

export default function AiAssistant() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-25% 0px" });
  const [typed, setTyped] = useState(0);
  const [stage, setStage] = useState(0); // 0 typing user, 1..n ai lines, n+1 done

  useEffect(() => {
    if (!inView) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    // type user message
    for (let i = 0; i <= USER_MSG.length; i += 3) {
      timers.push(setTimeout(() => setTyped(Math.min(i, USER_MSG.length)), 14 * i));
    }
    const base = 14 * USER_MSG.length + 500;
    AI_LINES.forEach((_, i) => {
      timers.push(setTimeout(() => setStage(i + 1), base + i * 1100));
    });
    timers.push(setTimeout(() => setStage(AI_LINES.length + 1), base + AI_LINES.length * 1100 + 900));
    return () => timers.forEach(clearTimeout);
  }, [inView]);

  const done = stage > AI_LINES.length;

  return (
    <section id="ai" className="relative mt-24 scroll-mt-24 sm:mt-36">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* copy */}
          <div className="order-2 lg:order-1">
            <SectionHead
              align="left"
              eyebrow="AI Assistant · Growth & Scale"
              title={
                <>
                  Describe the lead.
                  <br />
                  <span className="text-zest">The Assistant does the rest.</span>
                </>
              }
              copy="Skip the operators and filters. Tell Zybble's AI who you want in plain human and it plans the searches, validates a sample, runs the full extraction and enforces your rules — like a lead-gen ops teammate that never sleeps."
            />
            <ul className="mt-8 space-y-3.5">
              {[
                "Turns one sentence into dozens of sector-level searches",
                "Quality-gates every batch before it hits your list",
                "Applies rating, review and attribute filters automatically",
                "Hands off a deduped, export-ready list — with a diary of what it did",
              ].map((t) => (
                <motion.li
                  key={t}
                  initial={{ opacity: 0, x: -18 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                  className="flex items-start gap-3 text-[14.5px] text-sage"
                >
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-zest/30 bg-zest/10">
                    <Check className="size-3 text-zest" />
                  </span>
                  {t}
                </motion.li>
              ))}
            </ul>
          </div>

          {/* chat mock */}
          <div ref={ref} className="order-1 lg:order-2">
            <div className="sheen mx-auto max-w-xl overflow-hidden rounded-2xl border border-line-strong bg-coal shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)] sm:rounded-3xl">
              <div className="flex items-center gap-3 border-b border-line px-4 py-3.5 sm:px-5">
                <span className="grid size-8 place-items-center rounded-lg border border-zest/25 bg-zest/[0.08]">
                  <Sparkles className="size-4 text-zest" />
                </span>
                <div>
                  <p className="font-display text-sm font-semibold text-bone">Zybble Assistant</p>
                  <p className="font-mono text-[10px] text-zest">online · runs unattended</p>
                </div>
                <span className="ml-auto rounded-md border border-line px-2 py-1 font-mono text-[9.5px] uppercase tracking-widest text-faint">
                  GPT-class planner
                </span>
              </div>

              <div className="min-h-[340px] space-y-3.5 p-4 sm:min-h-[380px] sm:p-5">
                {/* user bubble */}
                <div className="flex justify-end gap-2.5">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-zest px-4 py-3 text-[13px] font-medium leading-relaxed text-ink">
                    {USER_MSG.slice(0, typed)}
                    {typed < USER_MSG.length && <span className="ml-0.5 inline-block h-3.5 w-[2px] animate-blink bg-ink/70 align-middle" />}
                  </div>
                  <span className="mt-1 grid size-7 shrink-0 place-items-center rounded-lg border border-line text-sage">
                    <User className="size-3.5" />
                  </span>
                </div>

                {/* ai lines */}
                <AnimatePresence>
                  {stage > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex gap-2.5"
                    >
                      <span className="mt-1 grid size-7 shrink-0 place-items-center rounded-lg border border-zest/30 bg-zest/10 text-zest">
                        <Bot className="size-3.5" />
                      </span>
                      <div className="max-w-[88%] space-y-2 rounded-2xl rounded-bl-md border border-line bg-white/[0.03] px-4 py-3">
                        {AI_LINES.slice(0, Math.min(stage, AI_LINES.length)).map((l, i) => {
                          const complete = stage > i + 1 || done;
                          return (
                            <motion.p
                              key={l}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="flex items-center gap-2 font-mono text-[11px] leading-relaxed text-sage"
                            >
                              {complete ? (
                                <Check className="size-3.5 shrink-0 text-zest" />
                              ) : (
                                <Loader2 className="size-3.5 shrink-0 animate-spin text-zest" />
                              )}
                              {l}
                            </motion.p>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* result card */}
                <AnimatePresence>
                  {done && (
                    <motion.div
                      initial={{ opacity: 0, y: 18, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                      className="ml-9 max-w-[88%] overflow-hidden rounded-2xl border border-zest/30 bg-zest/[0.06]"
                    >
                      <div className="flex items-center justify-between border-b border-zest/20 px-4 py-3">
                        <p className="font-display text-sm font-semibold text-bone">
                          312 HVAC companies ready
                        </p>
                        <span className="rounded-md bg-zest px-2 py-1 font-mono text-[10px] font-bold text-ink">
                          NEW LIST
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-px bg-zest/10 px-0">
                        {[
                          ["276", "with email"],
                          ["4.6★", "avg rating"],
                          ["38s", "run time"],
                        ].map(([v, l]) => (
                          <div key={l} className="bg-ink/50 px-3 py-3 text-center">
                            <p className="font-display text-lg font-bold text-zest">{v}</p>
                            <p className="font-mono text-[9px] uppercase tracking-wider text-sage">{l}</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 p-3">
                        <span className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-zest py-2.5 font-display text-[12.5px] font-semibold text-ink">
                          <Download className="size-3.5" /> Export CSV
                        </span>
                        <span className="inline-flex flex-1 items-center justify-center rounded-lg border border-zest/30 py-2.5 font-display text-[12.5px] font-medium text-zest">
                          View list
                        </span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex items-center gap-2.5 border-t border-line bg-ink/40 p-3 sm:p-4">
                <div className="flex h-11 flex-1 items-center rounded-xl border border-line bg-ink/60 px-4">
                  <span className="truncate font-mono text-[12px] text-faint">
                    ask follow-ups · refine filters · rerun…
                  </span>
                </div>
                <span className={cn("grid size-11 place-items-center rounded-xl transition-colors", done ? "bg-zest text-ink" : "bg-graphite text-faint")}>
                  <Send className="size-4" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
