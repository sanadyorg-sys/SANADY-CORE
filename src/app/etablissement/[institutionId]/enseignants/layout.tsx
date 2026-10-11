import { PageHeader } from "@/components/ui/surface";
import { LinkTabs } from "@/components/ui/tabs";
import { requireInstitutionViewer } from "@/server/auth";

export default async function TeachersLayout(props: LayoutProps<"/etablissement/[institutionId]/enseignants">) {
  const { institutionId } = await props.params;
  const base = `/etablissement/${institutionId}/enseignants`;
  const { canManage } = await requireInstitutionViewer(institutionId);
  return (
    <>
      <PageHeader
        title="Nos enseignants"
        description={canManage ? "Annuaire, invitations et codes d’inscription de l’établissement." : "Annuaire des enseignants de l’établissement (lecture seule)."}
      />
      {canManage ? (
        <LinkTabs
          exact
          className="mb-6"
          items={[
            { href: base, label: "Annuaire" },
            { href: `${base}/invitations`, label: "Invitations" },
            { href: `${base}/codes`, label: "Codes d’inscription" },
          ]}
        />
      ) : null}
      {props.children}
    </>
  );
}
