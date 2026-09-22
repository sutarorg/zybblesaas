import { z } from "zod";
import { route, ok } from "../_lib/http";
import { parse } from "../_lib/validate";
import { admin, query } from "../_lib/supabase";
import { entitlements } from "../_lib/entitlements";
import { audit } from "../_lib/audit";
import { badRequest } from "../_lib/errors";
import { publicPlan } from "../_lib/plans";

const patchSchema = z.object({
  workspace: z
    .object({
      name: z.string().min(1).max(120).optional(),
      billingEmail: z.string().email().max(200).nullish(),
      countryCode: z.string().length(2).nullish(),
    })
    .optional(),
  preferences: z
    .object({
      defaultLanguage: z.string().min(2).max(10).optional(),
      defaultDepth: z.number().int().min(1).max(60).optional(),
      defaultRadiusKm: z.number().int().min(1).max(100).optional(),
      emailExtractionDefault: z.boolean().optional(),
      dedupeStrictness: z.enum(["loose", "balanced", "strict"]).optional(),
      theme: z.enum(["light", "dark", "system"]).optional(),
    })
    .optional(),
  notifications: z
    .object({
      searchCompleted: z.boolean().optional(),
      searchFailed: z.boolean().optional(),
      exportReady: z.boolean().optional(),
      aiCompleted: z.boolean().optional(),
      quotaWarnings: z.boolean().optional(),
      weeklyDigest: z.boolean().optional(),
      productUpdates: z.boolean().optional(),
      marketingTips: z.boolean().optional(),
    })
    .optional(),
  profile: z
    .object({
      fullName: z.string().min(1).max(120).optional(),
      company: z.string().max(120).nullish(),
      timezone: z.string().min(2).max(60).optional(),
      locale: z.string().min(2).max(10).optional(),
    })
    .optional(),
});

export default route({ methods: ["GET", "PATCH"], auth: "session", limit: { bucket: "settings", perMinute: 120 } }, async (ctx) => {
  const userId = ctx.caller?.userId;
  if (!userId) throw badRequest("A signed-in user is required");

  const ent = await entitlements(ctx.workspaceId);

  if (ctx.req.method?.toUpperCase() === "GET") {
    const [profile, preferences, notifications, members, plan] = await Promise.all([
      query<Array<Record<string, unknown>>>(
        admin().from("profiles").select("id, email, full_name, company, timezone, locale, avatar_url, is_platform_admin").eq("id", userId).limit(1),
        "settings profile",
      ),
      query<Array<Record<string, unknown>>>(
        admin().from("workspace_preferences").select("*").eq("workspace_id", ctx.workspaceId).limit(1),
        "settings workspace preferences",
      ),
      query<Array<Record<string, unknown>>>(
        admin()
          .from("notification_preferences")
          .select("*")
          .eq("workspace_id", ctx.workspaceId)
          .eq("user_id", userId)
          .limit(1),
        "settings notification preferences",
      ),
      query<Array<Record<string, unknown>>>(
        admin()
          .from("workspace_members")
          .select("id, user_id, invited_email, role, status, joined_at, created_at")
          .eq("workspace_id", ctx.workspaceId)
          .order("created_at", { ascending: true })
          .limit(100),
        "settings members",
      ),
      query<Array<Record<string, unknown>>>(admin().from("plans").select("*").eq("code", ent.plan.code).limit(1), "settings plan"),
    ]);

    return ok({
      profile: profile[0] ?? null,
      workspace: { ...ent.workspace, billing_email: null },
      role: ctx.caller?.role ?? null,
      canManage: ["owner", "admin"].includes(String(ctx.caller?.role)),
      plan: { ...ent.plan, view: plan[0] ? publicPlan(plan[0] as never) : null },
      subscription: ent.subscription,
      usage: ent.usage,
      preferences: preferences[0] ?? null,
      notificationPreferences: notifications[0] ?? null,
      members: members.map((member) => ({
        id: member.id,
        userId: member.user_id,
        email: member.invited_email,
        role: member.role,
        status: member.status,
        joinedAt: member.joined_at,
        isYou: member.user_id === userId,
      })),
    });
  }

  const body = parse(patchSchema, ctx.body);
  const isAdmin = ["owner", "admin"].includes(String(ctx.caller?.role));
  const applied: string[] = [];

  if (body.workspace) {
    if (!isAdmin) throw badRequest("Only workspace owners and admins can change workspace settings");
    const patch: Record<string, unknown> = {};
    if (body.workspace.name) patch.name = body.workspace.name;
    if (body.workspace.billingEmail !== undefined) patch.billing_email = body.workspace.billingEmail;
    if (body.workspace.countryCode !== undefined) patch.country_code = body.workspace.countryCode?.toUpperCase() ?? null;
    if (Object.keys(patch).length > 0) {
      await query(admin().from("workspaces").update(patch).eq("id", ctx.workspaceId).select("id"), "settings workspace update");
      applied.push("workspace");
    }
  }

  if (body.preferences) {
    const prefs = body.preferences;
    const patch: Record<string, unknown> = {};
    if (prefs.defaultLanguage) patch.default_language = prefs.defaultLanguage;
    if (prefs.defaultDepth) patch.default_depth = prefs.defaultDepth;
    if (prefs.defaultRadiusKm) patch.default_radius_km = prefs.defaultRadiusKm;
    if (prefs.emailExtractionDefault !== undefined) patch.email_extraction_default = prefs.emailExtractionDefault;
    if (prefs.dedupeStrictness) patch.dedupe_strictness = prefs.dedupeStrictness;
    if (prefs.theme) patch.theme = prefs.theme;
    if (Object.keys(patch).length > 0) {
      await query(
        admin().from("workspace_preferences").upsert({ workspace_id: ctx.workspaceId, ...patch }, { onConflict: "workspace_id" }).select("workspace_id"),
        "settings preferences upsert",
      );
      applied.push("preferences");
    }
  }

  if (body.notifications) {
    const n = body.notifications;
    const patch: Record<string, unknown> = {};
    const map: Record<string, string> = {
      searchCompleted: "search_completed",
      searchFailed: "search_failed",
      exportReady: "export_ready",
      aiCompleted: "ai_completed",
      quotaWarnings: "quota_warnings",
      weeklyDigest: "weekly_digest",
      productUpdates: "product_updates",
      marketingTips: "marketing_tips",
    };
    for (const [key, column] of Object.entries(map)) {
      const value = (n as Record<string, boolean | undefined>)[key];
      if (value !== undefined) patch[column] = value;
    }
    if (Object.keys(patch).length > 0) {
      await query(
        admin()
          .from("notification_preferences")
          .upsert({ workspace_id: ctx.workspaceId, user_id: userId, ...patch }, { onConflict: "workspace_id,user_id" })
          .select("id"),
        "settings notification upsert",
      );
      applied.push("notifications");
    }
  }

  if (body.profile) {
    const patch: Record<string, unknown> = {};
    if (body.profile.fullName) patch.full_name = body.profile.fullName;
    if (body.profile.company !== undefined) patch.company = body.profile.company;
    if (body.profile.timezone) patch.timezone = body.profile.timezone;
    if (body.profile.locale) patch.locale = body.profile.locale;
    if (Object.keys(patch).length > 0) {
      await query(admin().from("profiles").update(patch).eq("id", userId).select("id"), "settings profile update");
      applied.push("profile");
    }
  }

  if (applied.length === 0) throw badRequest("Nothing to update");

  await audit(ctx, { action: "settings.updated", targetType: "workspace", targetId: ctx.workspaceId, metadata: { applied } });
  return ok({ ok: true, applied });
});
