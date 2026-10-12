import type { Metadata } from "next";
import { InvitationTable } from "@/components/common/invitation-table";
import { InviteForm } from "@/components/common/invite-form";
import { BulkInviteForm } from "@/components/institution/bulk-invite-form";
import { Card, CardBody, CardHeader } from "@/components/ui/surface";
import { requireInstitutionAdmin } from "@/server/auth";
import { getDepartments, getInstitutionInvitations } from "@/server/queries/institution";
import { wording } from "@/lib/enterprise";

export const metadata: Metadata = { title: "Invitations" };

export default async function InstitutionInvitationsPage(props: PageProps<"/etablissement/[institutionId]/enseignants/invitations">) {
  const { institutionId } = await props.params;
  const { institution } = await requireInstitutionAdmin(institutionId);
  const say = wording(institution.kind);
  const enterprise = institution.kind === "enterprise";
  const [invitations, departments] = await Promise.all([getInstitutionInvitations(institutionId), enterprise ? getDepartments(institutionId) : []]);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
      <div className="space-y-6 self-start">
      <Card>
        <CardHeader
          title={say("Inviter un enseignant")}
          description={say("L’enseignant crée son compte (ou utilise son compte existant) et donne son accord pour rejoindre l’établissement.")}
        />
        <CardBody>
          <InviteForm kinds={["institution_teacher", "institution_supervisor"]} fixedInstitutionId={institutionId} departments={departments} enterprise={enterprise} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Invitations groupées" description={say("Invitez plusieurs enseignants en une fois. Chaque ligne est vérifiée comme une invitation individuelle.")} />
        <CardBody>
          <BulkInviteForm institutionId={institutionId} withDepartments={enterprise} />
        </CardBody>
      </Card>
      </div>
      <Card>
        <CardHeader title="Invitations envoyées" description="Une invitation expire automatiquement et ne peut être utilisée qu’une fois." />
        <InvitationTable invitations={invitations} />
      </Card>
    </div>
  );
}
