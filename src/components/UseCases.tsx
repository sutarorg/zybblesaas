import { motion } from "framer-motion";
import { Briefcase, LineChart, Rocket, Users, ArrowUpRight } from "lucide-react";
import { USE_CASES } from "../lib/data";
import { SectionHead, staggerChild, staggerParent } from "./ui";

const ICONS: Record<string, typeof Briefcase> = { Briefcase, Rocket, LineChart, Users };

export default function UseCases() {
  return (
    <section className="relative mt-24 sm:mt-36">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHead
          eyebrow="Who runs on Zybble"
          title={
            <>
              Built for teams who eat
              <br className="hidden sm:block" /> <span className="text-zest">what they hunt</span>
            </>
          }
          copy="From one-person agencies to fifty-seat sales floors — if your customers have a pin on the map, Zybble finds them."
        />

        <motion.div
          variants={staggerParent}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-8%" }}
          className="mx-auto mt-14 grid max-w-6xl gap-4 sm:grid-cols-2"
        >
          {USE_CASES.map((u) => {
            const Icon = ICONS[u.icon] ?? Briefcase;
            return (
              <motion.article
                key={u.title}
                variants={staggerChild}
                whileHover={{ y: -5 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                className="sheen group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-coal p-6 transition-colors duration-300 hover:border-zest/30 sm:p-8"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white/[0.03] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-sage">
                    {u.tag}
                  </span>
                  <ArrowUpRight className="size-4 text-faint transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-zest" />
                </div>
                <div className="mt-5 flex items-center gap-3.5">
                  <div className="grid size-12 shrink-0 place-items-center rounded-xl border border-zest/25 bg-zest/[0.07]">
                    <Icon className="size-5 text-zest" strokeWidth={1.8} />
                  </div>
                  <h3 className="font-display text-xl font-semibold tracking-tight text-bone">{u.title}</h3>
                </div>
                <p className="mt-4 flex-1 text-[14px] leading-relaxed text-sage">{u.body}</p>
                <div className="mt-6 flex items-end gap-2.5 border-t border-line pt-5">
                  <span className="font-display text-3xl font-bold tracking-tight text-zest">{u.stat}</span>
                  <span className="pb-1 font-mono text-[10px] uppercase tracking-wider text-faint">
                    {u.statLabel}
                  </span>
                </div>
              </motion.article>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
