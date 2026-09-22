import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Coffee,
  Coins,
  Globe2,
  Laptop,
  Mail,
  Megaphone,
  MessageSquare,
  Newspaper,
  Plane,
  Send,
  Timer,
  Users,
} from "lucide-react";
import { Reveal, SectionHead } from "../components/ui";
import { Page, PageCta, PageHero } from "./ui";
import { cn } from "../utils/cn";

/* ================================================================== */
/*  /careers                                                           */
/* ================================================================== */

const PERKS = [
  { icon: Globe2, t: "Remote-first", d: "Four time zones, async by default. Meetings are rare and always optional-recording." },
  { icon: Coins, t: "Real equity", d: "Meaningful options on a standard 4-year plan. Salary bands published internally." },
  { icon: Laptop, t: "Hardware that ships", d: "M-class laptop, 4K monitor, and a standing-desk budget on day one." },
  { icon: Plane, t: "Two offsites / year", d: "Somewhere with good coffee and bad wifi excuses. Partner-friendly." },
  { icon: BookOpen, t: "€1,500 learning budget", d: "Courses, conferences, books. Spend it, present the takeaways, repeat." },
  { icon: Timer, t: "No-fake-urgency policy", d: "We ship weekly but sprint never. Pager-duty rotation is compensated and quiet." },
];

const ROLES: { dept: string; roles: [string, string, string, string][] }[] = [
  {
    dept: "Engineering",
    roles: [
      ["Senior Distributed Systems Engineer", "Remote · EU overlap", "Full-time", "€95–130k"],
      ["Crawl Infrastructure Engineer", "Remote · Global", "Full-time", "€85–115k"],
      ["Applied AI Engineer (agent tooling)", "Remote · EU overlap", "Full-time", "€100–140k"],
    ],
  },
  {
    dept: "Growth",
    roles: [
      ["Content Lead (data storytelling)", "Remote · Global", "Full-time", "€70–95k"],
      ["Product Marketing Manager", "Remote · EU/US", "Full-time", "€80–110k"],
    ],
  },
  {
    dept: "Operations",
    roles: [["Support Engineer", "Remote · Global", "Full-time", "€55–75k"]],
  },
];

const STEPS = [
  { t: "Apply async", d: "No cover letters. A short form, recent work you're proud of, and your favorite prospecting war story." },
  { t: "Craft call · 45m", d: "Deep-dive with your future teammate on one real problem — the kind this role actually faces." },
  { t: "Paid mini-project", d: "≤3 hours, real repo or real campaign, compensated at €150/h. Never used in production." },
  { t: "Offer in 72h", d: "Decision with reasoning either way. Rejections come with genuine, specific feedback." },
];

export function CareersPage() {
  return (
    <Page title="Careers — zybble">
      <PageHero
        crumb={["company", "careers"]}
        eyebrow="Careers · 6 open roles"
        title={
          <>
            Build the engine that
            <br />
            <span className="text-zest">maps every business on Earth</span>
          </>
        }
        copy="Nine people, four time zones, 4,300 teams depending on our pipeline. Small enough that your code is the product; stable enough that your salary never feels like a startup bet."
      />

      {/* perks */}
      <section className="mt-24 sm:mt-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHead eyebrow="The deal" title={<>Strong perks, <span className="text-zest">stronger defaults</span></>} />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PERKS.map((p, i) => (
              <Reveal key={p.t} delay={i * 0.05}>
                <div className="sheen h-full rounded-2xl border border-line bg-coal p-7 transition-colors hover:border-zest/25">
                  <span className="grid size-11 place-items-center rounded-xl border border-zest/25 bg-zest/[0.07]">
                    <p.icon className="size-5 text-zest" />
                  </span>
                  <h3 className="mt-5 font-display text-lg font-semibold text-bone">{p.t}</h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-sage">{p.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* roles */}
      <section className="mt-24 sm:mt-32">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <SectionHead eyebrow="Open roles" title={<>Pick your <span className="text-zest">battle</span></>} copy="Apply through the contact form below with the role as subject — a human answers every application within five working days." />
          <div className="mt-12 space-y-10">
            {ROLES.map((g) => (
              <div key={g.dept}>
                <Reveal>
                  <h3 className="flex items-center gap-3 font-mono text-[11px] font-semibold uppercase tracking-[0.24em] text-zest">
                    <span className="h-px w-6 bg-zest/40" /> {g.dept}
                  </h3>
                </Reveal>
                <div className="mt-4 space-y-3">
                  {g.roles.map((r, i) => (
                    <Reveal key={r[0]} delay={i * 0.05}>
                      <a
                        href="#/contact"
                        className="group flex flex-col gap-3 rounded-2xl border border-line bg-coal p-5 transition-all duration-300 hover:border-zest/35 sm:flex-row sm:items-center sm:justify-between sm:p-6"
                      >
                        <div>
                          <p className="font-display text-[15.5px] font-semibold text-bone transition-colors group-hover:text-zest">
                            {r[0]}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {[r[1], r[2]].map((c) => (
                              <span key={c} className="rounded-md border border-line bg-white/[0.02] px-2 py-1 font-mono text-[10px] text-sage">
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-4 sm:justify-end">
                          <span className="font-mono text-[12px] font-medium text-zest">{r[3]}</span>
                          <span className="grid size-9 place-items-center rounded-lg border border-line-strong text-faint transition-all group-hover:border-zest/50 group-hover:text-zest">
                            <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                          </span>
                        </div>
                      </a>
                    </Reveal>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* process */}
      <section className="mt-24 sm:mt-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHead eyebrow="Hiring process" title={<>Two weeks, four steps, <span className="text-zest">zero ghosting</span></>} />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <Reveal key={s.t} delay={i * 0.07}>
                <div className="relative h-full rounded-2xl border border-line bg-coal p-6">
                  <span className="font-display text-4xl font-bold text-transparent [-webkit-text-stroke:1px_rgba(201,241,88,0.35)]">
                    0{i + 1}
                  </span>
                  <h3 className="mt-4 font-display text-base font-semibold text-bone">{s.t}</h3>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-sage">{s.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <PageCta title="Not hiring shaped like a role?" copy="Exceptional people get custom roles. Write to talent@zybble.io with what you'd own in your first quarter." button="Start a conversation" />
    </Page>
  );
}

/* ================================================================== */
/*  /contact                                                           */
/* ================================================================== */

const CHANNELS = [
  { icon: Coins, t: "Sales & upgrades", mail: "sales@zybble.io", sla: "same business day", d: "Plan sizing, volume discounts, procurement." },
  { icon: MessageSquare, t: "Product support", mail: "support@zybble.io", sla: "< 4h on Scale", d: "Stuck run, weird record, quota question." },
  { icon: Newspaper, t: "Press & media", mail: "press@zybble.io", sla: "< 24h", d: "Interviews, data requests, embargoes." },
  { icon: Megaphone, t: "Partnerships", mail: "partners@zybble.io", sla: "2–3 days", d: "Agency programs, integrations, affiliates." },
];

const inputCls =
  "h-12 w-full rounded-xl border border-line bg-ink/60 px-4 text-sm text-bone placeholder:text-faint outline-none transition-colors focus:border-zest/50";

export function ContactPage() {
  const [sent, setSent] = useState(false);
  const mailTo = "tejassutar.business@gmail.com";
  const [form, setForm] = useState({ name: "", email: "", company: "", size: "1–10", topic: "Sales & upgrades", message: "" });

  const deliver = () => {
    const subject = encodeURIComponent(`[zybble contact] ${form.topic} — ${form.name}`);
    const body = encodeURIComponent(
      [
        `Name: ${form.name}`,
        `Work email: ${form.email}`,
        `Company: ${form.company}`,
        `Team size: ${form.size}`,
        `Topic: ${form.topic}`,
        "",
        form.message,
      ].join("\n")
    );
    window.location.href = `mailto:${mailTo}?subject=${subject}&body=${body}`;
    setSent(true);
  };
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Page title="Contact — zybble">
      <PageHero
        crumb={["company", "contact"]}
        eyebrow="Contact"
        title={
          <>
            Humans answer here.
            <br />
            <span className="text-zest">Fast ones.</span>
          </>
        }
        copy="Sales question, stuck extraction, press inquiry or a partnership idea — pick a channel or use the form. Real replies from the nine people building this."
      />

      {/* channels */}
      <section className="mt-16 sm:mt-20">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          {CHANNELS.map((c, i) => (
            <Reveal key={c.t} delay={i * 0.06}>
              <a
                href={`mailto:${c.mail}`}
                className="group block h-full rounded-2xl border border-line bg-coal p-6 transition-all duration-300 hover:border-zest/35"
              >
                <c.icon className="size-5 text-zest" />
                <h3 className="mt-4 font-display text-base font-semibold text-bone">{c.t}</h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-sage">{c.d}</p>
                <p className="mt-4 font-mono text-[12px] text-zest">{c.mail}</p>
                <p className="mt-1 font-mono text-[9.5px] uppercase tracking-widest text-faint">replies {c.sla}</p>
              </a>
            </Reveal>
          ))}
        </div>
      </section>

      {/* form */}
      <section className="mt-20 sm:mt-28">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.4fr] lg:gap-14 lg:px-8">
          <div>
            <SectionHead
              align="left"
              eyebrow="Write to us"
              title={<>The form goes to <span className="text-zest">a real inbox</span></>}
              copy="No ticketing black hole. Your message lands with the human rostered for this topic this week."
            />
            <Reveal delay={0.15}>
              <div className="mt-8 space-y-3">
                {[
                  { icon: Timer, t: "Median first response", v: "2h 11m" },
                  { icon: Users, t: "Tickets answered by founders", v: "61%" },
                  { icon: Coffee, t: "Auto-responders deployed", v: "0" },
                ].map((s) => (
                  <div key={s.t} className="flex items-center justify-between rounded-xl border border-line bg-coal px-4 py-3.5">
                    <span className="flex items-center gap-2.5 font-mono text-[11px] text-sage">
                      <s.icon className="size-4 text-zest" /> {s.t}
                    </span>
                    <span className="font-mono text-[12px] font-semibold text-bone">{s.v}</span>
                  </div>
                ))}
              </div>
            </Reveal>
            <Reveal delay={0.2}>
              <div className="mt-6 rounded-xl border border-line bg-coal p-5 font-mono text-[11px] leading-[1.9] text-faint">
                zybble hq — 52.5200°N 13.4050°E
                <br />
                remote-first, registered in Berlin.
                <br />
                the map is both our address and our product.
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.1}>
            <div className="sheen rounded-2xl border border-line-strong bg-coal p-6 sm:p-8">
              <AnimatePresence mode="wait">
                {sent ? (
                  <motion.div
                    key="done"
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="grid min-h-[420px] place-items-center"
                  >
                    <div className="text-center">
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.15, type: "spring", stiffness: 260, damping: 16 }}
                        className="mx-auto grid size-16 place-items-center rounded-full border border-zest/40 bg-zest/10"
                      >
                        <CheckCircle2 className="size-8 text-zest" />
                      </motion.span>
                      <h3 className="mt-6 font-display text-2xl font-bold text-bone">Message ready.</h3>
                      <p className="mx-auto mt-3 max-w-sm text-[14px] leading-relaxed text-sage">
                        Thanks {form.name.split(" ")[0] || "friend"} — your mail client just opened
                        with the message pre-filled for the team. Hit send there and it lands
                        straight in our inbox.
                      </p>
                      <p className="mx-auto mt-4 max-w-sm font-mono text-[11px] leading-relaxed text-faint">
                        Mail app didn't open? Write directly to{" "}
                        <a href={`mailto:${mailTo}`} className="text-zest underline decoration-zest/40 underline-offset-4 hover:decoration-zest">
                          {mailTo}
                        </a>
                      </p>
                      <button
                        onClick={() => setSent(false)}
                        className="mt-6 font-mono text-[12px] text-zest underline decoration-zest/40 underline-offset-4 hover:decoration-zest"
                      >
                        send another →
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    exit={{ opacity: 0, scale: 0.97 }}
                    onSubmit={(e) => {
                      e.preventDefault();
                      deliver();
                    }}
                    className="space-y-4"
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Name</label>
                        <input required value={form.name} onChange={set("name")} placeholder="Ada Lovelace" className={inputCls} />
                      </div>
                      <div>
                        <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Work email</label>
                        <input required type="email" value={form.email} onChange={set("email")} placeholder="ada@company.com" className={inputCls} />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Company</label>
                        <input value={form.company} onChange={set("company")} placeholder="Analytical Engines Ltd." className={inputCls} />
                      </div>
                      <div>
                        <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Team size</label>
                        <select value={form.size} onChange={set("size")} className={cn(inputCls, "appearance-none")}>
                          {["1–10", "11–50", "51–200", "200+"].map((s) => (
                            <option key={s} className="bg-coal">{s}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Topic</label>
                      <div className="flex flex-wrap gap-2">
                        {CHANNELS.map((c) => (
                          <button
                            type="button"
                            key={c.t}
                            onClick={() => setForm((f) => ({ ...f, topic: c.t }))}
                            className={cn(
                              "rounded-full border px-3.5 py-2 font-mono text-[11px] transition-all",
                              form.topic === c.t ? "border-zest/50 bg-zest/10 text-zest" : "border-line text-sage hover:text-bone"
                            )}
                          >
                            {c.t}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Message</label>
                      <textarea
                        required
                        value={form.message}
                        onChange={set("message")}
                        rows={5}
                        placeholder="Tell us about your volume, your niche, or the weird edge case…"
                        className="w-full resize-none rounded-xl border border-line bg-ink/60 px-4 py-3.5 text-sm text-bone placeholder:text-faint outline-none transition-colors focus:border-zest/50"
                      />
                    </div>
                    <button
                      type="submit"
                      className="group inline-flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-zest py-3.5 font-display text-[15px] font-semibold text-ink transition-transform duration-300 hover:scale-[1.02] active:scale-[0.98]"
                    >
                      Send message
                      <Send className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </button>
                    <p className="flex items-center justify-center gap-1.5 pt-1 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                      <Mail className="size-3" /> lands in a human inbox, promise
                    </p>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </Reveal>
        </div>
      </section>

      <PageCta
        title="Rather just try the product?"
        copy="Skip the email thread — 50 free leads a month answer most questions faster than we can type."
        button="Start free instead"
      />
    </Page>
  );
}
