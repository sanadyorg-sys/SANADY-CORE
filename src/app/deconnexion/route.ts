import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Ends the session (used e.g. when a suspended account is detected). */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const motif = request.nextUrl.searchParams.get("motif");
  const url = new URL("/connexion", request.nextUrl.origin);
  if (motif && /^[a-z_]{1,40}$/.test(motif)) url.searchParams.set("motif", motif);
  return NextResponse.redirect(url);
}
