import type { Metadata } from "next";
import { InvitationTable } from "@/components/common/invitation-table";
import { InviteForm } from "@/components/common/invite-form";
import { Card, CardBody, CardHeader } from "@/components/ui/surface";
import { requireInstitutionAdmin } from "@/server/auth";
import { getInstitutionInvitations } from "@/server/queries/institution";

export const metadata: Metadata = { title: "Invitations" };

export default async function InstitutionInvitationsPage(props: PageProps<"/etablissement/[institutionId]/enseignants/invitations">) {
  const { institutionId } = await props.params;
  await requireInstitutionAdmin(institutionId);
  const invitations = await getInstitutionInvitations(institutionId);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
      <Card className="self-start">
        <CardHeader
          title="Inviter un enseignant"
          description="L’enseignant crée son compte (ou utilise son compte existant) et donne son accord pour rejoindre l’établissement."
        />
        <CardBody>
          <InviteForm kinds={["institution_teacher"]} fixedInstitutionId={institutionId} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Invitations envoyées" description="Une invitation expire automatiquement et ne peut être utilisée qu’une fois." />
        <InvitationTable invitations={invitations} />
      </Card>
    </div>
  );
}
