import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Megaphone, Pencil } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { NeedForm, StatusChangeForm, TargetNoteForm } from "@/components/partnerships/target-forms";
import { HistoryList, NotesList } from "@/components/partnerships/timeline";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/overlay";
import { Alert, Badge, Card, CardBody, CardHeader, DescriptionList, PageHeader } from "@/components/ui/surface";
import { displayName, formatDateTime } from "@/lib/format";
import { INTERVENTION_FIELDS, NEED_PRIORITY, NEED_STATUS, OPPORTUNITY_STATUS, formatAmount, needNextSteps } from "@/lib/partnerships";
import { uuidSchema } from "@/lib/validation";
import { createOpportunityFromNeed } from "@/server/actions/partnerships";
import { requirePartnershipStaff } from "@/server/auth";
import { getNeed, institutionsForNeeds, partnershipTeam, pipelineActor } from "@/server/queries/partnerships";

export const metadata: Metadata = { title: "Besoin éducatif" };

const ACTION_LABELS: Record<string, string> = {
  internal_review: "Soumettre à la revue interne",
  identified: "Renvoyer en préparation",
  approved: "Valider le besoin (approbateur)",
  rejected: "Ne pas retenir (approbateur)",
  closed: "Clore le besoin",
};

export default async function NeedPage(props: PageProps<"/admin/partenariats/besoins/[needId]">) {
  const viewer = await requirePartnershipStaff();
  const { needId } = await props.params;
  if (!uuidSchema.safeParse(needId).success) notFound();
  const [detail, actor, institutions, team] = await Promise.all([getNeed(needId), pipelineActor(viewer), institutionsForNeeds(), partnershipTeam()]);
  if (!detail) notFound();
  const { need: n, notes, history, opportunities } = detail;
  const editable = n.status === "identified" || n.status === "internal_review";
  const steps = needNextSteps(n.status, actor);
  const labels = Object.fromEntries(Object.entries(NEED_STATUS).map(([k, v]) => [k, v.label]));

  return (
    <>
      <Link href="/admin/partenariats/besoins" className="mb-3 inline-flex items-center gap-1.5 text-label text-ink-600 hover:text-ink-900">
        <ArrowLeft className="size-4" aria-hidden /> Besoins éducatifs
      </Link>
      <PageHeader
        title={n.title}
        description={`${n.reference} · ${INTERVENTION_FIELDS[n.intervention_field]?.name}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={NEED_STATUS[n.status].tone}>{NEED_STATUS[n.status].label}</Badge>
            {editable ? (
              <Drawer
                title="Modifier le besoin"
                width="max-w-xl"
                trigger={
                  <Button variant="secondary">
                    <Pencil aria-hidden /> Modifier
                  </Button>
                }
              >
                <div className="p-5">
                  <NeedForm need={n} institutions={institutions} team={team.filter((m) => m.id !== viewer.id)} />
                </div>
              </Drawer>
            ) : null}
          </div>
        }
      />
      {!editable ? (
        <Alert tone="info" className="mb-6">
          Ce besoin a été {n.status === "approved" ? "validé" : "clos"}
          {n.decider ? ` par ${displayName(n.decider)}` : ""}
          {n.decided_at ? ` le ${formatDateTime(n.decided_at)}` : ""} : son contenu n’est plus modifiable.
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Le besoin" />
            <CardBody className="space-y-4">
              <DescriptionList
                items={[
                  { term: "Priorité", value: <Badge tone={NEED_PRIORITY[n.priority].tone}>{NEED_PRIORITY[n.priority].label}</Badge> },
                  { term: "Établissement", value: n.institution?.name ?? "—" },
                  { term: "Projet", value: n.project_label ?? "—" },
                  { term: "Coût estimé (interne)", value: formatAmount(n.estimated_cost, n.currency) ?? "—" },
                  { term: "Calendrier", value: n.timeline ?? "—" },
                  { term: "Responsable", value: n.responsible ? displayName(n.responsible) : "—" },
                ]}
              />
              <div>
                <h3 className="text-label font-semibold text-ink-600">Description</h3>
                <p className="mt-1 whitespace-pre-line text-body text-ink-800">{n.description}</p>
              </div>
              <div>
                <h3 className="text-label font-semibold text-ink-600">Justification éducative</h3>
                <p className="mt-1 whitespace-pre-line text-body text-ink-800">{n.justification}</p>
              </div>
              {n.required_resources ? (
                <div>
                  <h3 className="text-label font-semibold text-ink-600">Ressources nécessaires</h3>
                  <p className="mt-1 whitespace-pre-line text-body text-ink-800">{n.required_resources}</p>
                </div>
              ) : null}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Notes internes" />
            <CardBody className="space-y-5">
              <TargetNoteForm needId={n.id} />
              <NotesList notes={notes} />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Décision" />
            <CardBody>
              <StatusChangeForm
                id={n.id}
                kind="need"
                options={steps.map((s) => ({ value: s, label: ACTION_LABELS[s] ?? s }))}
                help={!actor.signatory && n.status === "internal_review" ? "La validation revient à un approbateur habilité." : undefined}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Projets publiables" description="Un projet est un document distinct, approuvé avant toute publication." />
            <CardBody className="space-y-3">
              {opportunities.length ? (
                <ul className="space-y-2">
                  {opportunities.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-2">
                      <Link href={`/admin/partenariats/opportunites/${o.id}`} className="text-body font-medium text-accent-700 hover:underline">
                        {o.reference} — {o.title}
                      </Link>
                      <Badge tone={OPPORTUNITY_STATUS[o.status].tone}>{OPPORTUNITY_STATUS[o.status].label}</Badge>
                    </li>
                  ))}
                </ul>
              ) : null}
              {n.status === "approved" ? (
                <ActionButton
                  variant="accent"
                  size="md"
                  action={createOpportunityFromNeed.bind(null, n.id)}
                  confirm={{
                    title: "Préparer un projet à partir de ce besoin ?",
                    description: "Un brouillon est créé (non public). Il devra être complété, relu puis approuvé avant publication.",
                    confirmLabel: "Créer le brouillon",
                  }}
                >
                  <Megaphone aria-hidden /> Préparer un projet
                </ActionButton>
              ) : (
                <p className="text-caption text-ink-500">Disponible une fois le besoin validé par un approbateur.</p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Historique" description={`Créé le ${formatDateTime(n.created_at)}`} />
            <CardBody>
              <HistoryList history={history} labels={labels} />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
