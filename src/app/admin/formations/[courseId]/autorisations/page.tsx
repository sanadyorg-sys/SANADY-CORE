import type { Metadata } from "next";
import Link from "next/link";
import { CourseOwnershipForm } from "@/components/admin/course-ownership-form";
import { GrantSelect } from "@/components/admin/grant-select";
import { ActionButton } from "@/components/common/action-button";
import { EmptyState } from "@/components/ui/feedback";
import { Alert, Card, CardBody, CardHeader } from "@/components/ui/surface";
import { COURSE_OWNERSHIP, type CourseOwnership } from "@/lib/enterprise";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { grantCourseToInstitution, revokeCourseFromInstitution, revokeCourseFromUser } from "@/server/actions/courses";
import { requireSanadyAdmin } from "@/server/auth";

export const metadata: Metadata = { title: "Autorisations" };

export default async function CourseAuthorizationsPage(props: PageProps<"/admin/formations/[courseId]/autorisations">) {
  const { courseId } = await props.params;
  await requireSanadyAdmin();
  const supabase = await createClient();
  const [{ data: perms }, { data: institutions }, { data: course }, { data: workspaces }] = await Promise.all([
    supabase
      .from("course_permissions")
      .select("id, granted_at, institution_id, user_id, institution:institutions(id, name), user:profiles!course_permissions_user_id_fkey(id, full_name, email)")
      .eq("course_id", courseId)
      .is("revoked_at", null)
      .order("granted_at", { ascending: false }),
    supabase.from("institutions").select("id, name, kind").eq("status", "active").order("name"),
    supabase.from("courses").select("status, ownership, owner_institution_id, tenant_private").eq("id", courseId).maybeSingle(),
    supabase.rpc("enterprise_workspaces"),
  ]);
  type Perm = {
    id: string;
    granted_at: string;
    institution_id: string | null;
    user_id: string | null;
    institution: { id: string; name: string } | null;
    user: { id: string; full_name: string; email: string } | null;
  };
  const permissions = (perms ?? []) as unknown as Perm[];
  const byInstitution = permissions.filter((p) => p.institution);
  const byUser = permissions.filter((p) => p.user);
  const authorized = new Set(byInstitution.map((p) => p.institution_id));
  const c = course as { status: string; ownership: CourseOwnership; owner_institution_id: string | null; tenant_private: boolean } | null;
  const status = c?.status;
  const spaces = ((workspaces ?? []) as Array<{ institution_id: string; name: string; status: string }>).filter((w) => w.status !== "closed");
  // A course reserved to one company can only be opened to that company.
  const grantable = ((institutions ?? []) as Array<{ id: string; name: string; kind: "school" | "enterprise" }>)
    .filter((i) => !authorized.has(i.id))
    .filter((i) => !c?.tenant_private || i.id === c.owner_institution_id);

  return (
    <div className="space-y-6">
      {status !== "published" ? (
        <Alert tone="info">
          Vous pouvez préparer les autorisations dès maintenant : la formation ne sera accessible qu’une fois publiée.
        </Alert>
      ) : null}
      {c ? (
        <Card>
          <CardHeader
            title="Propriété et visibilité"
            description={`Actuellement : ${COURSE_OWNERSHIP[c.ownership]}${c.tenant_private ? " — réservée à l’espace de son entreprise" : ""}. Les formations SANADY destinées aux enseignants restent « Formation SANADY ».`}
          />
          <CardBody>
            <CourseOwnershipForm courseId={courseId} ownership={c.ownership} ownerId={c.owner_institution_id} isPrivate={c.tenant_private} workspaces={spaces} />
          </CardBody>
        </Card>
      ) : null}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Établissements autorisés"
            description="Un établissement autorisé peut affecter la formation à ses enseignants. L’autorisation seule ne donne accès à personne."
          />
          <CardBody className="space-y-4">
            <GrantSelect
              label="Autoriser un établissement"
              placeholder="Choisir un établissement"
              buttonLabel="Autoriser"
              emptyMessage="Tous les établissements actifs sont déjà autorisés."
              options={grantable.map((i) => ({ value: i.id, label: i.kind === "enterprise" ? `${i.name} (espace entreprise)` : i.name }))}
              onGrant={async (institutionId) => {
                "use server";
                return grantCourseToInstitution(courseId, institutionId);
              }}
            />
            {byInstitution.length ? (
              <ul className="divide-y divide-line rounded-md border border-line">
                {byInstitution.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <Link href={`/admin/etablissements/${p.institution!.id}`} className="truncate text-body font-medium text-ink-900 hover:underline">
                        {p.institution!.name}
                      </Link>
                      <p className="text-caption text-ink-500">Depuis le {formatDate(p.granted_at)}</p>
                    </div>
                    <ActionButton
                      variant="danger-ghost"
                      action={revokeCourseFromInstitution.bind(null, courseId, p.institution!.id)}
                      confirm={{
                        title: `Retirer l’autorisation de ${p.institution!.name} ?`,
                        description: "Les affectations de cette formation dans l’établissement seront retirées. La progression des enseignants est conservée.",
                        confirmLabel: "Retirer",
                      }}
                    >
                      Retirer
                    </ActionButton>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact title="Aucun établissement autorisé" />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Accès individuels"
            description="Enseignants ayant reçu la formation directement de SANADY. Pour en ajouter, ouvrez la fiche de l’enseignant."
          />
          {byUser.length ? (
            <ul className="divide-y divide-line">
              {byUser.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <Link href={`/admin/enseignants/${p.user!.id}`} className="truncate text-body font-medium text-ink-900 hover:underline">
                      {p.user!.full_name || p.user!.email}
                    </Link>
                    <p className="text-caption text-ink-500">
                      {p.user!.email} · depuis le {formatDate(p.granted_at)}
                    </p>
                  </div>
                  <ActionButton
                    variant="danger-ghost"
                    action={revokeCourseFromUser.bind(null, courseId, p.user!.id)}
                    confirm={{ title: "Retirer cet accès individuel ?", description: "La progression de l’enseignant est conservée.", confirmLabel: "Retirer" }}
                  >
                    Retirer
                  </ActionButton>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact title="Aucun accès individuel" />
          )}
        </Card>
      </div>
    </div>
  );
}
