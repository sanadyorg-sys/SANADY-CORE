import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { LearnerCourseCard } from "@/components/learning/course-card";
import { EmptyState } from "@/components/ui/feedback";
import { Card, PageHeader } from "@/components/ui/surface";
import { LinkTabs } from "@/components/ui/tabs";
import { requireViewer } from "@/server/auth";
import { getLearnerCourses } from "@/server/queries/learning";

export const metadata: Metadata = { title: "Mes formations" };

const FILTERS = {
  en_cours: { label: "En cours", test: (c: { enrollment_status: string; has_access: boolean }) => c.enrollment_status === "active" && c.has_access },
  terminees: { label: "Terminées", test: (c: { enrollment_status: string }) => c.enrollment_status === "completed" },
  toutes: { label: "Toutes", test: () => true },
} as const;

export default async function MyCoursesPage(props: PageProps<"/espace/formations">) {
  await requireViewer();
  const { filtre } = await props.searchParams;
  const key = (typeof filtre === "string" && filtre in FILTERS ? filtre : "en_cours") as keyof typeof FILTERS;
  const courses = await getLearnerCourses();
  const visible = courses.filter(FILTERS[key].test);

  return (
    <>
      <PageHeader title="Mes formations" description="Les formations qui vous ont été attribuées, à suivre à votre rythme." />
      <div className="mb-6">
        <FilterTabs current={key} counts={Object.fromEntries(Object.entries(FILTERS).map(([k, f]) => [k, courses.filter(f.test).length]))} />
      </div>
      {visible.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((c) => (
            <LearnerCourseCard key={c.course_id} course={c} />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={BookOpen}
            title={key === "terminees" ? "Aucune formation terminée pour le moment" : "Aucune formation dans cette catégorie"}
            description={
              key === "terminees"
                ? "Une formation est terminée lorsque toutes ses leçons obligatoires sont suivies et toutes ses évaluations réussies."
                : "Les formations vous sont attribuées par l’équipe SANADY ou par votre établissement."
            }
          />
        </Card>
      )}
    </>
  );
}

function FilterTabs({ current, counts }: { current: string; counts: Record<string, number> }) {
  return (
    <LinkTabs
      exact
      items={Object.entries(FILTERS).map(([k, f]) => ({
        href: k === "en_cours" ? "/espace/formations" : `/espace/formations?filtre=${k}`,
        label: f.label,
        count: counts[k],
      }))}
      activeHref={current === "en_cours" ? "/espace/formations" : `/espace/formations?filtre=${current}`}
    />
  );
}
