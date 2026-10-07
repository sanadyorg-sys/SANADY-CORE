import type { Metadata } from "next";
import Link from "next/link";
import { Building2, ShieldCheck } from "lucide-react";
import { LeaveInstitutionButton, PasswordForm, ProfileForm } from "@/components/profile/profile-forms";
import { buttonClasses } from "@/components/ui/button";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/surface";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/server/auth";

export const metadata: Metadata = { title: "Mon profil" };

export default async function ProfilePage() {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const { data } = await supabase
    .from("institution_memberships")
    .select("id, role, created_at, consented_at, institution:institutions(id, name)")
    .eq("user_id", viewer.id)
    .eq("status", "active")
    .order("created_at");
  const memberships = (data ?? []) as unknown as Array<{
    id: string;
    role: "admin" | "teacher";
    created_at: string;
    consented_at: string | null;
    institution: { id: string; name: string } | null;
  }>;

  return (
    <>
      <PageHeader title="Mon profil" description="Vos informations personnelles, votre sécurité et vos établissements." />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Informations personnelles" />
            <CardBody>
              <ProfileForm profile={viewer.profile} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Sécurité" description="Changez régulièrement votre mot de passe et ne le partagez jamais." />
            <CardBody>
              <PasswordForm />
            </CardBody>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader
              title="Mes établissements"
              actions={
                <Link href="/rejoindre" className={buttonClasses({ variant: "secondary", size: "sm" })}>
                  Rejoindre
                </Link>
              }
            />
            <CardBody>
              {memberships.length === 0 ? (
                <p className="text-body text-ink-500">
                  Vous n’êtes rattaché(e) à aucun établissement. Votre compte reste personnel : seule l’équipe SANADY peut voir votre
                  progression.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {memberships.map((m) => (
                    <li key={m.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                      <Building2 className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="text-body font-medium text-ink-900">{m.institution?.name}</p>
                        <p className="text-caption text-ink-500">
                          {m.role === "admin" ? "Administrateur" : "Enseignant"} · depuis le {formatDate(m.created_at)}
                        </p>
                        {m.role === "teacher" ? (
                          <Badge tone="neutral" className="mt-1.5">
                            Accès aux formations affectées uniquement
                          </Badge>
                        ) : null}
                      </div>
                      {m.role === "teacher" && m.institution ? (
                        <LeaveInstitutionButton institutionId={m.institution.id} institutionName={m.institution.name} />
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Vos données" />
            <CardBody className="space-y-3 text-body text-ink-600">
              <p className="flex gap-2">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent-600" aria-hidden />
                Un établissement ne voit votre progression que pour les formations qu’il vous a lui-même affectées.
              </p>
              <p>
                Notice acceptée le {formatDate(viewer.profile.privacy_acknowledged_at)}.{" "}
                <Link href="/confidentialite" className="font-medium text-accent-700 hover:underline">
                  Consulter la notice
                </Link>
              </p>
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}
