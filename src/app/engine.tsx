import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, ApiError, type Job } from "../lib/api";
import { supabase } from "../lib/supabase";
import { useSession } from "./session";

/**
 * Live search state.
 *
 * The list is the real `/api/searches` payload. While anything is queued or
 * running the app also listens to Supabase Realtime for row changes and polls
 * as a fallback, so progress shown in the UI is the worker's own progress —
 * never a client-side animation.
 */

type CreateJobInput = {
  query: string;
  city?: string;
  planned?: number;
  source?: "manual" | "ai";
  flags?: Partial<{ email: boolean; fastMode: boolean; depth: number; radius: number; lang: string; grid: boolean; extraReviews: boolean }>;
  aiPlan?: Record<string, unknown> | null;
  name?: string;
};

type EngineCtx = {
  jobs: Job[];
  loading: boolean;
  error: string | null;
  liveCount: number;
  refresh: () => Promise<void>;
  createJob: (input: CreateJobInput) => Promise<Job>;
  toggle: (slug: string) => Promise<void>;
  rerun: (slug: string) => Promise<void>;
  cancel: (slug: string) => Promise<void>;
  rename: (slug: string, name: string) => Promise<void>;
  remove: (slug: string) => Promise<void>;
  get: (slug: string) => Job | undefined;
};

const Ctx = createContext<EngineCtx | null>(null);

const ACTIVE = new Set(["queued", "running", "paused"]);

export function EngineProvider({ children }: { children: ReactNode }) {
  const { status, me } = useSession();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef(false);
  const workspaceId = me?.workspace?.id ?? null;

  const refresh = useCallback(async () => {
    if (status !== "signed_in" || inflight.current) return;
    inflight.current = true;
    try {
      const page = await api.searches.list({ limit: 100 });
      setJobs(page.items);
      setError(null);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not load your searches");
    } finally {
      inflight.current = false;
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    if (status !== "signed_in") {
      setJobs([]);
      setLoading(status === "loading");
      return;
    }
    void refresh();
  }, [refresh, status]);

  // Realtime: the worker updates search rows, so a row change is progress.
  useEffect(() => {
    const client = supabase;
    if (!client || !workspaceId || status !== "signed_in") return;
    const channel = client
      .channel(`searches:${workspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "searches", filter: `workspace_id=eq.${workspaceId}` }, () => {
        void refresh();
      })
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [refresh, status, workspaceId]);

  // Polling fallback (and the only source of truth when Realtime is off).
  useEffect(() => {
    if (status !== "signed_in") return;
    const hasActive = jobs.some((job) => ACTIVE.has(job.status));
    const interval = window.setInterval(() => void refresh(), hasActive ? 5_000 : 30_000);
    return () => window.clearInterval(interval);
  }, [jobs, refresh, status]);

  const createJob = useCallback(
    async (input: CreateJobInput): Promise<Job> => {
      const flags = input.flags ?? {};
      const response = await api.searches.create({
        query: input.query.trim(),
        name: input.name,
        location: input.city?.trim() || undefined,
        requestedCount: input.planned,
        source: input.source ?? "manual",
        aiPlan: input.aiPlan ?? null,
        config: {
          emailExtraction: flags.email ?? true,
          fastMode: flags.fastMode ?? false,
          depth: flags.depth,
          radiusKm: flags.radius,
          language: flags.lang,
          grid: flags.grid,
          extraReviews: flags.extraReviews,
        },
      });
      await refresh();
      return response.search;
    },
    [refresh],
  );

  const toggle = useCallback(
    async (slug: string) => {
      const job = jobs.find((candidate) => candidate.slug === slug);
      if (!job) return;
      await api.searches.action(slug, job.status === "running" || job.status === "queued" ? "pause" : "resume");
      await refresh();
    },
    [jobs, refresh],
  );

  const rerun = useCallback(
    async (slug: string) => {
      await api.searches.action(slug, "rerun");
      await refresh();
    },
    [refresh],
  );

  const cancel = useCallback(
    async (slug: string) => {
      await api.searches.action(slug, "cancel");
      await refresh();
    },
    [refresh],
  );

  const rename = useCallback(
    async (slug: string, name: string) => {
      await api.searches.rename(slug, name);
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (slug: string) => {
      await api.searches.remove(slug);
      await refresh();
    },
    [refresh],
  );

  const get = useCallback((slug: string) => jobs.find((job) => job.slug === slug), [jobs]);

  const value = useMemo<EngineCtx>(
    () => ({
      jobs,
      loading,
      error,
      liveCount: jobs.filter((job) => ACTIVE.has(job.status)).length,
      refresh,
      createJob,
      toggle,
      rerun,
      cancel,
      rename,
      remove,
      get,
    }),
    [cancel, createJob, error, get, jobs, loading, refresh, remove, rename, rerun, toggle],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEngine(): EngineCtx {
  const context = useContext(Ctx);
  if (!context) throw new Error("useEngine must be used inside <EngineProvider>");
  return context;
}
