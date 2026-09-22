import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Mail } from "lucide-react";
import { Eyebrow } from "./ui";

export default function Cta() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <section id="cta" className="relative mt-24 scroll-mt-24 py-24 sm:mt-36 sm:py-32">
      {/* glow + rings */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[520px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-zest/[0.08] blur-[130px]" />
        {[300, 460, 640].map((s) => (
          <div
            key={s}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.05]"
            style={{ width: s, height: s }}
          />
        ))}
      </div>

      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <Eyebrow>Free forever plan</Eyebrow>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 28, filter: "blur(8px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 font-display text-[2.3rem] font-bold leading-[1.05] tracking-[-0.025em] text-bone sm:text-6xl"
        >
          Your next 50 customers
          <br />
          <span className="text-zest">are already on the map.</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-sage sm:text-base"
        >
          Drop your email, name a niche and a city — your first enriched lead list lands
          in minutes. No card, no sales call, no strings.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mt-9 max-w-md"
        >
          <AnimatePresence mode="wait">
            {sent ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-center justify-center gap-3 rounded-2xl border border-zest/40 bg-zest/10 px-6 py-5"
              >
                <CheckCircle2 className="size-6 shrink-0 text-zest" />
                <div className="text-left">
                  <p className="font-display text-[15px] font-semibold text-bone">You're in.</p>
                  <p className="font-mono text-[11.5px] text-sage">
                    50 free leads are warming up for {email || "you"} →
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (email.trim()) setSent(true);
                }}
                className="flex flex-col gap-2.5 sm:flex-row"
              >
                <div className="relative flex-1">
                  <Mail className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-faint" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="h-13 w-full rounded-xl border border-line-strong bg-coal/80 py-3.5 pl-11 pr-4 text-sm text-bone placeholder:text-faint outline-none backdrop-blur transition-colors focus:border-zest/50"
                  />
                </div>
                <button
                  type="submit"
                  className="group inline-flex h-13 items-center justify-center gap-2 rounded-xl bg-zest px-6 py-3.5 font-display text-[15px] font-semibold text-ink transition-transform duration-300 hover:scale-[1.04] active:scale-95"
                >
                  Get my 50 leads
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              </motion.form>
            )}
          </AnimatePresence>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
            4,300+ teams pulled lists this week
          </p>
        </motion.div>
      </div>
    </section>
  );
}
