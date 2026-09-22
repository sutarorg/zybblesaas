import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck,
  Check,
  ClipboardList,
  FileText,
  MailCheck,
  MapPin,
  Megaphone,
  Quote,
  Send,
  Timer,
  TrendingUp,
} from "lucide-react";
import { Reveal, SectionHead } from "../components/ui";
import { Page, PageCta, PageHero, StatsRow } from "./ui";
import { cn } from "../utils/cn";

/* ================================================================== */
/*  /agencies — timeline-driven                                        */
/* ================================================================== */

const AGENDA: [string, string, string][] = [
  ["09:00", "Pick the gap", "Filter a metro for gyms rated under 4.0 with 30+ reviews — that's a reputation-rescue pitch queue."],
  ["10:30", "Enrich 300 emails", "Owner-facing addresses off official sites, phones normalized, completeness-scored."],
  ["12:00", "Personalization pass", "Latest review text on every record gives each opener a real hook."],
  ["14:00", "Load the sequence", "CSV maps clean into your sequencer — company, contact, rating hook, priority."],
  ["17:30", "First replies", "Three conversations started. Two discovery calls booked for tomorrow."],
];

const PITCHES = [
  { icon: Megaphone, t: "Reputation management", f: "rating < 4.0 AND reviews ≥ 30", d: "Businesses being publicly dragged — with enough volume to care." },
  { icon: FileText, t: "Web design / rebuilds", f: "website contains page-builder signature", d: "Listings with dated, templated sites — they know it too." },
  { icon: MailCheck, t: "Booking & automation", f: "booking link = empty", d: "No online scheduling in 2026? That's your calendar-sync demo." },
  { icon: TrendingUp, t: "Paid acquisition", f: "reviews high AND rating ≥ 4.5", d: "Great product, invisible marketing. Pour fuel on it." },
];

export function AgenciesPage() {
  return (
    <Page title="For Agencies & Freelancers — zybble">
      <PageHero
        crumb={["use cases", "agencies"]}
        eyebrow="For agencies & freelancers"
        title={
          <>
            Client hunting,
            <br />
            <span className="text-zest">on rails.</span>
          </>
        }
        copy="Stop scrolling directories. Pull every business in a metro that badly needs what you sell — then pitch it the same afternoon, review-hook in hand."
        motif={
          <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-line-strong bg-coal p-6 shadow-2xl sm:p-8">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">the agency afternoon</span>
              <Timer className="size-4 text-zest" />
            </div>
            <p className="mt-4 font-display text-3xl font-bold tracking-tight text-bone sm:text-4xl">
              09:00 gap → <span className="text-zest">17:30 replies</span>
            </p>
            <div className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line">
              {[["300", "emails enriched"], ["~2h", "list → sequence"], ["3", "conversations day one"]].map(([v, l]) => (
                <div key={l} className="bg-ink/60 px-3 py-4 text-center">
                  <p className="font-display text-xl font-bold text-zest">{v}</p>
                  <p className="mt-1 font-mono text-[9px] uppercase tracking-wider text-faint">{l}</p>
                </div>
              ))}
            </div>
          </div>
        }
      />

      {/* agenda timeline */}
      <section className="mt-24 sm:mt-32">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <SectionHead
            eyebrow="One Friday afternoon"
            title={<>From gap to booked calls <span className="text-zest">in 8.5 hours</span></>}
          />
          <div className="mt-12 space-y-0">
            {AGENDA.map(([time, t, d], i) => (
              <Reveal key={time} delay={i * 0.06}>
                <div className="relative flex gap-5 pb-9 pl-1 last:pb-0 sm:gap-7">
                  {i < AGENDA.length - 1 && <span className="absolute left-[45px] top-12 h-[calc(100%-44px)] w-px bg-line sm:left-[51px]" />}
                  <span className="w-[86px] shrink-0 pt-4 text-right font-mono text-sm font-semibold text-zest">
                    {time}
                  </span>
                  <div className="sheen flex-1 rounded-2xl border border-line bg-coal p-5 transition-colors hover:border-zest/25 sm:p-6">
                    <h3 className="font-display text-base font-semibold text-bone sm:text-lg">{t}</h3>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-sage">{d}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* sell the gap */}
      <section className="mt-24 sm:mt-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHead
            eyebrow="Four pitches, four filters"
            title={<>Sell the gap you can <span className="text-zest">actually see</span></>}
            copy="Each service you offer maps to a measurable absence in public data. Zybble finds the absence; you bring the cure."
          />
          <div className="mx-auto mt-12 grid max-w-6xl gap-4 sm:grid-cols-2">
            {PITCHES.map((p, i) => (
              <Reveal key={p.t} delay={i * 0.06}>
                <div className="sheen group h-full rounded-2xl border border-line bg-coal p-7 transition-colors hover:border-zest/25">
                  <div className="flex items-center gap-3.5">
                    <span className="grid size-11 place-items-center rounded-xl border border-zest/25 bg-zest/[0.07]">
                      <p.icon className="size-5 text-zest" />
                    </span>
                    <h3 className="font-display text-lg font-semibold text-bone">{p.t}</h3>
                  </div>
                  <code className="mt-5 block w-fit rounded-lg border border-zest/30 bg-zest/[0.06] px-3 py-2 font-mono text-[11.5px] text-zest">
                    {p.f}
                  </code>
                  <p className="mt-4 text-[13.5px] leading-relaxed text-sage">{p.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* quote */}
      <section className="mt-24 sm:mt-32">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <Reveal>
            <figure className="sheen rounded-3xl border border-line bg-coal p-8 text-center sm:p-12">
              <Quote className="mx-auto size-7 text-zest/60" />
              <blockquote className="mt-5 font-display text-2xl font-medium leading-snug text-bone sm:text-3xl">
                “We killed our lead-buying budget entirely. Two Fridays a month
                in Zybble keeps a six-person studio booked out a quarter deep.”
              </blockquote>
              <figcaption className="mt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
                Founder · web & SEO studio, 14 retainers
              </figcaption>
            </figure>
          </Reveal>
          <Reveal delay={0.12} className="mt-10">
            <StatsRow items={[["3.2×", "more discovery calls"], ["$0", "spent on lead brokers"], ["88%", "email deliverability"], ["2", "Fridays per month"]]} />
          </Reveal>
        </div>
      </section>

      <PageCta title="Your next retainer is already listed" copy="Pull the gap-analysis list for your dream-client niche — free, 50 leads deep." />
    </Page>
  );
}

/* ================================================================== */
/*  /saas-sales — territory math                                       */
/* ================================================================== */

const TERRITORIES = [
  ["Austin, TX", "12,400", "10,900", "88%"],
  ["Toronto, ON", "18,200", "15,700", "86%"],
  ["Manchester, UK", "9,800", "8,600", "87%"],
  ["Melbourne, AU", "11,300", "9,900", "88%"],
  ["Munich, DE", "7,600", "6,500", "85%"],
];

export function SaasSalesPage() {
  return (
    <Page title="For SaaS Sales Teams — zybble">
      <PageHero
        crumb={["use cases", "saas sales"]}
        eyebrow="For SaaS sales teams"
        title={
          <>
            Territories that are
            <br />
            <span className="text-zest">actually countable.</span>
          </>
        }
        copy="Selling to SMBs? Know exactly how many restaurants, clinics and contractors exist in each rep's patch — with owner-reachable emails and phones attached."
        motif={
          <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-line-strong bg-coal shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">territory · “vertical SaaS / POS”</span>
              <MapPin className="size-4 text-zest" />
            </div>
            <div className="grid gap-px bg-line sm:grid-cols-3">
              {[["5", "metros assigned"], ["59,300", "businesses found"], ["51,600", "emails attached"]].map(([v, l]) => (
                <div key={l} className="bg-coal px-4 py-5 text-center">
                  <p className="font-display text-2xl font-bold text-zest">{v}</p>
                  <p className="mt-1 font-mono text-[9.5px] uppercase tracking-wider text-faint">{l}</p>
                </div>
              ))}
            </div>
          </div>
        }
      />

      {/* territory table */}
      <section className="mt-24 sm:mt-32">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <SectionHead
            eyebrow="Territory math"
            title={<>Quota capacity, <span className="text-zest">quantified</span></>}
            copy="Assign patches with real inventory numbers, not vibes. Here's one POS vendor's five-metro math for restaurants + cafés."
          />
          <Reveal className="mt-12 overflow-x-auto rounded-2xl border border-line-strong bg-coal">
            <table className="w-full min-w-[520px] text-left">
              <thead>
                <tr className="border-b border-line bg-white/[0.02] font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
                  <th className="px-5 py-4 font-medium">Metro</th>
                  <th className="px-4 py-4 text-right font-medium">Businesses</th>
                  <th className="px-4 py-4 text-right font-medium">With email</th>
                  <th className="px-4 py-4 text-right font-medium">Hit-rate</th>
                </tr>
              </thead>
              <tbody>
                {TERRITORIES.map((row, i) => (
                  <tr key={row[0]} className={cn("border-b border-line/60 last:border-0", i % 2 === 0 && "bg-white/[0.012]")}>
                    <td className="px-5 py-3.5 text-[13.5px] font-medium text-bone">{row[0]}</td>
                    <td className="px-4 py-3.5 text-right font-mono text-[12.5px] text-sage">{row[1]}</td>
                    <td className="px-4 py-3.5 text-right font-mono text-[12.5px] text-zest">{row[2]}</td>
                    <td className="px-4 py-3.5 text-right font-mono text-[12.5px] text-amber">{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
        </div>
      </section>

      {/* ICP stack + sequence */}
      <section className="mt-24 sm:mt-32">
        <div className="mx-auto grid max-w-7xl items-start gap-4 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <Reveal>
            <div className="rounded-2xl border border-line bg-coal p-7 sm:p-8">
              <h3 className="font-display text-xl font-semibold text-bone">The ICP filter stack</h3>
              <p className="mt-2.5 text-[13.5px] leading-relaxed text-sage">
                Mid-market SaaS dies on bad-fit demos. Stack the qualifying signals before a rep spends a single dial:
              </p>
              <div className="mt-6 space-y-2.5">
                {[
                  ["segment", "restaurants + cafés, dine-in flag"],
                  ["size proxy", "price range $$–$$$"],
                  ["maturity", "reviews ≥ 40 AND rating ≥ 4.0"],
                  ["tech gap", "no online ordering link"],
                  ["reachability", "email present · owner-claimed listing"],
                ].map(([k, v], i) => (
                  <motion.div
                    key={k}
                    initial={{ opacity: 0, x: -16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 }}
                    className="flex items-center gap-3 rounded-xl border border-line bg-white/[0.015] px-4 py-3"
                  >
                    <span className="w-24 shrink-0 font-mono text-[10px] uppercase tracking-widest text-faint">{k}</span>
                    <span className="font-mono text-[11.5px] text-zest">{v}</span>
                  </motion.div>
                ))}
              </div>
              <p className="mt-5 font-mono text-[11px] text-faint">result: 51,600 → <span className="text-zest">8,940 demo-worthy accounts</span></p>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="rounded-2xl border border-line bg-coal p-7 sm:p-8">
              <h3 className="font-display text-xl font-semibold text-bone">Into the CRM in four moves</h3>
              <ol className="mt-6 space-y-0">
                {[
                  "Sweep each metro, sector-planned (one search per neighborhood).",
                  "Let dedupe merge overlapping districts automatically.",
                  "Score by review count — biggest venues float to the top.",
                  "Export CSV → your CRM's native importer; fields already named right.",
                ].map((s, i) => (
                  <li key={s} className="relative flex gap-4 pb-6 last:pb-0">
                    {i < 3 && <span className="absolute left-[15px] top-9 h-[calc(100%-32px)] w-px bg-line" />}
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-zest/25 bg-zest/[0.07] font-mono text-[11px] font-semibold text-zest">
                      {i + 1}
                    </span>
                    <p className="pt-1.5 text-[13.5px] leading-relaxed text-sage">{s}</p>
                  </li>
                ))}
              </ol>
              <div className="mt-6 rounded-xl border border-zest/25 bg-zest/[0.05] px-4 py-3.5 font-mono text-[11.5px] leading-relaxed text-sage">
                Rule of thumb: <span className="text-bone">1,000 qualified SMBs ≈ 90 replies ≈ 18 demos</span> at cold-email average.
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <Reveal className="mx-auto mt-20 max-w-6xl px-4 sm:px-6 lg:px-8">
        <StatsRow items={[["8,940", "qualified accounts"], ["18", "est. demos / 1k touched"], ["120/min", "sweep throughput"], ["3", "seats on Growth"]]} />
      </Reveal>

      <PageCta title="Book demos from the map" copy="Your ICP is pinned somewhere between two coordinates. Go count it — 50 leads free, every month." />
    </Page>
  );
}

/* ================================================================== */
/*  /local-marketers — interactive audit                               */
/* ================================================================== */

const AUDIT_ITEMS = [
  "Owner-claimed listing",
  "Rating ≥ 4.2",
  "Reviews ≥ 25",
  "Website linked",
  "Booking enabled",
  "Online ordering live",
  "Photos ≥ 5",
  "Hours up to date",
  "Menu link present",
  "Popular times visible",
  "Description filled",
  "Responds to reviews",
];

export function LocalMarketersPage() {
  const [checked, setChecked] = useState<number[]>([0, 1, 2, 3]);
  const score = Math.round((checked.length / AUDIT_ITEMS.length) * 100);

  return (
    <Page title="For Local & SEO Marketers — zybble">
      <PageHero
        crumb={["use cases", "local marketers"]}
        eyebrow="For local & SEO marketers"
        title={
          <>
            Audit a whole market,
            <br />
            <span className="text-zest">not one listing at a time.</span>
          </>
        }
        copy="Maps data is a competitive teardown waiting to happen: who claims their listing, who books online, who left reviews unanswered. Zybble scores entire metros in minutes."
        motif={
          <div className="mx-auto max-w-2xl rounded-2xl border border-line-strong bg-coal p-6 shadow-2xl sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div className="text-left">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">try it — check what this listing does right</p>
                <p className="mt-2 font-display text-2xl font-bold tracking-tight text-bone">
                  Listing health: <span className="text-zest">{score}/100</span>
                </p>
              </div>
              <div className="relative grid size-20 shrink-0 place-items-center">
                <svg viewBox="0 0 80 80" className="size-20 -rotate-90">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(237,239,232,0.08)" strokeWidth="7" />
                  <motion.circle
                    cx="40" cy="40" r="34" fill="none" stroke="#c9f158" strokeWidth="7" strokeLinecap="round"
                    strokeDasharray={213.6}
                    animate={{ strokeDashoffset: 213.6 - (213.6 * score) / 100 }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  />
                </svg>
                <span className="absolute font-mono text-sm font-bold text-zest">{score}</span>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {AUDIT_ITEMS.map((item, i) => {
                const on = checked.includes(i);
                return (
                  <button
                    key={item}
                    onClick={() => setChecked((c) => (on ? c.filter((x) => x !== i) : [...c, i]))}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left font-mono text-[10px] leading-tight transition-all duration-200",
                      on ? "border-zest/40 bg-zest/[0.08] text-bone" : "border-line text-faint hover:text-sage"
                    )}
                  >
                    <span className={cn("grid size-3.5 shrink-0 place-items-center rounded-[4px] border", on ? "border-zest bg-zest" : "border-line-strong")}>
                      {on && <Check className="size-2.5 text-ink" strokeWidth={3} />}
                    </span>
                    {item}
                  </button>
                );
              })}
            </div>
            <AnimatePresence>
              {score < 50 && (
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-4 font-mono text-[11px] text-amber"
                >
                  → that listing is your next client. 10,000 more just like it in any metro.
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        }
      />

      {/* findings → pitches */}
      <section className="mt-24 sm:mt-32">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <SectionHead
            eyebrow="Findings → retainers"
            title={<>Every data gap is <span className="text-zest">a line item</span></>}
            copy="Translate public listing weaknesses into scoped work. Clients understand evidence."
          />
          <Reveal className="mt-12 overflow-hidden rounded-2xl border border-line-strong bg-coal">
            {[
              ["Unclaimed listing", "Claiming, verification & profile build-out", "One-time"],
              ["4.8★ · zero responses to reviews", "Monthly review-ops & response cadence", "Retainer"],
              ["Great rating, no photos", "Quarterly photo refresh & media pack", "Quarterly"],
              ["No booking link", "Scheduling stack + conversion tracking", "Setup + MRR"],
              ["Ranked #9 for core category", "Maps SEO sprint: categories, posts, Q&A", "90-day sprint"],
            ].map(([gap, work, model], i) => (
              <div key={gap} className={cn("grid gap-2 px-5 py-4 sm:grid-cols-[1.1fr_1.4fr_auto] sm:items-center sm:gap-4 sm:px-6", i % 2 === 0 && "bg-white/[0.012]")}>
                <span className="text-[13.5px] font-medium text-bone">{gap}</span>
                <span className="text-[13px] text-sage">{work}</span>
                <span className="w-fit rounded-full border border-zest/30 bg-zest/[0.06] px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-wider text-zest">
                  {model}
                </span>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* cadence */}
      <section className="mt-24 sm:mt-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHead
            eyebrow="Monthly cadence"
            title={<>A reporting rhythm <span className="text-zest">clients renew for</span></>}
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            {[
              { icon: ClipboardList, w: "Week 1", t: "Sweep & score", d: "Re-run the metro; diff ratings, review velocity and listing changes since last month." },
              { icon: BadgeCheck, w: "Week 2", t: "Act on deltas", d: "New negative-review clusters? Outdated hours? Each delta becomes a task with evidence attached." },
              { icon: Send, w: "Week 4", t: "Prove it", d: "Export the before/after record set. Renewal decks write themselves when the CSV shows the delta." },
            ].map((c, i) => (
              <Reveal key={c.t} delay={i * 0.08}>
                <div className="sheen h-full rounded-2xl border border-line bg-coal p-7">
                  <div className="flex items-center justify-between">
                    <c.icon className="size-5 text-zest" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">{c.w}</span>
                  </div>
                  <h3 className="mt-4 font-display text-lg font-semibold text-bone">{c.t}</h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-sage">{c.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <Reveal className="mx-auto mt-20 max-w-6xl px-4 sm:px-6 lg:px-8">
        <StatsRow items={[["36", "audit fields automated"], ["10×", "faster than manual checks"], ["90", "minutes per metro audit"], ["4", "renewal-proof report sections"]]} />
      </Reveal>

      <PageCta title="Audit your first market free" copy="Point Zybble at any metro and see the missings that pay your invoices. 50 leads on the house." />
    </Page>
  );
}
