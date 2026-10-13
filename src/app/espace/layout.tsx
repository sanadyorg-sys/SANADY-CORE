import { AppShell } from "@/components/layout/app-shell";
import { signOut } from "@/server/actions/auth";
import { redirect } from "next/navigation";
import { requireViewer } from "@/server/auth";
import { contextsFor, shellUser } from "@/server/shell";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  // A partner contact with no school is not a teacher.
  if (viewer.partnerOrganization && !viewer.institutions.length && !viewer.platformRole) redirect("/espace-partenaire");
  return (
    <AppShell
      area="teacher"
      enterprise={viewer.isEmployeeOnly}
      currentContextKey="teacher"
      contexts={contextsFor(viewer)}
      user={shellUser(viewer)}
      signOutAction={signOut}
    >
      {children}
    </AppShell>
  );
}
