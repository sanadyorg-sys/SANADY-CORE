import "server-only";
import type { ShellContext, ShellUser } from "@/components/layout/app-shell";
import { displayName } from "@/lib/format";
import type { Viewer } from "./auth";

/** Workspaces the viewer can switch between (admin, institutions, learner). */
export function contextsFor(viewer: Viewer): ShellContext[] {
  const contexts: ShellContext[] = [];
  if (viewer.isSanadyAdmin) {
    contexts.push({ key: "admin", label: "Administration SANADY", description: "Gestion de la plateforme", href: "/admin", kind: "admin" });
  }
  for (const inst of viewer.adminInstitutions) {
    contexts.push({
      key: `inst:${inst.id}`,
      label: inst.name,
      description: "Espace établissement",
      href: `/etablissement/${inst.id}`,
      kind: "institution",
    });
  }
  contexts.push({ key: "teacher", label: "Espace enseignant", description: "Mes formations", href: "/espace", kind: "teacher" });
  return contexts;
}

export function shellUser(viewer: Viewer): ShellUser {
  return { name: displayName(viewer.profile), email: viewer.email };
}
