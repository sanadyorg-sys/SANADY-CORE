import type { Metadata } from "next";
import Link from "next/link";
import { UserRoundCog } from "lucide-react";
import { AssignTrainerForm } from "@/components/admin/trainer-forms";
import { ActionButton } from "@/components/common/action-button";
import { EmptyState } from "@/components/ui/feedback";
import { Card, CardBody, CardHeader } from "@/components/ui/surface";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { removeCourseTrainer } from "@/server/actions/courses";
import { requireStaff } from "@/server/auth";

export const metadata: Metadata = { title: "Formateurs" };

type Person = { id: string; full_name: string | null; email: string; job_title: string | null };

export default async function CourseTrainersPage(props: PageProps<"/admin/formations/[courseId]/formateurs">) {
  const { courseId } = await props.params;
  await requireStaff(["admin", "manager"]);
  const supabase = await createClient();
  const [{ data: assigned }, { data: trainers }] = await Promise.all([
    supabase.from("course_trainers").select("assigned_at, trainer:profiles!course_trainers_user_id_fkey(id, full_name, email, job_title)").eq("course_id", courseId),
    supabase.from("platform_roles").select("profile:profiles!platform_roles_user_id_fkey(id, full_name, email, job_title)").eq("role", "trainer"),
  ]);
  const current = ((assigned ?? []) as unknown as Array<{ assigned_at: string; trainer: Person | null }>).filter((a) => a.trainer);
  const currentIds = new Set(current.map((a) => a.trainer!.id));
  const candidates = ((trainers ?? []) as unknown as Array<{ profile: Person | null }>)
    .map((t) => t.profile)
    .filter((p): p is Person => Boolean(p) && !currentIds.has(p!.id))
    .map((p) => ({ id: p.id, name: p.full_name || p.email, email: p.email }));

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Card>
        <CardHeader
          title="Formateurs de la formation"
          description="Ils modifient la formation lorsqu’elle est en brouillon, la soumettent à la revue et suivent la progression de ses apprenants. Leur nom figure sur la page publique de la formation."
        />
        {current.length ? (
          <ul className="divide-y divide-line">
            {current.map(({ trainer, assigned_at }) => (
              <li key={trainer!.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="text-body font-medium text-ink-900">{trainer!.full_name || trainer!.email}</p>
                  <p className="text-caption text-ink-500">
                    {trainer!.job_title ? `${trainer!.job_title} · ` : ""}
                    {trainer!.email} · depuis le {formatDate(assigned_at)}
                  </p>
                </div>
                <ActionButton
                  action={removeCourseTrainer.bind(null, courseId, trainer!.id)}
                  variant="danger-ghost"
                  confirm={{
                    title: "Retirer ce formateur ?",
                    description: "Il ne pourra plus modifier cette formation ni suivre ses apprenants.",
                    confirmLabel: "Retirer",
                    tone: "danger",
                  }}
                >
                  Retirer
                </ActionButton>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState compact icon={UserRoundCog} title="Aucun formateur" description="L’équipe SANADY conçoit cette formation directement." />
        )}
      </Card>
      <Card className="self-start">
        <CardHeader title="Ajouter un formateur" />
        <CardBody>
          {candidates.length ? (
            <AssignTrainerForm courseId={courseId} candidates={candidates} />
          ) : (
            <p className="text-body text-ink-600">
              Aucun autre compte n’a le rôle de formateur. Attribuez ce rôle dans{" "}
              <Link href="/admin/administrateurs" className="font-medium text-accent-700 hover:underline">
                Équipe SANADY
              </Link>
              .
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
