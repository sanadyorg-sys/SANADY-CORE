import { AppShell } from "@/components/layout/app-shell";
import { flushNotificationsLater } from "@/server/notifications";
import { signOut } from "@/server/actions/auth";
import { requireInstitutionViewer } from "@/server/auth";
import { companyLogoUrl, contextsFor, shellUser } from "@/server/shell";

export default async function InstitutionLayout(props: LayoutProps<"/etablissement/[institutionId]">) {
  const { institutionId } = await props.params;
  const { viewer, institution, canManage } = await requireInstitutionViewer(institutionId);
  const logo = institution.kind === "enterprise" ? await companyLogoUrl(institutionId) : null;
  // E-mails queued by what this person just did go out after the response.
  flushNotificationsLater();
  return (
    <AppShell
      area="institution"
      navRole={canManage ? "admin" : "supervisor"}
      enterprise={institution.kind === "enterprise"}
      institutionId={institutionId}
      currentContextKey={`inst:${institutionId}`}
      contexts={contextsFor(viewer)}
      user={shellUser(viewer)}
      signOutAction={signOut}
      companyLogo={logo ? { url: logo, name: institution.name } : null}
    >
      {props.children}
    </AppShell>
  );
}
