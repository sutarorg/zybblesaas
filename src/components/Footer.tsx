import { AtSign, Globe, MessageSquare, Rss } from "lucide-react";
import { Logo } from "./ui";

const COLS = [
  {
    title: "Product",
    links: ["Live demo", "Data points", "AI Assistant", "Lead lists", "Pricing", "Changelog"],
    hrefs: ["#/live-demo", "#/data-points", "#/ai-assistant", "#/lead-lists", "#/pricing", "#/changelog"],
  },
  {
    title: "Use cases",
    links: ["Agencies", "SaaS sales", "Local marketers", "Recruiters", "Marketplaces"],
    hrefs: ["#/agencies", "#/saas-sales", "#/local-marketers", "#/recruiters", "#/marketplaces"],
  },
  {
    title: "Company",
    links: ["About", "Blog", "Careers", "Press kit", "Contact"],
    hrefs: ["#/about", "#/blog", "#/careers", "#/press-kit", "#/contact"],
  },
  {
    title: "Legal",
    links: ["Privacy", "Terms", "DPA", "Responsible use"],
    hrefs: ["#/privacy", "#/terms", "#/dpa", "#/responsible-use"],
  },
];

export default function Footer() {
  return (
    <footer className="relative border-t border-line bg-coal/40">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_2fr]">
          <div>
            <a href="#/" aria-label="zybble home">
              <Logo />
            </a>
            <p className="mt-5 max-w-xs text-[13.5px] leading-relaxed text-sage">
              The B2B lead generation engine that turns the world's maps into your
              pipeline — live data, deep enrichment, zero babysitting.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-line bg-white/[0.02] px-3 py-1.5">
              <span className="relative flex size-2">
                <span className="absolute size-full animate-ping-soft rounded-full bg-zest" />
                <span className="relative size-2 rounded-full bg-zest" />
              </span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-sage">
                Extraction engine · operational
              </span>
            </div>
            <div className="mt-7 flex gap-2.5">
              {[
                { icon: AtSign, label: "Email", href: "#/contact" },
                { icon: Globe, label: "Home", href: "#/" },
                { icon: MessageSquare, label: "Blog", href: "#/blog" },
                { icon: Rss, label: "Changelog", href: "#/changelog" },
              ].map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  className="grid size-10 place-items-center rounded-lg border border-line text-sage transition-all duration-300 hover:border-zest/40 hover:text-zest"
                >
                  <s.icon className="size-4" />
                </a>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {COLS.map((c) => (
              <div key={c.title}>
                <h4 className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-faint">
                  {c.title}
                </h4>
                <ul className="mt-4 space-y-2.5">
                  {c.links.map((l, i) => (
                    <li key={l}>
                      <a
                        href={c.hrefs[i]}
                        className="text-[13.5px] text-sage transition-colors hover:text-bone"
                      >
                        {l}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-line pt-7 sm:flex-row">
          <p className="font-mono text-[11px] text-faint">
            © 2026 Zybble Inc. All rights reserved.
          </p>
          <p className="text-center font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">
            Live extraction, not stale databases. Use responsibly.
          </p>
        </div>
      </div>
    </footer>
  );
}
