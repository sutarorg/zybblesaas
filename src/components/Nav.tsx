import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { Logo } from "./ui";
import { cn } from "../utils/cn";

const LINKS = [
  { label: "How it works", href: "#how" },
  { label: "Live demo", href: "#demo" },
  { label: "Data", href: "#data" },
  { label: "AI Assistant", href: "#ai" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <motion.header
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        className="fixed inset-x-0 top-0 z-50"
      >
        <div
          className={cn(
            "mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-4 px-4 transition-all duration-500 sm:px-6 lg:px-8",
            scrolled && "h-[60px]"
          )}
        >
          <div
            className={cn(
              "pointer-events-none absolute inset-0 border-b border-transparent transition-all duration-500",
              scrolled && "border-line bg-ink/80 backdrop-blur-xl"
            )}
          />
          <a href="#top" className="relative z-10 shrink-0" aria-label="zybble home">
            <Logo />
          </a>

          <nav className="relative z-10 hidden items-center gap-1 lg:flex">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="rounded-lg px-3.5 py-2 text-[13.5px] font-medium text-sage transition-colors duration-200 hover:bg-white/[0.04] hover:text-bone"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="relative z-10 flex items-center gap-2.5">
            <a
              href="#/signin"
              className="hidden h-10 items-center rounded-lg px-3.5 text-[13.5px] font-medium text-sage transition-colors hover:text-bone sm:inline-flex"
            >
              Sign in
            </a>
            <a
              href="#/signup"
              className="group inline-flex h-10 items-center gap-1.5 rounded-lg bg-zest px-4 font-display text-[13.5px] font-semibold text-ink transition-transform duration-300 hover:scale-[1.04] active:scale-95"
            >
              Start free
              <ArrowUpRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
            <button
              onClick={() => setOpen(true)}
              className="grid size-10 place-items-center rounded-lg border border-line-strong text-bone transition-colors hover:bg-white/[0.05] lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </button>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[90] flex flex-col bg-ink/95 backdrop-blur-2xl lg:hidden"
          >
            <div className="flex h-[68px] items-center justify-between px-4">
              <Logo />
              <button
                onClick={() => setOpen(false)}
                className="grid size-10 place-items-center rounded-lg border border-line-strong text-bone"
                aria-label="Close menu"
              >
                <X className="size-5" />
              </button>
            </div>
            <nav className="flex flex-1 flex-col justify-center gap-1 px-6">
              {LINKS.map((l, i) => (
                <motion.a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  initial={{ opacity: 0, x: -24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.06 * i + 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className="group flex items-center justify-between border-b border-line py-4"
                >
                  <span className="font-display text-3xl font-semibold tracking-tight text-bone">
                    {l.label}
                  </span>
                  <ArrowUpRight className="size-6 text-faint transition-all group-hover:text-zest" />
                </motion.a>
              ))}
            </nav>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.5 }}
              className="space-y-3 p-6 pb-10"
            >
              <a
                href="#/signup"
                onClick={() => setOpen(false)}
                className="flex h-14 w-full items-center justify-center rounded-xl bg-zest font-display text-base font-semibold text-ink"
              >
                Get 50 free leads
              </a>
              <p className="text-center font-mono text-[11px] uppercase tracking-widest text-faint">
                No credit card required
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
