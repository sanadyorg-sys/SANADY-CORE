import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation";
import { getViewer } from "@/server/auth";

/**
 * Opens a document attached to an enterprise request through a 60-second
 * signed link. Access is decided by the database: RLS on
 * enterprise_documents and the storage policy of the private « enterprise »
 * bucket (enterprise staff with a two-factor session only). Documents of
 * requests marked as spam are never opened.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/entreprises/documents/[documentId]">) {
  const { documentId } = await ctx.params;
  if (!uuidSchema.safeParse(documentId).success) return new NextResponse("Introuvable", { status: 404 });

  const viewer = await getViewer();
  if (!viewer || viewer.aal !== "aal2") return new NextResponse("Accès refusé.", { status: 401 });

  const supabase = await createClient();
  const { data } = await supabase
    .from("enterprise_documents")
    .select("storage_path, file_name, request:enterprise_requests(status)")
    .eq("id", documentId)
    .maybeSingle();
  const doc = data as unknown as { storage_path: string; file_name: string; request: { status: string } | null } | null;
  if (!doc) return new NextResponse("Introuvable", { status: 404 });
  if (doc.request?.status === "spam") return new NextResponse("Document d’une demande indésirable.", { status: 410 });

  const { data: signed, error } = await supabase.storage.from("enterprise").createSignedUrl(doc.storage_path, 60, { download: doc.file_name });
  if (error || !signed) return new NextResponse("Accès refusé.", { status: 403 });
  return NextResponse.redirect(signed.signedUrl, { headers: { "Cache-Control": "no-store" } });
}
