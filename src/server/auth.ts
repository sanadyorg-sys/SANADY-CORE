import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Institution, Profile } from "@/lib/types";

export interface ViewerInstitution {
  id: string;
  name: string;
  identifier: string;
  role: "admin" | "teacher";
}

export interface Viewer {
  id: string;
  email: string;
  profile: Profile;
  isSanadyAdmin: boolean;
  institutions: ViewerInstitution[];
  /** Institutions the viewer administers. */
  adminInstitutions: ViewerInstitution[];
}

/**
 * Resolves the current user from a VERIFIED JWT (getClaims validates the
 * signature) and loads their profile, platform role and memberships.
 * Cached per request. Returns null when unauthenticated.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return null;

  const [profileRes, roleRes, membershipRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("platform_roles").select("role").eq("user_id", userId).maybeSingle(),
    supabase
      .from("institution_memberships")
      .select("role, institution:institutions(id, name, identifier, status)")
      .eq("user_id", userId)
      .eq("status", "active"),
  ]);

  const profile = profileRes.data as Profile | null;
  if (!profile) return null;

  type Row = { role: "admin" | "teacher"; institution: Pick<Institution, "id" | "name" | "identifier" | "status"> | null };
  const institutions = ((membershipRes.data ?? []) as unknown as Row[])
    .filter((m) => m.institution && m.institution.status === "active")
    .map((m) => ({ id: m.institution!.id, name: m.institution!.name, identifier: m.institution!.identifier, role: m.role }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  return {
    id: userId,
    email: profile.email,
    profile,
    isSanadyAdmin: Boolean(roleRes.data) && profile.status === "active",
    institutions,
    adminInstitutions: institutions.filter((i) => i.role === "admin"),
  };
});

/** Requires an authenticated, active, onboarded user. */
export async function requireViewer({ allowOnboarding = false } = {}): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/connexion");
  if (viewer.profile.status !== "active") redirect("/deconnexion?motif=compte_suspendu");
  if (!allowOnboarding && !viewer.profile.onboarded_at) redirect("/bienvenue");
  return viewer;
}

export async function requireSanadyAdmin(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!viewer.isSanadyAdmin) redirect("/");
  return viewer;
}

export async function requireInstitutionAdmin(institutionId: string) {
  const viewer = await requireViewer();
  const institution = viewer.adminInstitutions.find((i) => i.id === institutionId);
  if (!institution) redirect("/");
  return { viewer, institution };
}

/** Default landing page for a user, by role. */
export function homeFor(viewer: Viewer): string {
  if (viewer.isSanadyAdmin) return "/admin";
  if (viewer.adminInstitutions[0]) return `/etablissement/${viewer.adminInstitutions[0].id}`;
  return "/espace";
}
