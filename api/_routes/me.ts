import { route, ok } from "../_lib/http.js";
import { admin, query } from "../_lib/supabase.js";
import { entitlements } from "../_lib/entitlements.js";
import { planByCode, publicPlan } from "../_lib/plans.js";
import { features } from "../_lib/env.js";

/**
 * Session bootstrap: one call the SPA makes after sign-in.
 *
 * It answers "who am I, which workspace am I in, what am I allowed to do" using
 * the verified session (never a client-supplied workspace id) plus server-side
 * entitlements.
 */
export default route({ methods: ["GET"], auth: "both", scopes: ["searches:read"], limit: { bucket: "me", perMinute: 240 } }, async (ctx) => {
  const ent = await entitlements(ctx.workspaceId);

  const [profile, planRow, memberships] = await Promise.all([
    ctx.caller?.userId
      ? query<Array<Record<string, unknown>>>(
          admin().from("profiles").select("id, email, full_name, company, timezone, locale, avatar_url, is_platform_admin").eq("id", ctx.caller.userId).limit(1),
          "me profile",
        )
      : Promise.resolve([] as Array<Record<string, unknown>>),
    planByCode(ent.plan.code).catch(() => null),
    ctx.caller?.userId
      ? query<Array<{ workspace_id: string; role: string; status: string }>>(
          admin().from("workspace_members").select("workspace_id, role, status").eq("user_id", ctx.caller.userId).eq("status", "active").limit(20),
          "me workspaces",
        )
      : Promise.resolve([]),
  ]);

  const workspaces = memberships.length
    ? await query<Array<{ id: string; name: string; slug: string }>>(
        admin()
          .from("workspaces")
          .select("id, name, slug")
          .in("id", memberships.map((membership) => membership.workspace_id)),
        "me workspace names",
      )
    : [];

  return ok({
    caller: {
      userId: ctx.caller?.userId ?? null,
      email: ctx.caller?.email ?? null,
      via: ctx.caller?.via ?? "session",
      role: ctx.caller?.role ?? null,
      scopes: ctx.caller?.scopes ?? [],
      isPlatformAdmin: Boolean(ctx.caller?.isPlatformAdmin),
    },
    profile: profile[0] ?? null,
    workspace: ent.workspace,
    workspaces: memberships.map((membership) => ({
      ...membership,
      name: workspaces.find((workspace) => workspace.id === membership.workspace_id)?.name ?? null,
      slug: workspaces.find((workspace) => workspace.id === membership.workspace_id)?.slug ?? null,
    })),
    plan: planRow ? publicPlan(planRow) : null,
    subscription: ent.subscription,
    usage: ent.usage,
    seats: { used: ent.seats_used, included: ent.plan.seats },
    activeSearches: ent.active_searches,
    capabilities: {
      ...features(),
      aiEnabled: ent.plan.ai_enabled && features().ai,
      apiAccess: ent.plan.api_access,
      gridCoverage: ent.plan.grid_coverage,
      maxDepth: ent.plan.max_search_depth,
      maxRadiusKm: ent.plan.max_radius_km,
      concurrentSearches: ent.plan.concurrent_searches,
      exportFormats: ent.plan.export_formats,
    },
  });
});
