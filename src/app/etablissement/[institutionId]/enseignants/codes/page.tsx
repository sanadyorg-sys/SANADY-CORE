import type { Metadata } from "next";
import { EnrollmentCodeForm } from "@/components/common/enrollment-code-form";
import { EnrollmentCodeList } from "@/components/common/enrollment-code-list";
import { Alert, Card, CardBody, CardHeader } from "@/components/ui/surface";
import { publicEnv } from "@/lib/env";
import { requireInstitutionAdmin } from "@/server/auth";
import { getEnrollmentCodes } from "@/server/queries/institution";
import { wording } from "@/lib/enterprise";

export const metadata: Metadata = { title: "Codes d’inscription" };

export default async function EnrollmentCodesPage(props: PageProps<"/etablissement/[institutionId]/enseignants/codes">) {
  const { institutionId } = await props.params;
  const say = wording((await requireInstitutionAdmin(institutionId)).institution.kind);
  const codes = await getEnrollmentCodes(institutionId);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
      <div className="space-y-4 self-start">
        <Card>
          <CardHeader title="Nouveau code" description={say("Partagez-le avec vos enseignants, par exemple lors d’une réunion d’équipe.")} />
          <CardBody>
            <EnrollmentCodeForm institutionId={institutionId} />
          </CardBody>
        </Card>
        <Alert tone="info">
          {say("Un code permet uniquement de rejoindre l’établissement. Il ne donne accès à aucune formation : vous restez maître des")}
          affectations.
        </Alert>
      </div>
      <Card>
        <CardHeader title={say("Codes de l’établissement")} description={say(`Les enseignants saisissent le code sur ${publicEnv.appUrl}/rejoindre.`)} />
        <EnrollmentCodeList codes={codes} institutionId={institutionId} joinUrl={`${publicEnv.appUrl}/rejoindre`} />
      </Card>
    </div>
  );
}
