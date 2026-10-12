import { AppShell } from "@/components/layout/app-shell";
import { signOut } from "@/server/actions/auth";
import { requireInstitutionViewer } from "@/server/auth";
import { contextsFor, shellUser } from "@/server/shell";

export default async function InstitutionLayout(props: LayoutProps<"/etablissement/[institutionId]">) {
  const { institutionId } = await props.params;
  const { viewer, institution, canManage } = await requireInstitutionViewer(institutionId);
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
    >
      {props.children}
    </AppShell>
  );
}
