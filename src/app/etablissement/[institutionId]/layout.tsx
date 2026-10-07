import { AppShell } from "@/components/layout/app-shell";
import { signOut } from "@/server/actions/auth";
import { requireInstitutionAdmin } from "@/server/auth";
import { contextsFor, shellUser } from "@/server/shell";

export default async function InstitutionLayout(props: LayoutProps<"/etablissement/[institutionId]">) {
  const { institutionId } = await props.params;
  const { viewer } = await requireInstitutionAdmin(institutionId);
  return (
    <AppShell
      area="institution"
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
