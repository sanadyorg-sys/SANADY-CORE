import type { Metadata } from "next";
import { Award, CheckCircle2, ClipboardCheck, FileDown, UserCheck, Users } from "lucide-react";
import { PeriodFilter } from "@/components/reports/period-filter";
import { WeeklyChart } from "@/components/reports/weekly-chart";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Alert, Card, PageHeader, StatTile } from "@/components/ui/surface";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import { parsePeriod } from "@/lib/period";
import { requireInstitutionAdmin } from "@/server/auth";
import { getInstitutionReport } from "@/server/queries/reports";

export const metadata: Metadata = { title: "Statistiques" };

const score = (v: number | null) => (v === null ? "—" : `${formatNumber(Number(v))} %`);
const rate = (v: number | null) => (v === null ? "—" : formatPercent(Number(v)));

export default async function InstitutionStatsPage(props: PageProps<"/etablissement/[institutionId]/statistiques">) {
  const { institutionId } = await props.params;
  await requireInstitutionAdmin(institutionId);
  const period = parsePeriod(await props.searchParams);
  const report = await getInstitutionReport(institutionId, period.from, period.to);
  const k = report.kpis;
  const base = `/etablissement/${institutionId}/statistiques`;
  const query = `du=${period.from}&au=${period.to}`;
  const exportLink = (name: string) => (
    <a href={`/api/exports/etablissement/${institutionId}/${name}?${query}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
      <FileDown aria-hidden /> Exporter (CSV)
    </a>
  );

  return (
    <>
      <PageHeader
        title="Statistiques"
        description={`Formations affectées par votre établissement, du ${formatDate(period.from)} au ${formatDate(period.to)}.`}
        actions={exportLink("enseignants")}
      />
      <Alert tone="info" className="mb-6">
        Seules les formations que votre établissement a affectées sont prises en compte. Les formations personnelles des enseignants
        ne sont jamais comptées.
      </Alert>
      <PeriodFilter action={base} period={period} />

      <section aria-label="Indicateurs clés" className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatTile label="Enseignants" value={formatNumber(k.teachers)} detail={`${formatNumber(k.assignments)} formations affectées`} icon={Users} />
        <StatTile label="Enseignants actifs" value={formatNumber(k.active_teachers)} detail="Sur la période" icon={UserCheck} />
        <StatTile label="Formations terminées" value={formatNumber(k.completed)} detail={`Achèvement : ${rate(k.completion_rate)} · ${formatNumber(k.completions)} sur la période`} icon={CheckCircle2} />
        <StatTile label="Évaluations passées" value={formatNumber(k.attempts)} detail={`Réussite : ${rate(k.pass_rate)} des tentatives`} icon={ClipboardCheck} />
        <StatTile label="Score moyen" value={score(k.average_score)} detail="Sur la période" icon={ClipboardCheck} />
        <StatTile label="Certificats" value={formatNumber(k.certificates)} detail="Délivrés sur la période" icon={Award} />
      </section>

      <section aria-label="Évolution hebdomadaire" className="mb-6 grid gap-4 xl:grid-cols-2">
        <WeeklyChart
          title="Enseignants actifs par semaine"
          unit="enseignants actifs"
          points={report.weekly.map((w) => ({ week: w.week, value: Number(w.active_teachers) }))}
        />
        <WeeklyChart
          title="Formations terminées par semaine"
          unit="formations terminées"
          points={report.weekly.map((w) => ({ week: w.week, value: Number(w.completions) }))}
        />
      </section>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-card font-semibold text-ink-900">Par formation</h2>
            <p className="text-caption text-ink-500">Achèvement cumulé ; score moyen sur la période.</p>
          </div>
          {exportLink("formations")}
        </div>
        {report.courses.length ? (
          <Table caption="Statistiques par formation affectée">
            <THead>
              <TR>
                <TH>Formation</TH>
                <TH align="right">Affectée à</TH>
                <TH align="right">Commencée</TH>
                <TH align="right">Terminée</TH>
                <TH align="right">Achèvement</TH>
                <TH align="right">Score moyen</TH>
                <TH align="right">Certificats</TH>
              </TR>
            </THead>
            <TBody>
              {report.courses.map((c) => (
                <TR key={c.id}>
                  <TD className="font-medium text-ink-900">{c.title}</TD>
                  <TD align="right">{c.assigned}</TD>
                  <TD align="right">{c.started}</TD>
                  <TD align="right">{c.completed}</TD>
                  <TD align="right">{rate(c.completion_rate)}</TD>
                  <TD align="right">{score(c.average_score)}</TD>
                  <TD align="right">{c.certificates}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        ) : (
          <EmptyState compact title="Aucune formation affectée" description="Affectez une formation à vos enseignants pour suivre ces indicateurs." />
        )}
      </Card>
    </>
  );
}
