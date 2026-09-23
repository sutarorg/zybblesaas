import { z } from "zod";
import { route, ok } from "../../_lib/http";
import { parse } from "../../_lib/validate";
import { admin, query } from "../../_lib/supabase";
import { audit } from "../../_lib/audit";
import { badRequest, notFound } from "../../_lib/errors";
import { toLeadDetail, type LeadRow } from "../../_lib/serialize";
import { leadBelongsToWorkspace } from "./index";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add_to_list"), listId: z.string().uuid().optional(), listSlug: z.string().optional() }),
  z.object({ action: z.literal("remove_from_list"), listId: z.string().uuid().optional(), listSlug: z.string().optional() }),
]);

export default route(
  {
    methods: ["GET", "POST"],
    auth: "both",
    scopes: ["leads:read", "leads:write"],
    limit: { bucket: "lead-detail", perMinute: 300 },
  },
  async (ctx) => {
    const slug = ctx.params.slug;
    if (!slug) throw badRequest("A lead slug is required");

    const lead = await leadBelongsToWorkspace(ctx.workspaceId, slug);
    if (!lead) throw notFound("Lead not found");

    if (ctx.req.method?.toUpperCase() === "POST") {
      const body = parse(actionSchema, ctx.body);
      const listRows = await query<Array<{ id: string; name: string }>>(
        admin()
          .from("lists")
          .select("id, name")
          .eq("workspace_id", ctx.workspaceId)
          .eq(body.listId ? "id" : "slug", body.listId ?? body.listSlug ?? "")
          .is("deleted_at", null)
          .limit(1),
        "list lookup",
      );
      const list = listRows[0];
      if (!list) throw notFound("List not found");

      if (body.action === "add_to_list") {
        // primary key (list_id, lead_id) makes this idempotent; the
        // list_leads_counters_trg trigger refreshes the list aggregates.
        await query(
          admin()
            .from("list_leads")
            .upsert(
              { list_id: list.id, lead_id: lead.id, workspace_id: ctx.workspaceId, added_by: ctx.caller?.userId ?? null },
              { onConflict: "list_id,lead_id", ignoreDuplicates: true },
            )
            .select("list_id"),
          "list lead insert",
        );
      } else {
        await query(
          admin().from("list_leads").delete().eq("list_id", list.id).eq("lead_id", lead.id).select("list_id"),
          "list lead delete",
        );
      }

      await audit(ctx, {
        action: `lead.${body.action}`,
        targetType: "lead",
        targetId: lead.id,
        metadata: { list_id: list.id, list: list.name },
      });

      return ok({ ok: true, listId: list.id });
    }

    const [emails, socials, reviews, analyses] = await Promise.all([
      query<Array<{ email: string; source: string; status: string; is_primary: boolean; verified_at: string | null }>>(
        admin()
          .from("lead_emails")
          .select("email, source, status, is_primary, verified_at")
          .eq("lead_id", lead.id)
          .order("is_primary", { ascending: false }),
        "lead emails",
      ),
      query<Array<{ platform: string; url: string; handle: string | null }>>(
        admin().from("lead_social_profiles").select("platform, url, handle").eq("lead_id", lead.id),
        "lead socials",
      ),
      query<Array<{ author_name: string | null; rating: number | null; text_original: string | null; published_at: string | null }>>(
        admin()
          .from("lead_reviews")
          .select("author_name, rating, text_original, published_at")
          .eq("lead_id", lead.id)
          .order("published_at", { ascending: false })
          .limit(12),
        "lead reviews",
      ),
      query<Array<{ summary: string | null; fit: string | null; score: number | null; reasons: unknown; opportunities: unknown; risks: unknown; outreach_angle: string | null; model: string | null }>>(
        admin()
          .from("lead_ai_analyses")
          .select("summary, fit, score, reasons, opportunities, risks, outreach_angle, model")
          .eq("lead_id", lead.id)
          .eq("workspace_id", ctx.workspaceId)
          .eq("status", "ready")
          .order("created_at", { ascending: false })
          .limit(1),
        "lead analyses",
      ),
    ]);

    const memberships = await query<Array<{ list: Array<{ slug: string; name: string }> }>>(
      admin().from("list_leads").select("list:lists(slug, name)").eq("lead_id", lead.id).eq("workspace_id", ctx.workspaceId),
      "lead lists",
    );

    return ok({
      lead: toLeadDetail(lead as LeadRow, { emails, socials, reviews, analyses }),
      lists: memberships.flatMap((row) => row.list ?? []),
    });
  },
);
