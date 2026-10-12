import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, CalendarClock, Check, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { OutlineForm, ProjectForm, ReviewForm, TaskForm, TrainerForm, TrainingStatusForm } from "@/components/enterprise/studio-forms";
import { HistoryList } from "@/components/partnerships/timeline";
import { Button, buttonClasses } from "@/components/ui/button";
import { Drawer } from "@/components/ui/overlay";
import { Alert, Badge, Card, CardBody, CardHeader, DescriptionList, PageHeader } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { displayName, formatDate, formatDateTime } from "@/lib/format";
import { COURSE_OWNERSHIP, LANGUAGES, TASK_KINDS, TASK_STATUS, TRAINING_STATUS, TRAINING_STEPS, trainingNextSteps } from "@/lib/enterprise";
import { uuidSchema } from "@/lib/validation";
import { createProjectCourse, deleteOutlineItem, moveOutlineItem, removeProjectTrainer, setTrainingTaskStatus } from "@/server/actions/studio";
import { requireStaff } from "@/server/auth";
import { getProject, productionTeam, projectFormOptions, studioActor } from "@/server/queries/studio";

export const metadata: Metadata = { title: "Projet de formation — Studio" };

const HISTORY_LABELS: Record<string, string> = {
  ...Object.fromEntries(Object.entries(TRAINING_STATUS).map(([k, v]) => [k, v.label])),
  course_created: "Formation créée en brouillon",
};
const COURSE_STATUS: Record<string, string> = { draft: "Brouillon (en écriture)", review: "Soumise à l’équipe pédagogique", published: "Publiée" };
const EDITABLE = ["brief", "design", "production"];

export default async function ProjectPage(props: PageProps<"/admin/studio/[projectId]">) {
  const viewer = await requireStaff(["admin", "manager", "enterprise", "trainer", "partners"]);
  const { projectId } = await props.params;
  if (!uuidSchema.safeParse(projectId).success) notFound();
  const [detail, actor] = await Promise.all([getProject(projectId), studioActor(viewer)]);
  if (!detail) notFound();
  const { project: p, outline, tasks, reviews, versions, history, checklist, trainers } = detail;
  const [team, options] = actor.manage ? await Promise.all([productionTeam(), projectFormOptions(p.organization_id)]) : [[], { tenants: [], proposals: [] }];
  const editable = actor.manage && EDITABLE.includes(p.status);
  const done = checklist ? TRAINING_STEPS.filter((s) => checklist[s.key]).length : 0;
  const today = new Date().toISOString().slice(0, 10);
  const label = (m: { full_name: string | null; email: string }) => m.full_name || m.email;
  const canOpenCourse = Boolean(p.course_id) && (viewer.isCourseStaff || trainers.some((t) => t.id === viewer.id));

  return (
    <>
      <Link href="/admin/studio" className="mb-3 inline-flex items-center gap-1.5 text-label text-ink-600 hover:text-ink-900">
        <ArrowLeft className="size-4" aria-hidden /> Studio de production
      </Link>
      <PageHeader
        title={p.title}
        description={`${p.reference} · ${p.organization?.name ?? ""}${p.version > 1 ? ` · version ${p.version}` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={TRAINING_STATUS[p.status].tone}>{TRAINING_STATUS[p.status].label}</Badge>
            {editable ? (
              <Drawer
                title="Fiche du projet"
                width="max-w-2xl"
                trigger={
                  <Button variant="secondary">
                    <Pencil aria-hidden /> Modifier
                  </Button>
                }
              >
                <div className="p-5">
                  <ProjectForm
                    organizationId={p.organization_id}
                    project={p}
                    tenants={options.tenants}
                    proposals={options.proposals}
                    team={team.filter((m) => m.role !== "trainer").map((m) => ({ id: m.id, label: label(m) }))}
                  />
                </div>
              </Drawer>
            ) : null}
          </div>
        }
      />

      <StatusAlert status={p.status} signatory={actor.signatory} pedagogy={actor.pedagogy} courseId={p.course_id} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          {checklist ? (
            <Card>
              <CardHeader title="Étapes de production" description={`${done} sur ${TRAINING_STEPS.length} — vérifiées à partir des données.`} />
              <ol className="grid gap-x-6 px-5 py-3 sm:grid-cols-2">
                {TRAINING_STEPS.map((s, i) => {
                  const ok = Boolean(checklist[s.key]);
                  return (
                    <li key={s.key} className="flex items-center gap-2.5 py-1.5">
                      <span
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-semibold",
                          ok ? "bg-success-600 text-white" : "border border-line-strong text-ink-500",
                        )}
                        aria-hidden
                      >
                        {ok ? <Check className="size-3" /> : i + 1}
                      </span>
                      <span className={cn("text-label", ok ? "text-ink-600" : "font-medium text-ink-900")}>
                        {s.label} <span className="sr-only">{ok ? "(fait)" : "(à faire)"}</span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Besoins du client" />
            <CardBody className="space-y-4">
              <DescriptionList
                items={[
                  { term: "Public visé", value: p.target_audience },
                  { term: "Langue", value: LANGUAGES[p.language] },
                  { term: "Durée visée", value: p.target_minutes ? `${p.target_minutes} min` : "—" },
                  { term: "Propriété", value: COURSE_OWNERSHIP[p.ownership] },
                  { term: "Espace du client", value: p.tenant?.display_name ?? "—" },
                  { term: "Revue du client", value: p.client_review_required ? "Prévue au contrat" : "Non prévue" },
                  { term: "Responsable", value: p.lead ? displayName(p.lead) : "—" },
                  { term: "Échéance", value: p.due_on ? formatDate(p.due_on) : "—" },
                ]}
              />
              {[
                ["Objectifs de formation", p.objectives],
                ["Contraintes et exigences", p.constraints],
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
            <CardHeader title="Programme" description="Modules prévus. Ils deviennent les modules de la formation lors de sa création." />
            {outline.length ? (
              <ol className="divide-y divide-line">
                {outline.map((o, i) => (
                  <li key={o.id} className="flex items-start gap-3 px-5 py-3">
                    <span className="mt-0.5 font-mono text-caption text-ink-500">{String(i + 1).padStart(2, "0")}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink-900">{o.title}</p>
                      {o.description ? <p className="text-label text-ink-600">{o.description}</p> : null}
                    </div>
                    {editable ? (
                      <div className="flex shrink-0 gap-1">
                        <ActionButton variant="ghost" action={moveOutlineItem.bind(null, o.id, -1, p.id)}>
                          <ArrowUp aria-hidden /> <span className="sr-only">Monter {o.title}</span>
                        </ActionButton>
                        <ActionButton variant="ghost" action={moveOutlineItem.bind(null, o.id, 1, p.id)}>
                          <ArrowDown aria-hidden /> <span className="sr-only">Descendre {o.title}</span>
                        </ActionButton>
                        <ActionButton
                          variant="danger-ghost"
                          action={deleteOutlineItem.bind(null, o.id, p.id)}
                          confirm={{ title: `Retirer « ${o.title} » ?`, description: "Le module est retiré du programme (pas de la formation déjà créée).", confirmLabel: "Retirer" }}
                        >
                          <Trash2 aria-hidden /> <span className="sr-only">Retirer {o.title}</span>
                        </ActionButton>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : (
              <CardBody>
                <p className="text-body text-ink-600">Aucun module pour l’instant.</p>
              </CardBody>
            )}
            {editable ? (
              <CardBody className="border-t border-line">
                <OutlineForm projectId={p.id} />
              </CardBody>
            ) : null}
          </Card>

          <Card>
            <CardHeader title="Formation" description="Écrite dans l’éditeur de formations par ses formateurs ; revue et publiée par l’équipe pédagogique." />
            <CardBody className="space-y-4">
              {p.course ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink-900">{p.course.title}</p>
                      <p className="text-caption text-ink-500">
                        {COURSE_STATUS[p.course.status] ?? p.course.status}
                        {checklist?.course_issues ? ` · ${checklist.course_issues} point(s) à compléter avant la revue` : ""}
                      </p>
                    </div>
                    {canOpenCourse ? (
                      <Link href={`/admin/formations/${p.course.id}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
                        Ouvrir l’éditeur <ExternalLink aria-hidden />
                      </Link>
                    ) : null}
                  </div>
                  <div>
                    <h3 className="text-label font-semibold text-ink-700">Formateurs</h3>
                    {trainers.length ? (
                      <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
                        {trainers.map((t) => (
                          <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2">
                            <span className="truncate text-body text-ink-800">{label(t)}</span>
                            {actor.manage ? (
                              <ActionButton variant="danger-ghost" action={removeProjectTrainer.bind(null, p.id, t.id)}>
                                Retirer
                              </ActionButton>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-body text-ink-600">Aucun formateur.</p>
                    )}
                  </div>
                  {actor.manage ? (
                    <TrainerForm
                      projectId={p.id}
                      trainers={team.filter((m) => m.role === "trainer" && !trainers.some((t) => t.id === m.id)).map((m) => ({ id: m.id, label: label(m) }))}
                    />
                  ) : null}
                </>
              ) : actor.manage && (p.status === "design" || p.status === "production") ? (
                <ActionButton
                  variant="accent"
                  size="md"
                  action={createProjectCourse.bind(null, p.id)}
                  confirm={{
                    title: "Créer la formation ?",
                    description: "Une formation en brouillon est créée avec les modules du programme. Elle appartient au client et reste réservée à son espace.",
                    confirmLabel: "Créer",
                  }}
                >
                  Créer la formation à partir du programme
                </ActionButton>
              ) : (
                <p className="text-body text-ink-600">La formation est créée à l’étape de conception, une fois le programme prêt.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Tâches de production" description={checklist?.open_tasks ? `${checklist.open_tasks} tâche(s) ouverte(s)` : undefined} />
            {tasks.length ? (
              <ul className="divide-y divide-line">
                {tasks.map((t) => {
                  const late = t.status !== "done" && t.due_on && t.due_on < today;
                  const mine = t.assigned_to === viewer.id;
                  return (
                    <li key={t.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className={cn("text-body", t.status === "done" ? "text-ink-500 line-through" : "font-medium text-ink-900")}>
                          {t.title} <Badge>{TASK_KINDS[t.kind]}</Badge>
                        </p>
                        <p className="mt-0.5 flex flex-wrap gap-x-3 text-caption text-ink-500">
                          <span>{TASK_STATUS[t.status]}</span>
                          {t.assignee ? <span>{displayName(t.assignee)}</span> : <span>Non attribuée</span>}
                          {t.due_on ? (
                            <span className={late ? "inline-flex items-center gap-1 font-semibold text-danger-600" : "inline-flex items-center gap-1"}>
                              <CalendarClock className="size-3.5" aria-hidden /> {late ? "En retard — " : ""}
                              {formatDate(t.due_on)}
                            </span>
                          ) : null}
                        </p>
                      </div>
                      {actor.manage || mine ? (
                        <div className="flex gap-2">
                          {t.status === "todo" ? <ActionButton action={setTrainingTaskStatus.bind(null, t.id, "in_progress", p.id)}>Commencer</ActionButton> : null}
                          {t.status !== "done" ? (
                            <ActionButton variant="accent" action={setTrainingTaskStatus.bind(null, t.id, "done", p.id)}>
                              Terminer
                            </ActionButton>
                          ) : (
                            <ActionButton action={setTrainingTaskStatus.bind(null, t.id, "todo", p.id)}>Rouvrir</ActionButton>
                          )}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <CardBody>
                <p className="text-body text-ink-600">Aucune tâche.</p>
              </CardBody>
            )}
            {actor.manage && !["launched", "cancelled"].includes(p.status) ? (
              <CardBody className="border-t border-line">
                <TaskForm projectId={p.id} team={team.map((m) => ({ id: m.id, label: label(m) }))} />
              </CardBody>
            ) : null}
          </Card>

          <Card>
            <CardHeader title="Revues" description="Revue pédagogique interne, puis revue du client si le contrat la prévoit." />
            {(p.status === "internal_review" && actor.pedagogy) || (p.status === "client_review" && actor.manage) ? (
              <CardBody className="border-b border-line">
                <p className="mb-3 text-label font-medium text-ink-800">
                  {p.status === "internal_review" ? "Votre revue pédagogique" : "Retour du client (reçu par l’équipe Enterprise)"}
                </p>
                <ReviewForm projectId={p.id} kind={p.status === "internal_review" ? "internal" : "client"} />
              </CardBody>
            ) : null}
            {reviews.length ? (
              <ul className="divide-y divide-line">
                {reviews.map((r) => (
                  <li key={r.id} className="px-5 py-3">
                    <p className="flex flex-wrap items-center gap-2 text-body font-medium text-ink-900">
                      {r.kind === "internal" ? "Revue pédagogique" : "Revue du client"}
                      <Badge tone={r.decision === "approved" ? "success" : "warning"}>{r.decision === "approved" ? "Validée" : "Modifications demandées"}</Badge>
                      {versions.length > 1 || p.version > 1 ? <span className="text-caption text-ink-500">version {r.version}</span> : null}
                    </p>
                    {r.comment ? <p className="mt-1 whitespace-pre-line text-label text-ink-700">{r.comment}</p> : null}
                    <p className="mt-1 text-caption text-ink-500">
                      {r.reviewer ? displayName(r.reviewer) : r.kind === "client" ? "Administrateur de l’entreprise" : "Équipe pédagogique"} · {formatDateTime(r.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <CardBody>
                <p className="text-body text-ink-600">Aucune revue pour l’instant.</p>
              </CardBody>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Étape du projet" />
            <CardBody>
              <TrainingStatusForm id={p.id} from={p.status} options={trainingNextSteps(p.status, actor)} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Versions approuvées" description="Copie figée de la formation à chaque validation institutionnelle." />
            {versions.length ? (
              <ul className="divide-y divide-line">
                {versions.map((v) => (
                  <li key={v.id} className="px-5 py-3">
                    <p className="font-medium text-ink-900">Version {v.version}</p>
                    <p className="text-caption text-ink-500">
                      Approuvée {v.approver ? `par ${displayName(v.approver)} ` : ""}le {formatDateTime(v.approved_at)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <CardBody>
                <p className="text-body text-ink-600">Aucune version approuvée.</p>
              </CardBody>
            )}
          </Card>
          <Card>
            <CardHeader title="Historique" description={`Projet créé le ${formatDateTime(p.created_at)}`} />
            <CardBody>
              <HistoryList history={history} labels={HISTORY_LABELS} />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function StatusAlert({ status, signatory, pedagogy, courseId }: { status: string; signatory: boolean; pedagogy: boolean; courseId: string | null }) {
  const text: Record<string, string> = {
    internal_review: pedagogy
      ? "La formation vous est soumise : vérifiez-la dans l’éditeur, puis enregistrez votre revue ci-dessous."
      : "En revue pédagogique : l’équipe pédagogique vérifie la formation.",
    client_review: "En attente du retour du client : il peut valider le programme dans son espace, ou l’équipe Enterprise enregistre son retour.",
    approval: signatory
      ? "Validation institutionnelle : relisez les revues et la formation, puis approuvez ou renvoyez en production."
      : "En attente de la validation institutionnelle par un approbateur habilité.",
    approved: pedagogy
      ? "Approuvée : publiez la formation depuis l’éditeur (« Approuver et publier »)."
      : "Approuvée : l’équipe pédagogique peut maintenant publier la formation.",
    published: "Publiée : lancez-la dans l’espace du client pour que son administrateur l’affecte aux collaborateurs.",
  };
  if (!text[status]) return null;
  return (
    <Alert tone={status === "approval" || status === "client_review" ? "warning" : "info"} className="mb-6">
      {text[status]}
      {status === "approved" && pedagogy && courseId ? (
        <>
          {" "}
          <Link href={`/admin/formations/${courseId}`} className="font-medium underline">
            Ouvrir la formation
          </Link>
        </>
      ) : null}
    </Alert>
  );
}
