import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Mail,
  Quote,
  Terminal,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Eyebrow, Reveal } from "../components/ui";
import { Crumb, Page, PageCta } from "./ui";
import { cn } from "../utils/cn";

/* ------------------------------------------------------------------ */
/*  content model                                                      */
/* ------------------------------------------------------------------ */

type Block =
  | { t: "h"; s: string }
  | { t: "p"; s: string }
  | { t: "list"; s: string[] }
  | { t: "quote"; s: string }
  | { t: "callout"; s: string };

type Post = {
  slug: string;
  tag: string;
  title: string;
  excerpt: string;
  date: string;
  minutes: number;
  author: string;
  role: string;
  heroLines: string[];
  blocks: Block[];
};

export const POSTS: Post[] = [
  {
    slug: "map-data-lead-generation-guide",
    tag: "Playbooks",
    title: "The complete guide to map-data lead generation in 2026",
    excerpt:
      "Why public map listings beat every database you've ever bought — and the exact workflow to turn any niche + any city into a qualified pipeline in an afternoon.",
    date: "Mar 4, 2026",
    minutes: 9,
    author: "Lena Richter",
    role: "Growth, Zybble",
    heroLines: ["$ zybble find 'dentists in Berlin' --email", "[ok] 312 leads · 276 emails · 88% complete"],
    blocks: [
      {
        t: "p",
        s: "Every lead database decays from the moment it's compiled. Businesses move, rebrand, close, and change phone numbers — a list exported six months ago lies to you with a straight face. Yet one dataset never goes stale, because it's maintained by the businesses themselves: their public map listings.",
      },
      { t: "h", s: "Why map data wins" },
      {
        t: "list",
        s: [
          "Fresh by design — owners update hours, photos and descriptions weekly because customers depend on them.",
          "Complete coverage — 200M+ businesses across 195 countries, including the long-tail SMBs no broker lists.",
          "Reputation attached — ratings, review counts and review velocity are built-in qualification signals.",
          "Reachability — most listings link to an official website where direct emails live, one crawl away.",
        ],
      },
      {
        t: "p",
        s: "The catch used to be access. Reading listings at scale meant proxies, browser automation and anti-bot warfare. That engineering moat is exactly what modern extraction engines solved — which is why map-data lead gen went from hacker trick to default playbook in about two years.",
      },
      { t: "h", s: "The afternoon workflow" },
      {
        t: "p",
        s: "Start with a gap, not a niche. 'Dentists in Berlin' is a list; 'dentists in Berlin rated below 4.2 with no online booking' is a pitch queue. Define the absence your service fixes, turn it into filters, then sweep. Enrich emails from official websites, dedupe against anything you already own, and export.",
      },
      {
        t: "callout",
        s: "Rule of one: one metro, one niche, one angle per list. Segmentation is the entire game — 300 perfectly-targeted leads outperform 3,000 generic ones on every metric that matters.",
      },
      { t: "h", s: "What a good record looks like" },
      {
        t: "p",
        s: "Insist on depth: name, category, full address, coordinates, phone, website, email, rating, review count, rating distribution, hours, price range, owner-claimed status. Thirty-plus fields means you can personalize at the list level — 'your 400th review went up last week' beats 'Hi {first_name}' every single day.",
      },
      { t: "h", s: "Staying smart and compliant" },
      {
        t: "p",
        s: "Reach out as a business to a business, honor opt-outs instantly, use the phone column sparingly, and never resell personal data. Public business contact details exist to be contacted — the pros just do it politely and precisely.",
      },
      {
        t: "quote",
        s: "The best lead list isn't the biggest one. It's the one where every row answers 'why you, why now.'",
      },
    ],
  },
  {
    slug: "cold-email-playbook-smb",
    tag: "Outreach",
    title: "The 9-line cold email playbook that books SMB owners",
    excerpt:
      "SMB owners don't read cold email — they triage it in seconds. This structure survives the triage. Field-tested across 40,000 sends from Zybble-powered lists.",
    date: "Feb 11, 2026",
    minutes: 7,
    author: "Theo Lindgren",
    role: "Co-founder, Zybble",
    heroLines: ["subject: your 4.9★ vs the #2 guy's booking page", "opens 61% · replies 6.4% · meetings 11/400"],
    blocks: [
      {
        t: "p",
        s: "A restaurant owner reads email between lunch prep and a delivery driver argument. You have two glances. Every line of your email must justify the next line's existence.",
      },
      { t: "h", s: "The anatomy" },
      {
        t: "list",
        s: [
          "Line 1 — Observation from their own data: rating jump, review milestone, a booking link that 404s. Proves a human looked.",
          "Line 2 — The gap it creates: 'the #2-rated spot three blocks away takes reservations online; you don't.'",
          "Line 3 — The fix, sized honestly: 'we set that up for two venues on your street.'",
          "Line 4 — A tiny ask: 12 minutes, Thursday, or 'want the 40-second video version?'",
          "Sign-off — name, role, one link. No banners, no signatures with five logos.",
        ],
      },
      {
        t: "p",
        s: "Notice what's missing: your company history, your awards, your feature list. SMB owners buy outcomes within one glance of the subject line. The subject itself should be an observation they want explained: 'your reviews jumped 40 this month' gets opened because it could be from a customer.",
      },
      { t: "h", s: "Where the data comes from" },
      {
        t: "p",
        s: "Every hook above exists in a proper lead record: rating trends, review counts, competitor proximity (coordinates!), missing booking links. This is why map-data enrichment changed cold outreach — personalization stopped being manual research and became list fields.",
      },
      {
        t: "callout",
        s: "Benchmarks from 40,000 sends: observation-first subject lines hit 55–65% opens; gap-in-line-two emails triple reply rates versus template blasts; 12-minute asks book 2× more than 30-minute ones.",
      },
      { t: "h", s: "Follow-ups that don't rot" },
      {
        t: "p",
        s: "Two, maximum three. Each adds new information — a fresh competitor data point, a one-line case result — never 'just bumping this.' If line one of your follow-up could be sent to anyone, delete it and start over.",
      },
      { t: "h", s: "The delusion to drop" },
      {
        t: "quote",
        s: "Volume is not a strategy. Volume × targeting × observation is. Most senders scale the wrong factor.",
      },
      {
        t: "p",
        s: "Build smaller lists with sharper gaps, write honest first lines, and let the math work. When your reply rate holds above 5%, scale the list — not the nerve.",
      },
    ],
  },
  {
    slug: "ai-agents-lead-gen-field-report",
    tag: "Field report",
    title: "AI agents are the new SDRs: a field report from 500 runs",
    excerpt:
      "We let the Assistant plan, sample, enrich and QA 500 lead-gen jobs without human edits. Here's what it got eerily right, where it stumbled, and the final reply-rate numbers.",
    date: "Jan 21, 2026",
    minutes: 11,
    author: "Priya Anand",
    role: "AI / Assistant, Zybble",
    heroLines: ["[09:12:04] brief received — 500 runs queued", "[report] 94% shipped without human edits"],
    blocks: [
      {
        t: "p",
        s: "Between October and December we ran an experiment: five hundred real customer briefs executed end-to-end by the AI Assistant, with humans allowed to observe but not intervene. The question wasn't whether agents can scrape — it's whether an agent can exercise judgment.",
      },
      { t: "h", s: "What eerily worked" },
      {
        t: "list",
        s: [
          "Sector planning — agents split metros into search cells better than our hand-tuned configs. Dense downtowns got finer grids; suburbs got wider sweeps. Hit-rate per query rose 14%.",
          "Sample gating — in 31 runs the agent sampled, found dirty data (closed businesses clustering), re-planned the search terms, and asked for no permission. All 31 re-plans outperformed the originals.",
          "Filter translation — vague briefs ('established-looking agencies') were translated to measurable proxies (reviews ≥ 30, rating ≥ 4.3, owner-claimed) with 96% human agreement in review.",
          "QA diaries — the agent flagged 4% of runs as below its own completeness bar and offered partial exports with explanations. Customers preferred honest partials to silent full ones.",
        ],
      },
      { t: "h", s: "Where it stumbled" },
      {
        t: "p",
        s: "Ambiguous geographies ('the coastal ones near Malaga') produced 9 wasteful runs before we added clarification prompts. Highly-regulated niches sometimes triggered overly conservative filtering that discarded good leads. And once — memorably — it spent 40 minutes finding ' dragons' because a customer typo'd and the agent trusted them completely.",
      },
      { t: "h", s: "The numbers" },
      {
        t: "callout",
        s: "500 runs · 61,240 leads delivered · 94% shipped without edits · median run 3m 40s · downstream reply rate 6.1% vs 4.3% for manually-built lists in the same period.",
      },
      {
        t: "p",
        s: "The reply-rate delta is the headline. Agents don't just save the planning time — their systematic sector coverage finds the long-tail businesses that manual searches skip, and those businesses respond better because everyone's competitors ignored them too.",
      },
      { t: "h", s: "What this means for your team" },
      {
        t: "p",
        s: "The SDR role isn't dying — it's compressing. The winner spends thirty minutes writing an excellent brief and zero minutes babysitting tooling. Skill moves up the stack: from operator to director of a small army of runs.",
      },
      {
        t: "quote",
        s: "The best prospectors of 2026 won't be the hardest workers. They'll be the best brief writers.",
      },
    ],
  },
];

export function getPost(slug: string): Post | undefined {
  return POSTS.find((p) => p.slug === slug);
}

/* ------------------------------------------------------------------ */
/*  /blog index                                                        */
/* ------------------------------------------------------------------ */

export function BlogPage() {
  const [sub, setSub] = useState(false);
  const [featured, ...rest] = POSTS;
  return (
    <Page title="Blog — zybble">
      <section className="relative pt-[118px] sm:pt-[136px]">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px]">
          <div className="absolute left-1/2 top-[-240px] h-[480px] w-[760px] -translate-x-1/2 rounded-full bg-zest/[0.06] blur-[130px]" />
        </div>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal className="flex justify-center"><Crumb trail={["company", "blog"]} /></Reveal>
            <Reveal delay={0.06} className="mt-5"><Eyebrow>The pipeline papers</Eyebrow></Reveal>
            <Reveal delay={0.12}>
              <h1 className="mt-6 font-display text-[2.3rem] font-bold leading-[1.04] tracking-[-0.025em] text-bone sm:text-5xl lg:text-6xl">
                Playbooks from the <span className="text-zest">lead mines</span>
              </h1>
            </Reveal>
            <Reveal delay={0.2}>
              <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-sage sm:text-base">
                Field-tested prospecting systems, outreach math and honest field reports
                from inside the engine. No listicles. No filler.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* featured */}
      <section className="mt-14 sm:mt-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <a
              href={`#/blog/${featured.slug}`}
              className="group grid overflow-hidden rounded-3xl border border-line-strong bg-coal transition-colors hover:border-zest/35 lg:grid-cols-[1.2fr_1fr]"
            >
              <div className="p-7 sm:p-10">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="rounded-full bg-zest px-2.5 py-1 font-mono text-[9.5px] font-bold uppercase tracking-wider text-ink">Featured</span>
                  <span className="rounded-full border border-line px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-wider text-sage">{featured.tag}</span>
                  <span className="font-mono text-[10px] text-faint">{featured.date} · {featured.minutes} min</span>
                </div>
                <h2 className="mt-5 font-display text-2xl font-bold leading-tight tracking-tight text-bone transition-colors group-hover:text-zest sm:text-3xl">
                  {featured.title}
                </h2>
                <p className="mt-4 max-w-lg text-[14px] leading-relaxed text-sage">{featured.excerpt}</p>
                <span className="mt-7 inline-flex items-center gap-2 font-display text-sm font-semibold text-zest">
                  Read the guide <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
              <div className="relative hidden min-h-[260px] border-l border-line bg-ink/60 lg:block">
                <div className="absolute inset-0 map-grid opacity-70" />
                <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 space-y-2 rounded-xl border border-line bg-ink/80 p-4 font-mono text-[11px] shadow-2xl">
                  <p className="text-zest">$ {featured.heroLines[0].slice(2)}</p>
                  <p className="text-sage">{featured.heroLines[1]}</p>
                  <p className="text-faint">_ exporting…</p>
                </div>
              </div>
            </a>
          </Reveal>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {rest.map((p, i) => (
              <Reveal key={p.slug} delay={i * 0.08}>
                <a href={`#/blog/${p.slug}`} className="group flex h-full flex-col rounded-3xl border border-line bg-coal p-7 transition-colors hover:border-zest/35 sm:p-8">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="rounded-full border border-zest/30 bg-zest/[0.06] px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-wider text-zest">{p.tag}</span>
                    <span className="font-mono text-[10px] text-faint">{p.date} · {p.minutes} min</span>
                  </div>
                  <h3 className="mt-4 font-display text-xl font-bold leading-snug tracking-tight text-bone transition-colors group-hover:text-zest sm:text-2xl">
                    {p.title}
                  </h3>
                  <p className="mt-3 flex-1 text-[13.5px] leading-relaxed text-sage">{p.excerpt}</p>
                  <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
                    <span className="font-mono text-[10.5px] text-faint">{p.author} · {p.role}</span>
                    <ArrowRight className="size-4 text-faint transition-all group-hover:translate-x-1 group-hover:text-zest" />
                  </div>
                </a>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* newsletter */}
      <section className="mt-20 sm:mt-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <Reveal>
            <div className="sheen rounded-3xl border border-line-strong bg-coal p-8 text-center sm:p-10">
              <Mail className="mx-auto size-6 text-zest" />
              <h3 className="mt-4 font-display text-2xl font-bold tracking-tight text-bone">
                One playbook a month. <span className="text-zest">Zero fluff.</span>
              </h3>
              <p className="mx-auto mt-3 max-w-md text-[14px] leading-relaxed text-sage">
                Join 12,000+ prospectors. Unsubscribe in one click whenever it stops earning its keep.
              </p>
              {sub ? (
                <motion.p
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mx-auto mt-7 flex max-w-sm items-center justify-center gap-2.5 rounded-xl border border-zest/40 bg-zest/10 px-5 py-4 font-mono text-[12.5px] text-zest"
                >
                  <CheckCircle2 className="size-4.5" /> you're on the list — see you next month
                </motion.p>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setSub(true);
                  }}
                  className="mx-auto mt-7 flex max-w-md flex-col gap-2.5 sm:flex-row"
                >
                  <input required type="email" placeholder="you@company.com" className="h-12 flex-1 rounded-xl border border-line bg-ink/70 px-4 text-sm text-bone placeholder:text-faint outline-none transition-colors focus:border-zest/50" />
                  <button className="h-12 rounded-xl bg-zest px-6 font-display text-sm font-semibold text-ink transition-transform hover:scale-[1.04] active:scale-95">
                    Subscribe
                  </button>
                </form>
              )}
            </div>
          </Reveal>
        </div>
      </section>

      <PageCta />
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/*  /blog/:slug article                                                */
/* ------------------------------------------------------------------ */

export function ArticlePage({ slug }: { slug: string }) {
  const post = getPost(slug);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!post) {
    return (
      <Page title="Not found — zybble blog">
        <div className="grid min-h-[60vh] place-items-center px-4 pt-[118px]">
          <div className="text-center">
            <p className="font-mono text-sm text-zest">404</p>
            <h1 className="mt-3 font-display text-3xl font-bold text-bone">This post pulled a Houdini.</h1>
            <a href="#/blog" className="mt-6 inline-flex items-center gap-2 font-mono text-sm text-zest underline decoration-zest/40 underline-offset-4">
              <ArrowLeft className="size-4" /> back to the blog
            </a>
          </div>
        </div>
      </Page>
    );
  }

  const next = POSTS[(POSTS.indexOf(post) + 1) % POSTS.length];

  return (
    <Page title={`${post.title} — zybble blog`}>
      {/* progress bar */}
      <div className="fixed inset-x-0 top-0 z-[60] h-[3px] bg-white/[0.04]">
        <div className="h-full bg-gradient-to-r from-zest-dim to-zest" style={{ width: `${progress * 100}%` }} />
      </div>

      <article className="pt-[118px] sm:pt-[136px]">
        <header className="mx-auto max-w-3xl px-4 sm:px-6">
          <Reveal><Crumb trail={["company", "blog", post.tag.toLowerCase()]} /></Reveal>
          <Reveal delay={0.06} className="mt-6">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="rounded-full border border-zest/30 bg-zest/[0.06] px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-wider text-zest">{post.tag}</span>
              <span className="flex items-center gap-1.5 font-mono text-[10.5px] text-faint"><CalendarDays className="size-3.5" />{post.date}</span>
              <span className="flex items-center gap-1.5 font-mono text-[10.5px] text-faint"><Clock3 className="size-3.5" />{post.minutes} min read</span>
            </div>
          </Reveal>
          <Reveal delay={0.12}>
            <h1 className="mt-6 font-display text-[2rem] font-bold leading-[1.08] tracking-[-0.02em] text-bone sm:text-5xl">
              {post.title}
            </h1>
          </Reveal>
          <Reveal delay={0.18}>
            <p className="mt-5 text-[15px] leading-relaxed text-sage sm:text-base">{post.excerpt}</p>
          </Reveal>
          <Reveal delay={0.24}>
            <div className="mt-8 rounded-2xl border border-line-strong bg-[#0a0d0b] p-4 font-mono text-[11.5px] shadow-2xl sm:p-5">
              <div className="mb-3 flex items-center gap-2 border-b border-line pb-3">
                <Terminal className="size-3.5 text-zest" />
                <span className="text-faint">exhibit A — straight from the engine</span>
              </div>
              {post.heroLines.map((l, i) => (
                <motion.p
                  key={l}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4 + i * 0.25 }}
                  className={cn("py-0.5", i === 0 ? "text-zest" : "text-sage")}
                >
                  {l}
                </motion.p>
              ))}
            </div>
          </Reveal>
          <Reveal delay={0.3}>
            <div className="mt-8 flex items-center gap-3 border-y border-line py-4">
              <span className="grid size-10 place-items-center rounded-xl border border-zest/25 bg-zest/[0.08] font-display text-sm font-bold text-zest">
                {post.author.split(" ").map((w) => w[0]).join("")}
              </span>
              <div>
                <p className="text-[13.5px] font-semibold text-bone">{post.author}</p>
                <p className="font-mono text-[10px] uppercase tracking-wider text-faint">{post.role}</p>
              </div>
              <TrendingUp className="ml-auto size-4 text-faint" />
            </div>
          </Reveal>
        </header>

        <div className="mx-auto max-w-3xl px-4 pb-8 pt-12 sm:px-6">
          {post.blocks.map((b, i) => {
            switch (b.t) {
              case "h":
                return (
                  <Reveal key={i} y={14}>
                    <h2 className="mb-4 mt-12 flex items-baseline gap-3 font-display text-2xl font-bold tracking-tight text-bone">
                      <span className="text-zest">#</span> {b.s}
                    </h2>
                  </Reveal>
                );
              case "p":
                return (
                  <Reveal key={i} y={14}>
                    <p className="mb-6 text-[15px] leading-[1.9] text-sage sm:text-[15.5px]">{b.s}</p>
                  </Reveal>
                );
              case "list":
                return (
                  <Reveal key={i} y={14}>
                    <ul className="mb-6 space-y-3">
                      {(b as { s: string[] }).s.map((li) => (
                        <li key={li.slice(0, 24)} className="flex items-start gap-3 rounded-xl border border-line bg-coal px-4 py-3.5 text-[14px] leading-relaxed text-sage">
                          <Zap className="mt-1 size-4 shrink-0 text-zest" />
                          {li}
                        </li>
                      ))}
                    </ul>
                  </Reveal>
                );
              case "callout":
                return (
                  <Reveal key={i} y={14}>
                    <div className="mb-6 rounded-2xl border border-zest/30 bg-zest/[0.05] p-6">
                      <p className="font-mono text-[13px] leading-[1.85] text-bone">{b.s}</p>
                    </div>
                  </Reveal>
                );
              case "quote":
                return (
                  <Reveal key={i} y={14}>
                    <figure className="my-10 border-l-2 border-zest pl-6">
                      <Quote className="mb-3 size-5 text-zest/60" />
                      <blockquote className="font-display text-xl font-semibold leading-snug text-bone sm:text-2xl">
                        {b.s}
                      </blockquote>
                    </figure>
                  </Reveal>
                );
            }
          })}
        </div>

        {/* next post */}
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <a href={`#/blog/${next.slug}`} className="group block rounded-2xl border border-line bg-coal p-6 transition-colors hover:border-zest/35 sm:p-8">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">read next</p>
            <p className="mt-3 flex items-center justify-between gap-4 font-display text-xl font-bold tracking-tight text-bone transition-colors group-hover:text-zest">
              {next.title}
              <ArrowRight className="size-5 shrink-0 text-zest transition-transform group-hover:translate-x-1" />
            </p>
          </a>
        </div>
      </article>

      <PageCta title="Every playbook starts with a list" copy="Put this article to work — pull 50 free leads with the exact fields we wrote about." />
    </Page>
  );
}
