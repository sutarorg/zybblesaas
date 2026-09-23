import type { IncomingRequest, OutgoingResponse } from "./types";

import aiAnalyzeHandler from "../_routes/ai/analyze";
import aiChatHandler from "../_routes/ai/chat";
import aiListAnalysisHandler from "../_routes/ai/list-analysis";
import aiPlanHandler from "../_routes/ai/plan";
import aiScoreHandler from "../_routes/ai/score";

import billingCheckoutHandler from "../_routes/billing/checkout";
import billingPlansHandler from "../_routes/billing/plans";
import billingSubscriptionHandler from "../_routes/billing/subscription";
import billingVerifyHandler from "../_routes/billing/verify";
import billingWebhookHandler from "../_routes/billing/webhook";

import exportsSlugHandler from "../_routes/exports/[slug]";
import exportsIndexHandler from "../_routes/exports/index";

import geoHandler from "../_routes/geo";
import healthHandler from "../_routes/health";

import keysIdHandler from "../_routes/keys/[id]";
import keysIndexHandler from "../_routes/keys/index";

import leadsSlugHandler from "../_routes/leads/[slug]";
import leadsIndexHandler from "../_routes/leads/index";

import listsSlugHandler from "../_routes/lists/[slug]";
import listsIndexHandler from "../_routes/lists/index";

import meHandler from "../_routes/me";
import notificationsHandler from "../_routes/notifications/index";

import searchesSlugHandler from "../_routes/searches/[slug]";
import searchesIndexHandler from "../_routes/searches/index";

import settingsIndexHandler from "../_routes/settings/index";
import settingsTeamHandler from "../_routes/settings/team";
import statsHandler from "../_routes/stats";
import systemHandler from "../_routes/system";

type RouteAction = (req: IncomingRequest, res: OutgoingResponse) => Promise<unknown> | unknown;

export function extractApiPath(req: IncomingRequest): string {
  if (Array.isArray(req.query?.path)) {
    return req.query.path.join("/");
  }
  if (typeof req.query?.path === "string" && req.query.path.length > 0 && req.query.path !== "[...path]") {
    return req.query.path;
  }
  const matched = (req.headers?.["x-matched-path"] || req.headers?.["x-forwarded-uri"]) as string | undefined;
  if (matched) {
    const clean = matched.split("?")[0].replace(/^\/api\/?/, "");
    if (clean) return clean;
  }
  if (req.url) {
    const clean = req.url.split("?")[0].replace(/^\/api\/?/, "");
    if (clean && !clean.includes("[...path]")) return clean;
  }
  return "";
}

/**
 * Dispatches an incoming request to the matching API route handler.
 */
export default async function apiRouter(req: IncomingRequest, res: OutgoingResponse): Promise<void> {
  const rawPath = extractApiPath(req);
  const cleanPath = rawPath.replace(/\/+$/, "");

  // Clean out internal 'path' param from req.query so handlers only see real query params
  if (req.query && "path" in req.query) {
    const { path: _unused, ...rest } = req.query;
    req.query = rest;
  }

  // Exact routes
  const exactRoutes: Record<string, RouteAction> = {
    "": () => {
      res.setHeader("content-type", "application/json");
      res.status(200);
      res.json({ service: "zybble-api", status: "ok" });
    },
    index: () => {
      res.setHeader("content-type", "application/json");
      res.status(200);
      res.json({ service: "zybble-api", status: "ok" });
    },
    health: healthHandler,
    system: systemHandler,
    stats: statsHandler,
    geo: geoHandler,
    me: meHandler,
    "ai/analyze": aiAnalyzeHandler,
    "ai/chat": aiChatHandler,
    "ai/plan": aiPlanHandler,
    "ai/list-analysis": aiListAnalysisHandler,
    "ai/score": aiScoreHandler,
    "billing/checkout": billingCheckoutHandler,
    "billing/plans": billingPlansHandler,
    "billing/verify": billingVerifyHandler,
    "billing/subscription": billingSubscriptionHandler,
    "billing/webhook": billingWebhookHandler,
    exports: exportsIndexHandler,
    keys: keysIndexHandler,
    leads: leadsIndexHandler,
    lists: listsIndexHandler,
    notifications: notificationsHandler,
    searches: searchesIndexHandler,
    settings: settingsIndexHandler,
    "settings/team": settingsTeamHandler,
  };

  if (exactRoutes[cleanPath]) {
    await exactRoutes[cleanPath](req, res);
    return;
  }

  // Parameterized routes
  let match: RegExpMatchArray | null = null;

  if ((match = cleanPath.match(/^exports\/([^/]+)$/))) {
    req.query = { ...req.query, slug: decodeURIComponent(match[1]) };
    await exportsSlugHandler(req, res);
    return;
  }

  if ((match = cleanPath.match(/^keys\/([^/]+)$/))) {
    req.query = { ...req.query, id: decodeURIComponent(match[1]) };
    await keysIdHandler(req, res);
    return;
  }

  if ((match = cleanPath.match(/^leads\/([^/]+)$/))) {
    req.query = { ...req.query, slug: decodeURIComponent(match[1]) };
    await leadsSlugHandler(req, res);
    return;
  }

  if ((match = cleanPath.match(/^lists\/([^/]+)$/))) {
    req.query = { ...req.query, slug: decodeURIComponent(match[1]) };
    await listsSlugHandler(req, res);
    return;
  }

  if ((match = cleanPath.match(/^searches\/([^/]+)$/))) {
    req.query = { ...req.query, slug: decodeURIComponent(match[1]) };
    await searchesSlugHandler(req, res);
    return;
  }

  res.setHeader("content-type", "application/json");
  res.status(404);
  res.json({
    error: {
      code: "not_found",
      message: `API route not found: /api/${cleanPath}`,
    },
  });
}
