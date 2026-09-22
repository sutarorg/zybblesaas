import { motion } from "framer-motion";
import { ArrowUpRight, Check, Minus, Sparkles } from "lucide-react";
import { PRICING } from "../lib/data";
import { SectionHead, staggerChild, staggerParent } from "./ui";
import { cn } from "../utils/cn";

function perLead(price: number, leads: string) {
  if (price === 0) return "free forever";
  const n = parseInt(leads.replace(/[^0-9]/g, ""), 10);
  return `$${(price / n).toFixed(3)}/lead`;
}

export default function Pricing() {
  return (
    <section id="pricing" className="relative mt-24 scroll-mt-24 sm:mt-36">
      <div className="pointer-events-none absolute inset-x-0 top-24 -z-10 mx-auto h-[420px] max-w-4xl rounded-full bg-zest/[0.05] blur-[120px]" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHead
          eyebrow="Pricing"
          title={
            <>
              Cheaper than one
              <br className="hidden sm:block" /> <span className="text-zest">missed opportunity</span>
            </>
          }
          copy="Start with 50 free leads every month. Upgrade when pipeline becomes a habit. Cancel in two clicks whenever."
        />

        <motion.div
          variants={staggerParent}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-6%" }}
          className="mx-auto mt-14 grid max-w-5xl gap-4 lg:grid-cols-3 lg:gap-5"
        >
          {PRICING.map((p, i) => (
            <motion.article
              key={p.name + i}
              variants={staggerChild}
              className={cn(
                "sheen relative flex flex-col rounded-2xl border p-6 sm:p-8",
                p.accent
                  ? "border-zest/50 bg-gradient-to-b from-zest/[0.09] to-coal shadow-[0_30px_80px_-30px_rgba(201,241,88,0.25)] lg:-my-3 lg:py-11"
                  : "border-line bg-coal"
              )}
            >
              {p.accent && (
                <span className="absolute -top-3.5 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-zest px-3.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink shadow-lg">
                  <Sparkles className="size-3" /> Most popular
                </span>
              )}

              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-xl font-semibold text-bone">{p.name}</h3>
                <span className="font-mono text-[10.5px] uppercase tracking-wider text-faint">
                  {perLead(p.price, p.leads)}
                </span>
              </div>

              <div className="mt-5 flex items-end gap-2">
                <span className="font-display text-5xl font-bold tracking-tight text-bone">
                  ${p.price}
                </span>
                <span className="pb-1.5 font-mono text-xs text-faint">/month</span>
              </div>
              <p className={cn("mt-2 font-mono text-xs font-medium", p.accent ? "text-zest" : "text-sage")}>
                {p.leads}
              </p>
              <p className="mt-4 text-[13.5px] leading-relaxed text-sage">{p.blurb}</p>

              <ul className="mt-7 flex-1 space-y-3 border-t border-line pt-6">
                {p.features.map((f) => (
                  <li key={f.label} className="flex items-center gap-3 text-[13.5px]">
                    {f.included ? (
                      <span className="grid size-5 shrink-0 place-items-center rounded-full border border-zest/30 bg-zest/10">
                        <Check className="size-3 text-zest" />
                      </span>
                    ) : (
                      <span className="grid size-5 shrink-0 place-items-center rounded-full border border-line">
                        <Minus className="size-3 text-faint" />
                      </span>
                    )}
                    <span className={f.included ? "text-bone/90" : "text-faint line-through decoration-faint/50"}>
                      {f.label}
                    </span>
                  </li>
                ))}
              </ul>

              <a
                href="#cta"
                className={cn(
                  "group mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-xl font-display text-[15px] font-semibold transition-transform duration-300 hover:scale-[1.03] active:scale-95",
                  p.accent
                    ? "bg-zest text-ink"
                    : "border border-line-strong bg-white/[0.03] text-bone hover:border-zest/40"
                )}
              >
                {p.cta}
                <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </a>
            </motion.article>
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="mx-auto mt-10 max-w-xl text-center font-mono text-[11px] uppercase leading-relaxed tracking-[0.16em] text-faint"
        >
          All plans: live-per-query data · automatic dedupe · email &amp; phone on every
          plan · no credit card to start
        </motion.p>
      </div>
    </section>
  );
}
