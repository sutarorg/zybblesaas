import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  BrainCircuit,
  Check,
  CopyX,
  Download,
  FileSpreadsheet,
  GitBranch,
  Layers,
  ListFilter,
  Mail,
  MessageSquareText,
  Minus,
  Phone,
  Play,
  Quote,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Workflow,
} from "lucide-react";
import { PRICING } from "../lib/data";
import { Reveal, SectionHead } from "../components/ui";
import { Page, PageCta, PageHero } from "./ui";
import { cn } from "../utils/cn";

/* ================================================================== */
/*  /ai-assistant                                                      */
/* ================================================================== */

const DIARY: [string, string][] = [
  ["09:12:04", "brief received — “HVAC, Dallas, 4.5★+, website but no online booking”"],
  ["09:12:06", "planned 14 sector searches across the Dallas metro"],
  ["09:12:09", "sample run: 12/12 leads valid, proceeding to full sweep"],
  ["09:12:41", "sweep complete — 428 candidates captured"],
  ["09:13:18", "enriched 428 websites → 276 direct emails"],
  ["09:13:20", "filters applied → rating ≥4.5 · no booking link · has website"],
  ["09:13:22", "QA passed — 0 duplicates against your 3 existing lists"],
  ["09:13:22", "shipped: list “dallas-hvac-booking-gap” — 312 leads"],
];

const PROMPTS = [
  "Find wedding photographers in Austin without an Instagram link",
  "Every crossfit box in Denver rated under 4.2 — reputation rescue pitch",
  "Boutique hotels in Lisbon with 50+ reviews and no online booking engine",
  "Dental clinics in Berlin still showing “temporarily closed”",
  "Law firms in Toronto with a website but zero blog content",
  "Family restaurants in Leeds open past 11pm",
];

export function AiAssistantPage() {
  return (
    <Page title="AI Assistant — zybble">
      <PageHero
        crumb={["product", "ai assistant"]}
        eyebrow="Growth & Scale feature"
        title={
          <>
            Brief it in English.
            <br />
            <span className="text-zest">Wake up to a list.</span>
          </>
        }
        copy="The Assistant turns one sentence into a full extraction job: planning searches, sampling for quality, enriching emails, enforcing your filters, and shipping a deduped list — with a diary of everything it did."
        motif={
          <div className="overflow-hidden rounded-2xl border border-line-strong bg-coal shadow-2xl sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-3.5 sm:px-5">
              <span className="flex items-center gap-2.5 font-mono text-[11px] text-sage">
                <Sparkles className="size-4 text-zest" /> run diary · #4821
              </span>
              <span className="rounded-md bg-zest/10 px-2 py-1 font-mono text-[10px] font-semibold text-zest">
                completed in 78s
              </span>
            </div>
            <div className="space-y-2 p-4 sm:p-6">
              {DIARY.map(([t, msg], i) => (
                <motion.div
                  key={t}
                  initial={{ opacity: 0, x: -14 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.35 + i * 0.12, duration: 0.45 }}
                  className="flex items-start gap-3 font-mono text-[11px] leading-relaxed sm:text-xs"
                >
                  <span className="shrink-0 text-faint">{t}</span>
                  <span className={i === DIARY.length - 1 ? "text-zest" : "text-sage"}>{msg}</span>
                </motion.div>
              ))}
            </div>
          </div>
        }
      />

      {/* prompt gallery */}
      <section className="mt-24 sm:mt-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHead
            eyebrow="Briefs that work"
            title={<>Steal these <span className="text-zest">prompts</span></>}
            copy="The Assistant understands niches, geographies, ratings, and business attributes. Be specific about the gap you're selling into."
          />
          <div className="mx-auto mt-12 grid max-w-4xl gap-3 sm:grid-cols-2">
            {PROMPTS.map((p, i) => (
              <Reveal key={p} delay={i * 0.05}>
                <div className="group flex h-full items-start gap-3 rounded-2xl border border-line bg-coal p-5 transition-all duration-300 hover:border-zest/30 hover:bg-graphite">
                  <MessageSquareText className="mt-0.5 size-4.5 shrink-0 text-zest/70 transition-colors group-hover:text-zest" />
                  <p className="font-mono text-[12.5px] leading-relaxed text-sage group-hover:text-bone">“{p}”</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* agent loop */}
      <section className="mt-24 sm:mt-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHead
            eyebrow="How the agent works"
            title={<>A loop, not <span className="text-zest">a lottery</span></>}
            copy="No blind bulk scraping. The Assistant runs a disciplined control loop and refuses to ship lists that fail its own checks."
          />
          <div className="mx-auto mt-12 flex max-w-5xl flex-col items-stretch gap-3 lg:flex-row lg:items-center lg:gap-0">
            {[
              { icon: BrainCircuit, t: "Plan", d: "Decompose the brief into sector searches + filters" },
              { icon: Play, t: "Sample", d: "Validate a small batch before committing quota" },
              { icon: Play, t: "Run", d: "Full sweep + email enrichment at engine speed", hide: true },
              { icon: ShieldCheck, t: "QA", d: "Dedupe, completeness score, filter enforcement" },
              { icon: Download, t: "Ship", d: "List lands in your workspace with a full diary" },
            ].map((s, i, arr) => (
              <Reveal key={s.t} delay={i * 0.07} className="flex-1">
                <div className="flex items-center gap-3 lg:block lg:px-2 lg:text-center">
                  <div className="grid size-12 shrink-0 place-items-center rounded-2xl border border-zest/25 bg-zest/[0.07] lg:mx-auto">
                    {i === 1 ? <Play className="size-5 text-zest" /> : <s.icon className="size-5 text-zest" />}
                  </div>
                  <div className="lg:mt-4">
                    <h3 className="font-display text-base font-semibold text-bone">{s.t}</h3>
                    <p className="mt-1 max-w-[240px] text-[12px] leading-relaxed text-sage lg:mx-auto">{s.d}</p>
                  </div>
                </div>
                {i < arr.length - 1 && (
                  <div className="ml-6 mt-1 h-4 w-px bg-zest/25 lg:mx-[6%] lg:mt-0 lg:h-px lg:w-[88%] lg:bg-gradient-to-r lg:from-zest/25 lg:to-transparent" />
                )}
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* autonomy + quote */}
      <section className="mt-24 sm:mt-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-4 lg:grid-cols-3">
            {[
              { icon: Bot, t: "Assist", d: "You type the query, the Assistant suggests filters and flags based on your historical wins." },
              { icon: Workflow, t: "Copilot", d: "Brief → plan preview. You approve the searches and quota spend before anything runs." },
              { icon: RefreshCw, t: "Autopilot", d: "Recurring briefs on a schedule — new leads for the same ICP lands every Monday at 7am." },
            ].map((c, i) => (
              <Reveal key={c.t} delay={i * 0.08}>
                <div className={cn("sheen h-full rounded-2xl border p-7", i === 1 ? "border-zest/40 bg-gradient-to-b from-zest/[0.08] to-coal" : "border-line bg-coal")}>
                  <div className="flex items-center justify-between">
                    <c.icon className="size-5 text-zest" />
                    {i === 1 && <span className="rounded-full bg-zest px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-ink">default</span>}
                  </div>
                  <h3 className="mt-4 font-display text-lg font-semibold text-bone">{c.t}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-sage">{c.d}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.1} className="mt-10">
            <figure className="mx-auto max-w-3xl rounded-3xl border border-line bg-coal p-8 text-center sm:p-10">
              <Quote className="mx-auto size-6 text-zest/60" />
              <blockquote className="mt-4 font-display text-xl font-medium leading-snug text-bone sm:text-2xl">
                “I wrote a two-line brief on Friday. Monday morning there were
                1,400 segmented leads in my workspace with a QA diary. It’s the
                closest thing I’ve seen to cloning an ops hire.”
              </blockquote>
              <figcaption className="mt-5 font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
                Head of Growth · fintech, Series B
              </figcaption>
            </figure>
          </Reveal>
        </div>
      </section>

      <PageCta
        title="Put the Assistant on your account"
        copy="AI-powered briefs ship with Growth and Scale. Start free, upgrade when you're ready for a teammate that never sleeps."
        button="See plans"
      />
    </Page>
  );
}

/* ================================================================== */
/*  /lead-lists                                                        */
/* ================================================================== */

export function LeadListsPage() {
  return (
    <Page title="Lead Lists — zybble">
      <PageHero
        crumb={["product", "lead lists"]}
        eyebrow="Organization"
        title={
          <>
            Lists that behave like
            <br />
            <span className="text-zest">a database, not a drawer.</span>
          </>
        }
        copy="Every extraction lands as a living list: deduped against everything you own, filterable by any of 36 fields, and exportable in one click."
        motif={
          <div className="overflow-hidden rounded-2xl border border-line-strong bg-coal shadow-2xl sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
              <span className="font-mono text-[10.5px] text-faint">workspace / pipeline-q3</span>
              <span className="flex items-center gap-1.5 font-mono text-[10px] text-zest">
                <span className="size-1.5 rounded-full bg-zest" /> 3 lists syncing
              </span>
            </div>
            <div className="grid sm:grid-cols-[200px_1fr]">
              <div className="hidden border-r border-line p-3 sm:block">
                {["berlin-dentists-q3", "lyon-boutique-hotels", "austin-hvac-gap", "archive-2025"].map((l, i) => (
                  <div key={l} className={cn("flex items-center justify-between rounded-lg px-3 py-2.5 font-mono text-[11px]", i === 0 ? "bg-zest/10 text-zest" : "text-sage")}>
                    <span className="truncate">{l}</span>
                    <span className="text-[9.5px] text-faint">{[312, 247, 61, 1240][i]}</span>
                  </div>
                ))}
              </div>
              <div className="p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white/[0.02] px-3.5 py-2.5">
                  <span className="font-display text-sm font-semibold text-bone">berlin-dentists-q3</span>
                  <div className="flex gap-2">
                    <span className="rounded-md border border-line px-2 py-1 font-mono text-[10px] text-sage">312 leads</span>
                    <span className="rounded-md bg-zest px-2 py-1 font-mono text-[10px] font-semibold text-ink">export CSV</span>
                  </div>
                </div>
                <div className="mt-2.5 space-y-2">
                  {[
                    ["KinderSmile Dental Studio", "hello@kindersmile.de", "4.8", "verified"],
                    ["Northline Dental Care", "info@northline.de", "4.2", "new"],
                    ["Atlas Orthodontics", "office@atlasortho.de", "4.9", "verified"],
                  ].map((r, i) => (
                    <motion.div
                      key={r[0]}
                      initial={{ opacity: 0, y: 12 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.3 + i * 0.1 }}
                      className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-xl border border-line bg-white/[0.015] px-3.5 py-3 sm:grid-cols-[1.3fr_1.1fr_0.4fr_0.6fr]"
                    >
                      <span className="truncate text-[12.5px] font-medium text-bone">{r[0]}</span>
                      <span className="hidden truncate font-mono text-[11px] text-zest sm:block">{r[1]}</span>
                      <span className="hidden font-mono text-[11px] text-amber sm:block">★ {r[2]}</span>
                      <span className={cn("w-fit rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider", r[3] === "verified" ? "bg-zest/10 text-zest" : "bg-white/[0.05] text-sage")}>
                        {r[3]}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        }
      />

      {/* dedupe methods */}
      <section className="mt-24 sm:mt-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHead
            eyebrow="Deduper"
            title={<>Three fingerprints. <span className="text-zest">Zero duplicates.</span></>}
            copy="Run the same city ten times — a business you already own never burns a second credit. Here's how we know it's the same business."
          />
          <div className="mx-auto mt-12 grid max-w-6xl gap-4 md:grid-cols-3">
            {[
              { icon: CopyX, t: "Domain match", d: "Same official website = same business. The strongest signal, checked first, case and subdomain normalized.", tag: "exact" },
              { icon: Phone, t: "Phone match", d: "Numbers normalized to E.164 before comparison — formats and country codes can't fool it.", tag: "exact" },
              { icon: GitBranch, t: "Fuzzy name + geo", d: "Name similarity weighted by coordinate distance catches “Atlas Ortho” vs “Atlas Orthodontics” 40m apart.", tag: "smart" },
            ].map((c, i) => (
              <Reveal key={c.t} delay={i * 0.08}>
                <div className="sheen h-full rounded-2xl border border-line bg-coal p-7">
                  <div className="flex items-center justify-between">
                    <span className="grid size-11 place-items-center rounded-xl border border-zest/25 bg-zest/[0.07]">
                      <c.icon className="size-5 text-zest" />
                    </span>
                    <span className={cn("rounded-full border px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-widest", c.tag === "smart" ? "border-amber/30 text-amber" : "border-zest/30 text-zest")}>
                      {c.tag}
                    </span>
                  </div>
                  <h3 className="mt-5 font-display text-lg font-semibold text-bone">{c.t}</h3>
                  <p className="mt-2.5 text-[13.5px] leading-relaxed text-sage">{c.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* filter algebra + export mapping */}
      <section className="mt-24 sm:mt-32">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <Reveal>
            <div className="h-full rounded-2xl border border-line bg-coal p-7 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl border border-zest/25 bg-zest/[0.07]">
                  <ListFilter className="size-5 text-zest" />
                </span>
                <h3 className="font-display text-xl font-semibold text-bone">Filter algebra</h3>
              </div>
              <p className="mt-3 text-[13.5px] leading-relaxed text-sage">
                Stack conditions with AND/OR logic across any field. Save a stack once, reuse it on every future list.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-2 font-mono text-[11.5px]">
                <span className="rounded-lg border border-zest/40 bg-zest/10 px-3 py-2 text-zest">rating ≥ 4.5</span>
                <span className="text-faint">AND</span>
                <span className="rounded-lg border border-zest/40 bg-zest/10 px-3 py-2 text-zest">reviews ≥ 50</span>
                <span className="text-faint">AND</span>
                <span className="rounded-lg border border-zest/40 bg-zest/10 px-3 py-2 text-zest">has email</span>
                <span className="text-faint">AND (</span>
                <span className="rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-amber">no booking link</span>
                <span className="text-faint">OR</span>
                <span className="rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-amber">no website</span>
                <span className="text-faint">)</span>
              </div>
              <div className="mt-6 rounded-xl border border-line bg-ink/40 px-4 py-3 font-mono text-[11px] text-sage">
                312 leads → <span className="text-zest">118 match</span> · est. contact rate 3.1×
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="h-full rounded-2xl border border-line bg-coal p-7 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl border border-zest/25 bg-zest/[0.07]">
                  <FileSpreadsheet className="size-5 text-zest" />
                </span>
                <h3 className="font-display text-xl font-semibold text-bone">CRM-ready export</h3>
              </div>
              <p className="mt-3 text-[13.5px] leading-relaxed text-sage">
                Columns map 1:1 to the fields your stack expects. No rename gymnastics before import.
              </p>
              <div className="mt-6 space-y-2 font-mono text-[11.5px]">
                {[
                  ["email", "Contact.email", "hello@kindersmile.de"],
                  ["phone", "Contact.phone", "+49 30 555 0192"],
                  ["rating", "Company.intent_score", "4.8"],
                  ["coords", "Territory.geo", "52.5219, 13.4132"],
                ].map(([from, to, ex]) => (
                  <div key={from} className="flex items-center gap-2.5 rounded-lg border border-line bg-white/[0.015] px-3 py-2.5">
                    <span className="shrink-0 text-zest">{from}</span>
                    <span className="text-faint">→</span>
                    <span className="truncate text-sage">{to}</span>
                    <span className="ml-auto hidden shrink-0 text-faint md:block">{ex}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* quota math */}
      <section className="mt-16 sm:mt-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="sheen flex flex-col items-start gap-5 rounded-2xl border border-zest/25 bg-gradient-to-br from-zest/[0.07] to-coal p-7 sm:flex-row sm:items-center sm:p-8">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-zest text-ink">
                <Layers className="size-5" />
              </span>
              <div>
                <h3 className="font-display text-lg font-semibold text-bone">The quota rule, restated</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-sage">
                  One unique, enriched business = one credit, charged only when it lands in a list.
                  Re-runs, merges and duplicates: <span className="text-bone">always free</span>.
                </p>
              </div>
              <span className="sm:ml-auto">
                <BadgeCheck className="size-8 text-zest" />
              </span>
            </div>
          </Reveal>
        </div>
      </section>

      <PageCta title="Give your leads a proper home" copy="Unlimited lists on every plan — including the free one. Start organizing before your competitors finish their spreadsheets." />
    </Page>
  );
}

/* ================================================================== */
/*  /pricing — full pricing page                                       */
/* ================================================================== */

const COMPARE_ROWS: [string, string | boolean, string | boolean, string | boolean][] = [
  ["Enriched leads / month", "50", "10,000", "50,000"],
  ["Live map data", true, true, true],
  ["Email & phone included", true, true, true],
  ["CSV export", true, true, true],
  ["Unlimited lead lists", true, true, true],
  ["Automatic dedupe", true, true, true],
  ["AI Assistant", false, true, true],
  ["Recurring autopilot briefs", false, true, true],
  ["Priority extraction queue", false, false, true],
  ["Bulk territory sweeps", false, false, true],
  ["Support", "Community", "Email · 24h", "Priority · 4h"],
  ["Seats included", "1", "3", "10"],
];

function Cell({ v }: { v: string | boolean }) {
  if (typeof v === "boolean")
    return v ? (
      <span className="mx-auto grid size-5 place-items-center rounded-full border border-zest/30 bg-zest/10">
        <Check className="size-3 text-zest" />
      </span>
    ) : (
      <Minus className="mx-auto size-3.5 text-faint" />
    );
  return <span className="font-mono text-[12px] text-sage">{v}</span>;
}

export function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const [needed, setNeeded] = useState("8000");
  const n = Math.max(0, parseInt(needed.replace(/[^0-9]/g, "") || "0", 10));
  const recommended = n === 0 ? null : n <= 50 ? 0 : n <= 10000 ? 1 : 2;

  const priceFor = (p: (typeof PRICING)[number]) => (annual ? Math.round(p.price * 0.8) : p.price);

  return (
    <Page title="Pricing — zybble">
      <PageHero
        crumb={["product", "pricing"]}
        eyebrow="Pricing"
        title={
          <>
            Pricing that scales with
            <br /> <span className="text-zest">your ambition</span>
          </>
        }
        copy="Start free with 50 leads a month. Every paid plan includes emails, phones, unlimited lists and the AI Assistant."
        motif={
          <div className="mx-auto flex w-fit items-center gap-1 rounded-full border border-line-strong bg-coal p-1.5">
            {(["Monthly", "Annual −20%"] as const).map((label, i) => {
              const active = annual === (i === 1);
              return (
                <button
                  key={label}
                  onClick={() => setAnnual(i === 1)}
                  className={cn(
                    "rounded-full px-4 py-2 font-display text-[13px] font-medium transition-all duration-300",
                    active ? "bg-zest text-ink" : "text-sage hover:text-bone"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        }
      />

      {/* cards */}
      <section className="mt-14 sm:mt-16">
        <div className="mx-auto grid max-w-5xl gap-4 px-4 sm:px-6 lg:grid-cols-3 lg:gap-5 lg:px-8">
          {PRICING.map((p, i) => {
            const rec = i === recommended;
            return (
              <motion.div
                key={p.name}
                initial={{ opacity: 0, y: 26 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  "relative flex flex-col rounded-2xl border p-6 transition-colors sm:p-8",
                  p.accent
                    ? "border-zest/50 bg-gradient-to-b from-zest/[0.09] to-coal"
                    : "border-line bg-coal",
                  rec && "ring-2 ring-zest/70 ring-offset-4 ring-offset-ink"
                )}
              >
                {p.accent && (
                  <span className="absolute -top-3.5 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-zest px-3.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink">
                    <Sparkles className="size-3" /> Most popular
                  </span>
                )}
                {rec && (
                  <span className="absolute -top-3.5 right-4 rounded-full bg-amber px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ink">
                    fits your volume
                  </span>
                )}
                <div className="flex items-baseline justify-between">
                  <h3 className="font-display text-xl font-semibold text-bone">{p.name}</h3>
                  {annual && p.price > 0 && (
                    <span className="font-mono text-[10px] text-zest line-through decoration-faint/60">${p.price}</span>
                  )}
                </div>
                <div className="mt-4 flex items-end gap-2">
                  <AnimatePresence mode="popLayout">
                    <motion.span
                      key={String(annual)}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.3 }}
                      className="font-display text-5xl font-bold tracking-tight text-bone"
                    >
                      ${priceFor(p)}
                    </motion.span>
                  </AnimatePresence>
                  <span className="pb-1.5 font-mono text-xs text-faint">/mo{annual && p.price > 0 ? " · billed yearly" : ""}</span>
                </div>
                <p className={cn("mt-2 font-mono text-xs font-medium", p.accent ? "text-zest" : "text-sage")}>{p.leads}</p>
                <p className="mt-3 text-[13.5px] leading-relaxed text-sage">{p.blurb}</p>
                <ul className="mt-6 flex-1 space-y-2.5 border-t border-line pt-5">
                  {p.features.map((f) => (
                    <li key={f.label} className="flex items-center gap-2.5 text-[13px]">
                      {f.included ? (
                        <Check className="size-4 shrink-0 text-zest" />
                      ) : (
                        <Minus className="size-4 shrink-0 text-faint" />
                      )}
                      <span className={f.included ? "text-bone/90" : "text-faint line-through decoration-faint/50"}>{f.label}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href="#cta"
                  className={cn(
                    "mt-7 inline-flex h-11 items-center justify-center gap-2 rounded-xl font-display text-sm font-semibold transition-transform duration-300 hover:scale-[1.03] active:scale-95",
                    p.accent ? "bg-zest text-ink" : "border border-line-strong bg-white/[0.03] text-bone hover:border-zest/40"
                  )}
                >
                  {p.cta} <ArrowRight className="size-4" />
                </a>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* volume recommender */}
      <section className="mt-24 sm:mt-32">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <SectionHead
            eyebrow="Plan finder"
            title={<>How many leads <span className="text-zest">do you need?</span></>}
            copy="Type a monthly volume — we'll match the plan that covers it with headroom."
          />
          <Reveal className="mt-10">
            <div className="sheen rounded-2xl border border-line-strong bg-coal p-7 text-center sm:p-9">
              <div className="mx-auto flex max-w-sm items-center justify-center gap-2">
                <input
                  value={needed}
                  onChange={(e) => setNeeded(e.target.value)}
                  inputMode="numeric"
                  className="h-14 w-full rounded-xl border border-line bg-ink/70 px-5 text-center font-mono text-lg text-bone outline-none transition-colors focus:border-zest/50"
                  placeholder="10,000"
                />
                <span className="shrink-0 font-mono text-xs text-faint">leads / mo</span>
              </div>
              <AnimatePresence mode="wait">
                <motion.p
                  key={String(recommended)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                  className="mt-6 font-display text-xl font-semibold text-bone"
                >
                  {recommended === null ? (
                    <span className="text-sage">Enter a volume to see your fit.</span>
                  ) : (
                    <>
                      Your fit:{" "}
                      <span className="text-zest">
                        {PRICING[recommended].name} — ${annual ? Math.round(PRICING[recommended].price * 0.8) : PRICING[recommended].price}/mo
                      </span>
                    </>
                  )}
                </motion.p>
              </AnimatePresence>
              <p className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">
                {recommended !== null && `${PRICING[recommended].leads} · highlighted above`}
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* comparison table */}
      <section className="mt-24 sm:mt-32">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <SectionHead eyebrow="Full comparison" title={<>Line by line, <span className="text-zest">nothing hidden</span></>} />
          <Reveal className="mt-12 overflow-x-auto rounded-2xl border border-line-strong bg-coal">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line bg-white/[0.02] font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
                  <th className="px-5 py-4 font-medium">Feature</th>
                  {PRICING.map((p) => (
                    <th key={p.name} className={cn("px-4 py-4 text-center font-medium", p.accent && "text-zest")}>
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map(([label, a, b, c], i) => (
                  <tr key={label} className={cn("border-b border-line/60 last:border-0", i % 2 === 0 && "bg-white/[0.012]")}>
                    <td className="px-5 py-3.5 text-[13px] text-bone/85">{label}</td>
                    <td className="px-4 py-3.5 text-center"><Cell v={a} /></td>
                    <td className="px-4 py-3.5 text-center"><Cell v={b} /></td>
                    <td className="px-4 py-3.5 text-center"><Cell v={c} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
        </div>
      </section>

      {/* pricing faq */}
      <section className="mt-24 sm:mt-32">
        <div className="mx-auto grid max-w-5xl gap-4 px-4 sm:grid-cols-2 sm:px-6 lg:px-8">
          {[
            { icon: RefreshCw, q: "What happens if I hit my quota?", a: "Runs pause politely — never fail mid-job. Upgrade instantly, or wait for the monthly reset. Unused quota never rolls into debt either way." },
            { icon: Sparkles, q: "Do unused leads roll over?", a: "No — fresh quota every month keeps the engine honest and the pricing low. Most teams right-size within two cycles." },
            { icon: Mail, q: "What's your refund policy?", a: "14 days, no questions, on any first paid month. If Zybble didn't earn its keep, you shouldn't pay for it." },
            { icon: SlidersHorizontal, q: "Can I switch plans mid-month?", a: "Yes. Upgrades apply instantly with proration; downgrades take effect at the next cycle so you never lose paid quota." },
          ].map((f, i) => (
            <Reveal key={f.q} delay={i * 0.06}>
              <div className="h-full rounded-2xl border border-line bg-coal p-7">
                <f.icon className="size-5 text-zest" />
                <h3 className="mt-4 font-display text-base font-semibold text-bone">{f.q}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-sage">{f.a}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <PageCta title="Start free. Upgrade when it hurts not to." copy="50 enriched leads a month, forever, no card. The paid plans are down the page whenever your pipeline outgrows them." />
    </Page>
  );
}
