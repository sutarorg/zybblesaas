import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { INITIAL_JOBS, slugify, type Job } from "./data";

type CreateJobInput = {
  query: string;
  city?: string;
  planned?: number;
  source?: "manual" | "ai";
  flags?: Partial<Job["flags"]>;
  firstLog?: string[];
};

type EngineCtx = {
  jobs: Job[];
  createJob: (input: CreateJobInput) => Job;
  toggle: (slug: string) => void;
  rerun: (slug: string) => void;
  get: (slug: string) => Job | undefined;
};

const Ctx = createContext<EngineCtx | null>(null);

function nowStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

const LOG_POOL = (j: Job): string[] => {
  const pct = Math.round((j.processed / Math.max(1, j.planned)) * 100);
  return [
    `sweeping sectors — ${pct}% of planned candidates processed`,
    `sector cluster dense, split at zoom ${j.flags.fastMode ? 16 : 15}`,
    `${j.found} candidates captured so far`,
    j.flags.email ? `crawling official sites — email hit-rate ${Math.round((j.emails / Math.max(1, j.found)) * 100)}%` : "skipping email crawl (flag off)",
    `dedupe pass — ${Math.floor(j.found * 0.014)} fingerprints merged`,
    `throughput steady at ~${104 + Math.floor(Math.random() * 24)} places/min`,
    `proxy rotation healthy — 0 blocks this run`,
  ];
};

export function EngineProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>(INITIAL_JOBS);
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;

  useEffect(() => {
    const iv = setInterval(() => {
      setJobs((prev) => {
        let runningCount = prev.filter((j) => j.status === "running").length;
        let promoted = false;
        return prev.map((j) => {
          // promote queued jobs while capacity allows
          if (j.status === "queued" && runningCount < 2) {
            runningCount++;
            promoted = true;
            return { ...j, status: "running" as const, log: [...j.log, `[${nowStamp()}] slot free — sweep started`] };
          }
          if (j.status !== "running") return j;
          const step = 5 + Math.floor(Math.random() * 8);
          const processed = Math.min(j.planned, j.processed + step);
          const found = Math.min(processed - 3, j.found + step - 1 + Math.floor(Math.random() * 3));
          const emails = j.flags.email
            ? Math.min(found, j.emails + Math.round(step * (0.68 + Math.random() * 0.18)))
            : j.emails;
          const done = processed >= j.planned;
          const extraLogs: string[] = [];
          if (Math.random() > 0.55 && !done) {
            const line = LOG_POOL(j)[Math.floor(Math.random() * 7)];
            extraLogs.push(`[${nowStamp()}] ${line}`);
          }
          if (done) {
            extraLogs.push(`[${nowStamp()}] dedupe final — ${Math.max(1, Math.round(found * 0.02))} duplicates merged`);
            extraLogs.push(`[${nowStamp()}] ✔ complete — ${found} leads · ${j.flags.email ? `${emails} emails` : "email crawl skipped"} · list ready`);
          }
          return {
            ...j,
            status: done ? ("complete" as const) : j.status,
            processed,
            found,
            emails,
            etaMin: done ? 0 : Math.max(0, Math.ceil((j.planned - processed) / 70)),
            listSlug: done && !j.listSlug ? slugify(j.query) : j.listSlug,
            log: [...j.log, ...extraLogs].slice(-40),
          };
        });
        void promoted;
      });
    }, 1400);
    return () => clearInterval(iv);
  }, []);

  const createJob = (input: CreateJobInput): Job => {
    const planned = input.planned ?? 240 + Math.floor(Math.random() * 160);
    const base = slugify(input.query) || "search";
    let slug = base;
    let n = 2;
    while (jobsRef.current.some((j) => j.slug === slug)) slug = `${base}-${n++}`;
    const job: Job = {
      slug,
      query: input.query,
      city: input.city ?? input.query.replace(/^.*?\bin\s+/i, ""),
      status: "queued",
      planned,
      processed: 0,
      found: 0,
      emails: 0,
      createdLabel: "just now",
      duration: "—",
      etaMin: Math.ceil(planned / 110),
      source: input.source ?? "manual",
      flags: { email: true, fastMode: false, depth: 10, radius: 10, lang: "en", ...input.flags },
      log: [
        `[${nowStamp()}] ${input.source === "ai" ? "brief planned by AI — sector plan approved" : "run queued"} — ${Math.max(6, Math.round(planned / 28))} sectors × zoom 15`,
        ...(input.firstLog ?? []),
      ],
    };
    setJobs((p) => [job, ...p]);
    return job;
  };

  const toggle = (slug: string) =>
    setJobs((p) =>
      p.map((j) => {
        if (j.slug !== slug) return j;
        if (j.status === "running")
          return { ...j, status: "paused" as const, log: [...j.log, `[${nowStamp()}] ⏸ paused by user — resumable from current sector`].slice(-40) };
        if (j.status === "paused")
          return { ...j, status: "running" as const, log: [...j.log, `[${nowStamp()}] ▶ resumed — continuing from checkpoint`].slice(-40) };
        return j;
      })
    );

  const rerun = (slug: string) =>
    setJobs((p) =>
      p.map((j) =>
        j.slug === slug && (j.status === "failed" || j.status === "complete" || j.status === "paused")
          ? {
              ...j,
              status: "queued" as const,
              processed: 0,
              found: 0,
              emails: 0,
              etaMin: Math.ceil(j.planned / 110),
              flags: { ...j.flags, fastMode: false },
              log: [...j.log, `[${nowStamp()}] re-run queued — standard mode, fresh credentials`].slice(-40),
            }
          : j
      )
    );

  const get = (slug: string) => jobs.find((j) => j.slug === slug);

  return <Ctx.Provider value={{ jobs, createJob, toggle, rerun, get }}>{children}</Ctx.Provider>;
}

export function useEngine(): EngineCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useEngine outside provider");
  return ctx;
}
