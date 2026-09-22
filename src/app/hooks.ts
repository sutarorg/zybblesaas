import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError, type ExportPayload, type LeadListItem, type ListPayload, type NotificationPayload, type Page, type StatsPayload } from "../lib/api";
import { useSession } from "./session";

/**
 * Small data hooks. They exist so screens stay presentational: loading, error
 * and empty states all come from the server response, and nothing is cached
 * beyond the component's own lifetime.
 */

export type AsyncState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
  setData: (value: T | null) => void;
};

export function useAsyncData<T>(loader: () => Promise<T>, deps: unknown[], options: { pollMs?: number; enabled?: boolean } = {}): AsyncState<T> {
  const { pollMs, enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const reload = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    try {
      const value = await loaderRef.current();
      setData(value);
      setError(null);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : cause instanceof Error ? cause.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!pollMs || !enabled) return;
    const interval = window.setInterval(() => void reload(), pollMs);
    return () => window.clearInterval(interval);
  }, [enabled, pollMs, reload]);

  return { data, error, loading, reload, setData };
}

/* --------------------------------------------------------------- dashboard */

export function useStats() {
  const { status } = useSession();
  return useAsyncData<StatsPayload>(() => api.stats(), [status], { enabled: status === "signed_in", pollMs: 30_000 });
}

/* ------------------------------------------------------------------ lists */

export function useLists(query?: { q?: string; limit?: number }) {
  const { status } = useSession();
  return useAsyncData<Page<ListPayload>>(() => api.lists.list(query), [status, query?.q, query?.limit], { enabled: status === "signed_in" });
}

export function useList(slug: string | null, query?: { q?: string; has_email?: boolean; limit?: number; offset?: number }) {
  const { status } = useSession();
  return useAsyncData(
    () => {
      if (!slug)
        return Promise.resolve({
          list: null as unknown as ListPayload,
          items: [] as LeadListItem[],
          total: 0,
          limit: 0,
          offset: 0,
        });
      return api.lists.get(slug, query);
    },
    [status, slug, query?.q, query?.has_email, query?.limit, query?.offset],
    { enabled: status === "signed_in" && Boolean(slug) },
  );
}

/* ------------------------------------------------------------------ leads */

export function useLeads(query?: {
  q?: string;
  city?: string;
  category?: string;
  has_email?: boolean;
  has_phone?: boolean;
  has_website?: boolean;
  min_rating?: number;
  sort?: string;
  limit?: number;
  offset?: number;
}) {
  const { status } = useSession();
  const key = useMemo(() => JSON.stringify(query ?? {}), [query]);
  return useAsyncData<Page<LeadListItem>>(() => api.leads.list(query), [status, key], { enabled: status === "signed_in" });
}

export function useLead(slug: string | null) {
  const { status } = useSession();
  return useAsyncData(
    () => (slug ? api.leads.get(slug) : Promise.reject(new ApiError(404, "not_found", "No lead selected"))),
    [status, slug],
    { enabled: status === "signed_in" && Boolean(slug) },
  );
}

/* ---------------------------------------------------------------- exports */

export function useExports(query?: { status?: string; limit?: number }) {
  const { status } = useSession();
  // Poll while something is being generated so the row flips to ready on its own.
  return useAsyncData<Page<ExportPayload>>(() => api.exports.list(query), [status, query?.status, query?.limit], {
    enabled: status === "signed_in",
    pollMs: 8_000,
  });
}

/* ---------------------------------------------------------- notifications */

export function useNotifications(limit = 30) {
  const { status } = useSession();
  return useAsyncData(() => api.notifications.list({ limit }), [status, limit], { enabled: status === "signed_in", pollMs: 30_000 });
}

export type { NotificationPayload };

/* ------------------------------------------------------------------ plans */

export function usePlans() {
  return useAsyncData(() => api.billing.plans(), [], { pollMs: 300_000 });
}

export function useBilling() {
  const { status } = useSession();
  return useAsyncData(() => api.billing.subscription(), [status], { enabled: status === "signed_in" });
}

/* --------------------------------------------------------------- settings */

export function useSettings() {
  const { status } = useSession();
  return useAsyncData(() => api.settings.get(), [status], { enabled: status === "signed_in" });
}

export function useTeam() {
  const { status } = useSession();
  return useAsyncData(() => api.settings.team(), [status], { enabled: status === "signed_in" });
}

export function useApiKeys() {
  const { status } = useSession();
  return useAsyncData(() => api.keys.list(), [status], { enabled: status === "signed_in" });
}
