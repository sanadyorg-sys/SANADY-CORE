import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Inbox } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { EmptyState } from "@/components/ui/feedback";
import { Badge, Card, PageHeader } from "@/components/ui/surface";
import { LinkTabs } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatRelative } from "@/lib/format";
import { approveAccessRequest, rejectAccessRequest } from "@/server/actions/access-requests";
import { requireSanadyAdmin } from "@/server/auth";

export const metadata: Metadata = { title: "Demandes d’accès" };

interface AccessRequest {
  id: string;
  kind: "teacher" | "institution";
  first_name: string;
  last_name: string;
  email: string;
  job_title: string | null;
  subject_area: string | null;
  institution_name: string | null;
  city: string | null;
  message: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  handled_at: string | null;
  course: { title: string } | null;
}

const TABS = { attente: "pending", acceptees: "approved", refusees: "rejected" } as const;

export default async function AccessRequestsPage(props: PageProps<"/admin/demandes">) {
  await requireSanadyAdmin();
  const sp = await props.searchParams;
  const tab = (typeof sp.statut === "string" && sp.statut in TABS ? sp.statut : "attente") as keyof typeof TABS;
  const supabase = await createClient();

  const [{ data }, { count: pending }] = await Promise.all([
    supabase
      .from("access_requests")
      .select("id, kind, first_name, last_name, email, job_title, subject_area, institution_name, city, message, status, created_at, handled_at, course:courses(title)")
      .eq("status", TABS[tab])
      .order("created_at", { ascending: tab === "attente" })
      .limit(300),
    supabase.from("access_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  const requests = (data ?? []) as unknown as AccessRequest[];

  return (
    <>
      <PageHeader
        title="Demandes d’accès"
        description="Demandes envoyées depuis le site public. Accepter une demande d’enseignant lui envoie une invitation personnelle ; les demandes d’établissement sont à traiter avec l’équipe."
      />
      <LinkTabs
        className="mb-6"
        activeHref={`/admin/demandes?statut=${tab}`}
        items={[
          { href: "/admin/demandes?statut=attente", label: "En attente", count: pending ?? 0 },
          { href: "/admin/demandes?statut=acceptees", label: "Acceptées" },
          { href: "/admin/demandes?statut=refusees", label: "Refusées" },
        ]}
      />

      {requests.length === 0 ? (
        <Card>
          <EmptyState
            icon={Inbox}
            title={tab === "attente" ? "Aucune demande en attente" : "Aucune demande"}
            description={
              <>
                Les visiteurs peuvent demander un accès depuis{" "}
                <Link href="/demande-acces" className="font-medium text-accent-700 hover:underline">
                  la page publique
                </Link>
                .
              </>
            }
          />
        </Card>
      ) : (
        <ul className="space-y-4">
          {requests.map((r) => {
            const name = `${r.first_name} ${r.last_name}`;
            const profile = [r.job_title, r.subject_area].filter(Boolean).join(" · ");
            const place = [r.institution_name, r.city].filter(Boolean).join(", ");
            return (
              <li key={r.id}>
                <Card className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-card font-semibold text-ink-900">{name}</h2>
                        {r.kind === "institution" ? (
                          <Badge tone="accent">
                            <Building2 className="size-3" aria-hidden /> Établissement
                          </Badge>
                        ) : (
                          <Badge tone="neutral">Enseignant</Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-body text-ink-600">
                        <a href={`mailto:${r.email}`} className="hover:underline">
                          {r.email}
                        </a>
                      </p>
                      <dl className="mt-3 grid gap-x-8 gap-y-1.5 text-label sm:grid-cols-2">
                        {profile ? (
                          <div className="flex gap-2">
                            <dt className="text-ink-500">Profil :</dt>
                            <dd className="text-ink-800">{profile}</dd>
                          </div>
                        ) : null}
                        {place ? (
                          <div className="flex gap-2">
                            <dt className="text-ink-500">Établissement :</dt>
                            <dd className="text-ink-800">{place}</dd>
                          </div>
                        ) : null}
                        {r.course ? (
                          <div className="flex gap-2">
                            <dt className="text-ink-500">Formation :</dt>
                            <dd className="text-ink-800">{r.course.title}</dd>
                          </div>
                        ) : null}
                        <div className="flex gap-2">
                          <dt className="text-ink-500">Reçue :</dt>
                          <dd className="text-ink-800" title={formatDateTime(r.created_at)}>
                            {formatRelative(r.created_at)}
                          </dd>
                        </div>
                        {r.handled_at ? (
                          <div className="flex gap-2">
                            <dt className="text-ink-500">Traitée :</dt>
                            <dd className="text-ink-800">{formatDateTime(r.handled_at)}</dd>
                          </div>
                        ) : null}
                      </dl>
                      {r.message ? (
                        <blockquote className="mt-3 whitespace-pre-line border-l-2 border-line-strong pl-3 text-body text-ink-700">
                          {r.message}
                        </blockquote>
                      ) : null}
                    </div>

                    {r.status === "pending" ? (
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <ActionButton
                          action={approveAccessRequest.bind(null, r.id)}
                          variant="accent"
                          confirm={
                            r.kind === "teacher"
                              ? {
                                  title: `Inviter ${name} ?`,
                                  description: `Une invitation personnelle (compte enseignant indépendant) sera envoyée à ${r.email}.`,
                                  confirmLabel: "Accepter et inviter",
                                  tone: "accent",
                                }
                              : {
                                  title: "Marquer la demande comme acceptée ?",
                                  description:
                                    "Créez ensuite l’établissement dans « Établissements » et invitez son administrateur. Aucun e-mail n’est envoyé automatiquement.",
                                  confirmLabel: "Accepter",
                                  tone: "accent",
                                }
                          }
                        >
                          {r.kind === "teacher" ? "Accepter et inviter" : "Accepter"}
                        </ActionButton>
                        <ActionButton
                          action={rejectAccessRequest.bind(null, r.id)}
                          variant="ghost"
                          confirm={{
                            title: "Refuser cette demande ?",
                            description: "La personne n’est pas prévenue automatiquement.",
                            confirmLabel: "Refuser",
                            tone: "danger",
                          }}
                        >
                          Refuser
                        </ActionButton>
                      </div>
                    ) : (
                      <Badge tone={r.status === "approved" ? "success" : "neutral"} dot>
                        {r.status === "approved" ? "Acceptée" : "Refusée"}
                      </Badge>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
