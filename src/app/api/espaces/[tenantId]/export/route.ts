import { createClient } from "@/lib/supabase/server";
import { displayName } from "@/lib/format";
import { uuidSchema } from "@/lib/validation";
import { getViewer } from "@/server/auth";
import { buildTenantExport } from "@/server/tenant-export";

/**
 * End-of-contract export of a company space (ZIP). The database decides
 * who may download it (can_export_tenant: export authorised by an approver;
 * the team, approvers and administrators, or the company's administrator
 * while the space is still open), and records each download.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/espaces/[tenantId]/export">) {
  const { tenantId } = await ctx.params;
  if (!uuidSchema.safeParse(tenantId).success) return new Response("Introuvable", { status: 404 });
  const viewer = await getViewer();
  if (!viewer) return new Response("Authentification requise", { status: 401 });
  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc("can_export_tenant", { p_tenant: tenantId });
  if (!allowed) return new Response("Accès refusé.", { status: 403 });
  const { error } = await supabase.rpc("record_tenant_export", { p_tenant: tenantId });
  if (error) return new Response("Accès refusé.", { status: 403 });

  const { bytes, fileName } = await buildTenantExport(tenantId, displayName(viewer.profile));
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${fileName.replace(/[^\w.-]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
