import { z } from "zod";
import { ApiError } from "./errors.js";
import type { RouteContext } from "./http.js";

/**
 * Thin zod helpers. Every request body that reaches business logic has already
 * been parsed and narrowed here, so handlers never read unvalidated input.
 */

export function parse<S extends z.ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const details = flatten(result.error);
    const summary = Object.entries(details)
      .slice(0, 3)
      .map(([field, messages]) => (field === "_" ? messages[0] : `${field}: ${messages[0]}`))
      .join("; ");
    throw new ApiError("bad_request", summary ? `Some fields are invalid — ${summary}` : "Some fields are invalid", details);
  }
  return result.data;
}

function flatten(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_";
    out[key] = [...(out[key] ?? []), issue.message];
  }
  return out;
}

export const uuid = z.string().uuid();

export const slug = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be a URL-safe slug");

export const searchConfigSchema = z.object({
  depth: z.number().int().min(1).max(30).default(10),
  radiusKm: z.number().min(0.5).max(200).default(10),
  language: z.string().min(2).max(8).default("en"),
  emailExtraction: z.boolean().default(true),
  fastMode: z.boolean().default(false),
  grid: z.boolean().default(false),
  gridCellKm: z.number().min(0.2).max(50).default(1.5),
  extraReviews: z.boolean().default(false),
  includeFilters: z
    .object({
      minRating: z.number().min(0).max(5).optional(),
      minReviews: z.number().int().min(0).optional(),
      requireWebsite: z.boolean().optional(),
      requirePhone: z.boolean().optional(),
      excludeClosed: z.boolean().optional(),
      categoryContains: z.string().max(120).optional(),
    })
    .default({}),
});

export type SearchConfigInput = z.infer<typeof searchConfigSchema>;

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export function queryValue(ctx: RouteContext, key: string): string | undefined {
  const value = ctx.query[key];
  return value === "" ? undefined : value;
}
