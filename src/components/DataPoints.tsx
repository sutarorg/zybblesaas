import { motion } from "framer-motion";
import { Contact, MapPin, Star, Store, Braces } from "lucide-react";
import { DATA_POINT_GROUPS } from "../lib/data";
import { SectionHead, staggerChild, staggerParent } from "./ui";
import { cn } from "../utils/cn";

const ICONS: Record<string, typeof Contact> = { Contact, MapPin, Star, Store };

export default function DataPoints() {
  const totalFields = DATA_POINT_GROUPS.reduce((n, g) => n + g.fields.length, 0);
  return (
    <section id="data" className="relative mt-24 scroll-mt-24 py-20 sm:mt-36 sm:py-24">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-line-strong to-transparent" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHead
          eyebrow="Deep enrichment"
          title={
            <>
              Not a name in a spreadsheet.
              <br />
              <span className="text-zest">{totalFields + 4} data points per lead.</span>
            </>
          }
          copy="Every record ships as a complete intelligence file — enough to score, segment and personalize without touching another tool."
        />

        <motion.div
          variants={staggerParent}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-8%" }}
          className="mx-auto mt-14 grid max-w-6xl gap-4 sm:grid-cols-2"
        >
          {DATA_POINT_GROUPS.map((g, gi) => {
            const Icon = ICONS[g.icon] ?? Store;
            return (
              <motion.article
                key={g.title}
                variants={staggerChild}
                className={cn(
                  "sheen group relative overflow-hidden rounded-2xl border border-line bg-coal p-6 transition-colors duration-300 hover:border-line-strong sm:p-8",
                  gi === 0 && "sm:row-span-1"
                )}
              >
                <div className="pointer-events-none absolute -right-16 -top-16 size-44 rounded-full bg-zest/[0.05] blur-3xl transition-opacity duration-500 group-hover:bg-zest/[0.09]" />
                <div className="flex items-center gap-3">
                  <div className="grid size-11 place-items-center rounded-xl border border-zest/25 bg-zest/[0.07]">
                    <Icon className="size-5 text-zest" strokeWidth={1.8} />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-semibold tracking-tight text-bone">{g.title}</h3>
                    <p className="text-[12.5px] text-sage">{g.desc}</p>
                  </div>
                  <span className="ml-auto shrink-0 rounded-full border border-line px-2.5 py-1 font-mono text-[10px] text-faint">
                    {g.fields.length} fields
                  </span>
                </div>
                <ul className="mt-6 flex flex-wrap gap-2">
                  {g.fields.map((f, i) => (
                    <motion.li
                      key={f}
                      initial={{ opacity: 0, scale: 0.9 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.04 * i, duration: 0.4 }}
                      className={cn(
                        "rounded-lg border px-2.5 py-1.5 font-mono text-[11px] transition-colors duration-300",
                        i === 1 && gi === 0
                          ? "border-zest/40 bg-zest/10 text-zest"
                          : "border-line bg-white/[0.02] text-sage hover:border-line-strong hover:text-bone"
                      )}
                    >
                      {f}
                    </motion.li>
                  ))}
                </ul>
              </motion.article>
            );
          })}
        </motion.div>

        {/* record preview */}
        <motion.div
          initial={{ opacity: 0, y: 34 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-8%" }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mt-10 max-w-3xl overflow-hidden rounded-2xl border border-line-strong bg-ink shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
            <span className="inline-flex items-center gap-2 font-mono text-[11px] text-sage">
              <Braces className="size-3.5 text-zest" /> lead_record.json
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-faint">1 of 312</span>
          </div>
          <pre className="overflow-x-auto p-4 font-mono text-[11.5px] leading-[1.85] sm:p-6 sm:text-[12.5px]">
            <code>
              <span className="text-faint">{"{"}</span>{"\n"}
              {"  "}<span className="text-bone">"name"</span><span className="text-faint">:</span> <span className="text-zest">"KinderSmile Dental Studio"</span><span className="text-faint">,</span>{"\n"}
              {"  "}<span className="text-bone">"email"</span><span className="text-faint">:</span> <span className="text-zest">"hello@kindersmile.de"</span><span className="text-faint">,</span>{"\n"}
              {"  "}<span className="text-bone">"phone"</span><span className="text-faint">:</span> <span className="text-zest">"+49 30 555 0192"</span><span className="text-faint">,</span>{"\n"}
              {"  "}<span className="text-bone">"rating"</span><span className="text-faint">:</span> <span className="text-amber">4.8</span><span className="text-faint">,</span> <span className="text-bone">"reviews"</span><span className="text-faint">:</span> <span className="text-amber">412</span><span className="text-faint">,</span>{"\n"}
              {"  "}<span className="text-bone">"coords"</span><span className="text-faint">:</span> <span className="text-faint">[</span><span className="text-amber">52.5219</span><span className="text-faint">,</span> <span className="text-amber">13.4132</span><span className="text-faint">],</span>{"\n"}
              {"  "}<span className="text-bone">"price_range"</span><span className="text-faint">:</span> <span className="text-zest">"$$"</span><span className="text-faint">,</span> <span className="text-bone">"status"</span><span className="text-faint">:</span> <span className="text-zest">"open"</span>{"\n"}
              <span className="text-faint">{"}"}</span>
            </code>
          </pre>
        </motion.div>
      </div>
    </section>
  );
}
