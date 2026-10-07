import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { InviteForm } from "@/components/common/invite-form";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/surface";
import { formatDate } from "@/lib/format";
import { removePlatformAdmin } from "@/server/actions/admin";
import { requireSanadyAdmin } from "@/server/auth";
import { listAdmins } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Administrateurs" };

export default async function AdminsPage() {
  const viewer = await requireSanadyAdmin();
  const admins = await listAdmins();

  return (
    <>
      <PageHeader
        title="Administrateurs SANADY"
        description="Seuls les administrateurs SANADY peuvent créer, modifier, publier ou supprimer des contenus pédagogiques."
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader title="Équipe d’administration" description={`${admins.length} administrateur(s)`} />
          <ul className="divide-y divide-line">
            {admins.map((a) => (
              <li key={a.user.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <ShieldCheck className="size-4 shrink-0 text-navy-600" aria-hidden />
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
      </div>
    </>
  );
}
