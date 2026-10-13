import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarClock, Mail, Pencil, Phone, Plus, Star, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { ContactForm, NoteForm, OrganizationForm, PartnerStatusForm, TaskForm } from "@/components/partnerships/admin-forms";
import { AgreementForm, ContributionForm } from "@/components/partnerships/agreement-forms";
import { RelationshipCard } from "@/components/enterprise/relationship-card";
import { MetricForm, ReportForm } from "@/components/partnerships/impact-forms";
import { DeliverableReviewForm, InvitePartnerForm, TeamMessageForm } from "@/components/partnerships/portal-forms";
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
  AGREEMENT_STATUS,
  CONTRIBUTION_KINDS,
  CONTRIBUTION_STAGE,
  allowedNextSteps,
  METRIC_STATUS,
  REPORT_STATUS,
  contributionAmount,
  dimensionLabel,
  stageTone,
} from "@/lib/partnerships";
import { uuidSchema } from "@/lib/validation";
import { deleteContact, setTaskDone } from "@/server/actions/partnerships";
import { revokePartnerMember } from "@/server/actions/portal";
import { requirePartnershipStaff } from "@/server/auth";
import { linkOptions, listAgreements, listContributions } from "@/server/queries/agreements";
import { organizationRelationships } from "@/server/queries/finance";
import { listMetrics, listReports } from "@/server/queries/impact";
import { portalEnabled, portalForOrganization } from "@/server/queries/portal";
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
  const [agreements, contributions, links, metrics, reports, portalOn, portal] = await Promise.all([
    listAgreements({ organization: o.id }),
    listContributions({ organization: o.id }),
    linkOptions(o.id),
    listMetrics({ organization: o.id }),
    listReports({ organization: o.id }),
    portalEnabled(),
    portalForOrganization(o.id),
  ]);
  const relationships = o.enterprise_status ? await organizationRelationships(o.id) : null;
  const activePartner = ["agreement_signed", "implementation", "monitoring", "renewal_or_closure"].includes(o.status);
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
            <CardHeader title="Conventions" />
            {agreements.length ? (
              <ul className="divide-y divide-line">
                {agreements.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                    <Link href={`/admin/partenariats/conventions/${a.id}`} className="min-w-0 font-medium text-ink-900 hover:text-accent-700 hover:underline">
                      {a.title}
                      <span className="block text-caption font-normal text-ink-500">{a.reference}</span>
                    </Link>
                    <Badge tone={AGREEMENT_STATUS[a.status].tone}>{AGREEMENT_STATUS[a.status].label}</Badge>
                  </li>
                ))}
              </ul>
            ) : null}
            <CardBody className={agreements.length ? "border-t border-line" : undefined}>
              <Drawer
                title="Nouvelle convention"
                description="Créée en brouillon ; elle sera approuvée puis signée hors de la plateforme."
                width="max-w-2xl"
                trigger={
                  <Button variant="secondary">
                    <Plus aria-hidden /> Préparer une convention
                  </Button>
                }
              >
                <div className="p-5">
                  <AgreementForm organizationId={o.id} opportunities={links.opportunities} />
                </div>
              </Drawer>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Contributions" description="Promesses, réceptions et vérifications — jamais additionnées entre elles." />
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
                  <ContributionForm organizationId={o.id} agreements={links.agreements} opportunities={links.opportunities} />
                </div>
              </Drawer>
            </CardBody>
          </Card>

          {relationships ? <RelationshipCard r={relationships} /> : null}

          <Card id="impact">
            <CardHeader title="Indicateurs d’impact" description="Saisis par l’équipe, vérifiés par un approbateur. Seuls les indicateurs vérifiés entrent dans les rapports." />
            {metrics.length ? (
              <ul className="divide-y divide-line">
                {metrics.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-start justify-between gap-2 px-5 py-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink-900">
                        {dimensionLabel(m.dimension, m.label)} : {Number(m.value).toLocaleString("fr-FR")}
                        {m.unit ? ` ${m.unit}` : ""}
                      </p>
                      <p className="text-caption text-ink-500">
                        {m.metric_type === "output" ? "Réalisation" : "Résultat"} · du {formatDate(m.period_start)} au {formatDate(m.period_end)}
                        {m.agreement ? ` · ${m.agreement.reference}` : ""}
                      </p>
                      {m.status === "rejected" && m.review_comment ? <p className="mt-1 text-label text-danger-700">À corriger : {m.review_comment}</p> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={METRIC_STATUS[m.status].tone}>{METRIC_STATUS[m.status].label}</Badge>
                      {m.status !== "verified" ? (
                        <Drawer
                          title="Corriger l’indicateur"
                          width="max-w-2xl"
                          trigger={
                            <Button variant="ghost" size="sm">
                              <Pencil aria-hidden /> <span className="sr-only">Corriger {dimensionLabel(m.dimension, m.label)}</span>
                            </Button>
                          }
                        >
                          <div className="p-5">
                            <MetricForm organizationId={o.id} metric={m} agreements={links.agreements} opportunities={links.opportunities} />
                          </div>
                        </Drawer>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
            <CardBody className={metrics.length ? "border-t border-line" : undefined}>
              <Drawer
                title="Nouvel indicateur d’impact"
                description="Un chiffre mesuré, rattaché à une convention ou à un projet, avec sa méthode et la part du partenariat."
                width="max-w-2xl"
                trigger={
                  <Button variant="secondary">
                    <Plus aria-hidden /> Saisir un indicateur
                  </Button>
                }
              >
                <div className="p-5">
                  <MetricForm organizationId={o.id} agreements={links.agreements} opportunities={links.opportunities} />
                </div>
              </Drawer>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Rapports au partenaire" />
            {reports.length ? (
              <ul className="divide-y divide-line">
                {reports.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                    <Link href={`/admin/partenariats/rapports/${r.id}`} className="min-w-0 font-medium text-ink-900 hover:text-accent-700 hover:underline">
                      {r.title}
                      <span className="block text-caption font-normal text-ink-500">{r.reference}</span>
                    </Link>
                    <Badge tone={REPORT_STATUS[r.status].tone}>{REPORT_STATUS[r.status].label}</Badge>
                  </li>
                ))}
              </ul>
            ) : null}
            <CardBody className={reports.length ? "border-t border-line" : undefined}>
              <Drawer
                title="Nouveau rapport au partenaire"
                description="Construit à partir des données vérifiées ; approuvé avant transmission."
                width="max-w-2xl"
                trigger={
                  <Button variant="secondary">
                    <Plus aria-hidden /> Préparer un rapport
                  </Button>
                }
              >
                <div className="p-5">
                  <ReportForm organizationId={o.id} agreements={links.agreements} />
                </div>
              </Drawer>
            </CardBody>
          </Card>

          {portalOn || portal.members.length || portal.messages.length || portal.deliverables.length ? (
            <Card id="espace-partenaire">
              <CardHeader
                title="Espace partenaire"
                description="Ce que voit le partenaire : conventions signées, étapes, projets, rapports transmis, ses livrables et cette conversation."
              />
              <CardBody className="space-y-5">
                {!portalOn ? <p className="text-label text-warning-700">L’espace partenaire est désactivé : le partenaire n’y a pas accès.</p> : null}
                <div>
                  <h3 className="text-label font-semibold text-ink-700">Contacts ayant accès</h3>
                  {portal.members.length || portal.invitations.length ? (
                    <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
                      {portal.members.map((m) => (
                        <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2">
                          <span className="min-w-0 truncate text-body text-ink-800">{m.user ? displayName(m.user) : "Contact"}</span>
                          {actor.manager || viewer.isSanadyAdmin ? (
                            <ActionButton
                              variant="danger-ghost"
                              action={revokePartnerMember.bind(null, m.id, o.id)}
                              confirm={{ title: "Retirer l’accès ?", description: "Ce contact ne pourra plus ouvrir l’espace partenaire.", confirmLabel: "Retirer" }}
                            >
                              Retirer
                            </ActionButton>
                          ) : null}
                        </li>
                      ))}
                      {portal.invitations.map((i) => (
                        <li key={i.id} className="flex items-center justify-between gap-3 px-3 py-2">
                          <span className="min-w-0 truncate text-body text-ink-600">{i.email}</span>
                          <span className="text-caption text-ink-500">Invitation en attente · expire le {formatDate(i.expires_at)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-body text-ink-600">Aucun contact.</p>
                  )}
                </div>
                {portalOn && activePartner && (actor.manager || viewer.isSanadyAdmin) ? <InvitePartnerForm organizationId={o.id} /> : null}
                {portalOn && !activePartner ? <p className="text-caption text-ink-500">L’invitation s’ouvre une fois la convention signée.</p> : null}
                {portal.deliverables.length ? (
                  <div>
                    <h3 className="text-label font-semibold text-ink-700">Livrables du partenaire</h3>
                    <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
                      {portal.deliverables.map((d) => (
                        <li key={d.id} className="space-y-2 px-3 py-3">
                          <p className="flex flex-wrap items-center gap-2 font-medium text-ink-900">
                            {d.title}
                            <Badge tone={d.status === "accepted" ? "success" : d.status === "returned" ? "warning" : "brand"}>
                              {d.status === "accepted" ? "Accepté" : d.status === "returned" ? "À compléter" : "À examiner"}
                            </Badge>
                          </p>
                          <p className="flex flex-wrap gap-x-3 text-caption text-ink-500">
                            {formatDateTime(d.created_at)}
                            {d.agreement ? <span>{d.agreement.reference}</span> : null}
                            {d.docs.map((doc) => (
                              <a key={doc.id} href={`/api/partenariats/documents/${doc.id}`} className="text-accent-700 hover:underline">
                                {doc.file_name}
                              </a>
                            ))}
                          </p>
                          {d.description ? <p className="text-label text-ink-700">{d.description}</p> : null}
                          {d.status === "submitted" ? <DeliverableReviewForm id={d.id} organizationId={o.id} /> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div>
                  <h3 className="text-label font-semibold text-ink-700">Conversation avec le partenaire</h3>
                  {portal.messages.length ? (
                    <ol className="mt-2 space-y-2">
                      {portal.messages.map((m) => (
                        <li key={m.id} className={cn("max-w-[90%] rounded-2xl px-3 py-2", m.from_partner ? "bg-accent-50" : "ml-auto bg-ink-50")}>
                          <p className="whitespace-pre-line text-body text-ink-900">{m.body}</p>
                          <p className="mt-0.5 text-caption text-ink-500">
                            {m.author ? displayName(m.author) : m.from_partner ? "Partenaire" : "Équipe SANADY"} · {formatDateTime(m.created_at)}
                          </p>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mt-1 text-body text-ink-600">Aucun message.</p>
                  )}
                  {portalOn ? (
                    <div className="mt-3">
                      <TeamMessageForm organizationId={o.id} />
                    </div>
                  ) : null}
                </div>
              </CardBody>
            </Card>
          ) : null}

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
