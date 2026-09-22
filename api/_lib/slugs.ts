import { rpc } from "./supabase";

export type SlugTable = "searches" | "leads" | "lists" | "exports" | "ai_conversations" | "workspaces";

/**
 * URL-safe, collision-free slugs are generated inside Postgres so the check and
 * the insert happen in one transaction (the function retries with a suffix).
 */
export async function uniqueSlug(table: SlugTable, base: string): Promise<string> {
  return rpc<string>("unique_slug", { p_table: table, p_column: "slug", p_base: base, p_max: 200 });
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 72);
}
