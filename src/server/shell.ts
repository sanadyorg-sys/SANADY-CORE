import "server-only";
import type { ShellContext, ShellUser } from "@/components/layout/app-shell";
import { displayName } from "@/lib/format";
import type { Viewer } from "./auth";

/** Workspaces the viewer can switch between (admin, institutions, learner). */
export function contextsFor(viewer: Viewer): ShellContext[] {
  const contexts: ShellContext[] = [];
  if (viewer.isSanadyAdmin) {
    contexts.push({ key: "admin", label: "Administration SANADY", description: "Gestion de la plateforme", href: "/admin", kind: "admin" });
  } else if (viewer.isTrainingManager) {
    contexts.push({ key: "admin", label: "Espace pédagogique", description: "Responsable pédagogique", href: "/admin", kind: "admin" });
  } else if (viewer.isTrainer) {
    contexts.push({ key: "admin", label: "Espace pédagogique", description: "Formateur", href: "/admin/formations", kind: "admin" });
  } else if (viewer.platformRole === "partnership_coordinator" || viewer.platformRole === "partnership_manager") {
    contexts.push({
      key: "admin",
      label: "Partenariats & Coopération",
      description: viewer.platformRole === "partnership_manager" ? "Responsable des partenariats" : "Chargé(e) des partenariats",
      href: "/admin/partenariats",
      kind: "admin",
    });
  } else if (viewer.platformRole === "enterprise_manager" || viewer.platformRole === "production_manager") {
    contexts.push({
      key: "admin",
      label: "SANADY Enterprise",
      description: viewer.platformRole === "enterprise_manager" ? "Responsable entreprises" : "Responsable de production",
      href: "/admin/partenariats/entreprises",
      kind: "admin",
    });
  }
  for (const inst of viewer.supervisedInstitutions) {
    contexts.push({
      key: `inst:${inst.id}`,
      label: inst.name,
      description: inst.role === "supervisor" ? "Supervision (lecture seule)" : inst.kind === "enterprise" ? "Espace entreprise" : "Espace établissement",
      href: `/etablissement/${inst.id}`,
      kind: "institution",
    });
  }
  contexts.push({
    key: "teacher",
    label: viewer.isEmployeeOnly ? "Mon espace de formation" : "Espace enseignant",
    description: "Mes formations",
    href: "/espace",
    kind: "teacher",
  });
  return contexts;
}

export function shellUser(viewer: Viewer): ShellUser {
  return { name: displayName(viewer.profile), email: viewer.email };
}
