import type { Metadata } from "next";
import Link from "next/link";
import { Award, BookOpen, Building2, CheckCircle2, ClipboardCheck, FileDown, UserCheck, Users } from "lucide-react";
import { PeriodFilter } from "@/components/reports/period-filter";
import { WeeklyChart } from "@/components/reports/weekly-chart";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Card, PageHeader, StatTile } from "@/components/ui/surface";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import { parsePeriod } from "@/lib/period";
import { requireStaff } from "@/server/auth";
import { getAdminReport } from "@/server/queries/reports";

export const metadata: Metadata = { title: "Rapports et statistiques" };

const score = (v: number | null) => (v === null ? "—" : `${formatNumber(Number(v))} %`);
const rate = (v: number | null) => (v === null ? "—" : formatPercent(Number(v)));

function ExportLink({ report, query }: { report: string; query: string }) {
  return (
    <a href={`/api/exports/admin/${report}?${query}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
      <FileDown aria-hidden /> Exporter (CSV)
    </a>
  );
}

function Section({ title, description, actions, children }: { title: string; description: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-card font-semibold text-ink-900">{title}</h2>
          <p className="text-caption text-ink-500">{description}</p>
        </div>
        {actions}
      </div>
      {children}
    </Card>
  );
}

export default async function AdminReportsPage(props: PageProps<"/admin/rapports">) {
  await requireStaff(["admin", "manager"]);
  const period = parsePeriod(await props.searchParams);
  const report = await getAdminReport(period.from, period.to);
  const k = report.kpis;
  const query = `du=${period.from}&au=${period.to}`;

  return (
    <>
      <PageHeader
        title="Rapports et statistiques"
        description={`Indicateurs calculés à partir des données réelles de la plateforme, du ${formatDate(period.from)} au ${formatDate(period.to)}.`}
        actions={<ExportLink report="certificats" query={query} />}
      />
      <PeriodFilter action="/admin/rapports" period={period} />

      <section aria-label="Indicateurs clés" className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Enseignants inscrits" value={formatNumber(k.teachers)} detail={`${formatNumber(k.new_teachers)} nouveaux sur la période`} icon={Users} />
        <StatTile label="Enseignants actifs" value={formatNumber(k.active_teachers)} detail="Au moins une activité d’apprentissage" icon={UserCheck} />
        <StatTile label="Formations terminées" value={formatNumber(k.completions)} detail={`Taux d’achèvement global : ${rate(k.completion_rate)}`} icon={CheckCircle2} />
        <StatTile label="Certificats délivrés" value={formatNumber(k.certificates)} detail="Sur la période (hors révoqués)" icon={Award} />
        <StatTile label="Évaluations passées" value={formatNumber(k.attempts)} detail={`Réussite : ${rate(k.pass_rate)} des tentatives`} icon={ClipboardCheck} />
        <StatTile label="Score moyen" value={score(k.average_score)} detail="Tentatives soumises sur la période" icon={ClipboardCheck} />
        <StatTile label="Inscriptions en cours" value={formatNumber(k.active_enrollments)} detail={`${formatNumber(k.published_courses)} formations publiées`} icon={BookOpen} />
        <StatTile label="Établissements actifs" value={formatNumber(k.institutions)} icon={Building2} />
      </section>

      <section aria-label="Évolution hebdomadaire" className="mb-6 grid gap-4 xl:grid-cols-2">
        <WeeklyChart
          title="Enseignants actifs par semaine"
          description="Enseignants ayant suivi une leçon ou passé une évaluation"
          unit="enseignants actifs"
          points={report.weekly.map((w) => ({ week: w.week, value: Number(w.active_teachers) }))}
        />
        <WeeklyChart
          title="Formations terminées par semaine"
          description="Toutes les leçons obligatoires et évaluations validées"
          unit="formations terminées"
          points={report.weekly.map((w) => ({ week: w.week, value: Number(w.completions) }))}
        />
      </section>

      <div className="space-y-6">
        <Section
          title="Formations"
          description="Inscriptions et achèvements cumulés ; activité et score moyen sur la période."
          actions={<ExportLink report="formations" query={query} />}
        >
          {report.courses.length ? (
            <Table caption="Rapport par formation">
              <THead>
                <TR>
                  <TH>Formation</TH>
                  <TH align="right">Inscrits</TH>
                  <TH align="right">Commencée</TH>
                  <TH align="right">Terminée</TH>
                  <TH align="right">Achèvement</TH>
                  <TH align="right">Actifs (période)</TH>
                  <TH align="right">Score moyen</TH>
                  <TH align="right">Certificats</TH>
                </TR>
              </THead>
              <TBody>
                {report.courses.map((c) => (
                  <TR key={c.id}>
                    <TD>
                      <Link href={`/admin/formations/${c.id}`} className="font-medium text-ink-900 hover:underline">
                        {c.title}
                      </Link>
                      {c.status === "archived" ? <span className="ml-2 text-caption text-ink-500">(archivée)</span> : null}
                    </TD>
                    <TD align="right">{c.enrolled}</TD>
                    <TD align="right">{c.started}</TD>
                    <TD align="right">{c.completed}</TD>
                    <TD align="right">{rate(c.completion_rate)}</TD>
                    <TD align="right">{c.active_in_period}</TD>
                    <TD align="right">{score(c.average_score)}</TD>
                    <TD align="right">{c.certificates}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : (
            <EmptyState compact title="Aucune formation publiée" />
          )}
        </Section>

        <Section
          title="Établissements"
          description="Formations affectées par chaque établissement à ses enseignants (achèvement cumulé ; activité sur la période)."
          actions={<ExportLink report="etablissements" query={query} />}
        >
          {report.institutions.length ? (
            <Table caption="Rapport par établissement">
              <THead>
                <TR>
                  <TH>Établissement</TH>
                  <TH align="right">Enseignants</TH>
                  <TH align="right">Affectations</TH>
                  <TH align="right">Terminées</TH>
                  <TH align="right">Achèvement</TH>
                  <TH align="right">Actifs (période)</TH>
                  <TH align="right">Certificats</TH>
                </TR>
              </THead>
              <TBody>
                {report.institutions.map((i) => (
                  <TR key={i.id}>
                    <TD>
                      <Link href={`/admin/etablissements/${i.id}`} className="font-medium text-ink-900 hover:underline">
                        {i.name}
                      </Link>
                      {i.city ? <p className="text-caption text-ink-500">{i.city}</p> : null}
                    </TD>
                    <TD align="right">{i.teachers}</TD>
                    <TD align="right">{i.assignments}</TD>
                    <TD align="right">{i.completed}</TD>
                    <TD align="right">{rate(i.completion_rate)}</TD>
                    <TD align="right">{i.active_in_period}</TD>
                    <TD align="right">{i.certificates}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : (
            <EmptyState compact title="Aucun établissement actif" />
          )}
        </Section>

        <Section
          title="Évaluations"
          description="Tentatives soumises sur la période (hors tentatives annulées par un administrateur)."
          actions={<ExportLink report="evaluations" query={query} />}
        >
          {report.quizzes.length ? (
            <Table caption="Rapport par évaluation">
              <THead>
                <TR>
                  <TH>Évaluation</TH>
                  <TH align="right">Enseignants</TH>
                  <TH align="right">Tentatives</TH>
                  <TH align="right">Score moyen</TH>
                  <TH align="right">Ont réussi</TH>
                  <TH align="right">Réussite 1re tentative</TH>
                </TR>
              </THead>
              <TBody>
                {report.quizzes.map((q) => (
                  <TR key={q.id}>
                    <TD>
                      <span className="font-medium text-ink-900">{q.title}</span>
                      <p className="text-caption text-ink-500">
                        {q.course_title} · module {q.module_position}
                      </p>
                    </TD>
                    <TD align="right">{q.learners}</TD>
                    <TD align="right">{q.attempts}</TD>
                    <TD align="right">{score(q.average_score)}</TD>
                    <TD align="right">{rate(q.pass_rate)}</TD>
                    <TD align="right">{rate(q.first_attempt_pass_rate)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : (
            <EmptyState compact title="Aucune tentative sur cette période" />
          )}
        </Section>
      </div>
    </>
  );
}
