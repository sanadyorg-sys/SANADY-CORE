import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlayerView } from "@/components/learning/player-view";
import { buttonClasses } from "@/components/ui/button";
import { Alert } from "@/components/ui/surface";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/server/auth";
import { getPlayerData } from "@/server/queries/player";

export async function generateMetadata(props: PageProps<"/espace/formations/[courseId]/lecons/[lessonId]">): Promise<Metadata> {
  const { lessonId } = await props.params;
  const supabase = await createClient();
  const { data } = await supabase.from("lessons").select("title").eq("id", lessonId).maybeSingle();
  return { title: (data as { title: string } | null)?.title ?? "Leçon" };
}

export default async function LessonPage(props: PageProps<"/espace/formations/[courseId]/lecons/[lessonId]">) {
  const { courseId, lessonId } = await props.params;
  const viewer = await requireViewer();
  const basePath = `/espace/formations/${courseId}`;

  const data = await getPlayerData(courseId, lessonId, viewer.id, { basePath });
  if (!data) notFound();
  if ("error" in data) {
    return (
      <div className="max-w-xl">
        <Alert tone="warning" title="Leçon indisponible">
          {data.error}
        </Alert>
        <Link href="/espace/formations" className={buttonClasses({ variant: "secondary", className: "mt-4" })}>
          Retour à mes formations
        </Link>
      </div>
    );
  }

  return <PlayerView data={data} courseId={courseId} basePath={basePath} backHref={basePath} backLabel={data.outline.course.title} />;
}
