import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation";
import { getViewer } from "@/server/auth";

/**
 * A company's logo, for its members and the Enterprise team (tenant_logo
 * and the storage policy decide). Served from the private bucket, never
 * from a public link.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/logos/entreprise/[institutionId]">) {
  const { institutionId } = await ctx.params;
  if (!uuidSchema.safeParse(institutionId).success) return new Response("Introuvable", { status: 404 });
  const viewer = await getViewer();
  if (!viewer) return new Response("Authentification requise", { status: 401 });
  const supabase = await createClient();
  const { data: path } = await supabase.rpc("tenant_logo", { p_institution: institutionId });
  if (!path) return new Response("Introuvable", { status: 404 });
  const { data: file } = await supabase.storage.from("enterprise-logos").download(path as string);
  if (!file) return new Response("Introuvable", { status: 404 });
  return new Response(file, {
    headers: {
      "Content-Type": (path as string).endsWith(".png") ? "image/png" : "image/jpeg",
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
