import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Award, Building2, ChartColumn, Library, Mail, TriangleAlert, UserCheck, Users } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { Alert, Card, CardBody, CardHeader, PageHeader, StatTile } from "@/components/ui/surface";
import { formatDateTime } from "@/lib/format";
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/labels";
import { requireSanadyAdmin } from "@/server/auth";
import { getPlatformOverview, listAuditLogs, listCourses } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Administration" };

export default async function AdminDashboardPage() {
  await requireSanadyAdmin();
  const [overview, audit, drafts] = await Promise.all([
    getPlatformOverview(),
    listAuditLogs({ page: 1, pageSize: 8 }),
    listCourses({ status: "draft" }),
  ]);
  const completion = overview.enrollments ? Math.round((overview.completed_enrollments / overview.enrollments) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        description="Vue d’ensemble de la plateforme SANADY."
        actions={
          <>
            <Link href="/admin/invitations" className={buttonClasses({ variant: "secondary" })}>
              <Mail aria-hidden /> Inviter
            </Link>
            <Link href="/admin/formations" className={buttonClasses()}>
              <Library aria-hidden /> Formations
            </Link>
          </>
        }
      />

      {overview.exhausted_attempts > 0 ? (
        <Alert
          tone="warning"
          className="mb-6"
          title={`${overview.exhausted_attempts} enseignant(s) en attente d’intervention`}
          action={
            <Link href="/admin/suivi" className={buttonClasses({ variant: "secondary", size: "sm" })}>
              Traiter
            </Link>
          }
        >
          Ces enseignants ont épuisé leurs trois tentatives sur une évaluation de module.
        </Alert>
      ) : null}

      <section aria-label="Indicateurs" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatTile label="Établissements actifs" value={overview.institutions} icon={Building2} />
        <StatTile label="Enseignants" value={overview.teachers} icon={Users} detail={`${overview.pending_invitations} invitation(s) en attente`} />
        <StatTile
          label="Apprenants actifs"
          value={overview.active_learners}
          icon={UserCheck}
          detail={`Sur les ${overview.inactivity_threshold_days} derniers jours`}
        />
        <StatTile label="Certificats délivrés" value={overview.certificates} icon={Award} />
      </section>

      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Formations" />
            <CardBody>
              <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                {[
                  { label: "Publiées", value: overview.published_courses },
                  { label: "Brouillons", value: overview.draft_courses },
                  { label: "Inscriptions", value: overview.enrollments },
                  { label: "Taux d’achèvement", value: `${completion} %` },
                ].map((s) => (
                  <div key={s.label}>
                    <dt className="text-label text-ink-500">{s.label}</dt>
                    <dd className="tabular mt-1 text-section font-semibold text-ink-900">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Brouillons en cours"
              actions={
                <Link href="/admin/formations?statut=draft" className="text-label font-medium text-accent-700 hover:underline">
                  Voir tout
                </Link>
              }
            />
            {drafts.length === 0 ? (
              <CardBody>
                <p className="text-body text-ink-500">Aucun brouillon.</p>
              </CardBody>
            ) : (
              <ul className="divide-y divide-line">
                {drafts.slice(0, 5).map((c) => (
                  <li key={c.id}>
                    <Link href={`/admin/formations/${c.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-ink-25">
                      <span className="min-w-0">
                        <span className="block truncate text-body font-medium text-ink-900">{c.title}</span>
                        <span className="text-caption text-ink-500">
                          {c.modules} module{c.modules > 1 ? "s" : ""} · modifié le {formatDateTime(c.updated_at)}
                        </span>
                      </span>
                      <ArrowRight className="size-4 shrink-0 text-ink-400" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card className="self-start">
          <CardHeader
            title="Activité administrative"
            actions={
              <Link href="/admin/journal" className="text-label font-medium text-accent-700 hover:underline">
                Journal complet
              </Link>
            }
          />
          {audit.rows.length === 0 ? (
            <CardBody>
              <p className="text-body text-ink-500">Aucune activité enregistrée.</p>
            </CardBody>
          ) : (
            <ul className="divide-y divide-line">
              {audit.rows.map((row) => (
                <li key={row.id} className="px-5 py-3">
                  <p className="text-body text-ink-800">
                    <span className="font-medium">{AUDIT_ACTIONS[row.action] ?? row.action}</span> —{" "}
                    {AUDIT_ENTITIES[row.entity_type] ?? row.entity_type}
                    {row.details?.label ? ` « ${row.details.label} »` : ""}
                  </p>
                  <p className="text-caption text-ink-500">
                    {row.actor?.full_name || row.actor?.email || "Système"} · {formatDateTime(row.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <Link href="/admin/suivi" className="inline-flex items-center gap-1.5 text-label font-medium text-accent-700 hover:underline">
          <ChartColumn className="size-4" aria-hidden /> Accéder au suivi pédagogique
        </Link>
        {overview.exhausted_attempts === 0 ? null : (
          <span className="ml-3 inline-flex items-center gap-1 text-label text-warning-700">
            <TriangleAlert className="size-4" aria-hidden /> interventions en attente
          </span>
        )}
      </div>
    </>
  );
}
