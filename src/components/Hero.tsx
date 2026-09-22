import { motion } from "framer-motion";
import { ArrowDown, Play, ShieldCheck, Sparkles, Zap } from "lucide-react";
import Radar from "./Radar";
import { Eyebrow, PrimaryButton, GhostButton } from "./ui";

const ease = [0.22, 1, 0.36, 1] as const;

const STATS = [
  { num: "200", suffix: "M+", label: "mapped businesses" },
  { num: "36", suffix: "", label: "data points / lead" },
  { num: "120", suffix: "/min", label: "extraction speed" },
  { num: "195", suffix: "", label: "countries covered" },
];

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-[118px] sm:pt-[140px]">
      {/* ambient glows */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[720px]">
        <div className="absolute left-1/2 top-[-280px] h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-zest/[0.07] blur-[140px]" />
        <div className="absolute left-[8%] top-[200px] h-[300px] w-[300px] rounded-full bg-zest/[0.04] blur-[100px]" />
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-line-strong to-transparent" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.9, delay: 0.35, ease }}
          >
            <Eyebrow>B2B lead generation engine</Eyebrow>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 1, delay: 0.45, ease }}
            className="mt-6 font-display text-[2.55rem] font-bold leading-[1.02] tracking-[-0.03em] text-bone sm:text-6xl lg:text-[4.6rem]"
          >
            Every business on the map{" "}
            <span className="relative inline-block text-zest">
              is a lead.
              <svg
                viewBox="0 0 220 12"
                className="absolute -bottom-1 left-0 w-full sm:-bottom-2"
                preserveAspectRatio="none"
                aria-hidden
              >
                <motion.path
                  d="M3 9 C 60 2, 160 2, 217 7"
                  fill="none"
                  stroke="#c9f158"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.9, delay: 1.25, ease: "easeInOut" }}
                  opacity={0.65}
                />
              </svg>
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.6, ease }}
            className="mx-auto mt-6 max-w-2xl text-[15.5px] leading-relaxed text-sage sm:text-lg"
          >
            Zybble hunts down local businesses that match your ideal customer — any niche,
            any city — enriches each one with direct emails, phones and 36 data points,
            then hands you a clean, deduped list your CRM will love.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.72, ease }}
            className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <PrimaryButton className="w-full sm:w-auto">
              <Sparkles className="size-4" />
              Claim 50 free leads
            </PrimaryButton>
            <GhostButton href="#demo" className="w-full sm:w-auto">
              <Play className="size-4 fill-current" />
              Watch it work
            </GhostButton>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.9 }}
            className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint"
          >
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-zest-dim" /> No credit card
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Zap className="size-3.5 text-zest-dim" /> Live data, never stale
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ArrowDown className="size-3.5 text-zest-dim" /> CSV in one click
            </span>
          </motion.div>
        </div>

        {/* radar console */}
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1.1, delay: 0.85, ease }}
          className="relative mx-auto mt-12 max-w-5xl sm:mt-16"
        >
          <div className="pointer-events-none absolute -inset-8 -z-10 rounded-[40px] bg-zest/[0.05] blur-3xl" />
          <Radar />
          {/* floating query chip */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.6, duration: 0.7, ease }}
            className="absolute -top-5 right-4 hidden rotate-2 items-center gap-2 rounded-xl border border-line-strong bg-graphite px-3.5 py-2.5 shadow-2xl md:flex"
          >
            <span className="size-2 rounded-full bg-zest" />
            <span className="font-mono text-xs text-bone">312 leads · 287 emails found</span>
          </motion.div>
        </motion.div>

        {/* stat strip */}
        <motion.dl
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease }}
          className="mx-auto mt-12 grid max-w-5xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:mt-16 lg:grid-cols-4"
        >
          {STATS.map((s) => (
            <div key={s.label} className="group flex flex-col bg-coal px-5 py-6 transition-colors duration-300 hover:bg-graphite sm:px-7 sm:py-7">
              <dt className="order-2 mt-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-faint transition-colors group-hover:text-sage">
                {s.label}
              </dt>
              <dd className="order-1 font-display text-3xl font-bold tracking-tight text-bone sm:text-4xl">
                {s.num}
                {s.suffix && <span className="text-zest">{s.suffix}</span>}
              </dd>
            </div>
          ))}
        </motion.dl>
      </div>
    </section>
  );
}
