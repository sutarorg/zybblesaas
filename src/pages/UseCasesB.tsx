import { motion } from "framer-motion";
import {
  CalendarClock,
  MapPin,
  MessageSquare,
  Quote,
  Send,
  ShieldCheck,
  Star,
  Store,
  Target,
  Users,
  X,
  Zap,
} from "lucide-react";
import { Reveal, SectionHead } from "../components/ui";
import { Page, PageCta, PageHero } from "./ui";
import { cn } from "../utils/cn";

/* ================================================================== */
/*  /recruiters — funnel-driven                                        */
/* ================================================================== */

const FUNNEL = [
  { label: "businesses mapped", n: 4120, pct: 100 },
  { label: "with direct email", n: 3590, pct: 87 },
  { label: "contacted (day 1)", n: 1196, pct: 29 },
  { label: "replied (week 1)", n: 214, pct: 18 },
  { label: "meetings booked", n: 41, pct: 19 },
];

export function RecruitersPage() {
  return (
    <Page title="For Recruiters & Sourcers — zybble">
      <PageHero
        crumb={["use cases", "recruiters"]}
        eyebrow="For recruiters & sourcers"
        title={
          <>
            Every salon, shop and studio
            <br />
            <span className="text-zest">is a hiring funnel.</span>
          </>
        }
        copy="Staffing a vertical — stylists, techs, chefs, fitters? Map the whole labor market, personalize with public signals, and beat every agency to the first conversation."
        motif={
          <div className="mx-auto max-w-2xl rounded-2xl border border-line-strong bg-coal p-6 shadow-2xl sm:p-8">
            <div className="mb-5 flex items-center justify-between">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">one vertical · “barbershops, Denver metro”</span>
              <Users className="size-4 text-zest" />
            </div>
            <div className="space-y-3">
              {FUNNEL.map((f, i) => (
                <div key={f.label}>
                  <div className="mb-1.5 flex items-baseline justify-between font-mono text-[11px]">
                    <span className="text-sage">{f.label}</span>
                    <span className="text-bone">{f.n.toLocaleString()}</span>
                  </div>
                  <div className="h-6 overflow-hidden rounded-md bg-white/[0.04]">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${Math.max(f.pct, 4)}%` }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.2 + i * 0.14, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                      className={cn("h-full rounded-md", i === FUNNEL.length - 1 ? "bg-zest" : "bg-gradient-to-r from-zest-dim/50 to-zest/80")}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        }
      />

      {/* personalization */}
      <section className="mt-24 sm:mt-32">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <SectionHead
            eyebrow="Personalization"
            title={<>“Hi {`{name}`}” is dead. <span className="text-zest">Long live the review hook.</span></>}
            copy="Every record carries public reputation signals. Two outreach styles, side by side — guess which one books the owner."
          />
          <div className="mt-12 grid gap-4 lg:grid-cols-2">
            <Reveal>
              <div className="h-full rounded-2xl border border-line bg-coal p-7 opacity-80">
                <div className="flex items-center gap-2.5">
                  <X className="size-5 text-faint" />
                  <h3 className="font-display text-base font-semibold text-faint line-through decoration-faint/50">The template blast</h3>
                </div>
                <p className="mt-5 rounded-xl border border-line bg-ink/40 p-5 font-mono text-[12px] leading-[1.9] text-faint">
                  Hi, I recruit for the Denver area. We have exciting
                  opportunities for talented barbers. Let me know if you're
                  interested or know someone.
                </p>
                <p className="mt-4 font-mono text-[11px] text-faint">reply rate: ~1.9% · marked-as-spam: often</p>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="sheen h-full rounded-2xl border border-zest/35 bg-gradient-to-b from-zest/[0.07] to-coal p-7">
                <div className="flex items-center gap-2.5">
                  <Zap className="size-5 text-zest" />
                  <h3 className="font-display text-base font-semibold text-bone">The Zybble opener</h3>
                </div>
                <p className="mt-5 rounded-xl border border-zest/25 bg-ink/50 p-5 font-mono text-[12px] leading-[1.9] text-sage">
                  Hi Dana — saw Sharp & Son just crossed 400 reviews at 4.9
                  <span className="text-zest">★</span>, and the comments on your fade work keep
                  coming. I place senior barbers at two chair-first studios
                  expanding on your side of Denver. Worth 12 minutes Thursday?
                </p>
                <p className="mt-4 font-mono text-[11px] text-zest">reply rate: ~6.4% · hooks sourced from the record itself</p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* same-day playbook */}
      <section className="mt-24 sm:mt-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHead
            eyebrow="Same-day playbook"
            title={<>Beat the agencies to <span className="text-zest">first contact</span></>}
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: MapPin, t: "Map the market", d: "Every shop in the metro + suburbs. Sector planner kills coverage blind spots." },
              { icon: Star, t: "Rank by signal", d: "High review counts = established owners. Recent 5★ = growing team." },
              { icon: MessageSquare, t: "Hook from data", d: "Rating, recent reviews, hours, photos — pick one, write one line." },
              { icon: Send, t: "Sequence it", d: "Export to your sequencer; phone column reserved for owners who ghost." },
            ].map((c, i) => (
              <Reveal key={c.t} delay={i * 0.07}>
                <div className="sheen relative h-full rounded-2xl border border-line bg-coal p-6">
                  <span className="font-display text-4xl font-bold text-transparent [-webkit-text-stroke:1px_rgba(201,241,88,0.3)]">0{i + 1}</span>
                  <c.icon className="mt-4 size-5 text-zest" />
                  <h3 className="mt-3 font-display text-base font-semibold text-bone">{c.t}</h3>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-sage">{c.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <Reveal className="mx-auto mt-20 max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="sheen flex flex-col gap-5 rounded-2xl border border-line bg-coal p-7 sm:flex-row sm:items-center sm:p-8">
          <ShieldCheck className="size-8 shrink-0 text-zest" />
          <p className="text-[13.5px] leading-relaxed text-sage">
            <span className="font-semibold text-bone">A note on conduct:</span> Zybble surfaces
            public business-contact details for business outreach. Recruit owners and
            managers at the business, keep candidate data in your ATS, and honor opt-outs
            everywhere. The full framework lives in our{" "}
            <a href="#/responsible-use" className="text-zest underline decoration-zest/40 underline-offset-4 hover:decoration-zest">
              Responsible Use policy
            </a>
            .
          </p>
        </div>
      </Reveal>

      <PageCta title="The whole labor market, mapped" copy="Your placement desk starts with knowing everyone who exists. Start mapping free." />
    </Page>
  );
}

/* ================================================================== */
/*  /marketplaces — two-sided launch playbook                          */
/* ================================================================== */

const LAUNCH = [
  { week: "Week 1", icon: Target, t: "Sizing", d: "Count the supply universe: every venue that could list on your platform, quantified per district." },
  { week: "Week 2", icon: Store, t: "Supply sprint", d: "Sweeps + enrichment across the metro. Personalize pitches with each venue's own ratings." },
  { week: "Week 3", icon: Users, t: "Demand signal", d: "Map complementary businesses for partnerships and cross-promotion targets." },
  { week: "Week 4", icon: Send, t: "Onboarding wave", d: "Sequenced outreach in district order — density looks like momentum to owners deciding on you." },
  { week: "Week 5", icon: CalendarClock, t: "Liquidity watch", d: "Re-sweep: who listed, who churned, who's still unclaimed. The delta is your ops queue." },
];

export function MarketplacesPage() {
  return (
    <Page title="For Marketplaces — zybble">
      <PageHero
        crumb={["use cases", "marketplaces"]}
        eyebrow="For marketplaces"
        title={
          <>
            Cold-start a city
            <br />
            <span className="text-zest">in five weeks.</span>
          </>
        }
        copy="The chicken-and-egg problem is really a counting problem. Zybble tells you exactly how many venues exist per district — and hands you the emails to activate them."
        motif={
          <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-line-strong bg-coal shadow-2xl">
            <div className="grid sm:grid-cols-2">
              <div className="border-b border-line p-7 sm:border-b-0 sm:border-r">
                <div className="flex items-center gap-2.5">
                  <Store className="size-4 text-zest" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">supply side</span>
                </div>
                <p className="mt-3 font-display text-3xl font-bold text-bone">2,418</p>
                <p className="mt-1 font-mono text-[11px] text-sage">venues mapped · dining + nightlife</p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.05]">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: "72%" }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="h-full rounded-full bg-zest"
                  />
                </div>
                <p className="mt-2 font-mono text-[10px] text-faint">72% with direct email</p>
              </div>
              <div className="p-7">
                <div className="flex items-center gap-2.5">
                  <Users className="size-4 text-amber" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">demand side</span>
                </div>
                <p className="mt-3 font-display text-3xl font-bold text-bone">14 districts</p>
                <p className="mt-1 font-mono text-[11px] text-sage">ranked by venue density for rollout order</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {["Mitte", "Kreuzberg", "Prenzlberg", "Neukölln", "+10"].map((d) => (
                    <span key={d} className="rounded-md border border-line bg-white/[0.02] px-2 py-1 font-mono text-[10px] text-sage">{d}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        }
      />

      {/* launch playbook */}
      <section className="mt-24 sm:mt-32">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <SectionHead
            eyebrow="The playbook"
            title={<>Five weeks from zero <span className="text-zest">to liquidity</span></>}
          />
          <div className="mt-12 space-y-0">
            {LAUNCH.map((s, i) => (
              <Reveal key={s.week} delay={i * 0.06}>
                <div className="relative flex gap-5 pb-9 last:pb-0 sm:gap-7">
                  {i < LAUNCH.length - 1 && <span className="absolute left-[58px] top-12 h-[calc(100%-44px)] w-px bg-line sm:left-[64px]" />}
                  <span className="w-[104px] shrink-0 rounded-lg border border-line bg-coal px-2 pt-3 text-center font-mono text-[10px] font-semibold uppercase tracking-wider text-zest sm:w-[120px] sm:pt-3.5 sm:text-[11px]" style={{ height: "fit-content" }}>
                    <span className="block px-2 pb-3">{s.week}</span>
                  </span>
                  <div className="sheen flex-1 rounded-2xl border border-line bg-coal p-5 transition-colors hover:border-zest/25 sm:p-6">
                    <div className="flex items-center gap-3">
                      <s.icon className="size-4.5 text-zest" />
                      <h3 className="font-display text-base font-semibold text-bone sm:text-lg">{s.t}</h3>
                    </div>
                    <p className="mt-2 text-[13px] leading-relaxed text-sage">{s.d}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* density math */}
      <section className="mt-24 sm:mt-32">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <SectionHead
            eyebrow="Density math"
            title={<>Launch where the <span className="text-zest">count says so</span></>}
            copy="Rule of thumb for venue marketplaces: 150+ activated venues per district before buyers feel it. Here's how Zybble shapes that decision."
          />
          <Reveal className="mt-12 overflow-x-auto rounded-2xl border border-line-strong bg-coal">
            <table className="w-full min-w-[560px] text-left">
              <thead>
                <tr className="border-b border-line bg-white/[0.02] font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
                  <th className="px-5 py-4 font-medium">District</th>
                  <th className="px-4 py-4 text-right font-medium">Venues found</th>
                  <th className="px-4 py-4 text-right font-medium">Emails</th>
                  <th className="px-4 py-4 text-right font-medium">Activate @30% reply</th>
                  <th className="px-4 py-4 text-right font-medium">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Mitte", "412", "361", "≈ 124", "Launch"],
                  ["Kreuzberg", "388", "339", "≈ 117", "Launch"],
                  ["Prenzlberg", "296", "252", "≈ 89", "Seed"],
                  ["Neukölln", "341", "298", "≈ 103", "Launch"],
                  ["Spandau", "148", "121", "≈ 44", "Wait"],
                ].map((row, i) => (
                  <tr key={row[0]} className={cn("border-b border-line/60 last:border-0", i % 2 === 0 && "bg-white/[0.012]")}>
                    <td className="px-5 py-3.5 text-[13.5px] font-medium text-bone">{row[0]}</td>
                    <td className="px-4 py-3.5 text-right font-mono text-[12.5px] text-sage">{row[1]}</td>
                    <td className="px-4 py-3.5 text-right font-mono text-[12.5px] text-zest">{row[2]}</td>
                    <td className="px-4 py-3.5 text-right font-mono text-[12.5px] text-sage">{row[3]}</td>
                    <td className="px-4 py-3.5 text-right">
                      <span className={cn("rounded-full px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-wider", row[4] === "Launch" ? "bg-zest/15 text-zest" : row[4] === "Seed" ? "bg-amber/15 text-amber" : "bg-white/[0.05] text-faint")}>
                        {row[4]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
        </div>
      </section>

      <Reveal className="mx-auto mt-20 max-w-4xl px-4 sm:px-6">
        <figure className="sheen rounded-3xl border border-line bg-coal p-8 text-center sm:p-12">
          <Quote className="mx-auto size-7 text-zest/60" />
          <blockquote className="mt-5 font-display text-2xl font-medium leading-snug text-bone sm:text-3xl">
            “We killed the ‘which city next’ meeting. The density CSV makes the
            call; the outreach writes itself from the listings.”
          </blockquote>
          <figcaption className="mt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
            VP Expansion · venue-booking marketplace
          </figcaption>
        </figure>
      </Reveal>

      <PageCta title="Size your next city for free" copy="Point Zybble at one district and see real supply counts with emails attached. 50 leads, no card." />
    </Page>
  );
}
