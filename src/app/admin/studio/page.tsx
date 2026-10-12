import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, Clapperboard } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { EmptyState } from "@/components/ui/feedback";
import { Alert, Badge, Card, CardHeader, PageHeader } from "@/components/ui/surface";
import { LinkTabs } from "@/components/ui/tabs";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { displayName, formatDate, formatRelative } from "@/lib/format";
import { TASK_KINDS, TASK_STATUS, TRAINING_STATUS, type TrainingStatus } from "@/lib/enterprise";
import { setTrainingTaskStatus } from "@/server/actions/studio";
import { requireStaff } from "@/server/auth";
import { listProjects, myTrainingTasks } from "@/server/queries/studio";

export const metadata: Metadata = { title: "Studio de production" };

const TABS: Array<{ key: string; label: string; status?: TrainingStatus }> = [
  { key: "tous", label: "Tous" },
  { key: "conception", label: "Conception", status: "design" },
  { key: "production", label: "Production", status: "production" },
  { key: "revue", label: "Revue pédagogique", status: "internal_review" },
  { key: "client", label: "Revue du client", status: "client_review" },
  { key: "validation", label: "Validation", status: "approval" },
  { key: "lancees", label: "Lancées", status: "launched" },
];

export default async function StudioPage(props: PageProps<"/admin/studio">) {
  const viewer = await requireStaff(["admin", "manager", "enterprise", "trainer", "partners"]);
  const sp = await props.searchParams;
  const tab = TABS.find((t) => t.key === sp.onglet) ?? TABS[0]!;
  const [rows, tasks] = await Promise.all([listProjects({ status: tab.status }), myTrainingTasks(viewer.id)]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        title="Studio de production"
        description="Formations sur mesure pour les entreprises clientes : besoins → conception → production → revues → validation institutionnelle → publication → lancement."
      />
      {viewer.platformRole === "enterprise_manager" || viewer.platformRole === "production_manager" || viewer.isSanadyAdmin ? (
        <Alert tone="info" className="mb-4">
          Un projet se crée depuis la fiche d’un client (SANADY Enterprise → Clients et prospects).
        </Alert>
      ) : null}

      {tasks.length ? (
        <Card className="mb-6">
          <CardHeader title="Mes tâches de production" description={`${tasks.length} tâche(s) en cours`} />
          <ul className="divide-y divide-line">
            {tasks.map((t) => {
              const late = t.due_on && t.due_on < today;
              return (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink-900">
                      {t.title} <Badge>{TASK_KINDS[t.kind]}</Badge>
                    </p>
                    <p className="mt-0.5 flex flex-wrap gap-x-3 text-caption text-ink-500">
                      {t.project ? (
                        <Link href={`/admin/studio/${t.project.id}`} className="text-accent-700 hover:underline">
                          {t.project.reference} — {t.project.title}
                        </Link>
                      ) : null}
                      <span>{TASK_STATUS[t.status]}</span>
                      {t.due_on ? (
                        <span className={late ? "inline-flex items-center gap-1 font-semibold text-danger-600" : "inline-flex items-center gap-1"}>
                          <CalendarClock className="size-3.5" aria-hidden /> {late ? "En retard — " : ""}
                          {formatDate(t.due_on)}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {t.status === "todo" ? <ActionButton action={setTrainingTaskStatus.bind(null, t.id, "in_progress", t.project?.id ?? "")}>Commencer</ActionButton> : null}
                    <ActionButton variant="accent" action={setTrainingTaskStatus.bind(null, t.id, "done", t.project?.id ?? "")}>
                      Terminer
                    </ActionButton>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      <LinkTabs className="mb-4" activeHref={`/admin/studio?onglet=${tab.key}`} items={TABS.map((t) => ({ href: `/admin/studio?onglet=${t.key}`, label: t.label }))} />
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={Clapperboard} title="Aucun projet" description="Les projets de formation sur mesure apparaissent ici." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table caption="Projets de formation sur mesure">
            <THead>
              <TR>
                <TH>Projet</TH>
                <TH>Client</TH>
                <TH>Étape</TH>
                <TH>Responsable</TH>
                <TH>Échéance</TH>
                <TH>Mise à jour</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((p) => (
                <TR key={p.id}>
                  <TD>
                    <Link href={`/admin/studio/${p.id}`} className="font-semibold text-ink-900 hover:text-accent-700 hover:underline">
                      {p.title}
                    </Link>
                    <span className="block text-caption text-ink-500">
                      {p.reference}
                      {p.version > 1 ? ` · version ${p.version}` : ""}
                    </span>
                  </TD>
                  <TD>{p.organization?.name ?? "—"}</TD>
                  <TD>
                    <Badge tone={TRAINING_STATUS[p.status].tone}>{TRAINING_STATUS[p.status].label}</Badge>
                  </TD>
                  <TD>{p.lead ? displayName(p.lead) : "—"}</TD>
                  <TD className={p.due_on && p.due_on < today && !["launched", "cancelled"].includes(p.status) ? "font-semibold text-danger-600" : undefined}>
                    {p.due_on ? formatDate(p.due_on) : "—"}
                  </TD>
                  <TD>{formatRelative(p.updated_at)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </>
  );
}
