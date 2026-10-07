import { PageHeader } from "@/components/ui/surface";
import { LinkTabs } from "@/components/ui/tabs";

export default async function TeachersLayout(props: LayoutProps<"/etablissement/[institutionId]/enseignants">) {
  const { institutionId } = await props.params;
  const base = `/etablissement/${institutionId}/enseignants`;
  return (
    <>
      <PageHeader title="Nos enseignants" description="Annuaire, invitations et codes d’inscription de l’établissement." />
      <LinkTabs
        exact
        className="mb-6"
        items={[
          { href: base, label: "Annuaire" },
          { href: `${base}/invitations`, label: "Invitations" },
          { href: `${base}/codes`, label: "Codes d’inscription" },
        ]}
      />
      {props.children}
    </>
  );
}
