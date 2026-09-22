import type { ExportPayload, Job as ApiJob, LeadDetail, LeadListItem, ListPayload } from "../lib/api";

/**
 * Shared app types + formatting helpers.
 *
 * This file used to hold generated demo data. It now only re-exports the shapes
 * the API returns (`api/_lib/serialize.ts`) and small pure helpers — every
 * number the UI renders comes from Postgres through `/api/*`.
 */

export type JobStatus = "queued" | "running" | "paused" | "complete" | "failed";

/** A search job, exactly as `/api/searches` serialises it. */
export type Job = ApiJob;

/** A lead row in a table. */
export type Lead = LeadListItem;

/** A lead with all its children (detail page). */
export type FullLead = LeadDetail;

/** A saved list. */
export type ListMeta = ListPayload;

/** An export row. */
export type ExportRow = ExportPayload;

export type Invoice = {
  id: string;
  number: string;
  amount: number;
  currency: string;
  status: string;
  issuedLabel: string | null;
  paidAt: string | null;
  url: string | null;
};

/* ------------------------------------------------------------------ helpers */

export function slugify(s: string): string {
  return s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** Saves text the browser already holds (used for small, on-screen copies). */
export function downloadText(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Triggers a browser download of a URL the server signed. */
export function downloadUrl(url: string, filename?: string) {
  const link = document.createElement("a");
  link.href = url;
  if (filename) link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** CSV for rows already loaded in the browser (a copy of real values, nothing invented). */
export function recordsToCsv(rows: Array<Record<string, unknown>>, columns?: string[]): string {
  if (rows.length === 0) return "";
  const keys = columns ?? Object.keys(rows[0]);
  const escape = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    const text = typeof value === "object" ? JSON.stringify(value) : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [keys.join(","), ...rows.map((row) => keys.map((key) => escape(row[key])).join(","))].join("\n");
}

export function relTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return `${Math.max(0, seconds)}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 31) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function clockTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function formatMoney(amountMinor: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(amountMinor / 100);
}

export function initials(name: string | null | undefined): string {
  const source = (name ?? "").trim();
  if (!source) return "??";
  const parts = source.split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "??";
}

export function titleCase(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/[-_]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

/** Human label for a raw search status coming from Postgres. */
export function statusLabel(status: string): string {
  switch (status) {
    case "draft":
      return "draft";
    case "queued":
      return "queued";
    case "running":
    case "enriching":
      return "running";
    case "paused":
      return "paused";
    case "partial":
      return "partial";
    case "completed":
      return "complete";
    case "cancelled":
      return "cancelled";
    case "failed":
      return "failed";
    default:
      return status;
  }
}
