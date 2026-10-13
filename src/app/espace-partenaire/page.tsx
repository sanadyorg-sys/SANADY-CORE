import type { Metadata } from "next";
import { Check, Circle, Handshake } from "lucide-react";
import { EmptyState } from "@/components/ui/feedback";
import { Alert, Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { FOUNDATION } from "@/lib/institution";
import { AGREEMENT_STATUS } from "@/lib/partnerships";
import { requirePartnerMember } from "@/server/auth";
import { portalOverview } from "@/server/queries/portal";

export const metadata: Metadata = { title: "Espace partenaire" };

export default async function PartnerHome() {
  await requirePartnerMember();
  const v = await portalOverview();
  if (!v) return <Alert tone="warning">L’espace partenaire n’est pas disponible pour le moment.</Alert>;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        title={`Notre partenariat — ${v.organization.name}`}
        description={`Avec la ${FOUNDATION.name}${v.representative ? ` · votre interlocuteur : ${v.representative}` : ""}`}
      />
      {v.agreements.length === 0 ? (
        <Card>
          <EmptyState icon={Handshake} title="Aucune convention signée" description="Les conventions signées avec la Fondation apparaîtront ici." />
        </Card>
      ) : (
        <div className="space-y-6">
          {v.agreements.map((a) => {
            const done = a.milestones.filter((m) => m.done).length;
            return (
              <Card key={a.id}>
                <CardHeader
                  title={a.title}
                  description={`${a.reference} · ${a.field}${a.start_on && a.end_on ? ` · du ${formatDate(a.start_on)} au ${formatDate(a.end_on)}` : ""}`}
                  actions={<Badge tone={AGREEMENT_STATUS[a.status].tone}>{AGREEMENT_STATUS[a.status].label}</Badge>}
                />
                <CardBody className="space-y-4">
                  <p className="whitespace-pre-line text-body text-ink-800">{a.objectives}</p>
                  {a.milestones.length ? (
                    <div>
                      <h3 className="text-label font-semibold text-ink-700">
                        Étapes du projet — {done} sur {a.milestones.length} réalisée(s)
                      </h3>
                      <ol className="mt-2 space-y-2">
                        {a.milestones.map((m) => (
                          <li key={m.id} className="flex flex-wrap items-center gap-2.5">
                            <span
                              className={cn("flex size-5 shrink-0 items-center justify-center rounded-full", m.done ? "bg-success-600 text-white" : "border border-line-strong text-ink-400")}
                              aria-hidden
                            >
                              {m.done ? <Check className="size-3" /> : <Circle className="size-2" />}
                            </span>
                            <span className={cn("text-body", m.done ? "text-ink-600" : "text-ink-900")}>{m.title}</span>
                            <span className={cn("text-caption", !m.done && m.due_on < today ? "font-semibold text-warning-700" : "text-ink-500")}>{formatDate(m.due_on)}</span>
                            <span className="sr-only">{m.done ? "(réalisée)" : "(à venir)"}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
      {v.projects.length ? (
        <Card className="mt-6">
          <CardHeader title="Projets soutenus" />
          <ul className="divide-y divide-line">
            {v.projects.map((p) => (
              <li key={p.reference} className="px-5 py-3">
                <p className="font-medium text-ink-900">{p.title}</p>
                <p className="text-label text-ink-600">{p.summary}</p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
