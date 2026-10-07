import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Ban, CircleCheck } from "lucide-react";
import { GrantSelect } from "@/components/admin/grant-select";
import { ResetAttemptsForm } from "@/components/admin/reset-attempts-form";
import { ActionButton } from "@/components/common/action-button";
import { LearnerProgress } from "@/components/tracking/learner-progress";
import { Alert, Badge, Card, CardBody, CardHeader, DescriptionList, PageHeader } from "@/components/ui/surface";
import { formatDate } from "@/lib/format";
import { setUserStatus } from "@/server/actions/admin";
import { grantCourseToUser, revokeCourseFromUser } from "@/server/actions/courses";
import { requireSanadyAdmin } from "@/server/auth";
import { getExhaustedAttempts, getPersonDetail } from "@/server/queries/admin";
import { getLearnerDetails } from "@/server/queries/tracking";

export const metadata: Metadata = { title: "Fiche enseignant" };

export default async function PersonPage(props: PageProps<"/admin/enseignants/[userId]">) {
  const { userId } = await props.params;
  const viewer = await requireSanadyAdmin();
  const [detail, learning, exhausted] = await Promise.all([getPersonDetail(userId), getLearnerDetails(userId), getExhaustedAttempts()]);
  if (!detail) notFound();
  const { profile, isAdmin, memberships, permissions, publishedCourses } = detail;
  const grantedIds = new Set(permissions.map((p) => p.course.id));
  const blocked = exhausted.filter((e) => e.user_id === userId);
  const self = viewer.id === userId;

  return (
    <>
      <Link href="/admin/enseignants" className="mb-5 inline-flex items-center gap-1.5 text-label font-medium text-ink-600 hover:text-ink-900">
        <ArrowLeft className="size-4" aria-hidden /> Gestion des enseignants
      </Link>
      <PageHeader
        title={profile.full_name || profile.email}
        description={profile.email}
        actions={
          self ? null : profile.status === "active" ? (
            <ActionButton
              size="md"
              variant="danger-ghost"
              action={setUserStatus.bind(null, userId, "suspended")}
              confirm={{
                title: "Suspendre ce compte ?",
                description: "La personne ne pourra plus se connecter ni accéder aux formations. Ses données sont conservées et le compte peut être réactivé.",
                confirmLabel: "Suspendre le compte",
              }}
            >
              <Ban aria-hidden /> Suspendre le compte
            </ActionButton>
          ) : (
            <ActionButton size="md" action={setUserStatus.bind(null, userId, "active")}>
              <CircleCheck aria-hidden /> Réactiver le compte
            </ActionButton>
          )
        }
      >
        <div className="mt-3 flex flex-wrap gap-2">
          {profile.status === "active" ? <Badge tone="success">Actif</Badge> : <Badge tone="danger">Suspendu</Badge>}
          {isAdmin ? <Badge tone="navy">Administrateur SANADY</Badge> : null}
          {!profile.onboarded_at ? <Badge tone="warning">Profil non complété</Badge> : null}
        </div>
      </PageHeader>

      {blocked.length ? (
        <Card className="mb-6 border-warning-200">
          <CardHeader title="Tentatives épuisées" description="Réinitialisation tracée dans le journal d’activité, avec le motif indiqué." />
          <ul className="divide-y divide-line">
            {blocked.map((b) => (
              <li key={b.quiz_id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-body font-medium text-ink-900">{b.quiz_title}</p>
                  <p className="text-caption text-ink-500">
                    {b.course_title} · {b.attempts} tentatives · meilleur score {Number(b.best_score ?? 0).toLocaleString("fr-FR")} %
                  </p>
                </div>
                <ResetAttemptsForm quizId={b.quiz_id} userId={userId} learnerName={profile.full_name || profile.email} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader title="Profil" />
          <CardBody className="py-1">
            <DescriptionList
              items={[
                { term: "Fonction", value: profile.job_title ?? "—" },
                { term: "Discipline", value: profile.subject_area ?? "—" },
                { term: "Compte créé", value: formatDate(profile.created_at) },
                { term: "Notice acceptée", value: formatDate(profile.privacy_acknowledged_at) },
              ]}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Établissements" />
          <CardBody>
            {memberships.length ? (
              <ul className="space-y-2">
                {memberships.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2">
                    <Link href={`/admin/etablissements/${m.institution?.id}`} className="truncate text-body font-medium text-ink-900 hover:underline">
                      {m.institution?.name}
                    </Link>
                    <Badge tone={m.role === "admin" ? "navy" : "neutral"}>{m.role === "admin" ? "Administrateur" : "Enseignant"}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body text-ink-500">Compte individuel, sans établissement.</p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Accès individuels" description="Formations attribuées directement par SANADY." />
          <CardBody className="space-y-4">
            <GrantSelect
              label="Attribuer une formation"
              placeholder="Choisir une formation publiée"
              buttonLabel="Attribuer"
              emptyMessage="Toutes les formations publiées sont déjà attribuées."
              options={publishedCourses.filter((c) => !grantedIds.has(c.id)).map((c) => ({ value: c.id, label: c.title }))}
              onGrant={async (courseId) => {
                "use server";
                return grantCourseToUser(courseId, userId);
              }}
            />
            {permissions.length ? (
              <ul className="divide-y divide-line rounded-md border border-line">
                {permissions.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="min-w-0 truncate text-body text-ink-800">{p.course.title}</span>
                    <ActionButton
                      variant="danger-ghost"
                      action={revokeCourseFromUser.bind(null, p.course.id, userId)}
                      confirm={{
                        title: "Retirer cet accès individuel ?",
                        description: "La progression est conservée. L’accès peut subsister si un établissement a affecté cette formation.",
                        confirmLabel: "Retirer",
                      }}
                    >
                      Retirer
                    </ActionButton>
                  </li>
                ))}
              </ul>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <h2 className="mb-3 text-section font-semibold text-ink-900">Parcours de formation</h2>
      {profile.status === "suspended" ? (
        <Alert tone="warning" className="mb-4">
          Compte suspendu : l’accès aux formations est bloqué tant que le compte n’est pas réactivé.
        </Alert>
      ) : null}
      <LearnerProgress
        courses={learning.courses}
        activity={learning.activity}
        attemptHref={(attemptId) => `/admin/suivi/tentatives/${attemptId}`}
        emptyMessage="Cette personne n’est inscrite à aucune formation."
      />
    </>
  );
}
