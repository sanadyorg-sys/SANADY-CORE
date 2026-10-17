import { AppShell } from "@/components/layout/app-shell";
import { flushNotificationsLater } from "@/server/notifications";
import { signOut } from "@/server/actions/auth";
import { redirect } from "next/navigation";
import { requireViewer } from "@/server/auth";
import { companyLogoUrl, contextsFor, shellUser } from "@/server/shell";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  // A partner contact with no school is not a teacher.
  if (viewer.partnerOrganization && !viewer.institutions.length && !viewer.platformRole) redirect("/espace-partenaire");
  // An employee of a single company sees that company's logo.
  const company = viewer.isEmployeeOnly && viewer.institutions.length === 1 ? viewer.institutions[0] : undefined;
  const logo = await companyLogoUrl(company?.id);
  // E-mails queued by what this person just did go out after the response.
  flushNotificationsLater();
  return (
    <AppShell
      area="teacher"
      enterprise={viewer.isEmployeeOnly}
      currentContextKey="teacher"
      contexts={contextsFor(viewer)}
      user={shellUser(viewer)}
      signOutAction={signOut}
      companyLogo={logo && company ? { url: logo, name: company.name } : null}
    >
      {children}
    </AppShell>
  );
}
