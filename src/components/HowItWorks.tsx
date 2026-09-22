import { motion } from "framer-motion";
import { Filter, RadarIcon, SearchCheck, Download, MousePointerClick } from "lucide-react";
import { Reveal, SectionHead, staggerChild, staggerParent } from "./ui";

const STEPS = [
  {
    n: "01",
    icon: SearchCheck,
    title: "Describe who you sell to",
    body: "Type any niche + any city — “dentists in Berlin”, “wedding photographers in Austin” — or hand the AI Assistant a plain-language brief.",
    meta: "natural language → search plan",
  },
  {
    n: "02",
    icon: RadarIcon,
    title: "We sweep the map, sector by sector",
    body: "The engine crawls live map listings at up to 120 places a minute, then visits every official website to surface the email hiding on page three of the imprint.",
    meta: "live crawl → 36-field enrichment",
  },
  {
    n: "03",
    icon: Download,
    title: "Dedupe, filter, export. Done.",
    body: "Duplicates vanish automatically. Slice by rating, review count or category, save lists per campaign, and ship a CSV your sequencer devours.",
    meta: "clean list → CSV / CRM-ready",
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="relative mt-24 scroll-mt-24 sm:mt-36">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHead
          eyebrow="How it works"
          title={
            <>
              From niche + city to a pipeline
              <br className="hidden sm:block" /> in <span className="text-zest">under 3 minutes</span>
            </>
          }
          copy="No scraping scripts, no proxy juggling, no Chrome extensions to babysit. Three steps between you and a list of leads nobody in your competitor's CRM has."
        />

        <motion.ol
          variants={staggerParent}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-10%" }}
          className="relative mx-auto mt-14 grid max-w-6xl gap-4 sm:mt-16 md:grid-cols-3 md:gap-5"
        >
          {/* connector (desktop) */}
          <div className="pointer-events-none absolute left-0 right-0 top-14 hidden h-px md:block">
            <div className="flow-line mx-24 h-px" />
          </div>

          {STEPS.map((s, i) => (
            <motion.li key={s.n} variants={staggerChild} className="relative">
              <div className="sheen group h-full rounded-2xl border border-line bg-coal p-6 transition-colors duration-300 hover:border-line-strong sm:p-7">
                <div className="flex items-start justify-between">
                  <div className="relative grid size-12 place-items-center rounded-xl border border-zest/25 bg-zest/[0.07] text-zest">
                    <s.icon className="size-5" strokeWidth={1.8} />
                  </div>
                  <span className="font-display text-5xl font-bold tracking-tight text-transparent [-webkit-text-stroke:1px_rgba(237,239,232,0.14)] transition-all duration-500 group-hover:[-webkit-text-stroke:1px_rgba(201,241,88,0.45)]">
                    {s.n}
                  </span>
                </div>
                <h3 className="mt-6 font-display text-xl font-semibold tracking-tight text-bone">
                  {s.title}
                </h3>
                <p className="mt-3 text-[14px] leading-relaxed text-sage">{s.body}</p>
                <div className="mt-6 flex items-center gap-2 border-t border-line pt-4 font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">
                  <MousePointerClick className="size-3.5 text-zest/60" />
                  {s.meta}
                </div>
              </div>
              {i < STEPS.length - 1 && (
                <div className="mx-auto flex h-6 w-px justify-center md:hidden">
                  <div className="h-full w-px bg-gradient-to-b from-line-strong to-transparent" />
                </div>
              )}
            </motion.li>
          ))}
        </motion.ol>

        <Reveal delay={0.2} className="mx-auto mt-10 max-w-xl">
          <div className="flex items-center justify-center gap-3 rounded-2xl border border-line bg-coal/70 px-5 py-4 text-center">
            <Filter className="size-4 shrink-0 text-zest" />
            <p className="text-sm text-sage">
              Average time from sign-up to first exported list:{" "}
              <span className="font-mono font-semibold text-bone">2m 48s</span>
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
