import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Badge, Card, PageHeader } from "@/components/ui/surface";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { formatDateTime, formatScore } from "@/lib/format";
import { requireViewer } from "@/server/auth";
import { getAttempts } from "@/server/queries/learning";

export const metadata: Metadata = { title: "Mes évaluations" };

export default async function MyAssessmentsPage() {
  const viewer = await requireViewer();
  const attempts = await getAttempts(viewer.id);

  return (
    <>
      <PageHeader
        title="Mes évaluations"
        description="Historique de vos tentatives. Chaque évaluation de module se valide avec un score d’au moins 70 %, en trois tentatives maximum."
      />
      <Card>
        {attempts.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="Aucune évaluation passée"
            description="L’évaluation d’un module devient accessible lorsque toutes ses leçons obligatoires sont terminées."
          />
        ) : (
          <Table caption="Historique de mes évaluations">
            <THead>
              <tr>
                <TH>Évaluation</TH>
                <TH>Formation</TH>
                <TH>Tentative</TH>
                <TH>Date</TH>
                <TH align="right">Score</TH>
                <TH>Résultat</TH>
                <TH align="right">
                  <span className="sr-only">Actions</span>
                </TH>
              </tr>
            </THead>
            <TBody>
              {attempts.map((a) => {
                const base = `/espace/formations/${a.course_id}/evaluations/${a.quiz_id}`;
                return (
                  <TR key={a.id}>
                    <TD>
                      <p className="font-medium text-ink-900">{a.quiz?.module?.title ?? a.quiz?.title}</p>
                      <p className="text-caption text-ink-500">{a.quiz?.title}</p>
                    </TD>
                    <TD className="max-w-[260px] truncate">{a.course?.title}</TD>
                    <TD>
                      n° {a.attempt_number}
                      {a.voided_at ? <span className="block text-caption text-ink-500">Réinitialisée</span> : null}
                    </TD>
                    <TD className="whitespace-nowrap">{formatDateTime(a.submitted_at ?? a.started_at)}</TD>
                    <TD align="right">{a.status === "submitted" ? formatScore(a.score_percent) : "—"}</TD>
                    <TD>
                      {a.status === "in_progress" ? (
                        <Badge tone="accent">En cours</Badge>
                      ) : a.passed ? (
                        <Badge tone="success">Réussie</Badge>
                      ) : (
                        <Badge tone="danger">Non validée</Badge>
                      )}
                    </TD>
                    <TD align="right">
                      <Link
                        href={a.status === "submitted" ? `${base}/resultats/${a.id}` : base}
                        className={buttonClasses({ variant: "ghost", size: "sm" })}
                      >
                        {a.status === "submitted" ? "Détail" : "Reprendre"}
                      </Link>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
