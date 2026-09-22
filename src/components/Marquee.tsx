import { Search } from "lucide-react";
import { TICKER_ITEMS } from "../lib/data";

export default function Marquee() {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <section aria-label="Example searches" className="relative mt-16 sm:mt-24">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-ink to-transparent sm:w-32" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-ink to-transparent sm:w-32" />
      <div className="overflow-hidden border-y border-line bg-coal/60 py-4">
        <div className="flex w-max animate-marquee gap-3 pr-3 hover:[animation-play-state:paused]">
          {items.map((t, i) => (
            <span
              key={i}
              className="inline-flex shrink-0 items-center gap-2.5 rounded-full border border-line bg-white/[0.02] px-4 py-2 font-mono text-xs text-sage transition-colors hover:border-zest/30 hover:text-bone"
            >
              <Search className="size-3 text-zest/70" />
              {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
