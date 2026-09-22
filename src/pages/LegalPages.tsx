import { useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  FileText,
  Gavel,
  Globe2,
  Landmark,
  Lock,
  Mail,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Trash2,
  X,
} from "lucide-react";
import { Reveal, SectionHead } from "../components/ui";
import { scrollToId } from "../lib/router";
import { DocSection, Page, PageCta, PageHero } from "./ui";
import { cn } from "../utils/cn";

const UPDATED = "Last updated: March 1, 2026";

/* ================================================================== */
/*  /privacy — sticky TOC doc                                          */
/* ================================================================== */

const PRIVACY_SECTIONS: { id: string; n: string; t: string; body: string[] }[] = [
  {
    id: "who", n: "01", t: "Who we are",
    body: [
      "Zybble Inc. („Zybble”, “we”) operates the Zybble lead-generation workspace. Our registered office is in Berlin, Germany; the team is remote across the EU and beyond. For anything in this policy, privacy@zybble.io reaches a human.",
      "This policy covers two distinct categories: (a) data about you — our customers and visitors — and (b) the public business data our engine collects on your behalf.",
    ],
  },
  {
    id: "collect", n: "02", t: "What we collect about you",
    body: [
      "Account data: email, name, plan, billing details (processed by our payment provider — we never store full card numbers).",
      "Workspace data: your searches, lead lists, filters and exports. These exist to serve you and are never used to train models for other customers.",
      "Usage data: product analytics (features used, run statistics, errors) that keep the ship pointed in the right direction. No third-party advertising trackers, ever.",
    ],
  },
  {
    id: "public", n: "03", t: "The public data principle",
    body: [
      "Zybble's engine collects business information that is published publicly on map listings and official business websites: names, categories, addresses, public phone numbers, business-facing emails, ratings, reviews, opening hours and related attributes.",
      "We collect it at query time, respect source-rate norms, and store it on behalf of the requesting workspace. We do not index or profile private individuals outside of a business context.",
    ],
  },
  {
    id: "use", n: "04", t: "How your data is used",
    body: [
      "To run the service: executing your extractions, maintaining your lists, enforcing quotas, preventing abuse.",
      "To communicate: transactional email (receipts, run completions, security notices), product changelogs (opt-out one click).",
      "Never sold. Never brokered. Your account data is not an advertising asset in any form.",
    ],
  },
  {
    id: "cookies", n: "05", t: "Cookies",
    body: [
      "Strictly-necessary cookies keep you signed in and the app functioning. A minimal, EU-hosted analytics cookie measures aggregate usage.",
      "No advertising cookies, no cross-site tracking pixels, no “we value your privacy” banners harvesting the opposite.",
    ],
  },
  {
    id: "retention", n: "06", t: "Retention & deletion",
    body: [
      "Lead lists persist until you delete them. Deleted lists are purged from production storage within 30 days and from encrypted backups within 90.",
      "Closing your account deletes account data and all associated lists, subject to narrow legal retention duties (e.g., invoices, 7–10 years by jurisdiction).",
    ],
  },
  {
    id: "rights", n: "07", t: "Your rights (GDPR & friends)",
    body: [
      "Access, rectify, export, or erase your personal data at any time from workspace settings, or by email.",
      "Object to processing, restrict it, or lodge a complaint with your supervisory authority — Berlin's, in our case.",
      "If Zybble holds data about your business, you can request removal from future extractions via privacy@zybble.io; we honor verified requests globally and maintain a no-crawl suppression registry.",
    ],
  },
  {
    id: "security", n: "08", t: "Security",
    body: [
      "Encryption in transit (TLS 1.3) and at rest (AES-256). Least-privilege access, hardware-key admin auth, quarterly penetration tests, and a published vulnerability disclosure program.",
    ],
  },
  {
    id: "changes", n: "09", t: "Changes to this policy",
    body: [
      "Material changes ship with 30 days' email notice and a dated changelog. The current version always lives on this page.",
    ],
  },
];

export function PrivacyPage() {
  const [active, setActive] = useState(PRIVACY_SECTIONS[0].id);
  return (
    <Page title="Privacy Policy — zybble">
      <PageHero
        crumb={["legal", "privacy"]}
        eyebrow="Legal · privacy"
        title={<>Privacy, written <span className="text-zest">to be read</span></>}
        copy={`${UPDATED}. The short version: your account data is never sold, public business data is collected respectfully, and deletion is real deletion.`}
      />
      <section className="mt-14 sm:mt-20">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[240px_1fr] lg:gap-14 lg:px-8">
          {/* TOC */}
          <aside className="relative">
            <nav className="lg:sticky lg:top-28">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-faint">On this page</p>
              <div className="flex gap-2 overflow-x-auto no-bar lg:block lg:space-y-1">
                {PRIVACY_SECTIONS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setActive(s.id);
                      scrollToId(s.id);
                    }}
                    className={cn(
                      "shrink-0 rounded-lg border px-3 py-2 text-left font-mono text-[11px] transition-all lg:flex lg:w-full lg:items-center lg:gap-2.5 lg:border-transparent",
                      active === s.id ? "border-zest/40 bg-zest/[0.07] text-zest" : "border-line text-sage hover:text-bone lg:border-transparent"
                    )}
                  >
                    <span className="hidden text-[9px] text-faint lg:inline">{s.n}</span>
                    {s.t.length > 26 ? s.t.slice(0, 24) + "…" : s.t}
                  </button>
                ))}
              </div>
            </nav>
          </aside>
          {/* body */}
          <div className="rounded-2xl border border-line bg-coal px-5 sm:px-9">
            {PRIVACY_SECTIONS.map((s) => (
              <DocSection key={s.id} id={s.id} n={s.n} title={s.t}>
                {s.body.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </DocSection>
            ))}
            <div className="flex items-center gap-3 py-8 font-mono text-[11px] text-faint">
              <Lock className="size-4 text-zest" /> questions → privacy@zybble.io
            </div>
          </div>
        </div>
      </section>
      <PageCta title="Privacy-first, pipeline-always" copy="Try the workspace your legal team won't need to redline." />
    </Page>
  );
}

/* ================================================================== */
/*  /terms — numbered articles deck                                    */
/* ================================================================== */

const TERMS: { t: string; points: string[] }[] = [
  { t: "The service", points: ["Zybble provides software that collects publicly-available business information from map listings and official websites, enriches and organizes it, and exports it for your business use.", "We grant you a non-exclusive, non-transferable right to use the workspace on your active plan."] },
  { t: "Accounts", points: ["One workspace per account; seat counts follow your plan. Keep credentials private — you're responsible for activity under your login.", "You must be 18+ and acting in a business capacity."] },
  { t: "Quota & fair use", points: ["One unique, enriched lead credits once, at the moment it lands in a list. Merges, re-runs and duplicates are free.", "Quotas reset monthly and don't roll over. Automated access patterns designed to circumvent quotas (free-tier farming, account stacking) are prohibited."] },
  { t: "Acceptable use", points: ["Use exported data for lawful business outreach that honors applicable laws (CAN-SPAM, GDPR, CASL and local equivalents), includes identification and opt-outs where required.", "Never use Zybble for: consumer profiling, locating private individuals, stalking/harassment, discriminatory exclusion, spam infrastructure, or reselling raw exports.", "Violations suspend the account; we're decisive and unapologetic about protecting the commons."] },
  { t: "Payment & renewal", points: ["Paid plans bill monthly (or annually when selected) in advance. Prices exclude applicable taxes.", "Failed payments trigger a 7-day grace period before downgrade to the free tier — your lists are preserved read-only."] },
  { t: "Refunds", points: ["First paid month: 14-day no-questions refund guarantee. Renewal refunds per applicable consumer law."] },
  { t: "Your data & IP", points: ["You own your searches, lists and exports. Obtaining data doesn't transfer ownership of third-party content within it (e.g., review text) — respect source rights.", "Zybble retains all rights in the software, engine and brand. Feedback you share may be used to improve the product."] },
  { t: "Service level & warranties", points: ["We target 99.9% monthly uptime; status is public. The service is provided “as is” beyond what law requires; we warrant the core service will materially perform as documented."] },
  { t: "Liability", points: ["To the maximum legal extent: no liability for indirect or consequential damages; aggregate liability capped at fees paid in the preceding 12 months. Nothing excludes liability that can't legally be excluded."] },
  { t: "Changes & miscellany", points: ["We may update these terms with 30 days' notice for material changes; continued use after notice constitutes acceptance.", "German law governs, venue Berlin, mandatory consumer protections unaffected. Contact: legal@zybble.io."] },
];

export function TermsPage() {
  return (
    <Page title="Terms of Service — zybble">
      <PageHero
        crumb={["legal", "terms"]}
        eyebrow="Legal · terms"
        title={<>Terms, in <span className="text-zest">ten articles</span></>}
        copy={`${UPDATED}. Contracts shouldn't need a law degree. These cover the service, your quota, acceptable use, payments and the fine-but-plain print.`}
      />
      <section className="mt-14 sm:mt-20">
        <div className="mx-auto max-w-5xl space-y-4 px-4 sm:px-6">
          {TERMS.map((a, i) => (
            <Reveal key={a.t} delay={Math.min(i * 0.03, 0.2)}>
              <article className="group grid gap-5 rounded-2xl border border-line bg-coal p-6 transition-colors hover:border-line-strong sm:grid-cols-[88px_1fr] sm:p-8">
                <span className="font-display text-5xl font-bold text-transparent [-webkit-text-stroke:1px_rgba(201,241,88,0.35)] sm:text-6xl">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="flex items-center gap-3 font-display text-xl font-semibold tracking-tight text-bone">
                    {a.t}
                    <Gavel className="size-4 text-faint opacity-0 transition-opacity group-hover:opacity-100" />
                  </h3>
                  <ul className="mt-4 space-y-2.5">
                    {a.points.map((p) => (
                      <li key={p.slice(0, 30)} className="flex items-start gap-3 text-[13.5px] leading-[1.8] text-sage">
                        <span className="mt-2.5 size-1 shrink-0 rounded-full bg-zest" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            </Reveal>
          ))}
          <Reveal>
            <p className="px-2 pt-4 text-center font-mono text-[11px] leading-relaxed text-faint">
              By creating a workspace you accept these articles. Deeper data terms live in the DPA; sharper outreach rules in Responsible Use.
            </p>
          </Reveal>
        </div>
      </section>
      <PageCta title="Terms out of the way?" copy="Good. Now the fun part — 50 free leads a month are waiting." />
    </Page>
  );
}

/* ================================================================== */
/*  /dpa — data processing agreement                                   */
/* ================================================================== */

const SUBPROCESSORS = [
  ["Cloud infrastructure", "Compute, storage, network", "EU (Frankfurt) primary", "ISO 27001, SOC 2"],
  ["Payment processor", "Billing & invoicing", "Global", "PCI-DSS L1"],
  ["Transactional email", "Receipts, notices, magic links", "EU/US", "SOC 2"],
  ["AI planning models", "Assistant brief planning (no customer data retention)", "US", "Zero-retention API tier"],
  ["Error monitoring", "Crash traces (scrubbed)", "US/EU", "SOC 2"],
];

export function DpaPage() {
  return (
    <Page title="Data Processing Agreement — zybble">
      <PageHero
        crumb={["legal", "dpa"]}
        eyebrow="Legal · DPA"
        title={<>The data processing <span className="text-zest">agreement</span></>}
        copy={`${UPDATED}. For customers subject to GDPR and similar regimes: roles, safeguards, subprocessors and deletion mechanics — version 3.1, effective on signup.`}
        motif={
          <div className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-3">
            {[
              { icon: Landmark, t: "You = Controller", d: "You determine why leads are processed and how outreach uses them." },
              { icon: ShieldCheck, t: "Zybble = Processor", d: "We process only on your instructions, per this agreement." },
              { icon: Globe2, t: "Public source data", d: "Businesses' self-published info, collected at query time." },
            ].map((c) => (
              <div key={c.t} className="rounded-2xl border border-line bg-coal p-5 text-left">
                <c.icon className="size-5 text-zest" />
                <p className="mt-3 font-display text-sm font-semibold text-bone">{c.t}</p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-sage">{c.d}</p>
              </div>
            ))}
          </div>
        }
      />

      <section className="mt-16 sm:mt-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <SectionHead eyebrow="Annex I" title={<>Processing <span className="text-zest">particulars</span></>} />
          <Reveal className="mt-10 overflow-hidden rounded-2xl border border-line-strong bg-coal">
            {[
              ["Subject matter", "Provision of lead-generation services: collection, enrichment, organization and export of public business data per customer instructions."],
              ["Duration", "The subscription term, plus deletion windows defined in the Privacy Policy (30/90 days)."],
              ["Nature of processing", "Automated collection from public listings and websites; normalization; dedupe; storage; export at customer request."],
              ["Purpose", "Deliver the contracted service, secure it, bill for it. Nothing else."],
              ["Data categories", "Business identity data, contact data (business phones/emails), reputation data, location data, usage data, account data."],
              ["Data subjects", "Businesses (predominantly legal entities) and business-facing contact points; customer account holders."],
            ].map(([k, v], i) => (
              <div key={k} className={cn("grid gap-1.5 px-5 py-4 sm:grid-cols-[220px_1fr] sm:gap-6 sm:px-7", i % 2 === 0 && "bg-white/[0.015]")}>
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-zest">{k}</span>
                <span className="text-[13.5px] leading-relaxed text-sage">{v}</span>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* subprocessors */}
      <section className="mt-20 sm:mt-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <SectionHead eyebrow="Annex II" title={<>Subprocessors, <span className="text-zest">named</span></>} copy="Categories listed below; the live named list with legal entities is maintained in settings → trust. 30-day advance notice for additions, with objection rights." />
          <Reveal className="mt-10 overflow-x-auto rounded-2xl border border-line-strong bg-coal">
            <table className="w-full min-w-[620px] text-left">
              <thead>
                <tr className="border-b border-line bg-white/[0.02] font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
                  {["Processor", "Function", "Location", "Assurance"].map((h) => (
                    <th key={h} className="px-5 py-4 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SUBPROCESSORS.map((r, i) => (
                  <tr key={r[0]} className={cn("border-b border-line/60 last:border-0", i % 2 === 0 && "bg-white/[0.012]")}>
                    <td className="px-5 py-3.5 text-[13px] font-medium text-bone">{r[0]}</td>
                    <td className="px-5 py-3.5 text-[12.5px] text-sage">{r[1]}</td>
                    <td className="px-5 py-3.5 font-mono text-[11.5px] text-sage">{r[2]}</td>
                    <td className="px-5 py-3.5 font-mono text-[11.5px] text-zest">{r[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
        </div>
      </section>

      {/* safeguards + deletion */}
      <section className="mt-20 sm:mt-24">
        <div className="mx-auto grid max-w-5xl gap-4 px-4 sm:px-6 md:grid-cols-2 lg:px-8">
          {[
            { icon: ShieldCheck, t: "Technical measures", items: ["TLS 1.3 everywhere; AES-256 at rest", "Row-level workspace isolation; no shared query surfaces", "Hardware-key admin access; least-privilege posture", "Quarterly external penetration tests"] },
            { icon: Trash2, t: "Deletion mechanics", items: ["List deletion → purge in ≤30 days", "Account closure → all workspace data purged", "Encrypted backups age out ≤90 days", "Suppression registry honored across future crawls"] },
          ].map((c, i) => (
            <Reveal key={c.t} delay={i * 0.08}>
              <div className="h-full rounded-2xl border border-line bg-coal p-7">
                <c.icon className="size-5 text-zest" />
                <h3 className="mt-4 font-display text-lg font-semibold text-bone">{c.t}</h3>
                <ul className="mt-4 space-y-2.5">
                  {c.items.map((it) => (
                    <li key={it} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-sage">
                      <Check className="mt-0.5 size-4 shrink-0 text-zest" /> {it}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal className="mx-auto mt-6 max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start gap-4 rounded-2xl border border-line bg-coal p-6 sm:flex-row sm:items-center sm:p-7">
            <FileText className="size-6 shrink-0 text-zest" />
            <p className="text-[13px] leading-relaxed text-sage">
              Need the countersigned PDF for procurement? <span className="text-bone">legal@zybble.io</span> returns executed DPAs within two business days.
            </p>
            <a href="#/contact" className="ml-auto inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-zest/40 bg-zest/10 px-4 font-display text-sm font-medium text-zest transition-transform hover:scale-[1.04] active:scale-95">
              <Mail className="size-4" /> Request DPA
            </a>
          </div>
        </Reveal>
      </section>

      <PageCta title="Compliance handled on our side" copy="So your side can get back to pipeline. Start free whenever you're ready." />
    </Page>
  );
}

/* ================================================================== */
/*  /responsible-use — do / don't                                      */
/* ================================================================== */

const DOS = [
  "Reach out as an identified business, with a real sender and a real offer",
  "Reference honest, relevant observations (“saw your 500th review”)",
  "Honor every opt-out instantly, globally, forever",
  "Keep lists tight: segments with a reason to hear from you",
  "Verify high-stakes claims against sources before quoting them",
  "Respect local rules: CAN-SPAM, GDPR, CASL, PECR, and friends",
];

const DONTS = [
  "Scrape-and-blast: 10,000 generic messages to bought cold addresses",
  "Contact private individuals — Zybble is business-to-business, full stop",
  "Misrepresent who you are, or fake a prior relationship",
  "Resell or republish raw exports as your own database",
  "Attempt quota farming via stacked free accounts",
  "Use the data for exclusion, discrimination, or surveillance",
];

const CHECKLIST = [
  "My offer is genuinely relevant to this segment",
  "My sender identity is accurate and reachable",
  "My unsubscribe works in one click (or honest reply-based opt-out)",
  "My call list respects the local DNC registry where I'm dialing",
  "My data retention matches my actual need",
  "I'd be comfortable receiving this exact message myself",
];

export function ResponsibleUsePage() {
  return (
    <Page title="Responsible Use — zybble">
      <PageHero
        crumb={["legal", "responsible use"]}
        eyebrow="Legal · responsible use"
        title={<>Power tool, <span className="text-zest">house rules</span></>}
        copy="Zybble can put any business on Earth in your inbox in an afternoon. This page is the operating manual for not being a menace with that. It is also binding — it's part of the Terms."
      />

      {/* do / don't */}
      <section className="mt-16 sm:mt-24">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <Reveal>
            <div className="h-full rounded-2xl border border-zest/30 bg-gradient-to-b from-zest/[0.07] to-coal p-7 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-zest text-ink">
                  <Check className="size-5" strokeWidth={2.5} />
                </span>
                <h3 className="font-display text-xl font-semibold text-bone">Do — the craft</h3>
              </div>
              <ul className="mt-7 space-y-3.5">
                {DOS.map((d, i) => (
                  <motion.li
                    key={d}
                    initial={{ opacity: 0, x: -14 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.07 }}
                    className="flex items-start gap-3 text-[13.5px] leading-relaxed text-sage"
                  >
                    <Check className="mt-0.5 size-4.5 shrink-0 text-zest" />
                    {d}
                  </motion.li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="h-full rounded-2xl border border-amber/30 bg-gradient-to-b from-amber/[0.06] to-coal p-7 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-amber text-ink">
                  <X className="size-5" strokeWidth={2.5} />
                </span>
                <h3 className="font-display text-xl font-semibold text-bone">Don't — the shortcut to a ban</h3>
              </div>
              <ul className="mt-7 space-y-3.5">
                {DONTS.map((d, i) => (
                  <motion.li
                    key={d}
                    initial={{ opacity: 0, x: -14 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.07 }}
                    className="flex items-start gap-3 text-[13.5px] leading-relaxed text-sage"
                  >
                    <X className="mt-0.5 size-4.5 shrink-0 text-amber" />
                    {d}
                  </motion.li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* gray zone */}
      <section className="mt-20 sm:mt-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <SectionHead
            eyebrow="The honest part"
            title={<>Cold outreach is a <span className="text-zest">craft, not a crime</span></>}
            copy="B2B email to a relevant business contact is legal in most jurisdictions and normal commerce everywhere. What separates 'relevant' from 'spam' isn't your warm-up tool — it's whether the recipient can see why you wrote. Public data lets you answer that question in one sentence. Use it for that."
          />
        </div>
      </section>

      {/* checklist */}
      <section className="mt-16 sm:mt-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <SectionHead eyebrow="Pre-flight" title={<>Six checks before <span className="text-zest">every send</span></>} />
          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            {CHECKLIST.map((c, i) => (
              <Reveal key={c} delay={i * 0.05}>
                <div className="flex h-full items-start gap-3 rounded-xl border border-line bg-coal p-5">
                  <span className="grid size-6 shrink-0 place-items-center rounded-md border border-zest/30 bg-zest/[0.08] font-mono text-[10px] font-bold text-zest">
                    {i + 1}
                  </span>
                  <p className="text-[13.5px] leading-relaxed text-sage">{c}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* report */}
      <section className="mt-16 sm:mt-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <Reveal>
            <div className="sheen flex flex-col gap-5 rounded-2xl border border-amber/30 bg-gradient-to-br from-amber/[0.06] to-coal p-7 sm:flex-row sm:items-center sm:p-8">
              <Siren className="size-8 shrink-0 text-amber" />
              <div>
                <h3 className="font-display text-lg font-semibold text-bone">Received unwanted mail sourced from Zybble data?</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-sage">
                  Tell us at <span className="font-mono text-zest">abuse@zybble.io</span>. We investigate every report, disable confirmed offenders,
                  and add your business to the global suppression registry on request. Also see our{" "}
                  <a href="#/privacy" className="text-zest underline decoration-zest/40 underline-offset-4">Privacy Policy</a>.
                </p>
              </div>
              <a
                href="mailto:abuse@zybble.io"
                className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-amber/40 bg-amber/10 px-5 font-display text-sm font-semibold text-amber transition-transform hover:scale-[1.04] active:scale-95 sm:ml-auto"
              >
                <ShieldAlert className="size-4" /> Report abuse
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      <PageCta title="Prospecting with a clean conscience" copy="The margins are better too — targeted, honest lists out-reply blasts three to one. Start free." />
    </Page>
  );
}
