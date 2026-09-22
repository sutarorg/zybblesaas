import { z } from "zod";
import { route, ok } from "../_lib/http";
import { parse } from "../_lib/validate";
import { admin, query } from "../_lib/supabase";
import { audit } from "../_lib/audit";
import { badRequest } from "../_lib/errors";

const patchSchema = z
  .object({
    ids: z.array(z.string().uuid()).min(1).max(200).optional(),
    all: z.boolean().optional(),
    read: z.boolean().default(true),
  })
  .refine((value) => Boolean(value.all) || Boolean(value.ids?.length), { message: "Provide notifications to mark (ids) or all: true" });

export default route(
  { methods: ["GET", "PATCH"], auth: "both", scopes: ["searches:read"], limit: { bucket: "notifications", perMinute: 300 } },
  async (ctx) => {
    if (ctx.req.method?.toUpperCase() === "GET") {
      const limit = Math.min(100, Number(ctx.query.limit ?? 30));
      const unreadOnly = ctx.query.unread === "true";
      const type = ctx.query.type;

      let builder = admin()
        .from("notifications")
        .select("id, type, title, body, link, severity, metadata, read_at, created_at", { count: "exact" })
        .eq("workspace_id", ctx.workspaceId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (unreadOnly) builder = builder.is("read_at", null);
      if (type) builder = builder.eq("type", type);

      const { data, error, count } = await builder;
      if (error) throw badRequest(error.message);

      const unread = await query<Array<{ id: string }>>(
        admin().from("notifications").select("id").eq("workspace_id", ctx.workspaceId).is("read_at", null).limit(1000),
        "unread notifications",
      );

      return ok({
        items: ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
          id: row.id,
          type: row.type,
          title: row.title,
          body: row.body,
          link: row.link,
          severity: row.severity,
          metadata: row.metadata,
          read: Boolean(row.read_at),
          createdAt: row.created_at,
        })),
        total: count ?? 0,
        unread: unread.length,
      });
    }

    const body = parse(patchSchema, ctx.body);
    const readAt = body.read ? new Date().toISOString() : null;

    const selection = body.all
      ? admin().from("notifications").update({ read_at: readAt }).eq("workspace_id", ctx.workspaceId).is("read_at", body.read ? null : readAt)
      : admin().from("notifications").update({ read_at: readAt }).eq("workspace_id", ctx.workspaceId).in("id", body.ids ?? []);

    const { error } = await selection.select("id");
    if (error) throw badRequest(error.message);

    await audit(ctx, {
      action: body.read ? "notifications.read" : "notifications.unread",
      targetType: "workspace",
      targetId: ctx.workspaceId,
      metadata: { all: Boolean(body.all), count: body.ids?.length ?? null },
    });

    return ok({ ok: true, all: Boolean(body.all), count: body.ids?.length ?? null });
  },
);
