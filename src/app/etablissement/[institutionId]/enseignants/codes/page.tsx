import type { Metadata } from "next";
import { EnrollmentCodeForm } from "@/components/common/enrollment-code-form";
import { EnrollmentCodeList } from "@/components/common/enrollment-code-list";
import { Alert, Card, CardBody, CardHeader } from "@/components/ui/surface";
import { publicEnv } from "@/lib/env";
import { requireInstitutionAdmin } from "@/server/auth";
import { getEnrollmentCodes } from "@/server/queries/institution";

export const metadata: Metadata = { title: "Codes d’inscription" };

export default async function EnrollmentCodesPage(props: PageProps<"/etablissement/[institutionId]/enseignants/codes">) {
  const { institutionId } = await props.params;
  await requireInstitutionAdmin(institutionId);
  const codes = await getEnrollmentCodes(institutionId);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
      <div className="space-y-4 self-start">
        <Card>
          <CardHeader title="Nouveau code" description="Partagez-le avec vos enseignants, par exemple lors d’une réunion d’équipe." />
          <CardBody>
            <EnrollmentCodeForm institutionId={institutionId} />
          </CardBody>
        </Card>
        <Alert tone="info">
          Un code permet uniquement de rejoindre l’établissement. Il ne donne accès à aucune formation : vous restez maître des
          affectations.
        </Alert>
      </div>
      <Card>
        <CardHeader title="Codes de l’établissement" description={`Les enseignants saisissent le code sur ${publicEnv.appUrl}/rejoindre.`} />
        <EnrollmentCodeList codes={codes} institutionId={institutionId} joinUrl={`${publicEnv.appUrl}/rejoindre`} />
      </Card>
    </div>
  );
}
