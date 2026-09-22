import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "../utils/cn";

/* ---------------- scroll reveal wrapper ---------------- */
export function Reveal({
  children,
  delay = 0,
  y = 28,
  className,
  once = true,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  once?: boolean;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once, margin: "-8% 0px" }}
      transition={{ duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

export const staggerChild: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

/* ---------------- eyebrow label ---------------- */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-line-strong bg-white/[0.03] px-3 py-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-zest sm:text-[11px]",
        className
      )}
    >
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex size-full animate-ping-soft rounded-full bg-zest" />
        <span className="relative inline-flex size-1.5 rounded-full bg-zest" />
      </span>
      {children}
    </span>
  );
}

/* ---------------- section heading ---------------- */
export function SectionHead({
  eyebrow,
  title,
  copy,
  align = "center",
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  copy?: string;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto max-w-3xl",
        align === "center" ? "text-center" : "mx-0 text-left",
        className
      )}
    >
      <Reveal>
        <Eyebrow>{eyebrow}</Eyebrow>
      </Reveal>
      <Reveal delay={0.08}>
        <h2 className="mt-5 font-display text-[1.9rem] font-semibold leading-[1.08] tracking-[-0.02em] text-bone sm:text-4xl lg:text-[3.4rem]">
          {title}
        </h2>
      </Reveal>
      {copy && (
        <Reveal delay={0.16}>
          <p className={cn("mt-5 max-w-2xl text-[15px] leading-relaxed text-sage sm:text-base", align === "center" && "mx-auto")}>
            {copy}
          </p>
        </Reveal>
      )}
    </div>
  );
}

/* ---------------- brand logo ---------------- */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative grid size-8 shrink-0 place-items-center rounded-[10px] border border-line-strong bg-graphite">
        <span className="absolute size-4 rounded-full border-[2px] border-zest/80" />
        <span className="size-1.5 rounded-full bg-zest shadow-[0_0_10px_rgba(201,241,88,0.9)]" />
      </span>
      <span className="font-display text-[1.3rem] font-bold tracking-tight text-bone">
        zybble<span className="text-zest">.</span>
      </span>
    </span>
  );
}

/* ---------------- buttons ---------------- */
export function PrimaryButton({
  children,
  className,
  href = "#pricing",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  href?: string;
  onClick?: () => void;
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      className={cn(
        "group relative inline-flex h-12 items-center justify-center gap-2 overflow-hidden rounded-xl bg-zest px-6 font-display text-[15px] font-semibold text-ink transition-transform duration-300 hover:scale-[1.03] active:scale-[0.97]",
        className
      )}
    >
      <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/50 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      {children}
    </a>
  );
}

export function GhostButton({
  children,
  className,
  href,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  href?: string;
  onClick?: () => void;
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      className={cn(
        "inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line-strong bg-white/[0.03] px-6 font-display text-[15px] font-medium text-bone backdrop-blur transition-all duration-300 hover:border-zest/40 hover:bg-white/[0.06] active:scale-[0.97]",
        className
      )}
    >
      {children}
    </a>
  );
}

/* ---------------- star rating ---------------- */
export function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 font-mono text-xs text-amber", className)}>
      <svg viewBox="0 0 20 20" className="size-3 fill-amber" aria-hidden>
        <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5z" />
      </svg>
      {rating.toFixed(1)}
    </span>
  );
}
