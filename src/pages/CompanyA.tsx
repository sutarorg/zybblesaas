import { useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  Copy,
  Download,
  Fingerprint,
  Flag,
  Leaf,
  Quote,
  Radar,
  ShieldCheck,
  Telescope,
  Zap,
} from "lucide-react";
import { Logo, Reveal, SectionHead } from "../components/ui";
import { Page, PageCta, PageHero, StatsRow } from "./ui";
import { cn } from "../utils/cn";

/* ================================================================== */
/*  /about                                                             */
/* ================================================================== */

const MILESTONES = [
  { year: "2023", t: "The kernel", d: "Two engineers, one frustration: every lead database was stale and overpriced. We started running live map extractions for our own consulting gigs." },
  { year: "2024", t: "Engine hardening", d: "Sector planning, website email capture, dedupe fingerprints. The pipeline hit 120 places a minute and never looked back." },
  { year: "2025", t: "Zybble launches", d: "Lists, filters, CSV — productized into a workspace anyone can run. First 1,000 workspaces in nine weeks." },
  { year: "2026", t: "The Assistant era", d: "Plain-language briefs, QA diaries, autopilot schedules. Lead-gen moves from task to team member." },
];

const VALUES = [
  { icon: Radar, t: "Live or nothing", d: "If the data isn't from the source at query time, it doesn't ship. No caches posing as product." },
  { icon: Zap, t: "Minutes to value", d: "Sign-up to first exported list in under three. Every feature is judged against that stopwatch." },
  { icon: ShieldCheck, t: "Polite by design", d: "Rate-respecting infrastructure and public-data-only principles are architecture, not policy icing." },
  { icon: Telescope, t: "Honest instrumentation", d: "Run diaries, QA scores, completeness percentages — we show you the machine, not just the magic." },
];

const TEAM = [
  ["Mara Voss", "Co-founder · CEO", "MV"],
  ["Theo Lindgren", "Co-founder · Engine", "TL"],
  ["Priya Anand", "AI / Assistant", "PA"],
  ["Diego Ferraz", "Data Quality", "DF"],
  ["Anouk Bakker", "Design", "AB"],
  ["Sam Okafor", "Infrastructure", "SO"],
  ["Lena Richter", "Growth", "LR"],
  ["Kai Tanabe", "Support & Ops", "KT"],
];

export function AboutPage() {
  return (
    <Page title="About — zybble">
      <PageHero
        crumb={["company", "about"]}
        eyebrow="Our story"
        title={
          <>
            Every local business is
            <br />
            <span className="text-zest">searchable. We just prove it daily.</span>
          </>
        }
        copy="Zybble exists because the world's most valuable B2B dataset has been sitting in plain sight — on public maps — while sales teams paid for spreadsheets of last year's data."
      />

      {/* mission */}
      <section className="mt-24 sm:mt-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
            <Reveal>
              <div className="sheen flex h-full flex-col justify-between rounded-2xl border border-zest/30 bg-gradient-to-b from-zest/[0.08] to-coal p-8 sm:p-10">
                <Flag className="size-6 text-zest" />
                <p className="mt-10 font-display text-2xl font-semibold leading-snug text-bone sm:text-3xl">
                  Turn the world's open map data into fair, fresh pipeline for
                  anyone who sells to local businesses.
                </p>
                <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
                  the zybble mission · est. 2023
                </p>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="h-full rounded-2xl border border-line bg-coal p-8 sm:p-10">
                <h3 className="font-display text-xl font-semibold text-bone">Why we exist</h3>
                <div className="mt-5 space-y-4 text-[14px] leading-relaxed text-sage">
                  <p>
                    In 2023 we were consultants buying lead lists for clients. Every vendor sold the
                    same rotting spreadsheets: dead phones, closed businesses, emails nobody
                    monitored. Meanwhile, the freshest possible source — the live public listings
                    every business maintains about itself — was sitting untouched.
                  </p>
                  <p>
                    So we built an engine around it. Not a database that decays the day it ships, but
                    a pipeline that reads the world at query time: ratings this morning, review
                    counts this week, the email on their imprint page right now.
                  </p>
                  <p>
                    Today Zybble powers prospecting for agencies, SaaS teams, recruiters and marketplaces
                    across 195 countries — with a free tier generous enough that nobody needs an excuse
                    to start.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* milestones */}
      <section className="mt-24 sm:mt-32">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <SectionHead eyebrow="Trajectory" title={<>Four years, <span className="text-zest">one obsession</span></>} />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MILESTONES.map((m, i) => (
              <Reveal key={m.year} delay={i * 0.07}>
                <div className="group relative h-full rounded-2xl border border-line bg-coal p-6 transition-colors hover:border-zest/30">
                  <span className="font-display text-4xl font-bold text-transparent [-webkit-text-stroke:1px_rgba(201,241,88,0.45)]">
                    {m.year}
                  </span>
                  <h3 className="mt-4 font-display text-lg font-semibold text-bone">{m.t}</h3>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-sage">{m.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* values */}
      <section className="mt-24 sm:mt-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHead eyebrow="Operating principles" title={<>What we refuse <span className="text-zest">to compromise</span></>} />
          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {VALUES.map((v, i) => (
              <Reveal key={v.t} delay={i * 0.06}>
                <div className="sheen flex h-full gap-5 rounded-2xl border border-line bg-coal p-7">
                  <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-zest/25 bg-zest/[0.07]">
                    <v.icon className="size-5 text-zest" />
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-semibold text-bone">{v.t}</h3>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-sage">{v.d}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* numbers + team */}
      <section className="mt-24 sm:mt-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <StatsRow items={[["4,300+", "active workspaces"], ["9", "humans, remote-first"], ["38M", "leads delivered in 2025"], ["195", "countries served"]]} />
          </Reveal>
          <SectionHead eyebrow="The crew" title={<>Nine people, <span className="text-zest">deeply unreasonable standards</span></>} copy="Remote across four time zones. We ship weekly, argue kindly, and answer our own support inbox." className="mt-20" />
          <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {TEAM.map(([name, role, init], i) => (
              <Reveal key={name} delay={i * 0.04}>
                <div className="group rounded-2xl border border-line bg-coal p-6 text-center transition-colors hover:border-zest/30">
                  <div className="relative mx-auto grid size-16 place-items-center rounded-2xl border border-zest/25 bg-gradient-to-br from-zest/15 to-graphite font-display text-lg font-bold text-zest transition-transform duration-300 group-hover:scale-105">
                    {init}
                    <span className="absolute -bottom-1 -right-1 size-3 rounded-full border-2 border-coal bg-zest" />
                  </div>
                  <h3 className="mt-4 text-[14px] font-semibold text-bone">{name}</h3>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-faint">{role}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <PageCta title="Come prospect with us" copy="Whether you join as a customer or a teammate — the map is already waiting." />
    </Page>
  );
}

/* ================================================================== */
/*  /press-kit                                                         */
/* ================================================================== */

const logoSvg = (bg: string, fg: string, ring: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 72">` +
  `<rect width="240" height="72" rx="16" fill="${bg}"/>` +
  `<circle cx="38" cy="36" r="13" fill="none" stroke="${ring}" stroke-width="3.5"/>` +
  `<circle cx="38" cy="36" r="5" fill="${ring}"/>` +
  `<text x="62" y="45" font-family="Verdana, sans-serif" font-size="26" font-weight="bold" fill="${fg}">zybble.</text></svg>`;

function downloadSvg(filename: string, svg: string) {
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const COLORS = [
  { name: "Ink", hex: "#080A09", note: "primary canvas" },
  { name: "Zest", hex: "#C9F158", note: "action & signal" },
  { name: "Bone", hex: "#EDEFE8", note: "primary text" },
  { name: "Sage", hex: "#8F978C", note: "secondary text" },
  { name: "Amber", hex: "#FFC24B", note: "ratings & warnings" },
];

function ColorSwatch({ name, hex, note }: { name: string; hex: string; note: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(hex).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      }}
      className="group overflow-hidden rounded-2xl border border-line text-left transition-all hover:border-zest/40 active:scale-[0.98]"
    >
      <div className="grid h-24 place-items-center transition-transform" style={{ background: hex }}>
        <span className={cn("rounded-md px-2 py-1 font-mono text-[10px] opacity-0 transition-opacity group-hover:opacity-100", name === "Bone" || name === "Zest" ? "bg-ink/80 text-bone" : "bg-black/40 text-bone")}>
          {copied ? <span className="flex items-center gap-1"><Check className="size-3" /> copied</span> : "click to copy"}
        </span>
      </div>
      <div className="bg-coal p-4">
        <p className="font-display text-sm font-semibold text-bone">{name}</p>
        <p className="font-mono text-[11px] text-zest">{hex}</p>
        <p className="mt-0.5 font-mono text-[10px] text-faint">{note}</p>
      </div>
    </button>
  );
}

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative rounded-2xl border border-line bg-coal p-6 sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">{label}</span>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(text).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 font-mono text-[11px] transition-all",
            copied ? "border-zest/50 bg-zest/10 text-zest" : "border-line-strong text-sage hover:text-bone"
          )}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-4 text-[13.5px] leading-[1.8] text-sage">{text}</p>
    </div>
  );
}

export function PressKitPage() {
  return (
    <Page title="Press Kit — zybble">
      <PageHero
        crumb={["company", "press kit"]}
        eyebrow="Press kit"
        title={
          <>
            Everything you need to
            <br />
            <span className="text-zest">write about Zybble</span>
          </>
        }
        copy="Boilerplate, logos, brand colors and the facts — copy-paste welcome. For interviews and assets beyond this page, press@zybble.io answers within a day."
      />

      {/* boilerplate */}
      <section className="mt-20 sm:mt-28">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <SectionHead eyebrow="Boilerplate" title={<>Approved copy, <span className="text-zest">ready to paste</span></>} />
          <div className="mt-10 space-y-4">
            <CopyBlock
              label="Short · 50 words"
              text="Zybble is a B2B lead generation engine that turns live public map listings into export-ready sales leads. Any niche, any city: every record ships enriched with direct emails, phones and 36 data points — deduped automatically and exported to CSV in one click. Free plans start at 50 leads per month."
            />
            <CopyBlock
              label="Long · 120 words"
              text="Zybble is a B2B lead generation platform built on a simple observation: public map listings are the freshest business database on Earth — and nobody sells them properly. Zybble's extraction engine sweeps live listings across 195 countries at up to 120 businesses per minute, then visits each business's official website to capture direct emails and normalize phone numbers. Every lead ships as a 36-field intelligence record — ratings, review counts, opening hours, price range, coordinates and more — deduped by default against everything a team already owns. An AI Assistant turns plain-language briefs like 'HVAC companies in Dallas rated 4.5+ without online booking' into planned, quality-checked extraction jobs. Plans range from a free tier (50 leads/month) to Scale (50,000 leads/month with priority queues)."
            />
          </div>
        </div>
      </section>

      {/* logos */}
      <section className="mt-24 sm:mt-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHead eyebrow="Logo" title={<>The mark, <span className="text-zest">in three treatments</span></>} copy="A radar ring with a live dot — find the signal in the noise. Keep clear space equal to the dot's diameter ×3, don't rotate, don't recolor outside these treatments." />
          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            {[
              { name: "Dark (default)", bg: "#0A0D0B", el: <Logo />, svg: logoSvg("#0A0D0B", "#EDEFE8", "#C9F158"), file: "zybble-logo-dark.svg" },
              { name: "Light", bg: "#EDEFE8", el: <span className="inline-flex items-center gap-2.5"><span className="relative grid size-8 place-items-center rounded-[10px] border border-ink/15 bg-white"><span className="absolute size-4 rounded-full border-2 border-[#7ea018]" /><span className="size-1.5 rounded-full bg-[#7ea018]" /></span><span className="font-display text-xl font-bold tracking-tight text-ink">zybble<span className="text-[#7ea018]">.</span></span></span>, svg: logoSvg("#EDEFE8", "#080A09", "#7EA018"), file: "zybble-logo-light.svg" },
              { name: "Mono", bg: "#151916", el: <span className="inline-flex items-center gap-2.5"><span className="relative grid size-8 place-items-center rounded-[10px] border border-bone/20"><span className="absolute size-4 rounded-full border-2 border-bone" /><span className="size-1.5 rounded-full bg-bone" /></span><span className="font-display text-xl font-bold tracking-tight text-bone">zybble.</span></span>, svg: logoSvg("#151916", "#EDEFE8", "#EDEFE8"), file: "zybble-logo-mono.svg" },
            ].map((v, i) => (
              <Reveal key={v.name} delay={i * 0.07}>
                <div className="overflow-hidden rounded-2xl border border-line">
                  <div className="grid h-36 place-items-center" style={{ background: v.bg }}>
                    {v.el}
                  </div>
                  <div className="flex items-center justify-between bg-coal px-5 py-4">
                    <span className="text-[13px] font-medium text-bone">{v.name}</span>
                    <button
                      onClick={() => downloadSvg(v.file, v.svg)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong px-3.5 font-mono text-[11px] text-sage transition-all hover:border-zest/40 hover:text-zest active:scale-95"
                    >
                      <Download className="size-3.5" /> SVG
                    </button>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* colors + facts */}
      <section className="mt-24 sm:mt-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHead eyebrow="Palette" title={<>Five colors. <span className="text-zest">That's the brand.</span></>} />
          <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {COLORS.map((c, i) => (
              <motion.div key={c.name} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
                <ColorSwatch {...c} />
              </motion.div>
            ))}
          </div>

          <div className="mt-20 grid gap-4 lg:grid-cols-2">
            <Reveal>
              <div className="h-full rounded-2xl border border-line bg-coal p-7 sm:p-8">
                <Fingerprint className="size-5 text-zest" />
                <h3 className="mt-4 font-display text-xl font-semibold text-bone">Key facts</h3>
                <ul className="mt-5 space-y-3">
                  {[
                    "Founded 2023 · launched publicly July 2025",
                    "Covers 195 countries; ~120 leads/minute engine speed",
                    "36 data points per lead; emails from official sites",
                    "4,300+ active workspaces as of Q1 2026",
                    "Free tier: 50 leads/month, no card required",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[13.5px] text-sage">
                      <Check className="mt-0.5 size-4 shrink-0 text-zest" /> {f}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="flex h-full flex-col justify-between rounded-2xl border border-line bg-coal p-7 sm:p-8">
                <figure>
                  <Quote className="size-5 text-zest/60" />
                  <blockquote className="mt-4 font-display text-xl font-medium leading-snug text-bone">
                    “The best lead database is the one businesses maintain about
                    themselves. We just read it politely, at scale.”
                  </blockquote>
                  <figcaption className="mt-4 font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">
                    Mara Voss · Co-founder & CEO
                  </figcaption>
                </figure>
                <div className="mt-8 flex items-center gap-3 rounded-xl border border-line bg-white/[0.02] px-4 py-3.5">
                  <Leaf className="size-4 shrink-0 text-zest" />
                  <p className="font-mono text-[11px] text-sage">
                    media contact: <span className="text-zest">press@zybble.io</span> · reply &lt; 24h
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <PageCta title="Writing about us? Start free." copy="The fastest way to understand Zybble is one extraction. 50 leads on the house, forever." />
    </Page>
  );
}
