import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { ResetAttemptsForm } from "@/components/admin/reset-attempts-form";
import { EmptyState } from "@/components/ui/feedback";
import { Alert, Card, CardHeader, PageHeader } from "@/components/ui/surface";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { formatDateTime, formatScore } from "@/lib/format";
import { requireSanadyAdmin } from "@/server/auth";
import { getExhaustedAttempts } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Suivi pédagogique" };

export default async function AdminTrackingPage() {
  await requireSanadyAdmin();
  const exhausted = await getExhaustedAttempts();

  return (
    <>
      <PageHeader
        title="Suivi pédagogique"
        description="Interventions requises et accompagnement des enseignants. Le détail du parcours de chaque enseignant est disponible dans sa fiche."
      />
      <Alert tone="info" className="mb-6">
        Ces indicateurs signalent un besoin d’accompagnement. Ils ne constituent pas une évaluation des compétences de l’enseignant.
      </Alert>
      <Card>
        <CardHeader
          title="Tentatives épuisées"
          description="Enseignants ayant utilisé leurs trois tentatives sans atteindre 70 %. Une réinitialisation leur rend trois tentatives."
        />
        {exhausted.length === 0 ? (
          <EmptyState compact icon={CircleCheck} title="Aucune intervention en attente" />
        ) : (
          <Table caption="Tentatives épuisées">
            <THead>
              <tr>
                <TH>Enseignant</TH>
                <TH>Évaluation</TH>
                <TH align="right">Meilleur score</TH>
                <TH>Dernière tentative</TH>
                <TH align="right">
                  <span className="sr-only">Action</span>
                </TH>
              </tr>
            </THead>
            <TBody>
              {exhausted.map((row) => (
                <TR key={`${row.quiz_id}:${row.user_id}`}>
                  <TD>
                    <Link href={`/admin/enseignants/${row.user_id}`} className="font-medium text-ink-900 hover:underline">
                      {row.full_name || row.email}
                    </Link>
                    <p className="text-caption text-ink-500">{row.email}</p>
                  </TD>
                  <TD>
                    <p className="text-ink-800">{row.quiz_title}</p>
                    <p className="text-caption text-ink-500">{row.course_title}</p>
                  </TD>
                  <TD align="right">{formatScore(row.best_score)}</TD>
                  <TD className="whitespace-nowrap">{formatDateTime(row.last_attempt)}</TD>
                  <TD align="right">
                    <ResetAttemptsForm quizId={row.quiz_id} userId={row.user_id} learnerName={row.full_name || row.email} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
