import { motion } from "framer-motion";
import { CopyX, FolderKanban, ListFilter, Mail, Phone, ShieldCheck, Zap } from "lucide-react";
import { SectionHead } from "./ui";

const PILLS = [
  { icon: Zap, label: "120 leads / min throughput", span: "sm:col-span-2" },
  { icon: CopyX, label: "auto-dedupe on ingest", span: "" },
  { icon: Mail, label: "emails from official sites", span: "" },
  { icon: Phone, label: "direct dial numbers", span: "sm:col-span-2" },
  { icon: ListFilter, label: "rating & review filters", span: "" },
  { icon: FolderKanban, label: "unlimited lists & tags", span: "" },
  { icon: ShieldCheck, label: "compliance-first enrichment", span: "sm:col-span-2" },
];

const COLUMNS = ["name", "email", "phone", "rating", "status"];
const ROWS = [
  ["KinderSmile Dental Studio", "hello@kindersmile.de", "+49 30 555 0192", "4.8", "verified"],
  ["Northline Dental Care", "info@northlinedental.de", "+49 30 442 8710", "4.2", "new"],
  ["Atlas Orthodontics", "office@atlasortho.de", "+49 30 907 1123", "4.9", "verified"],
];

export default function Features() {
  return (
    <section className="relative mt-24 scroll-mt-24 py-20 sm:mt-36 sm:py-24">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-line-strong to-transparent" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHead
          eyebrow="Stay organized"
          title={
            <>
              Lead lists that stay
              <br className="hidden sm:block" /> <span className="text-zest">clean by default</span>
            </>
          }
          copy="Extraction is half the job. Zybble keeps every campaign organized — duplicates vanish, filters stack, and exports are always one click away."
        />

        <div className="mx-auto mt-14 grid max-w-6xl gap-4 lg:grid-cols-5">
          {/* left: list mock */}
          <motion.div
            initial={{ opacity: 0, y: 34 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-8%" }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden rounded-2xl border border-line-strong bg-coal lg:col-span-3"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3.5 sm:px-5">
              <div className="flex items-center gap-2.5">
                <FolderKanban className="size-4 text-zest" />
                <span className="font-display text-sm font-semibold text-bone">berlin-dentists-q3</span>
              </div>
              <span className="font-mono text-[10.5px] text-faint">312 leads · synced</span>
            </div>

            {/* desktop-ish table that degrades to stacked labels */}
            <div className="p-3 sm:p-4">
              <div className="hidden grid-cols-[1.4fr_1.2fr_1fr_0.5fr_0.6fr] gap-3 rounded-lg border border-line bg-white/[0.025] px-3.5 py-2.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint sm:grid">
                {COLUMNS.map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </div>
              <div className="mt-2 space-y-2">
                {ROWS.map((r, i) => (
                  <motion.div
                    key={r[0]}
                    initial={{ opacity: 0, x: -16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 + i * 0.12, duration: 0.55 }}
                    className="grid gap-2 rounded-lg border border-line bg-white/[0.015] px-3.5 py-3 transition-colors hover:border-zest/25 sm:grid-cols-[1.4fr_1.2fr_1fr_0.5fr_0.6fr] sm:items-center sm:gap-3"
                  >
                    <span className="truncate text-[13px] font-medium text-bone">{r[0]}</span>
                    <span className="truncate font-mono text-[11.5px] text-zest">{r[1]}</span>
                    <span className="truncate font-mono text-[11.5px] text-sage">{r[2]}</span>
                    <span className="font-mono text-[11.5px] text-amber">★ {r[3]}</span>
                    <span
                      className={
                        "w-fit rounded-full px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-wider " +
                        (r[4] === "verified"
                          ? "bg-zest/10 text-zest"
                          : "bg-white/[0.05] text-sage")
                      }
                    >
                      {r[4]}
                    </span>
                  </motion.div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between rounded-lg border border-dashed border-line px-3.5 py-2.5">
                <span className="font-mono text-[10.5px] text-faint">+ 309 more leads, all deduped</span>
                <span className="font-mono text-[10.5px] font-semibold text-zest">export →</span>
              </div>
            </div>
          </motion.div>

          {/* right: dedupe visual */}
          <motion.div
            initial={{ opacity: 0, y: 34 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-8%" }}
            transition={{ duration: 0.9, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="sheen relative overflow-hidden rounded-2xl border border-line-strong bg-coal p-6 sm:p-7 lg:col-span-2"
          >
            <div className="flex items-center gap-2.5">
              <span className="grid size-10 place-items-center rounded-xl border border-zest/25 bg-zest/[0.07]">
                <CopyX className="size-4.5 text-zest" />
              </span>
              <h3 className="font-display text-lg font-semibold tracking-tight text-bone">
                Zero-duplicate guarantee
              </h3>
            </div>
            <p className="mt-3 text-[13.5px] leading-relaxed text-sage">
              Scraped the same neighborhood twice? Merged five extractions?
              Zybble fingerprints every business across all your lists — a lead
              you already own never burns a second credit.
            </p>
            <div className="mt-6 space-y-2.5 font-mono text-[11.5px]">
              <div className="flex items-center justify-between rounded-lg border border-line bg-white/[0.02] px-3.5 py-2.5">
                <span className="text-sage">atlasortho.de (run #12)</span>
                <span className="text-faint line-through">duplicate</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-line bg-white/[0.02] px-3.5 py-2.5 opacity-60">
                <span className="text-sage">atlasortho.de (run #41)</span>
                <span className="text-amber">merged</span>
              </div>
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="flex items-center justify-between rounded-lg border border-zest/30 bg-zest/[0.06] px-3.5 py-2.5"
              >
                <span className="text-bone">atlasortho.de</span>
                <span className="font-semibold text-zest">1 credit</span>
              </motion.div>
            </div>
          </motion.div>
        </div>

        {/* capability pills */}
        <motion.ul
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-5%" }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
          className="mx-auto mt-4 grid max-w-6xl gap-3 sm:grid-cols-4"
        >
          {PILLS.map((p) => (
            <motion.li
              key={p.label}
              variants={{
                hidden: { opacity: 0, y: 16 },
                show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
              }}
              className={`flex items-center gap-3 rounded-xl border border-line bg-coal px-4 py-3.5 transition-colors hover:border-zest/25 ${p.span}`}
            >
              <p.icon className="size-4 shrink-0 text-zest" />
              <span className="font-mono text-[11.5px] text-sage">{p.label}</span>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}
