import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, Plus } from "lucide-react";
import { FAQS } from "../lib/data";
import { SectionHead } from "./ui";
import { cn } from "../utils/cn";

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative mt-24 scroll-mt-24 sm:mt-36">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
          <div>
            <SectionHead
              align="left"
              eyebrow="FAQ"
              title={
                <>
                  Asked before
                  <br /> <span className="text-zest">you ask</span>
                </>
              }
              copy="Straight answers on data sources, freshness, legality and quotas. Something else on your mind?"
            />
            <motion.a
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.6 }}
              href="#cta"
              className="mt-6 inline-flex items-center gap-2 rounded-lg border border-line bg-white/[0.03] px-4 py-2.5 text-[13px] font-medium text-sage transition-colors hover:border-zest/40 hover:text-bone"
            >
              <MessageCircle className="size-4 text-zest" />
              Talk to a human
            </motion.a>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-6%" }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden rounded-2xl border border-line bg-coal"
          >
            {FAQS.map((f, i) => {
              const isOpen = open === i;
              return (
                <div key={f.q} className={cn("border-b border-line last:border-b-0")}>
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4.5 text-left transition-colors hover:bg-white/[0.02] sm:px-6 sm:py-5"
                    aria-expanded={isOpen}
                  >
                    <span
                      className={cn(
                        "text-[14.5px] font-medium transition-colors sm:text-[15px]",
                        isOpen ? "text-zest" : "text-bone"
                      )}
                    >
                      {f.q}
                    </span>
                    <motion.span
                      animate={{ rotate: isOpen ? 45 : 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-full border transition-colors",
                        isOpen ? "border-zest/40 bg-zest/10 text-zest" : "border-line text-faint"
                      )}
                    >
                      <Plus className="size-3.5" />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                      >
                        <p className="px-5 pb-5 text-[13.5px] leading-relaxed text-sage sm:px-6 sm:text-sm">
                          {f.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
