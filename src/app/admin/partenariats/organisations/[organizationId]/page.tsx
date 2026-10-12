import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarClock, Mail, Pencil, Phone, Star, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { ContactForm, NoteForm, OrganizationForm, PartnerStatusForm, TaskForm } from "@/components/partnerships/admin-forms";
import { HistoryList, NotesList } from "@/components/partnerships/timeline";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/overlay";
import { Badge, Card, CardBody, CardHeader, DescriptionList, PageHeader } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { displayName, formatDate, formatDateTime } from "@/lib/format";
import {
  APPLICATION_STATUS,
  CONTRIBUTION_TYPES,
  INTERVENTION_FIELDS,
  ORG_TYPES,
  PIPELINE,
  PIPELINE_ORDER,
  allowedNextSteps,
  stageTone,
} from "@/lib/partnerships";
import { uuidSchema } from "@/lib/validation";
import { deleteContact, setTaskDone } from "@/server/actions/partnerships";
import { requirePartnershipStaff } from "@/server/auth";
import { getOrganization, partnershipTeam, pipelineActor } from "@/server/queries/partnerships";

export const metadata: Metadata = { title: "Organisation partenaire" };

const MAIN_STAGES = PIPELINE_ORDER.slice(0, 11);

export default async function OrganizationPage(props: PageProps<"/admin/partenariats/organisations/[organizationId]">) {
  const viewer = await requirePartnershipStaff();
  const { organizationId } = await props.params;
  if (!uuidSchema.safeParse(organizationId).success) notFound();
  const [detail, team, actor] = await Promise.all([getOrganization(organizationId), partnershipTeam(), pipelineActor(viewer)]);
  if (!detail) notFound();
  // An enterprise-only client has no partnership record yet.
  if (!detail.organization.status) redirect(`/admin/partenariats/entreprises/clients/${organizationId}`);
  const { organization: o, contacts, notes, history, tasks, applications } = detail;
  const stageIndex = MAIN_STAGES.indexOf(o.status);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <Link href="/admin/partenariats/organisations" className="mb-3 inline-flex items-center gap-1.5 text-label text-ink-600 hover:text-ink-900">
        <ArrowLeft className="size-4" aria-hidden /> Organisations partenaires
      </Link>
      <PageHeader
        title={o.name}
        description={[ORG_TYPES[o.org_type], o.country, o.city].filter(Boolean).join(" · ")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={stageTone(o.status)}>{PIPELINE[o.status]}</Badge>
            <Drawer
              title="Modifier la fiche"
              width="max-w-xl"
              trigger={
                <Button variant="secondary">
                  <Pencil aria-hidden /> Modifier
                </Button>
              }
            >
              <div className="p-5">
                <OrganizationForm organization={o} />
              </div>
            </Drawer>
          </div>
        }
      />

      {/* Stage progress (the 11 stages of the brief). */}
      <Card className="mb-6 overflow-x-auto p-4">
        <ol className="flex min-w-max items-center gap-1" aria-label="Étapes du partenariat">
          {MAIN_STAGES.map((s, i) => (
            <li key={s} className="flex items-center gap-1">
              <span
                className={cn(
                  "rounded-lg px-2.5 py-1 text-caption",
                  i === stageIndex ? "bg-accent-700 font-semibold text-white" : i < stageIndex ? "bg-accent-50 text-accent-900" : "text-ink-500",
                )}
                aria-current={i === stageIndex ? "step" : undefined}
              >
                {PIPELINE[s]}
              </span>
              {i < MAIN_STAGES.length - 1 ? <span aria-hidden className="h-px w-3 bg-line-strong" /> : null}
            </li>
          ))}
        </ol>
        {stageIndex < 0 ? <p className="mt-3 text-label font-medium text-ink-700">Partenariat clos : {PIPELINE[o.status]}.</p> : null}
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Profil" />
            <CardBody>
              <DescriptionList
                items={[
                  { term: "Domaines", value: o.fields.length ? o.fields.map((f) => INTERVENTION_FIELDS[f]?.name ?? f).join(", ") : "—" },
                  { term: "Contributions", value: o.contributions.length ? o.contributions.map((c) => CONTRIBUTION_TYPES[c]).join(", ") : "—" },
                  { term: "Secteur", value: o.sector ?? "—" },
                  {
                    term: "Site web",
                    value: o.website ? (
                      <a href={o.website} target="_blank" rel="noopener noreferrer nofollow" className="text-accent-700 hover:underline">
                        {o.website}
                      </a>
                    ) : (
                      "—"
                    ),
                  },
                  { term: "Responsable SANADY", value: o.assignee ? displayName(o.assignee) : "—" },
                ]}
              />
              {o.description ? <p className="mt-4 whitespace-pre-line text-body text-ink-800">{o.description}</p> : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Contacts" />
            {contacts.length ? (
              <ul className="divide-y divide-line">
                {contacts.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink-900">
                        {c.full_name}{" "}
                        {c.is_primary ? (
                          <Badge tone="accent">
                            <Star className="size-3" aria-hidden /> Principal
                          </Badge>
                        ) : null}
                      </p>
                      {c.job_title ? <p className="text-caption text-ink-500">{c.job_title}</p> : null}
                      <p className="mt-1 flex flex-wrap gap-x-4 text-label text-ink-700">
                        {c.email ? (
                          <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 hover:text-accent-700 hover:underline">
                            <Mail className="size-3.5" aria-hidden /> {c.email}
                          </a>
                        ) : null}
                        {c.phone ? (
                          <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 hover:text-accent-700 hover:underline">
                            <Phone className="size-3.5" aria-hidden /> {c.phone}
                          </a>
                        ) : null}
                      </p>
                    </div>
                    <ActionButton
                      variant="danger-ghost"
                      action={deleteContact.bind(null, c.id, o.id)}
                      confirm={{ title: "Supprimer ce contact ?", description: `${c.full_name} sera retiré de la fiche.`, confirmLabel: "Supprimer" }}
                    >
                      <Trash2 aria-hidden /> <span className="sr-only">Supprimer {c.full_name}</span>
                    </ActionButton>
                  </li>
                ))}
              </ul>
            ) : (
              <CardBody>
                <p className="text-body text-ink-600">Aucun contact.</p>
              </CardBody>
            )}
            <CardBody className="border-t border-line">
              <ContactForm organizationId={o.id} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Notes et échanges" description="Réunions, appels, décisions — visibles par l’équipe partenariats uniquement." />
            <CardBody className="space-y-5">
              <NoteForm organizationId={o.id} />
              <NotesList notes={notes} />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Étape du partenariat" />
            <CardBody>
              <PartnerStatusForm id={o.id} allowed={allowedNextSteps(o.status, actor)} />
              {!actor.signatory ? (
                <p className="mt-3 text-caption text-ink-500">
                  La validation d’une convention est réservée aux approbateurs habilités désignés dans « Équipe SANADY ».
                </p>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Tâches de suivi" />
            {tasks.length ? (
              <ul className="divide-y divide-line">
                {tasks.map((t) => {
                  const late = !t.done_at && t.due_on && t.due_on < today;
                  return (
                    <li key={t.id} className="flex items-start justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className={cn("text-body", t.done_at ? "text-ink-500 line-through" : "font-medium text-ink-900")}>{t.title}</p>
                        <p className="mt-0.5 flex flex-wrap gap-x-2 text-caption text-ink-500">
                          {t.due_on ? (
                            <span className={late ? "inline-flex items-center gap-1 font-semibold text-danger-600" : "inline-flex items-center gap-1"}>
                              <CalendarClock className="size-3.5" aria-hidden /> {late ? "En retard — " : ""}
                              {formatDate(t.due_on)}
                            </span>
                          ) : null}
                          {t.assignee ? <span>{displayName(t.assignee)}</span> : null}
                        </p>
                      </div>
                      <ActionButton action={setTaskDone.bind(null, t.id, !t.done_at, o.id)}>{t.done_at ? "Rouvrir" : "Terminer"}</ActionButton>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            <CardBody className={tasks.length ? "border-t border-line" : undefined}>
              <TaskForm organizationId={o.id} team={team.filter((m) => m.id !== viewer.id)} />
            </CardBody>
          </Card>

          {applications.length ? (
            <Card>
              <CardHeader title="Candidatures liées" />
              <ul className="divide-y divide-line">
                {applications.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <Link href={`/admin/partenariats/candidatures/${a.id}`} className="font-mono text-label text-accent-700 hover:underline">
                      {a.reference}
                    </Link>
                    <span className="text-caption text-ink-500">
                      {APPLICATION_STATUS[a.status].label} · {formatDate(a.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Historique" description={`Fiche créée le ${formatDateTime(o.created_at)}`} />
            <CardBody>
              <HistoryList history={history} labels={PIPELINE} />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
