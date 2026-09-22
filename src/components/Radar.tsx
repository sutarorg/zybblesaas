import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Mail, MapPin, Phone, Star } from "lucide-react";
import { generateLeads, type Lead } from "../lib/data";

const PINS = [
  { x: 14, y: 28, d: 0.6 },
  { x: 27, y: 56, d: 1.4 },
  { x: 22, y: 74, d: 2.3 },
  { x: 40, y: 20, d: 0.9 },
  { x: 47, y: 45, d: 1.9 },
  { x: 38, y: 70, d: 2.7 },
  { x: 60, y: 30, d: 1.1 },
  { x: 66, y: 58, d: 2.1 },
  { x: 57, y: 78, d: 3.0 },
  { x: 74, y: 42, d: 0.4 },
  { x: 80, y: 70, d: 2.5 },
  { x: 86, y: 22, d: 1.7 },
];

function FeedLine({ lead, stamp }: { lead: Lead; stamp: string }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-xl border border-line bg-white/[0.025] p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-[13px] font-medium text-bone">{lead.name}</p>
        <span className="font-mono text-[10px] text-faint">{stamp}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        {lead.email ? (
          <span className="inline-flex items-center gap-1 font-mono text-[10.5px] text-zest">
            <Mail className="size-3" />
            {lead.email}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 font-mono text-[10.5px] text-sage">
            <Phone className="size-3" />
            {lead.phone}
          </span>
        )}
        <span className="inline-flex items-center gap-1 font-mono text-[10.5px] text-amber">
          <Star className="size-3 fill-amber" />
          {lead.rating.toFixed(1)} ({lead.reviews})
        </span>
      </div>
    </motion.div>
  );
}

const stampFor = (id: number) => {
  const s = (12 * 3600 + 4 * 60 + id * 7) % 86400;
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
};

export default function Radar() {
  const pool = useMemo(() => generateLeads("dentists in Berlin", 30), []);
  const [visible, setVisible] = useState<{ id: number; li: number }[]>([
    { id: 0, li: 0 },
    { id: 1, li: 1 },
    { id: 2, li: 2 },
  ]);
  const idx = useRef(3);
  const [tick, setTick] = useState(0);
  const [found, setFound] = useState(59);

  useEffect(() => {
    const iv = setInterval(() => {
      setVisible((v) => {
        const next = [{ id: idx.current, li: idx.current % pool.length }, ...v].slice(0, 3);
        idx.current += 1;
        return next;
      });
      setFound((f) => (f >= 312 ? 59 : f + Math.floor(Math.random() * 17) + 6));
    }, 1700);
    const t = setInterval(() => setTick((n) => n + 1), 220);
    return () => {
      clearInterval(iv);
      clearInterval(t);
    };
  }, [pool]);

  const lat = 52.52 + Math.sin(tick / 6) * 0.0112;
  const lng = 13.405 + Math.cos(tick / 6) * 0.0141;

  return (
    <div className="always-dark sheen overflow-hidden rounded-2xl border border-line-strong bg-coal shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)] sm:rounded-3xl">
      {/* window chrome */}
      <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-white/10" />
            <span className="size-2.5 rounded-full bg-white/10" />
            <span className="size-2.5 rounded-full bg-zest/70" />
          </div>
          <span className="hidden font-mono text-[10.5px] text-faint sm:block">
            zybble://console/extraction-4821
          </span>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-zest/25 bg-zest/[0.06] px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-widest text-zest">
          <span className="relative flex size-1.5">
            <span className="absolute size-full animate-ping-soft rounded-full bg-zest" />
            <span className="relative size-1.5 rounded-full bg-zest" />
          </span>
          Live scan
        </span>
      </div>

      <div className="grid lg:grid-cols-[1.45fr_1fr]">
        {/* ------------------------------ map pane ------------------------------ */}
        <div className="relative min-h-[340px] overflow-hidden sm:min-h-[420px] lg:min-h-[480px]">
          <div className="absolute inset-0 map-streets" />
          <div className="absolute inset-0 map-grid" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(201,241,88,0.05),transparent_65%)]" />

          {/* radar assembly */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="relative size-[290px] sm:size-[380px]">
              {[100, 74, 48].map((s) => (
                <span
                  key={s}
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.07]"
                  style={{ width: `${s}%`, height: `${s}%` }}
                />
              ))}
              <span className="absolute left-1/2 top-0 h-1/2 w-px bg-white/10" />
              <span className="absolute left-0 top-1/2 h-px w-1/2 bg-white/10" />
              {/* sweep */}
              <div
                className="absolute inset-0 animate-radar rounded-full"
                style={{
                  background:
                    "conic-gradient(from 0deg, transparent 0deg, rgba(201,241,88,0.22) 42deg, rgba(201,241,88,0.55) 58deg, transparent 62deg)",
                }}
              />
              <span className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zest shadow-[0_0_20px_rgba(201,241,88,0.9)]" />
            </div>
          </div>

          {/* pins */}
          {PINS.map((p, i) => (
            <div
              key={i}
              className="absolute -translate-x-1/2 -translate-y-full animate-pin-pop"
              style={{ left: `${p.x}%`, top: `${p.y}%`, animationDelay: `${p.d + 0.8}s` }}
            >
              <span className="relative block">
                {i % 3 === 0 && (
                  <span className="absolute -inset-2 animate-ping-soft rounded-full bg-zest/25" style={{ animationDelay: `${p.d}s` }} />
                )}
                <MapPin
                  className="size-4 fill-zest text-ink drop-shadow-[0_0_8px_rgba(201,241,88,0.7)] sm:size-[18px]"
                  strokeWidth={1.5}
                />
              </span>
            </div>
          ))}

          {/* scanline */}
          <div className="pointer-events-none absolute inset-x-8 top-4 h-16 overflow-hidden">
            <div className="h-px w-full animate-scan-y bg-gradient-to-r from-transparent via-zest/40 to-transparent" />
          </div>

          {/* HUD */}
          <div className="pointer-events-none absolute inset-0 p-4 sm:p-5">
            <div className="absolute left-4 top-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-faint">
              <span className="text-zest">◈</span> sector 07 · berlin-mitte
            </div>
            <div className="absolute right-4 top-4 font-mono text-[10px] tracking-wider text-faint">
              {lat.toFixed(4)}°N {lng.toFixed(4)}°E
            </div>
            <div className="absolute bottom-4 left-4 hidden items-center gap-4 font-mono text-[10px] text-faint sm:flex">
              <span>depth 12</span>
              <span>radius 10 km</span>
              <span className="text-zest-dim">proxy pool: healthy</span>
            </div>
          </div>
        </div>

        {/* ------------------------------ feed pane ------------------------------ */}
        <div className="flex min-h-[300px] flex-col border-t border-line bg-ink/40 lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
            <div className="min-w-0">
              <p className="truncate font-mono text-[11px] text-sage">
                “dentists in Berlin” + email
              </p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-faint">
                live extraction feed
              </p>
            </div>
            <span className="shrink-0 rounded-md bg-zest/10 px-2 py-1 font-mono text-[11px] font-semibold text-zest">
              {found} found
            </span>
          </div>

          <div className="flex-1 space-y-2 overflow-hidden p-3 sm:p-4">
            <AnimatePresence initial={false} mode="popLayout">
              {visible.map((item) => (
                <FeedLine key={item.id} lead={pool[item.li]} stamp={stampFor(item.id)} />
              ))}
            </AnimatePresence>
          </div>

          <div className="border-t border-line px-4 py-3.5 sm:px-5">
            <div className="flex items-center justify-between font-mono text-[10.5px] text-sage">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-3 animate-spin text-zest" />
                crawling official sites for emails…
              </span>
              <span className="text-zest">68%</span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-zest-dim to-zest transition-all duration-1000" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
