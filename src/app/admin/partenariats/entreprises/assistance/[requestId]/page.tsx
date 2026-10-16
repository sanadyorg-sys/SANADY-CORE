import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { SupportAssignForm, SupportReplyForm } from "@/components/enterprise/support-forms";
import { SupportThread } from "@/components/enterprise/support-thread";
import { Badge, Card, CardBody, CardHeader, DescriptionList, PageHeader } from "@/components/ui/surface";
import { displayName, formatDateTime } from "@/lib/format";
import { SUPPORT_CATEGORIES, SUPPORT_PRIORITY, SUPPORT_STATUS, supportNextSteps, type SupportStatus } from "@/lib/enterprise";
import { uuidSchema } from "@/lib/validation";
import { setSupportStatus } from "@/server/actions/support";
import { requireEnterpriseStaff } from "@/server/auth";
import { enterpriseTeam } from "@/server/queries/enterprise";
import { getSupportRequest, supportCommitments } from "@/server/queries/support";

export const metadata: Metadata = { title: "Demande d’assistance — Enterprise" };

const STEP_LABEL: Record<SupportStatus, string> = {
  open: "Nouvelle",
  in_progress: "Passer « en cours »",
  waiting_client: "Attendre la réponse de l’entreprise",
  resolved: "Marquer comme résolue",
  closed: "Fermer la demande",
};

function hoursBetween(a: string, b: string) {
  const h = (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000;
  return h < 1 ? "moins d’une heure" : `${Math.round(h * 10) / 10} h`.replace(".", ",");
}

export default async function SupportRequestPage(props: PageProps<"/admin/partenariats/entreprises/assistance/[requestId]">) {
  await requireEnterpriseStaff();
  const { requestId } = await props.params;
  if (!uuidSchema.safeParse(requestId).success) notFound();
  const detail = await getSupportRequest(requestId);
  if (!detail) notFound();
  const { request: r, messages, opener } = detail;
  const [team, commitments] = await Promise.all([enterpriseTeam(), supportCommitments(r.tenant_id)]);

  return (
    <>
      <Link href="/admin/partenariats/entreprises/assistance" className="mb-3 inline-flex items-center gap-1.5 text-label text-ink-600 hover:text-ink-900">
        <ArrowLeft className="size-4" aria-hidden /> Assistance
      </Link>
      <PageHeader
        title={r.subject}
        description={`${r.reference} · ${r.tenant?.display_name ?? ""} · ${SUPPORT_CATEGORIES[r.category]}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {r.priority === "urgent" ? <Badge tone="danger">Urgente</Badge> : null}
            <Badge tone={SUPPORT_STATUS[r.status].tone}>{SUPPORT_STATUS[r.status].label}</Badge>
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <CardHeader title="Échanges" description="Les notes internes (fond jaune) ne sont jamais montrées à l’entreprise." />
          <CardBody className="space-y-5">
            <SupportThread messages={messages} team />
            {r.status !== "closed" ? <SupportReplyForm requestId={r.id} institutionId={r.institution_id} team /> : null}
          </CardBody>
        </Card>
        <div className="space-y-6 self-start">
          <Card>
            <CardHeader title="Suivi" />
            <CardBody className="space-y-4">
              <SupportAssignForm requestId={r.id} assignedTo={r.assigned_to} team={team.map((m) => ({ id: m.id, label: displayName(m) }))} />
              {supportNextSteps(r.status, true).length ? (
                <div className="flex flex-col gap-2">
                  {supportNextSteps(r.status, true).map((s) => (
                    <ActionButton key={s} action={setSupportStatus.bind(null, r.id, r.institution_id, s)}>
                      {STEP_LABEL[s]}
                    </ActionButton>
                  ))}
                </div>
              ) : null}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Informations" />
            <CardBody>
              <DescriptionList
                items={[
                  { term: "Ouverte par", value: opener ? displayName(opener) : "Administrateur de l’entreprise" },
                  { term: "Ouverte le", value: formatDateTime(r.created_at) },
                  { term: "Priorité", value: SUPPORT_PRIORITY[r.priority] },
                  { term: "Première réponse", value: r.first_response_at ? `${formatDateTime(r.first_response_at)} (${hoursBetween(r.created_at, r.first_response_at)})` : "Pas encore" },
                  { term: "Résolue le", value: r.resolved_at ? formatDateTime(r.resolved_at) : "—" },
                  { term: "Niveau de support", value: r.tenant?.support_level ?? "Non renseigné" },
                ]}
              />
              {commitments ? (
                <div className="mt-4 rounded-xl bg-ink-50 px-3 py-2 text-label text-ink-700">
                  <p className="font-medium text-ink-800">Engagements de support — {commitments.reference}</p>
                  <p className="mt-1 whitespace-pre-line">{commitments.support_commitments}</p>
                </div>
              ) : null}
              {r.tenant ? (
                <Link href={`/admin/partenariats/entreprises/espaces/${r.tenant.id}`} className="mt-4 inline-block text-label text-accent-700 hover:underline">
                  Voir l’espace de formation
                </Link>
              ) : null}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
