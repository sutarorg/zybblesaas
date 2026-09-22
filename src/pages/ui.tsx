import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Eyebrow, PrimaryButton, Reveal } from "../components/ui";
import { useTitle } from "../lib/router";
import { cn } from "../utils/cn";

/* ---------------- page wrapper (sets title) ---------------- */
export function Page({ title, children }: { title: string; children: ReactNode }) {
  useTitle(title);
  return <main className="relative overflow-x-clip">{children}</main>;
}

/* ---------------- breadcrumb ---------------- */
export function Crumb({ trail }: { trail: string[] }) {
  return (
    <nav className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">
      <a href="#/" className="transition-colors hover:text-zest">
        home
      </a>
      {trail.map((t, i) => (
        <span key={t} className="flex items-center gap-1.5">
          <ChevronRight className="size-3" />
          <span className={i === trail.length - 1 ? "text-sage" : ""}>{t}</span>
        </span>
      ))}
    </nav>
  );
}

/* ---------------- flexible page hero with motif slot ---------------- */
export function PageHero({
  eyebrow,
  crumb,
  title,
  copy,
  motif,
  align = "center",
  className,
}: {
  eyebrow: string;
  crumb: string[];
  title: ReactNode;
  copy: string;
  motif?: ReactNode;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <section className={cn("relative pt-[118px] sm:pt-[136px]", className)}>
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px]">
        <div className="absolute left-1/2 top-[-240px] h-[480px] w-[760px] -translate-x-1/2 rounded-full bg-zest/[0.06] blur-[130px]" />
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className={cn("mx-auto max-w-3xl", align === "center" ? "text-center" : "mx-0 text-left")}>
          <Reveal className={cn(align === "center" && "flex justify-center")}>
            <Crumb trail={crumb} />
          </Reveal>
          <Reveal delay={0.06} className="mt-5">
            <Eyebrow>{eyebrow}</Eyebrow>
          </Reveal>
          <Reveal delay={0.12}>
            <h1 className="mt-6 font-display text-[2.3rem] font-bold leading-[1.04] tracking-[-0.025em] text-bone sm:text-5xl lg:text-6xl">
              {title}
            </h1>
          </Reveal>
          <Reveal delay={0.2}>
            <p className={cn("mt-5 max-w-2xl text-[15px] leading-relaxed text-sage sm:text-base", align === "center" && "mx-auto")}>
              {copy}
            </p>
          </Reveal>
        </div>
        {motif && (
          <Reveal delay={0.28} y={40} className="mx-auto mt-12 max-w-5xl">
            {motif}
          </Reveal>
        )}
      </div>
    </section>
  );
}

/* ---------------- end-of-page CTA band ---------------- */
export function PageCta({
  title = "Ready to fill your pipeline?",
  copy = "Start with 50 free leads every month. No credit card, no sales call — your first list lands in minutes.",
  button = "Get 50 free leads",
}: {
  title?: string;
  copy?: string;
  button?: string;
}) {
  return (
    <section className="relative mt-24 py-20 sm:mt-32 sm:py-24">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/2 h-[340px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-zest/[0.07] blur-[110px]" />
      </div>
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <Reveal>
          <div className="sheen rounded-3xl border border-line-strong bg-coal px-6 py-12 sm:px-12 sm:py-14">
            <h2 className="font-display text-3xl font-bold tracking-tight text-bone sm:text-4xl">{title}</h2>
            <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-sage">{copy}</p>
            <div className="mt-8 flex justify-center">
              <PrimaryButton href="#cta" className="w-full sm:w-auto">
                {button}
              </PrimaryButton>
            </div>
            <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
              free forever plan · cancel anytime
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- inline stat row ---------------- */
export function StatsRow({ items }: { items: [string, string][] }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
      {items.map(([v, l]) => (
        <div key={l} className="group flex flex-col bg-coal px-5 py-6 transition-colors hover:bg-graphite">
          <dd className="font-display text-2xl font-bold tracking-tight text-bone sm:text-3xl">
            {v}
          </dd>
          <dt className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">{l}</dt>
        </div>
      ))}
    </dl>
  );
}

/* ---------------- doc section (legal) ---------------- */
export function DocSection({
  id,
  n,
  title,
  children,
}: {
  id: string;
  n: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 border-b border-line py-8 sm:py-9">
      <h3 className="flex items-baseline gap-3 font-display text-lg font-semibold tracking-tight text-bone sm:text-xl">
        <span className="font-mono text-xs font-medium text-zest">{n}</span>
        {title}
      </h3>
      <div className="mt-4 space-y-3.5 text-[13.5px] leading-[1.8] text-sage sm:text-sm">{children}</div>
    </section>
  );
}
