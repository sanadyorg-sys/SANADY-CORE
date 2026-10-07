import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Ban, CircleCheck, Pencil, UserMinus } from "lucide-react";
import { GrantSelect } from "@/components/admin/grant-select";
import { InstitutionForm } from "@/components/admin/institution-form";
import { ActionButton } from "@/components/common/action-button";
import { EnrollmentCodeList } from "@/components/common/enrollment-code-list";
import { InvitationTable } from "@/components/common/invitation-table";
import { InviteForm } from "@/components/common/invite-form";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Drawer } from "@/components/ui/overlay";
import { Badge, Card, CardBody, CardHeader, DescriptionList, PageHeader, StatTile } from "@/components/ui/surface";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { publicEnv } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { INSTITUTION_TYPES, MEMBERSHIP_SOURCES } from "@/lib/labels";
import { setInstitutionStatus } from "@/server/actions/admin";
import { grantCourseToInstitution, revokeCourseFromInstitution } from "@/server/actions/courses";
import { revokeMembership } from "@/server/actions/institution";
import { requireSanadyAdmin } from "@/server/auth";
import { getInstitutionDetail } from "@/server/queries/admin";
import { getInstitutionOverview } from "@/server/queries/institution";

export const metadata: Metadata = { title: "Établissement" };

export default async function AdminInstitutionPage(props: PageProps<"/admin/etablissements/[institutionId]">) {
  const { institutionId } = await props.params;
  await requireSanadyAdmin();
  const [detail, overview] = await Promise.all([getInstitutionDetail(institutionId), getInstitutionOverview(institutionId).catch(() => null)]);
  if (!detail) notFound();
  const { institution, members, permissions, invitations, codes, allCourses } = detail;
  const authorizedIds = new Set(permissions.map((p) => p.course.id));
  const admins = members.filter((m) => m.role === "admin");
  const teachers = members.filter((m) => m.role === "teacher");
  const suspended = institution.status === "suspended";

  return (
    <>
      <Link href="/admin/etablissements" className="mb-5 inline-flex items-center gap-1.5 text-label font-medium text-ink-600 hover:text-ink-900">
        <ArrowLeft className="size-4" aria-hidden /> Établissements
      </Link>
      <PageHeader
        title={institution.name}
        eyebrow={<span className="font-mono">{institution.identifier}</span>}
        description={`${INSTITUTION_TYPES[institution.type]}${institution.city ? ` · ${institution.city}` : ""}`}
        actions={
          <>
            <Drawer
              title="Modifier l’établissement"
              width="max-w-lg"
              trigger={
                <Button variant="secondary">
                  <Pencil aria-hidden /> Modifier
                </Button>
              }
            >
              <div className="p-5">
                <InstitutionForm institution={institution} />
              </div>
            </Drawer>
            {suspended ? (
              <ActionButton size="md" variant="secondary" action={setInstitutionStatus.bind(null, institution.id, "active")}>
                <CircleCheck aria-hidden /> Réactiver
              </ActionButton>
            ) : (
              <ActionButton
                size="md"
                variant="danger-ghost"
                action={setInstitutionStatus.bind(null, institution.id, "suspended")}
                confirm={{
                  title: "Suspendre l’établissement ?",
                  description:
                    "Ses administrateurs perdent l’accès à l’espace établissement et les formations affectées par l’établissement deviennent inaccessibles. Aucune donnée n’est supprimée.",
                  confirmLabel: "Suspendre",
                }}
              >
                <Ban aria-hidden /> Suspendre
              </ActionButton>
            )}
          </>
        }
      >
        <div className="mt-3">{suspended ? <Badge tone="warning">Suspendu</Badge> : <Badge tone="success">Actif</Badge>}</div>
      </PageHeader>

      {overview ? (
        <section className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatTile label="Enseignants" value={overview.registered_teachers} />
          <StatTile label="Actifs" value={overview.active_teachers} detail={`${overview.inactivity_threshold_days} derniers jours`} />
          <StatTile label="Affectations" value={overview.assignments} />
          <StatTile label="Terminées" value={overview.completed_assignments} />
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Coordonnées" />
          <CardBody className="py-1">
            <DescriptionList
              items={[
                { term: "E-mail de contact", value: institution.contact_email },
                { term: "Téléphone", value: institution.contact_phone ?? "—" },
                { term: "Créé le", value: formatDate(institution.created_at) },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Formations autorisées" description="L’établissement ne peut affecter que ces formations." />
          <CardBody className="space-y-4">
            <GrantSelect
              label="Autoriser une formation"
              placeholder="Choisir une formation"
              buttonLabel="Autoriser"
              emptyMessage="Toutes les formations disponibles sont déjà autorisées."
              options={allCourses.filter((c) => !authorizedIds.has(c.id)).map((c) => ({ value: c.id, label: c.status === "draft" ? `${c.title} (brouillon)` : c.title }))}
              onGrant={async (courseId) => {
                "use server";
                return grantCourseToInstitution(courseId, institutionId);
              }}
            />
            {permissions.length ? (
              <ul className="divide-y divide-line rounded-md border border-line">
                {permissions.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <Link href={`/admin/formations/${p.course.id}`} className="block truncate text-body font-medium text-ink-900 hover:underline">
                        {p.course.title}
                      </Link>
                      <p className="text-caption text-ink-500">
                        Autorisée le {formatDate(p.granted_at)}
                        {p.course.status !== "published" ? " · non publiée" : ""}
                      </p>
                    </div>
                    <ActionButton
                      variant="danger-ghost"
                      action={revokeCourseFromInstitution.bind(null, p.course.id, institution.id)}
                      confirm={{
                        title: "Retirer cette autorisation ?",
                        description:
                          "Les affectations de cette formation dans l’établissement seront retirées et les enseignants concernés n’y auront plus accès par ce biais. Leur progression est conservée.",
                        confirmLabel: "Retirer l’autorisation",
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

        <Card className="xl:col-span-2">
          <CardHeader title="Membres" description={`${admins.length} administrateur(s) · ${teachers.length} enseignant(s)`} />
          {members.length === 0 ? (
            <EmptyState compact title="Aucun membre" description="Invitez l’administrateur de l’établissement ci-dessous." />
          ) : (
            <Table caption="Membres de l’établissement">
              <THead>
                <tr>
                  <TH>Nom</TH>
                  <TH>Rôle</TH>
                  <TH>Arrivée</TH>
                  <TH align="right">
                    <span className="sr-only">Actions</span>
                  </TH>
                </tr>
              </THead>
              <TBody>
                {members.map((m) => (
                  <TR key={m.id}>
                    <TD>
                      <Link href={`/admin/enseignants/${m.user.id}`} className="font-medium text-ink-900 hover:underline">
                        {m.user.full_name || m.user.email}
                      </Link>
                      <p className="text-caption text-ink-500">{m.user.email}</p>
                    </TD>
                    <TD>{m.role === "admin" ? <Badge tone="navy">Administrateur</Badge> : <Badge>Enseignant</Badge>}</TD>
                    <TD>
                      {formatDate(m.created_at)}
                      <p className="text-caption text-ink-500">{MEMBERSHIP_SOURCES[m.source as keyof typeof MEMBERSHIP_SOURCES]}</p>
                    </TD>
                    <TD align="right">
                      <ActionButton
                        variant="danger-ghost"
                        action={revokeMembership.bind(null, m.id, institution.id)}
                        confirm={{
                          title: `Retirer ${m.user.full_name || m.user.email} de l’établissement ?`,
                          description: "Le compte personnel, la progression et les certificats sont conservés.",
                          confirmLabel: "Retirer",
                        }}
                      >
                        <UserMinus aria-hidden /> <span className="sr-only sm:not-sr-only">Retirer</span>
                      </ActionButton>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Inviter" description="Administrateur ou enseignant de cet établissement." />
          <CardBody>
            <InviteForm kinds={["institution_admin", "institution_teacher"]} fixedInstitutionId={institution.id} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Codes d’inscription" />
          <EnrollmentCodeList codes={codes} institutionId={institution.id} joinUrl={`${publicEnv.appUrl}/rejoindre`} />
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Invitations" />
          <InvitationTable invitations={invitations} showKind />
        </Card>
      </div>
    </>
  );
}
