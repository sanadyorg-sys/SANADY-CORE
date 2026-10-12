import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, GraduationCap, Handshake, ShieldCheck, UserRoundCog } from "lucide-react";
import { PartnershipApproverForm, PlatformRoleForm } from "@/components/admin/team-forms";
import { ActionButton } from "@/components/common/action-button";
import { InviteForm } from "@/components/common/invite-form";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/surface";
import { formatDate } from "@/lib/format";
import { removePlatformAdmin, removePlatformRole, revokePartnershipApprover } from "@/server/actions/admin";
import { requireSanadyAdmin } from "@/server/auth";
import { listAdmins, listPedagogicalTeam } from "@/server/queries/admin";
import { listSignatories } from "@/server/queries/partnerships";

const ROLE_LABEL = {
  training_manager: "Responsable pédagogique",
  trainer: "Formateur",
  partnership_coordinator: "Chargé(e) des partenariats",
  partnership_manager: "Responsable des partenariats",
  enterprise_manager: "Responsable entreprises (Enterprise)",
  production_manager: "Responsable de production (Enterprise)",
} as const;

export const metadata: Metadata = { title: "Équipe SANADY" };

export default async function AdminsPage() {
  const viewer = await requireSanadyAdmin();
  const [admins, team, approvers] = await Promise.all([listAdmins(), listPedagogicalTeam(), listSignatories()]);

  return (
    <>
      <PageHeader
        title="Équipe SANADY"
        description="Administrateurs (toute la plateforme), équipe pédagogique (responsables, formateurs), équipe partenariats et approbateurs habilités."
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader title="Équipe d’administration" description={`${admins.length} administrateur(s)`} />
          <ul className="divide-y divide-line">
            {admins.map((a) => (
              <li key={a.user.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <ShieldCheck className="size-4 shrink-0 text-brand-600" aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink-900">
                      {a.user.full_name || a.user.email}
                      {a.user.id === viewer.id ? <span className="ml-2 text-caption font-normal text-ink-500">(vous)</span> : null}
                    </p>
                    <p className="text-caption text-ink-500">
                      {a.user.email} · depuis le {formatDate(a.granted_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {a.user.status !== "active" ? <Badge tone="danger">Suspendu</Badge> : null}
                  {a.user.id !== viewer.id ? (
                    <ActionButton
                      variant="danger-ghost"
                      action={removePlatformAdmin.bind(null, a.user.id)}
                      confirm={{
                        title: "Retirer le rôle d’administrateur ?",
                        description: "La personne conserve son compte personnel mais perd l’accès à l’administration SANADY.",
                        confirmLabel: "Retirer le rôle",
                      }}
                    >
                      Retirer le rôle
                    </ActionButton>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="self-start">
          <CardHeader title="Inviter un administrateur" />
          <CardBody>
            <InviteForm kinds={["platform_admin"]} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Équipe pédagogique et partenariats" description={`${team.length} membre(s)`} />
          {team.length ? (
            <ul className="divide-y divide-line">
              {team.map((m) => (
                <li key={m.user.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="flex min-w-0 items-start gap-3">
                    {m.role === "trainer" ? (
                      <GraduationCap className="mt-0.5 size-4 shrink-0 text-accent-700" aria-hidden />
                    ) : m.role.startsWith("partnership") ? (
                      <Handshake className="mt-0.5 size-4 shrink-0 text-success-700" aria-hidden />
                    ) : (
                      <UserRoundCog className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-ink-900">
                        {m.user.full_name || m.user.email}{" "}
                        <Badge tone={m.role === "trainer" ? "accent" : m.role.startsWith("partnership") ? "success" : "brand"}>{ROLE_LABEL[m.role]}</Badge>
                      </p>
                      <p className="text-caption text-ink-500">
                        {m.user.email} · depuis le {formatDate(m.granted_at)}
                      </p>
                      {m.role === "trainer" ? (
                        <p className="mt-1 text-caption text-ink-600">
                          {m.courses.length ? (
                            <>
                              Formations :{" "}
                              {m.courses.map((c, i) => (
                                <span key={c.id}>
                                  {i ? ", " : ""}
                                  <Link href={`/admin/formations/${c.id}/formateurs`} className="text-accent-700 hover:underline">
                                    {c.title}
                                  </Link>
                                </span>
                              ))}
                            </>
                          ) : (
                            "Aucune formation confiée pour l’instant (onglet « Formateurs » d’une formation)."
                          )}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.user.status !== "active" ? <Badge tone="danger">Suspendu</Badge> : null}
                    <ActionButton
                      variant="danger-ghost"
                      action={removePlatformRole.bind(null, m.user.id)}
                      confirm={{
                        title: "Retirer ce rôle ?",
                        description: "La personne conserve son compte enseignant mais perd l’accès à l’espace pédagogique (et à ses formations confiées).",
                        confirmLabel: "Retirer le rôle",
                      }}
                    >
                      Retirer le rôle
                    </ActionButton>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <CardBody>
              <p className="text-body text-ink-600">Aucun responsable pédagogique ni formateur pour l’instant.</p>
            </CardBody>
          )}
        </Card>
        <Card className="self-start">
          <CardHeader title="Attribuer un rôle" />
          <CardBody>
            <PlatformRoleForm />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Approbateurs habilités"
            description="Seules ces personnes valident les engagements de la Fondation : conventions de partenariat, besoins et projets publiés, propositions et contrats Enterprise (double authentification). Le rôle d’administrateur ne donne pas ce pouvoir."
          />
          {approvers.length ? (
            <ul className="divide-y divide-line">
              {approvers.map((a) => (
                <li key={a.user.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <BadgeCheck className="size-4 shrink-0 text-success-700" aria-hidden />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink-900">{a.user.full_name || a.user.email}</p>
                      <p className="text-caption text-ink-500">
                        {a.user.email} · désigné(e) le {formatDate(a.granted_at)}
                        {a.granter ? ` par ${a.granter.full_name || a.granter.email}` : ""}
                      </p>
                    </div>
                  </div>
                  {a.user.id !== viewer.id ? (
                    <ActionButton
                      variant="danger-ghost"
                      action={revokePartnershipApprover.bind(null, a.user.id)}
                      confirm={{ title: "Retirer l’habilitation ?", description: "La personne ne pourra plus valider de convention.", confirmLabel: "Retirer" }}
                    >
                      Retirer
                    </ActionButton>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <CardBody>
              <p className="text-body text-ink-600">Aucun approbateur désigné : aucune convention ne peut être validée.</p>
            </CardBody>
          )}
        </Card>
        <Card className="self-start">
          <CardHeader title="Désigner un approbateur" />
          <CardBody>
            <PartnershipApproverForm />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
