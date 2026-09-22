import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { route, ok, created } from "../_lib/http";
import { parse } from "../_lib/validate";
import { admin, query, rpc } from "../_lib/supabase";
import { entitlements } from "../_lib/entitlements";
import { audit } from "../_lib/audit";
import { env } from "../_lib/env";
import { badRequest, conflict, forbidden, notFound, quotaExceeded } from "../_lib/errors";

const inviteSchema = z.object({ action: z.literal("invite"), email: z.string().email().max(200), role: z.enum(["admin", "member", "viewer"]).default("member") });
const roleSchema = z.object({ action: z.literal("role"), memberId: z.string().uuid(), role: z.enum(["owner", "admin", "member", "viewer"]) });
const removeSchema = z.object({ action: z.literal("remove"), memberId: z.string().uuid() });
const revokeSchema = z.object({ action: z.literal("revoke_invite"), inviteId: z.string().uuid() });
const acceptSchema = z.object({ action: z.literal("accept"), token: z.string().min(20).max(200) });

const bodySchema = z.discriminatedUnion("action", [inviteSchema, roleSchema, removeSchema, revokeSchema, acceptSchema]);

const hashToken = (token: string) => createHash("sha256").update(token, "utf8").digest("hex");

export default route({ methods: ["GET", "POST"], auth: "session", limit: { bucket: "team", perMinute: 60 } }, async (ctx) => {
  const userId = ctx.caller?.userId;
  if (!userId) throw badRequest("A signed-in user is required");

  if (ctx.req.method?.toUpperCase() === "GET") {
    const [members, invites, ent] = await Promise.all([
      query<Array<Record<string, unknown>>>(
        admin()
          .from("workspace_members")
          .select("id, user_id, invited_email, role, status, joined_at, created_at")
          .eq("workspace_id", ctx.workspaceId)
          .order("created_at", { ascending: true })
          .limit(100),
        "team members",
      ),
      query<Array<Record<string, unknown>>>(
        admin()
          .from("workspace_invites")
          .select("id, email, role, expires_at, accepted_at, revoked_at, created_at")
          .eq("workspace_id", ctx.workspaceId)
          .is("accepted_at", null)
          .is("revoked_at", null)
          .order("created_at", { ascending: false })
          .limit(50),
        "team invites",
      ),
      entitlements(ctx.workspaceId),
    ]);

    const profileIds = members.map((member) => member.user_id).filter((value): value is string => typeof value === "string");
    const profiles = profileIds.length
      ? await query<Array<{ id: string; email: string; full_name: string | null; avatar_url: string | null }>>(
          admin().from("profiles").select("id, email, full_name, avatar_url").in("id", profileIds),
          "team profiles",
        )
      : [];

    return ok({
      seats: { used: ent.seats_used, included: ent.plan.seats, plan: ent.plan.code },
      members: members.map((member) => {
        const profile = profiles.find((candidate) => candidate.id === member.user_id);
        return {
          id: member.id,
          userId: member.user_id,
          email: profile?.email ?? member.invited_email,
          name: profile?.full_name ?? null,
          avatarUrl: profile?.avatar_url ?? null,
          role: member.role,
          status: member.status,
          joinedAt: member.joined_at,
          isYou: member.user_id === userId,
        };
      }),
      invites: invites.map((invite) => ({
        id: invite.id,
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expires_at,
        createdAt: invite.created_at,
        expired: new Date(String(invite.expires_at)).getTime() < Date.now(),
      })),
    });
  }

  const body = parse(bodySchema, ctx.body);

  // Anyone can accept their own invitation with the token from the email.
  if (body.action === "accept") {
    const rows = await query<Array<{ id: string; workspace_id: string; email: string; role: string; expires_at: string }>>(
      admin()
        .from("workspace_invites")
        .select("id, workspace_id, email, role, expires_at")
        .eq("token_hash", hashToken(body.token))
        .is("accepted_at", null)
        .is("revoked_at", null)
        .limit(1),
      "invite lookup",
    );
    const invite = rows[0];
    if (!invite) throw notFound("This invitation is no longer valid");
    if (new Date(invite.expires_at).getTime() < Date.now()) throw conflict("This invitation expired — ask for a new one");

    const me = await query<Array<{ email: string }>>(admin().from("profiles").select("email").eq("id", userId).limit(1), "invite profile");
    if ((me[0]?.email ?? "").toLowerCase() !== invite.email.toLowerCase()) {
      throw forbidden(`This invitation was sent to ${invite.email} — sign in with that address to accept it`);
    }

    await query(
      admin()
        .from("workspace_members")
        .upsert(
          { workspace_id: invite.workspace_id, user_id: userId, role: invite.role, status: "active", joined_at: new Date().toISOString() },
          { onConflict: "workspace_id,user_id" },
        )
        .select("id"),
      "invite accept member",
    );
    await query(admin().from("workspace_invites").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id).select("id"), "invite accept");
    await audit(ctx, { action: "team.invite_accepted", targetType: "workspace", targetId: invite.workspace_id });

    return ok({ accepted: true, workspaceId: invite.workspace_id, role: invite.role });
  }

  const isAdmin = ["owner", "admin"].includes(String(ctx.caller?.role));
  if (!isAdmin) throw forbidden("Only workspace owners and admins can manage the team");

  if (body.action === "invite") {
    const ent = await entitlements(ctx.workspaceId);
    if (ent.seats_used >= ent.plan.seats) {
      throw quotaExceeded(`Your plan includes ${ent.plan.seats} seat${ent.plan.seats === 1 ? "" : "s"} and all are taken`, {
        seats_used: ent.seats_used,
        seats_included: ent.plan.seats,
        upgrade: "/billing",
      });
    }

    const token = randomBytes(24).toString("base64url");
    const rows = await query<Array<{ id: string }>>(
      admin()
        .from("workspace_invites")
        .upsert(
          {
            workspace_id: ctx.workspaceId,
            email: body.email,
            role: body.role,
            token_hash: hashToken(token),
            invited_by: userId,
            expires_at: new Date(Date.now() + 14 * 86_400_000).toISOString(),
            accepted_at: null,
            revoked_at: null,
          },
          { onConflict: "workspace_id,email" },
        )
        .select("id"),
      "invite upsert",
    );

    const link = `${env.appUrl}/signin?invite=${encodeURIComponent(token)}`;

    // Real delivery when Supabase Auth has SMTP configured; otherwise the owner
    // gets the link to share and Zybble says so plainly (no fake "email sent").
    let emailSent = false;
    let emailError: string | null = null;
    try {
      const { error } = await admin().auth.admin.inviteUserByEmail(body.email, {
        redirectTo: link,
        data: { invited_workspace_id: ctx.workspaceId, invited_role: body.role },
      });
      if (error) throw new Error(error.message);
      emailSent = true;
    } catch (error) {
      emailError = error instanceof Error ? error.message : "invitation email could not be sent";
    }

    await rpc("notify_workspace", {
      p_workspace_id: ctx.workspaceId,
      p_type: "team_invite",
      p_title: `Invitation sent to ${body.email}`,
      p_body: emailSent ? "They can accept it from the link in their inbox." : "Email delivery failed — share the invitation link manually.",
      p_severity: emailSent ? "info" : "warn",
      p_metadata: { email: body.email, role: body.role, email_sent: emailSent },
    }).catch(() => undefined);

    await audit(ctx, { action: "team.invited", targetType: "workspace_member", targetId: rows[0]?.id ?? null, metadata: { email: body.email, role: body.role, email_sent: emailSent } });

    return created({
      invited: true,
      email: body.email,
      role: body.role,
      emailSent,
      emailError,
      inviteLink: emailSent ? null : link,
      note: emailSent
        ? "Invitation emailed. It expires in 14 days."
        : "The invitation is recorded, but the email could not be sent. Share this link directly — it expires in 14 days.",
    });
  }

  if (body.action === "revoke_invite") {
    const rows = await query<Array<{ id: string; email: string }>>(
      admin().from("workspace_invites").select("id, email").eq("workspace_id", ctx.workspaceId).eq("id", body.inviteId).limit(1),
      "invite lookup",
    );
    const invite = rows[0];
    if (!invite) throw notFound("Invitation not found");
    await query(admin().from("workspace_invites").update({ revoked_at: new Date().toISOString() }).eq("id", invite.id).select("id"), "invite revoke");
    await audit(ctx, { action: "team.invite_revoked", targetType: "workspace_member", targetId: invite.id, metadata: { email: invite.email } });
    return ok({ revoked: true, id: invite.id });
  }

  const target = await query<Array<{ id: string; user_id: string | null; role: string; status: string }>>(
    admin().from("workspace_members").select("id, user_id, role, status").eq("workspace_id", ctx.workspaceId).eq("id", body.memberId).limit(1),
    "team member lookup",
  );
  const member = target[0];
  if (!member) throw notFound("Team member not found");

  if (body.action === "role") {
    if (member.role === "owner") throw conflict("Transfer ownership before changing the owner's role");
    if (member.user_id === userId) throw conflict("You cannot change your own role");
    if (body.role === "owner") throw conflict("Ownership transfer is not available yet — contact support");
    await query(admin().from("workspace_members").update({ role: body.role }).eq("id", member.id).select("id"), "team role update");
    await audit(ctx, { action: "team.role_changed", targetType: "workspace_member", targetId: member.id, metadata: { from: member.role, to: body.role } });
    return ok({ updated: true, memberId: member.id, role: body.role });
  }

  if (member.role === "owner") throw conflict("The workspace owner cannot be removed");
  if (member.user_id === userId) throw badRequest("You cannot remove yourself — ask another admin");
  await query(admin().from("workspace_members").delete().eq("id", member.id).select("id"), "team remove member");
  await audit(ctx, { action: "team.member_removed", targetType: "workspace_member", targetId: member.id, metadata: { user_id: member.user_id } });
  return ok({ removed: true, memberId: member.id });
});
