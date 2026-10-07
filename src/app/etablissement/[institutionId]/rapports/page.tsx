import type { Metadata } from "next";
import { FileDown, FileText } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { FilterSelect, SearchForm } from "@/components/ui/search-form";
import { Alert, Badge, Card, PageHeader } from "@/components/ui/surface";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { formatRelative } from "@/lib/format";
import { requireInstitutionAdmin } from "@/server/auth";
import { getTeacherSummaries } from "@/server/queries/institution";

export const metadata: Metadata = { title: "Rapports" };

const FILTERS: Record<string, { label: string; test: (t: Awaited<ReturnType<typeof getTeacherSummaries>>[number]) => boolean }> = {
  "": { label: "Tous les enseignants", test: () => true },
  avec_formation: { label: "Avec au moins une formation affectée", test: (t) => t.assigned_courses > 0 },
  termine: { label: "Ayant terminé au moins une formation", test: (t) => t.completed_courses > 0 },
  accompagnement: { label: "À accompagner", test: (t) => t.inactive || t.exhausted_quizzes > 0 },
};

export default async function ReportsPage(props: PageProps<"/etablissement/[institutionId]/rapports">) {
  const { institutionId } = await props.params;
  const sp = await props.searchParams;
  await requireInstitutionAdmin(institutionId);
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const filtre = typeof sp.filtre === "string" && sp.filtre in FILTERS ? sp.filtre : "";

  const teachers = (await getTeacherSummaries(institutionId)).filter(
    (t) => FILTERS[filtre]!.test(t) && (!q || `${t.full_name} ${t.email}`.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <>
      <PageHeader
        title="Rapports individuels"
        description="Générez, pour chaque enseignant, un rapport PDF de progression dans les formations affectées par l’établissement."
      />
      <Alert tone="info" className="mb-6">
        Les rapports ne contiennent que les formations affectées par votre établissement. Ils sont confidentiels et destinés à
        l’accompagnement des enseignants.
      </Alert>
      <Card>
        <div className="border-b border-line px-5 py-4">
          <SearchForm action={`/etablissement/${institutionId}/rapports`} defaultValue={q} placeholder="Rechercher un enseignant">
            <FilterSelect
              name="filtre"
              label="Filtrer les enseignants"
              defaultValue={filtre}
              options={Object.entries(FILTERS).map(([value, f]) => ({ value, label: f.label }))}
            />
          </SearchForm>
        </div>
        {teachers.length === 0 ? (
          <EmptyState compact icon={FileText} title="Aucun enseignant" description="Aucun enseignant ne correspond à ces critères." />
        ) : (
          <Table caption="Rapports individuels">
            <THead>
              <tr>
                <TH>Enseignant</TH>
                <TH align="right">Formations</TH>
                <TH align="right">Terminées</TH>
                <TH align="right">Certificats</TH>
                <TH>Dernière activité</TH>
                <TH align="right">
                  <span className="sr-only">Rapport</span>
                </TH>
              </tr>
            </THead>
            <TBody>
              {teachers.map((t) => (
                <TR key={t.user_id}>
                  <TD>
                    <p className="font-medium text-ink-900">{t.full_name || t.email}</p>
                    <p className="text-caption text-ink-500">{t.email}</p>
                    {t.inactive || t.exhausted_quizzes > 0 ? (
                      <Badge tone="warning" className="mt-1">
                        À accompagner
                      </Badge>
                    ) : null}
                  </TD>
                  <TD align="right">{t.assigned_courses}</TD>
                  <TD align="right">{t.completed_courses}</TD>
                  <TD align="right">{t.certificates}</TD>
                  <TD>{t.last_activity_at ? formatRelative(t.last_activity_at) : "—"}</TD>
                  <TD align="right">
                    <a href={`/api/rapports/${institutionId}/${t.user_id}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
                      <FileDown aria-hidden /> PDF
                    </a>
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
