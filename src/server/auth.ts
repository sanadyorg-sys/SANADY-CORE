import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Institution, Profile } from "@/lib/types";

export interface ViewerInstitution {
  id: string;
  name: string;
  identifier: string;
  role: "admin" | "teacher" | "supervisor";
}

export type PlatformRole =
  | "sanady_admin"
  | "training_manager"
  | "trainer"
  | "partnership_coordinator"
  | "partnership_manager"
  | "enterprise_manager"
  | "production_manager";
/** Staff roles allowed in the « Administration » area, as guard shorthand. */
/** "partners": partnership coordinators and managers (Partenariats & Coopération). */
export type StaffRole = "admin" | "manager" | "trainer" | "partners" | "enterprise";

export interface Viewer {
  id: string;
  email: string;
  profile: Profile;
  isSanadyAdmin: boolean;
  /** Platform role, if any (administrators, training managers, trainers). */
  platformRole: PlatformRole | null;
  isTrainingManager: boolean;
  isTrainer: boolean;
  /** Administrators and training managers: all courses, reports, library. */
  isCourseStaff: boolean;
  institutions: ViewerInstitution[];
  /** Institutions the viewer administers. */
  adminInstitutions: ViewerInstitution[];
  /** Institutions the viewer administers or supervises (read-only). */
  supervisedInstitutions: ViewerInstitution[];
  /** Assurance level of the current session (from the verified JWT). */
  aal: "aal1" | "aal2";
  /** True when a second factor (TOTP) is enrolled and verified. */
  mfaEnrolled: boolean;
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
  const aal = claimsData?.claims?.aal === "aal2" ? "aal2" : "aal1";

  const [profileRes, roleRes, membershipRes, aalRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("platform_roles").select("role").eq("user_id", userId).maybeSingle(),
    supabase
      .from("institution_memberships")
      .select("role, institution:institutions(id, name, identifier, status)")
      .eq("user_id", userId)
      .eq("status", "active"),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);

  const profile = profileRes.data as Profile | null;
  if (!profile) return null;

  type Row = { role: ViewerInstitution["role"]; institution: Pick<Institution, "id" | "name" | "identifier" | "status"> | null };
  const active = profile.status === "active";
  const platformRole = active ? ((roleRes.data as { role: PlatformRole } | null)?.role ?? null) : null;
  const institutions = ((membershipRes.data ?? []) as unknown as Row[])
    .filter((m) => m.institution && m.institution.status === "active")
    .map((m) => ({ id: m.institution!.id, name: m.institution!.name, identifier: m.institution!.identifier, role: m.role }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  return {
    id: userId,
    email: profile.email,
    profile,
    isSanadyAdmin: platformRole === "sanady_admin",
    platformRole,
    isTrainingManager: platformRole === "training_manager",
    isTrainer: platformRole === "trainer",
    isCourseStaff: platformRole === "sanady_admin" || platformRole === "training_manager",
    institutions,
    adminInstitutions: institutions.filter((i) => i.role === "admin"),
    supervisedInstitutions: institutions.filter((i) => i.role === "admin" || i.role === "supervisor"),
    aal,
    mfaEnrolled: aalRes.data?.nextLevel === "aal2",
  };
});

/**
 * Requires an authenticated, active, onboarded user. Anyone who enrolled a
 * second factor must have verified it in this session (aal2).
 */
export async function requireViewer({ allowOnboarding = false, allowPendingMfa = false } = {}): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/connexion");
  if (viewer.profile.status !== "active") redirect("/deconnexion?motif=compte_suspendu");
  if (!allowPendingMfa && viewer.mfaEnrolled && viewer.aal !== "aal2") redirect("/securite/verification");
  if (!allowOnboarding && !viewer.profile.onboarded_at) redirect("/bienvenue");
  return viewer;
}

/**
 * SANADY administrators must use two-factor authentication. The database
 * refuses admin privileges to aal1 sessions; this guard guides the user.
 */
export async function requireSanadyAdmin(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!viewer.isSanadyAdmin) redirect(staffRole(viewer) ? homeFor(viewer) : "/mon-espace");
  if (!viewer.mfaEnrolled) redirect("/securite/activer?suite=/admin");
  if (viewer.aal !== "aal2") redirect("/securite/verification?suite=/admin");
  return viewer;
}

/** Staff role of a viewer for guard purposes. */
export function staffRole(viewer: Viewer): StaffRole | null {
  if (viewer.isSanadyAdmin) return "admin";
  if (viewer.isTrainingManager) return "manager";
  if (viewer.isTrainer) return "trainer";
  if (viewer.platformRole === "partnership_coordinator" || viewer.platformRole === "partnership_manager") return "partners";
  if (viewer.platformRole === "enterprise_manager" || viewer.platformRole === "production_manager") return "enterprise";
  return null;
}

/**
 * Pedagogical team guard for the « Administration » area. Administrators
 * and training managers must use two-factor authentication (the database
 * refuses their privileges otherwise); trainers may enable it.
 */
export async function requireStaff(allow: StaffRole[] = ["admin", "manager", "trainer"]): Promise<Viewer> {
  const viewer = await requireViewer();
  const role = staffRole(viewer);
  if (!role || !allow.includes(role)) redirect(role ? homeFor(viewer) : "/mon-espace");
  if (role !== "trainer") {
    if (!viewer.mfaEnrolled) redirect("/securite/activer?suite=/admin");
    if (viewer.aal !== "aal2") redirect("/securite/verification?suite=/admin");
  }
  return viewer;
}

/**
 * Partenariats & Coopération: SANADY administrators and partnership staff,
 * always from a two-factor session (the database enforces the same rule).
 */
export async function requirePartnershipStaff(): Promise<Viewer> {
  return requireStaff(["admin", "partners"]);
}

/** SANADY Enterprise: administrators and enterprise staff (2FA, enforced by the database too). */
export async function requireEnterpriseStaff(): Promise<Viewer> {
  return requireStaff(["admin", "enterprise"]);
}

/** Institution pages readable by its administrators and supervisors. */
export async function requireInstitutionViewer(institutionId: string) {
  const viewer = await requireViewer();
  const institution = viewer.supervisedInstitutions.find((i) => i.id === institutionId);
  if (!institution) redirect("/mon-espace");
  return { viewer, institution, canManage: institution.role === "admin" };
}

export async function requireInstitutionAdmin(institutionId: string) {
  const viewer = await requireViewer();
  const institution = viewer.adminInstitutions.find((i) => i.id === institutionId);
  if (!institution) redirect("/mon-espace");
  return { viewer, institution };
}

/** Default landing page for a user, by role. */
export function homeFor(viewer: Viewer): string {
  if (viewer.isSanadyAdmin || viewer.isTrainingManager) return "/admin";
  if (viewer.isTrainer) return "/admin/formations";
  if (viewer.platformRole === "partnership_coordinator" || viewer.platformRole === "partnership_manager") return "/admin/partenariats";
  if (viewer.platformRole === "enterprise_manager" || viewer.platformRole === "production_manager") return "/admin/partenariats/entreprises";
  if (viewer.supervisedInstitutions[0]) return `/etablissement/${viewer.supervisedInstitutions[0].id}`;
  return "/espace";
}
