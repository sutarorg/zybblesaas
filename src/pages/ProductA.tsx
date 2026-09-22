import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Braces,
  CheckCircle2,
  ChevronRight,
  CircuitBoard,
  Database,
  Download,
  Fingerprint,
  Gauge,
  Globe2,
  MailCheck,
  MousePointerClick,
  Radar,
  RefreshCw,
  Search,
  ShieldCheck,
  TerminalSquare,
  Zap,
} from "lucide-react";
import { generateLeads, leadsToCsv, detectCity, detectNiche, DATA_POINT_GROUPS, type Lead } from "../lib/data";
import { Reveal, SectionHead } from "../components/ui";
import { Page, PageCta, PageHero, StatsRow } from "./ui";
import { cn } from "../utils/cn";

/* ================================================================== */
/*  /live-demo — CLI playground                                        */
/* ================================================================== */

type LogLine = { text: string; kind: "cmd" | "log" | "ok" | "num" | "dim" };

function CliPlayground() {
  const [cmd, setCmd] = useState('find "plumbers in Leeds" --email');
  const [lines, setLines] = useState<LogLine[]>([
    { text: "zybble playground · simulated run · type a query and hit run", kind: "dim" },
  ]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState<Lead[] | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const bodyRef = useRef<HTMLDivElement>(null);
  const queryRef = useRef("plumbers in Leeds");

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const push = (l: LogLine) => setLines((p) => [...p.slice(-40), l]);

  const run = () => {
    if (running) return;
    const m = cmd.match(/"([^"]+)"/);
    const q = (m ? m[1] : cmd.replace(/^find\s*/i, "")).trim() || "plumbers in Leeds";
    queryRef.current = q;
    const niche = detectNiche(q);
    const city = detectCity(q);
    const leads = generateLeads(q, 64);
    timers.current.forEach(clearTimeout);
    setRunning(true);
    setDone(null);
    setLines([]);

    const script: LogLine[] = [
      { text: `$ zybble ${cmd}`, kind: "cmd" },
      { text: `[parse]  niche="${niche.label.toLowerCase()}" · geo="${city}" · email=true`, kind: "log" },
      { text: `[plan]   9 sectors · zoom 15 · radius 10km`, kind: "log" },
      { text: `[sweep]  sectors 1..9 → 64 candidates in 1.4s`, kind: "num" },
      { text: `[enrich] visiting official sites → 57 direct emails captured`, kind: "num" },
      { text: `[verify] phones normalized (E.164) · 61/64 website reachable`, kind: "log" },
      { text: `[dedupe] 3 duplicates merged (domain + phone fingerprint)`, kind: "log" },
      { text: `✔ export ready — 61 enriched leads · 98% field completion`, kind: "ok" },
    ];
    script.forEach((l, i) => {
      timers.current.push(
        setTimeout(() => {
          push(l);
          if (i === script.length - 1) {
            setTimeout(() => {
              setRunning(false);
              setDone(leads);
            }, 500);
          }
        }, 420 * i + 260)
      );
    });
  };

  const download = () => {
    if (!done) return;
    const blob = new Blob([leadsToCsv(done, queryRef.current)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zybble-${queryRef.current.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-61leads.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="always-dark sheen overflow-hidden rounded-2xl border border-line-strong bg-[#0a0d0b] shadow-2xl sm:rounded-3xl">
      <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-white/10" />
            <span className="size-2.5 rounded-full bg-white/10" />
            <span className="size-2.5 rounded-full bg-zest/70" />
          </div>
          <span className="font-mono text-[10.5px] text-faint">zybble-cli — playground</span>
        </div>
        <TerminalSquare className="size-4 text-faint" />
      </div>

      <div ref={bodyRef} className="h-[320px] space-y-1.5 overflow-y-auto scroll-smooth p-4 font-mono text-[12px] leading-relaxed sm:h-[360px] sm:p-6 sm:text-[13px]">
        {lines.map((l, i) => (
          <motion.p
            key={i}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className={cn(
              l.kind === "cmd" && "text-bone",
              l.kind === "log" && "text-sage",
              l.kind === "num" && "text-zest/90",
              l.kind === "ok" && "font-semibold text-zest",
              l.kind === "dim" && "text-faint"
            )}
          >
            {l.text}
          </motion.p>
        ))}
        {running && <p className="text-zest"><span className="inline-block h-3.5 w-2 animate-blink bg-zest/80 align-middle" /></p>}
      </div>

      <div className="flex flex-col gap-2.5 border-t border-line bg-ink/50 p-3 sm:flex-row sm:p-4">
        <div className="relative flex-1">
          <ChevronRight className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zest" />
          <input
            value={cmd}
            onChange={(e) => setCmd(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            className="h-11 w-full rounded-lg border border-line bg-ink/80 pl-10 pr-3 font-mono text-[12.5px] text-bone outline-none transition-colors focus:border-zest/50"
            placeholder='find "dentists in Berlin" --email'
          />
        </div>
        <div className="flex gap-2.5">
          <button
            onClick={run}
            disabled={running}
            className={cn(
              "inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-zest px-5 font-display text-sm font-semibold text-ink transition-all sm:flex-none",
              running ? "cursor-wait opacity-60" : "hover:scale-[1.03] active:scale-95"
            )}
          >
            <Zap className="size-4" /> {running ? "Running…" : "Run"}
          </button>
          <button
            onClick={download}
            disabled={!done}
            className={cn(
              "inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border px-4 font-display text-sm font-semibold transition-all sm:flex-none",
              done
                ? "border-zest/40 bg-zest/10 text-zest hover:scale-[1.03]"
                : "cursor-not-allowed border-line text-faint"
            )}
          >
            <Download className="size-4" /> CSV
          </button>
        </div>
      </div>
    </div>
  );
}

export function LiveDemoPage() {
  return (
    <Page title="Live Demo — zybble">
      <PageHero
        crumb={["product", "live demo"]}
        eyebrow="Playground"
        title={
          <>
            Watch the engine <span className="text-zest">think.</span>
          </>
        }
        copy="A terminal-grade look at how Zybble turns one line of intent into an export-ready list. This is a simulation running in your browser — the CSV it exports is real."
        motif={<CliPlayground />}
      />

      {/* stage breakdown */}
      <section className="mt-24 sm:mt-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHead
            eyebrow="Under the hood"
            title={<>Five stages, <span className="text-zest">one line of input</span></>}
            copy="What looks like magic is a disciplined pipeline. Every run passes through the same five gates before a lead earns its row."
          />
          <div className="mx-auto mt-12 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { icon: Search, t: "Parse", d: "Your sentence becomes niche, geography, and enrichment flags. Fuzzy matching handles typos and synonyms." },
              { icon: Radar, t: "Plan", d: "The target area splits into sector cells sized so no cluster of businesses slips through pagination limits." },
              { icon: Globe2, t: "Sweep", d: "Live listings are crawled sector by sector at up to 120 places per minute — never a cached, stale database." },
              { icon: MailCheck, t: "Enrich", d: "Each official website is visited to capture direct emails; phones are normalized into dial-ready format." },
              { icon: Fingerprint, t: "Verify", d: "Dedupe fingerprints every record, completeness is scored, and the list ships only when it passes QA." },
            ].map((s, i) => (
              <Reveal key={s.t} delay={i * 0.07}>
                <div className="sheen group h-full rounded-2xl border border-line bg-coal p-5 transition-colors hover:border-zest/30">
                  <div className="flex items-center justify-between">
                    <span className="grid size-10 place-items-center rounded-xl border border-zest/25 bg-zest/[0.07]">
                      <s.icon className="size-4.5 text-zest" />
                    </span>
                    <span className="font-mono text-[10px] text-faint">0{i + 1}</span>
                  </div>
                  <h3 className="mt-4 font-display text-base font-semibold text-bone">{s.t}</h3>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-sage">{s.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* demo vs prod */}
      <section className="mt-24 sm:mt-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHead
            eyebrow="Honest comparison"
            title={<>This demo vs. <span className="text-zest">your workspace</span></>}
            copy="The playground is a slice of the real pipeline with simulated data. Here's exactly what changes when you sign up."
          />
          <Reveal className="mx-auto mt-12 max-w-4xl overflow-hidden rounded-2xl border border-line-strong bg-coal">
            <div className="grid grid-cols-[1.1fr_0.9fr_1fr] border-b border-line bg-white/[0.02] px-4 py-3 font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint sm:px-6 sm:text-[10.5px]">
              <span>Capability</span>
              <span>Playground</span>
              <span>Production</span>
            </div>
            {[
              ["Data source", "Simulated", "Live map listings"],
              ["Throughput", "Instant", "~120 leads / minute"],
              ["Rows per run", "64", "Up to your monthly quota"],
              ["Regions", "Any (synthetic)", "195 countries, real data"],
              ["Emails", "Pattern-generated", "Scraped from official sites"],
              ["AI agent briefs", "—", "Growth & Scale plans"],
            ].map(([cap, demo, prod], i) => (
              <div key={cap} className={cn("grid grid-cols-[1.1fr_0.9fr_1fr] gap-2 px-4 py-3.5 font-mono text-[11px] sm:px-6 sm:text-[12px]", i % 2 === 0 && "bg-white/[0.015]")}>
                <span className="text-sage">{cap}</span>
                <span className="text-faint">{demo}</span>
                <span className="text-zest">{prod}</span>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* cheat sheet */}
      <section className="mt-24 sm:mt-32">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: MousePointerClick, t: "Try these", d: '"vet clinics in Austin" · "boutique hotels in Lyon" · "crossfit gyms in Leeds"' },
              { icon: CircuitBoard, t: "Flags that matter", d: "--email → scrape sites for emails · --min-rating 4.5 · --has-website" },
              { icon: Database, t: "Where it lands", d: "Results save as a lead list automatically — and the CSV here downloads instantly." },
            ].map((c, i) => (
              <Reveal key={c.t} delay={i * 0.08}>
                <div className="rounded-2xl border border-line bg-coal p-6">
                  <c.icon className="size-5 text-zest" />
                  <h3 className="mt-4 font-display text-base font-semibold text-bone">{c.t}</h3>
                  <p className="mt-2 font-mono text-[11.5px] leading-relaxed text-sage">{c.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <PageCta title="The real thing is even faster" copy="Sign up, run your first full extraction, and watch 1,000+ leads an hour pile into your lists." />
    </Page>
  );
}

/* ================================================================== */
/*  /data-points — interactive field explorer                          */
/* ================================================================== */

type FieldDoc = { name: string; desc: string; src: "live" | "enriched" };
const FIELD_DOCS: Record<string, FieldDoc[]> = {
  "Contact & identity": [
    { name: "business name", desc: "Official trading name as listed publicly.", src: "live" },
    { name: "email", desc: "Address found on the business's own website — not guessed or patterned.", src: "enriched" },
    { name: "phone", desc: "Main public line, normalized for direct dialing.", src: "live" },
    { name: "website", desc: "Official domain, linked for enrichment and outreach research.", src: "live" },
    { name: "maps link", desc: "Canonical listing URL for one-click verification.", src: "live" },
    { name: "category", desc: "Primary business category as self-declared by the owner.", src: "live" },
    { name: "plus code", desc: "Short location code for hard-to-address areas.", src: "live" },
    { name: "owner-claimed status", desc: "Whether the business manages its own listing — a buying-intent signal.", src: "live" },
  ],
  "Location intelligence": [
    { name: "full address", desc: "Complete formatted postal address.", src: "live" },
    { name: "street", desc: "Street-level component, split for territory routing.", src: "live" },
    { name: "latitude / longitude", desc: "Precise coordinates — plot, cluster, or radius-filter anywhere.", src: "live" },
    { name: "timezone", desc: "Local zone so your sequences land during business hours.", src: "live" },
    { name: "status", desc: "Open, temporarily closed, or permanently closed.", src: "live" },
    { name: "street view url", desc: "Visual verification of storefront before you knock.", src: "live" },
    { name: " search area radius", desc: "Distance from your query's search centroid.", src: "enriched" },
  ],
  "Reputation signals": [
    { name: "star rating", desc: "Current public average — your fastest qualification filter.", src: "live" },
    { name: "review count", desc: "Volume of public reviews, a proxy for business maturity.", src: "live" },
    { name: "rating breakdown", desc: "Distribution across 1–5 stars; spot loved vs. loathed.", src: "live" },
    { name: "recent review text", desc: "Latest customer language for personalization hooks.", src: "live" },
    { name: "review link", desc: "Deep link straight to the review feed.", src: "live" },
    { name: "extended reviews", desc: "Up to ~300 reviews per business on deep runs.", src: "enriched" },
  ],
  "Business context": [
    { name: "opening hours", desc: "Full weekly schedule — time your calls.", src: "live" },
    { name: "popular times", desc: "Hourly footfall patterns; know when they're slammed.", src: "live" },
    { name: "price range", desc: "$ to $$$$ — qualify budget fit before outreach.", src: "live" },
    { name: "description", desc: "Owner-written summary of what they do and who they serve.", src: "live" },
    { name: "booking link", desc: "Reservation URL — or its absence (hello, SaaS pitch).", src: "live" },
    { name: "online ordering link", desc: "Whether they transact online already.", src: "live" },
    { name: "menu link", desc: "Menu/catalog URL for hospitality research.", src: "live" },
    { name: "payment methods", desc: "Accepted cards and payment types.", src: "live" },
    { name: "photos", desc: "Storefront and interior imagery URLs.", src: "live" },
  ],
};

export function DataPointsPage() {
  const groups = DATA_POINT_GROUPS.map((g) => g.title);
  const [tab, setTab] = useState(groups[0]);
  const fields = FIELD_DOCS[tab] ?? [];

  return (
    <Page title="Data Points — zybble">
      <PageHero
        crumb={["product", "data points"]}
        eyebrow="Field reference"
        title={
          <>
            Every lead, <span className="text-zest">dissected.</span>
          </>
        }
        copy="36 fields per record, grouped into four families. Explore each field: what it is, where it comes from, and why your outreach gets sharper because of it."
        motif={<StatsRow items={[["36", "fields per lead"], ["4", "field families"], ["88%", "email hit-rate"], ["100%", "live-verified"]]} />}
      />

      {/* explorer */}
      <section className="mt-20 sm:mt-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex gap-2 overflow-x-auto no-bar sm:flex-wrap">
            {groups.map((g) => (
              <button
                key={g}
                onClick={() => setTab(g)}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-2 font-mono text-[11.5px] transition-all duration-300",
                  tab === g
                    ? "border-zest/50 bg-zest/10 text-zest"
                    : "border-line text-sage hover:border-line-strong hover:text-bone"
                )}
              >
                {g}
              </button>
            ))}
          </div>

          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {fields.map((f, i) => (
              <Reveal key={f.name} delay={Math.min(i * 0.04, 0.3)} y={14}>
                <div className="group h-full rounded-xl border border-line bg-coal p-5 transition-colors hover:border-zest/25">
                  <div className="flex items-center justify-between gap-2">
                    <code className="rounded-md bg-zest/[0.08] px-2 py-1 font-mono text-[11px] font-medium text-zest">
                      {f.name.trim()}
                    </code>
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest",
                        f.src === "live" ? "border-zest/30 text-zest" : "border-amber/30 text-amber"
                      )}
                    >
                      {f.src === "live" ? "live source" : "enriched"}
                    </span>
                  </div>
                  <p className="mt-3 text-[12.5px] leading-relaxed text-sage">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </motion.div>
        </div>
      </section>

      {/* pipeline */}
      <section className="mt-24 sm:mt-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHead
            eyebrow="Enrichment pipeline"
            title={<>From listing to <span className="text-zest">intelligence file</span></>}
            copy="Raw listings are just the seed. Five transforms later, you hold a record your sequencers and CRMs actually understand."
          />
          <div className="mx-auto mt-12 max-w-3xl">
            {[
              { icon: Radar, t: "Listing crawl", d: "Live capture of name, category, address, rating — straight from the public listing." },
              { icon: Globe2, t: "Website visit", d: "The engine loads every official site, following contact and imprint pages hunters usually miss." },
              { icon: MailCheck, t: "Email capture & check", d: "Addresses are extracted, syntax-checked, and ranked (hello@ beats no-reply@, always)." },
              { icon: Braces, t: "Normalization", d: "Phones → E.164, hours → structured weekly schema, ratings → numerics. Machines rejoice." },
              { icon: ShieldCheck, t: "Fingerprint & QA", d: "Cross-list dedupe key + completeness scoring before anything touches your quota." },
            ].map((s, i) => (
              <Reveal key={s.t} delay={i * 0.06}>
                <div className="relative flex gap-5 pb-8 last:pb-0">
                  {i < 4 && <span className="absolute left-[19px] top-12 h-[calc(100%-40px)] w-px bg-gradient-to-b from-zest/30 to-transparent" />}
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-zest/25 bg-coal">
                    <s.icon className="size-4.5 text-zest" />
                  </span>
                  <div className="rounded-2xl border border-line bg-coal p-5 sm:p-6">
                    <h3 className="font-display text-base font-semibold text-bone">{s.t}</h3>
                    <p className="mt-2 text-[13px] leading-relaxed text-sage">{s.d}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* freshness contract */}
      <section className="mt-24 sm:mt-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHead
            eyebrow="Freshness contract"
            title={<>No stale rows. <span className="text-zest">Ever.</span></>}
          />
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              { icon: RefreshCw, t: "Queried live", d: "Ratings, review counts and status reflect the source the moment your run executes — not last quarter's snapshot." },
              { icon: Gauge, t: "Rate-respecting", d: "Throughput is adaptive: fast enough to matter, polite enough to be sustainable for the long term." },
              { icon: CheckCircle2, t: "Completeness score", d: "Every record carries a field-completion percentage, so you filter 98%-complete rows when it counts." },
            ].map((c, i) => (
              <Reveal key={c.t} delay={i * 0.08}>
                <div className="sheen h-full rounded-2xl border border-line bg-coal p-7">
                  <span className="grid size-11 place-items-center rounded-xl border border-zest/25 bg-zest/[0.07]">
                    <c.icon className="size-5 text-zest" />
                  </span>
                  <h3 className="mt-5 font-display text-lg font-semibold text-bone">{c.t}</h3>
                  <p className="mt-2.5 text-[13.5px] leading-relaxed text-sage">{c.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <PageCta title="36 fields on your next list" copy="Run one search and see the full record shape yourself — free plan, 50 leads a month." />
    </Page>
  );
}
