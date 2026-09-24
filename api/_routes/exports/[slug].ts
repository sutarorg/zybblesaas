import { route, ok } from "../../_lib/http.js";
import { admin, query } from "../../_lib/supabase.js";
import { audit } from "../../_lib/audit.js";
import { badRequest, conflict, notFound } from "../../_lib/errors.js";
import { toExport } from "../../_lib/serialize.js";

type ExportRow = Parameters<typeof toExport>[0];

const BUCKET = "zybble-exports";
const SIGNED_URL_TTL_SECONDS = 300;

export default route(
  { methods: ["GET", "DELETE"], auth: "both", scopes: ["exports:read", "exports:write"], limit: { bucket: "export-detail", perMinute: 240 } },
  async (ctx) => {
    const slug = ctx.params.slug;
    if (!slug) throw badRequest("An export slug is required");

    const rows = await query<ExportRow[]>(
      admin().from("exports").select("*").eq("workspace_id", ctx.workspaceId).eq("slug", slug).limit(1),
      "export lookup",
    );
    const row = rows[0];
    if (!row || row.status === "deleted") throw notFound("Export not found");

    if (ctx.req.method?.toUpperCase() === "DELETE") {
      if (row.status === "ready") {
        const path = `${ctx.workspaceId}/${row.slug}.${row.format}`;
        await admin().storage.from(BUCKET).remove([path]).catch(() => undefined);
      }
      await query(admin().from("exports").update({ status: "deleted" }).eq("id", row.id).select("id"), "export delete");
      await audit(ctx, { action: "export.deleted", targetType: "export", targetId: row.id });
      return ok({ deleted: true });
    }

    if (ctx.query.download === "1") {
      if (row.status !== "ready") {
        throw conflict(row.status === "expired" ? "This export has expired — create a new one" : "This export is still being generated");
      }
      const path = `${ctx.workspaceId}/${row.slug}.${row.format}`;
      const { data, error } = await admin().storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS, {
        download: row.name ?? undefined,
      });
      if (error || !data?.signedUrl) throw notFound("The export file is no longer available in storage");

      await audit(ctx, { action: "export.downloaded", targetType: "export", targetId: row.id });
      return ok({ url: data.signedUrl, expiresInSeconds: SIGNED_URL_TTL_SECONDS, name: row.name, format: row.format });
    }

    return ok({ export: toExport(row) });
  },
);
