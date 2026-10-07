import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ClipboardList } from "lucide-react";
import { EmptyState, ProgressBar } from "@/components/ui/feedback";
import { SearchForm } from "@/components/ui/search-form";
import { Badge, Card, PageHeader } from "@/components/ui/surface";
import { formatRelative } from "@/lib/format";
import { requireInstitutionAdmin } from "@/server/auth";
import { getTeacherSummaries } from "@/server/queries/institution";

export const metadata: Metadata = { title: "Suivi individuel" };

export default async function TrackingIndexPage(props: PageProps<"/etablissement/[institutionId]/suivi">) {
  const { institutionId } = await props.params;
  const sp = await props.searchParams;
  await requireInstitutionAdmin(institutionId);
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const teachers = (await getTeacherSummaries(institutionId)).filter(
    (t) => !q || `${t.full_name} ${t.email}`.toLowerCase().includes(q),
  );
  const base = `/etablissement/${institutionId}/suivi`;

  return (
    <>
      <PageHeader
        title="Suivi individuel"
        description="Sélectionnez un enseignant pour consulter sa progression dans les formations affectées par l’établissement."
      />
      <Card>
        <div className="border-b border-line px-5 py-4">
          <SearchForm action={base} defaultValue={q} placeholder="Rechercher un enseignant" />
        </div>
        {teachers.length === 0 ? (
          <EmptyState compact icon={ClipboardList} title="Aucun enseignant" description="Aucun enseignant ne correspond à votre recherche." />
        ) : (
          <ul className="divide-y divide-line">
            {teachers.map((t) => (
              <li key={t.user_id}>
                <Link href={`${base}/${t.user_id}`} className="flex flex-wrap items-center gap-4 px-5 py-3.5 hover:bg-ink-25">
                  <div className="min-w-[200px] flex-1">
                    <p className="font-medium text-ink-900">{t.full_name || t.email}</p>
                    <p className="text-caption text-ink-500">{t.email}</p>
                  </div>
                  <div className="w-44">
                    <ProgressBar
                      value={t.assigned_courses ? t.completed_courses / t.assigned_courses : 0}
                      label="Formations terminées"
                      size="sm"
                      tone="success"
                    />
                    <p className="mt-1 text-caption text-ink-500">
                      {t.completed_courses}/{t.assigned_courses} formation{t.assigned_courses > 1 ? "s" : ""} terminée
                      {t.completed_courses > 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="hidden w-36 text-caption text-ink-500 md:block">
                    {t.last_activity_at ? `Actif ${formatRelative(t.last_activity_at)}` : "Aucune activité"}
                  </div>
                  <div className="flex w-40 flex-wrap justify-end gap-1.5">
                    {t.inactive ? <Badge tone="warning">Inactif</Badge> : null}
                    {t.exhausted_quizzes > 0 ? <Badge tone="danger">Tentatives épuisées</Badge> : null}
                  </div>
                  <ChevronRight className="size-4 text-ink-400" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
