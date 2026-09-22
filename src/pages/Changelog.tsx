import { motion } from "framer-motion";
import { Bell, Bug, Rocket, Wrench, Zap } from "lucide-react";
import { Reveal } from "../components/ui";
import { Page, PageCta, PageHero } from "./ui";
import { cn } from "../utils/cn";

type Entry = {
  version: string;
  date: string;
  title: string;
  body: string;
  tags: { label: string; kind: "new" | "improved" | "fixed" }[];
};

const QUARTERS: { label: string; entries: Entry[] }[] = [
  {
    label: "Q1 2026",
    entries: [
      {
        version: "v2.8.0",
        date: "Mar 18, 2026",
        title: "Autopilot briefs",
        body: "Schedule any AI Assistant brief to recur — new leads for the same ICP land in your lists every Monday at 7am, quota-aware and deduped against everything you own.",
        tags: [{ label: "New", kind: "new" }],
      },
      {
        version: "v2.7.2",
        date: "Feb 27, 2026",
        title: "Fuzzy dedupe 2.0",
        body: "Name-similarity matching is now weighted by coordinate distance. “Atlas Ortho” and “Atlas Orthodontics” 40 meters apart finally stop eating two credits.",
        tags: [{ label: "Improved", kind: "improved" }],
      },
      {
        version: "v2.7.0",
        date: "Feb 10, 2026",
        title: "Extended review capture",
        body: "Deep runs now pull up to ~300 reviews per business, with per-star breakdowns — fuel for personalization and reputation-gap selling.",
        tags: [{ label: "New", kind: "new" }],
      },
      {
        version: "v2.6.4",
        date: "Jan 22, 2026",
        title: "Filter algebra: saved stacks",
        body: "Save AND/OR filter combinations once (“rating ≥ 4.5 AND has email AND no booking link”) and apply them to any list with one click.",
        tags: [{ label: "Improved", kind: "improved" }],
      },
    ],
  },
  {
    label: "Q4 2025",
    entries: [
      {
        version: "v2.6.0",
        date: "Dec 12, 2025",
        title: "Priority extraction queue",
        body: "Scale plans now jump the line — peak-hours throughput roughly doubled for heavy territory sweeps.",
        tags: [{ label: "New", kind: "new" }, { label: "Scale", kind: "improved" }],
      },
      {
        version: "v2.5.1",
        date: "Nov 28, 2025",
        title: "Email capture on imprints",
        body: "The website crawler now follows imprint, impressum and “über uns” pages — European email hit-rate up 11 points.",
        tags: [{ label: "Improved", kind: "improved" }],
      },
      {
        version: "v2.5.0",
        date: "Nov 6, 2025",
        title: "Sector planner",
        body: "Cities are automatically split into search cells sized to beat listing pagination limits. Density blind spots: gone.",
        tags: [{ label: "New", kind: "new" }],
      },
      {
        version: "v2.4.3",
        date: "Oct 19, 2025",
        title: "Fix: timezones on export",
        body: "CSV exports now carry correct IANA timezone values for territories crossing zone boundaries.",
        tags: [{ label: "Fixed", kind: "fixed" }],
      },
    ],
  },
  {
    label: "Q3 2025",
    entries: [
      {
        version: "v2.4.0",
        date: "Sep 2, 2025",
        title: "AI Assistant public beta",
        body: "Plain-language briefs: describe your ideal customer, approve the search plan, get a QA'd list with a full run diary. Growth and Scale plans.",
        tags: [{ label: "New", kind: "new" }],
      },
      {
        version: "v2.3.0",
        date: "Jul 15, 2025",
        title: "Zybble launches",
        body: "Live map extraction, 36-field enrichment, dedupe-by-default lead lists and one-click CSV — 50 free leads a month for everyone.",
        tags: [{ label: "New", kind: "new" }, { label: "Launch", kind: "improved" }],
      },
    ],
  },
];

const TAG_STYLE = {
  new: "border-zest/40 bg-zest/10 text-zest",
  improved: "border-amber/40 bg-amber/10 text-amber",
  fixed: "border-line bg-white/[0.04] text-sage",
};

const TAG_ICON = { new: Rocket, improved: Zap, fixed: Bug };

export default function Changelog() {
  return (
    <Page title="Changelog — zybble">
      <PageHero
        crumb={["product", "changelog"]}
        eyebrow="Ship log"
        title={
          <>
            Built in public,
            <br /> <span className="text-zest">shipped every week.</span>
          </>
        }
        copy="Every engine upgrade, enrichment trick and dead bug — dated and documented. Newest first."
      />

      <section className="mt-16 sm:mt-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          {QUARTERS.map((q, qi) => (
            <div key={q.label} className="relative pb-10">
              <motion.h2
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="sticky top-[76px] z-10 -mx-2 flex items-center gap-3 bg-ink/90 px-2 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.24em] text-zest backdrop-blur"
              >
                <span className="h-px w-6 bg-zest/40" />
                {q.label}
              </motion.h2>

              <div className="mt-2 space-y-0 border-l border-line pl-6 sm:pl-8">
                {q.entries.map((e, i) => (
                  <Reveal key={e.version} delay={i * 0.04}>
                    <article className="relative py-7 first:pt-4">
                      <span className="absolute -left-[7.5px] top-[34px] size-[9px] rounded-full border border-zest/50 bg-ink sm:-left-[9.5px]">
                        <span className="absolute inset-[2px] rounded-full bg-zest" />
                      </span>
                      <span className={cn("absolute -left-6 h-px w-6 bg-line sm:-left-8 sm:w-8", i === 0 ? "top-[38px]" : "top-[38px]")} />
                      <div className="sheen rounded-2xl border border-line bg-coal p-6 transition-colors hover:border-line-strong sm:p-7">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <code className="rounded-md border border-zest/25 bg-zest/[0.07] px-2 py-1 font-mono text-[11px] font-semibold text-zest">
                            {e.version}
                          </code>
                          <span className="font-mono text-[10.5px] text-faint">{e.date}</span>
                          <div className="ml-auto flex gap-2">
                            {e.tags.map((t) => {
                              const Icon = TAG_ICON[t.kind];
                              return (
                                <span key={t.label} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-widest", TAG_STYLE[t.kind])}>
                                  <Icon className="size-3" />
                                  {t.label}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                        <h3 className="mt-4 font-display text-lg font-semibold tracking-tight text-bone sm:text-xl">
                          {e.title}
                        </h3>
                        <p className="mt-2.5 text-[13.5px] leading-relaxed text-sage">{e.body}</p>
                      </div>
                    </article>
                  </Reveal>
                ))}
                {qi === QUARTERS.length - 1 && (
                  <div className="pb-2 pl-1 font-mono text-[11px] text-faint">
                    ▍ that's everything — the repo of your pipeline keeps growing from here
                  </div>
                )}
              </div>
            </div>
          ))}

          <Reveal>
            <div className="sheen mt-6 flex flex-col items-start justify-between gap-4 rounded-2xl border border-line bg-coal p-6 sm:flex-row sm:items-center sm:p-7">
              <div className="flex items-start gap-3.5">
                <Bell className="mt-0.5 size-5 shrink-0 text-zest" />
                <div>
                  <h3 className="font-display text-base font-semibold text-bone">Never miss a release</h3>
                  <p className="mt-1 text-[13px] text-sage">Release notes land in the product and in your inbox — no noise, one email a month.</p>
                </div>
              </div>
              <a href="#cta" className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-zest/40 bg-zest/10 px-4 font-display text-sm font-medium text-zest transition-transform hover:scale-[1.04] active:scale-95">
                <Wrench className="size-4" /> Subscribe free
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      <PageCta button="Try the latest build free" />
    </Page>
  );
}
