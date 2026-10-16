import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, RotateCcw } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { SupportReplyForm } from "@/components/enterprise/support-forms";
import { SupportThread } from "@/components/enterprise/support-thread";
import { Alert, Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/surface";
import { formatDateTime } from "@/lib/format";
import { SUPPORT_CATEGORIES, SUPPORT_PRIORITY, SUPPORT_STATUS } from "@/lib/enterprise";
import { uuidSchema } from "@/lib/validation";
import { setSupportStatus } from "@/server/actions/support";
import { requireInstitutionAdmin } from "@/server/auth";
import { getSupportRequest } from "@/server/queries/support";

export const metadata: Metadata = { title: "Demande d’assistance" };

export default async function WorkspaceSupportRequestPage(props: PageProps<"/etablissement/[institutionId]/assistance/[requestId]">) {
  const { institutionId, requestId } = await props.params;
  const { institution } = await requireInstitutionAdmin(institutionId);
  if (institution.kind !== "enterprise" || !uuidSchema.safeParse(requestId).success) notFound();
  const detail = await getSupportRequest(requestId);
  if (!detail || detail.request.institution_id !== institutionId) notFound();
  const { request: r, messages } = detail;
  const back = `/etablissement/${institutionId}/assistance`;

  return (
    <>
      <Link href={back} className="mb-3 inline-flex items-center gap-1.5 text-label text-ink-600 hover:text-ink-900">
        <ArrowLeft className="size-4" aria-hidden /> Assistance
      </Link>
      <PageHeader
        title={r.subject}
        description={`${r.reference} · ${SUPPORT_CATEGORIES[r.category]} · priorité ${SUPPORT_PRIORITY[r.priority].toLowerCase()} · ouverte le ${formatDateTime(r.created_at)}`}
        actions={<Badge tone={SUPPORT_STATUS[r.status].tone}>{SUPPORT_STATUS[r.status].label}</Badge>}
      />
      {r.status === "waiting_client" ? (
        <Alert tone="warning" className="mb-4">
          L’équipe SANADY attend votre réponse pour avancer.
        </Alert>
      ) : null}
      {r.status === "resolved" ? (
        <Alert tone="success" className="mb-4">
          L’équipe SANADY considère la demande comme résolue. Fermez-la si tout est en ordre, ou rouvrez-la si le problème persiste.
        </Alert>
      ) : null}
      <Card>
        <CardHeader title="Échanges" />
        <CardBody className="space-y-5">
          <SupportThread messages={messages} team={false} />
          {r.status !== "closed" ? (
            <>
              <SupportReplyForm requestId={r.id} institutionId={institutionId} team={false} />
              <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
                {r.status === "resolved" ? (
                  <ActionButton action={setSupportStatus.bind(null, r.id, institutionId, "in_progress")}>
                    <RotateCcw aria-hidden /> Rouvrir la demande
                  </ActionButton>
                ) : null}
                <ActionButton
                  action={setSupportStatus.bind(null, r.id, institutionId, "closed")}
                  confirm={{ title: "Fermer la demande ?", description: "Vous ne pourrez plus y répondre ; une nouvelle demande reste possible.", confirmLabel: "Fermer la demande", tone: "primary" }}
                >
                  <CheckCircle2 aria-hidden /> Fermer la demande
                </ActionButton>
              </div>
            </>
          ) : (
            <p className="text-label text-ink-500">Demande fermée le {r.closed_at ? formatDateTime(r.closed_at) : "—"}.</p>
          )}
        </CardBody>
      </Card>
    </>
  );
}
