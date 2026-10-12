import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, Pencil, Plus } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { AgreementForm, AgreementStatusForm, ContributionForm, DocumentUpload, MilestoneForm } from "@/components/partnerships/agreement-forms";
import { DocumentList } from "@/components/partnerships/document-list";
import { HistoryList } from "@/components/partnerships/timeline";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/overlay";
import { Alert, Badge, Card, CardBody, CardHeader, DescriptionList, PageHeader } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { displayName, formatDate, formatDateTime } from "@/lib/format";
import {
  AGREEMENT_STATUS,
  CONTRIBUTION_KINDS,
  CONTRIBUTION_STAGE,
  INTERVENTION_FIELDS,
  agreementNextSteps,
  contributionAmount,
  type DocumentKind,
} from "@/lib/partnerships";
import { uuidSchema } from "@/lib/validation";
import { setMilestoneDone } from "@/server/actions/agreements";
import { requirePartnershipStaff } from "@/server/auth";
import { getAgreement, linkOptions } from "@/server/queries/agreements";
import { pipelineActor } from "@/server/queries/partnerships";

export const metadata: Metadata = { title: "Convention de partenariat" };

const LABELS = Object.fromEntries(Object.entries(AGREEMENT_STATUS).map(([k, v]) => [k, v.label]));

export default async function AgreementPage(props: PageProps<"/admin/partenariats/conventions/[agreementId]">) {
  const viewer = await requirePartnershipStaff();
  const { agreementId } = await props.params;
  if (!uuidSchema.safeParse(agreementId).success) notFound();
  const [detail, actor] = await Promise.all([getAgreement(agreementId), pipelineActor(viewer)]);
  if (!detail) notFound();
  const { agreement: a, documents, milestones, history, contributions } = detail;
  const links = await linkOptions(a.organization_id);
  const draft = a.status === "draft";
  const closed = a.status === "completed" || a.status === "archived";
  const today = new Date().toISOString().slice(0, 10);
  const docKinds: DocumentKind[] = actor.signatory && ["approved", "signed", "active"].includes(a.status) ? ["signed", "draft", "supporting"] : ["draft", "supporting"];

  return (
    <>
      <Link href="/admin/partenariats/conventions" className="mb-3 inline-flex items-center gap-1.5 text-label text-ink-600 hover:text-ink-900">
        <ArrowLeft className="size-4" aria-hidden /> Conventions
      </Link>
      <PageHeader
        title={a.title}
        description={`${a.reference} · ${INTERVENTION_FIELDS[a.intervention_field]?.name ?? ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={AGREEMENT_STATUS[a.status].tone}>{AGREEMENT_STATUS[a.status].label}</Badge>
            {a.organization ? (
              <Link href={`/admin/partenariats/organisations/${a.organization.id}`} className="text-label text-accent-700 hover:underline">
                {a.organization.name}
              </Link>
            ) : null}
            {draft && actor.staff ? (
              <Drawer
                title="Modifier la convention"
                width="max-w-2xl"
                trigger={
                  <Button variant="secondary">
                    <Pencil aria-hidden /> Modifier
                  </Button>
                }
              >
                <div className="p-5">
                  <AgreementForm organizationId={a.organization_id} agreement={a} opportunities={links.opportunities} />
                </div>
              </Drawer>
            ) : null}
          </div>
        }
      />
      {!draft && !closed ? (
        <Alert tone="info" className="mb-6">
          {a.status === "internal_review"
            ? "En revue : un approbateur habilité approuve ou renvoie la convention en brouillon."
            : a.status === "approved"
              ? `Approuvée${a.approver ? ` par ${displayName(a.approver)}` : ""}${a.approved_at ? ` le ${formatDateTime(a.approved_at)}` : ""}. Après la signature, un approbateur joint l’exemplaire signé et enregistre la date.`
              : `Signée le ${a.signed_on ? formatDate(a.signed_on) : "—"}${a.recorder ? ` (enregistré par ${displayName(a.recorder)})` : ""}. Le contenu est figé.`}
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Convention" />
            <CardBody className="space-y-4">
              <DescriptionList
                items={[
                  { term: "Partenaire", value: a.organization?.name ?? "—" },
                  { term: "Projet concerné", value: a.opportunity ? `${a.opportunity.reference} — ${a.opportunity.title}` : "—" },
                  { term: "Période", value: a.start_on && a.end_on ? `du ${formatDate(a.start_on)} au ${formatDate(a.end_on)}` : "—" },
                  { term: "Rappel de renouvellement", value: `${a.renewal_notice_days} jours avant la fin` },
                ]}
              />
              {[
                ["Objectifs", a.objectives],
                ["Responsabilités", a.responsibilities],
                ["Contributions prévues", a.contributions_summary],
                ["Conditions de renouvellement", a.renewal_terms],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k}>
                    <h3 className="text-label font-semibold text-ink-600">{k}</h3>
                    <p className="mt-1 whitespace-pre-line text-body text-ink-800">{v}</p>
                  </div>
                ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Documents" description="Projets, exemplaire signé et pièces justificatives (PDF, stockage privé)." />
            <CardBody className="space-y-4">
              <DocumentList documents={documents} target="agreement" targetId={a.id} canDelete={(d) => actor.staff && d.kind !== "signed"} />
              {a.status !== "archived" ? <DocumentUpload target="agreement" targetId={a.id} kinds={docKinds} /> : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Étapes du projet" description="Jalons de mise en œuvre ; les échéances proches apparaissent dans « À surveiller »." />
            {milestones.length ? (
              <ul className="divide-y divide-line">
                {milestones.map((m) => {
                  const late = !m.done_at && m.due_on < today;
                  return (
                    <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className={cn("text-body", m.done_at ? "text-ink-500 line-through" : "font-medium text-ink-900")}>{m.title}</p>
                        <p className={cn("inline-flex items-center gap-1 text-caption", late ? "font-semibold text-danger-600" : "text-ink-500")}>
                          <CalendarClock className="size-3.5" aria-hidden /> {late ? "En retard — " : ""}
                          {formatDate(m.due_on)}
                        </p>
                      </div>
                      {actor.staff ? <ActionButton action={setMilestoneDone.bind(null, m.id, !m.done_at, a.id)}>{m.done_at ? "Rouvrir" : "Réalisée"}</ActionButton> : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {actor.staff && !closed ? (
              <CardBody className={milestones.length ? "border-t border-line" : undefined}>
                <MilestoneForm agreementId={a.id} />
              </CardBody>
            ) : null}
          </Card>

          <Card>
            <CardHeader title="Contributions liées" />
            {contributions.length ? (
              <ul className="divide-y divide-line">
                {contributions.map((c) => (
                  <li key={c.id} className="px-5 py-3">
                    <Link href={`/admin/partenariats/contributions/${c.id}`} className="font-medium text-ink-900 hover:text-accent-700 hover:underline">
                      {c.description}
                    </Link>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-caption text-ink-500">
                      {CONTRIBUTION_KINDS[c.kind]} · {contributionAmount(c)}
                      <Badge tone={CONTRIBUTION_STAGE[c.stage].tone}>{CONTRIBUTION_STAGE[c.stage].label}</Badge>
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
            {actor.staff ? (
              <CardBody className={contributions.length ? "border-t border-line" : undefined}>
                <Drawer
                  title="Nouvelle contribution"
                  description="Enregistrée comme promesse ; la réception est saisie à part."
                  width="max-w-2xl"
                  trigger={
                    <Button variant="secondary">
                      <Plus aria-hidden /> Enregistrer une contribution
                    </Button>
                  }
                >
                  <div className="p-5">
                    <ContributionForm organizationId={a.organization_id} agreements={links.agreements} opportunities={links.opportunities} defaultAgreement={a.id} />
                  </div>
                </Drawer>
              </CardBody>
            ) : null}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Statut" />
            <CardBody>
              <AgreementStatusForm id={a.id} options={agreementNextSteps(a.status, actor)} />
              {!actor.signatory ? (
                <p className="mt-3 text-caption text-ink-500">L’approbation et l’enregistrement de la signature reviennent aux approbateurs habilités.</p>
              ) : null}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Historique" description={`Créée le ${formatDateTime(a.created_at)}`} />
            <CardBody>
              <HistoryList history={history} labels={LABELS} />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
