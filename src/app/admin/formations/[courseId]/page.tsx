import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CourseInfoForm } from "@/components/admin/course-forms";
import { CoverUploader } from "@/components/admin/cover-uploader";
import { Card, CardBody, CardHeader } from "@/components/ui/surface";
import { createClient } from "@/lib/supabase/server";
import type { Course } from "@/lib/types";
import { requireSanadyAdmin } from "@/server/auth";
import { getCategories } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Informations de la formation" };

export default async function CourseInfoPage(props: PageProps<"/admin/formations/[courseId]">) {
  const { courseId } = await props.params;
  await requireSanadyAdmin();
  const supabase = await createClient();
  const [{ data }, categories] = await Promise.all([supabase.from("courses").select("*").eq("id", courseId).maybeSingle(), getCategories()]);
  const course = data as Course | null;
  if (!course) notFound();

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Card>
        <CardHeader title="Informations générales" description="Ces informations sont présentées aux enseignants et aux établissements." />
        <CardBody>
          <CourseInfoForm course={course} categories={categories} />
        </CardBody>
      </Card>
      <Card className="self-start">
        <CardHeader title="Couverture" />
        <CardBody>
          <CoverUploader courseId={course.id} coverPath={course.cover_path} title={course.title} />
        </CardBody>
      </Card>
    </div>
  );
}
