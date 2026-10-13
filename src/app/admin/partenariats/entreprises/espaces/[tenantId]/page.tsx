import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Circle, Pencil, ShieldCheck } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { AuthorizeTenantForm, DeletionDateForm, InviteTenantAdminForm, TenantForm, TenantStatusForm } from "@/components/enterprise/tenant-forms";
import { HistoryList } from "@/components/partnerships/timeline";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/overlay";
import { Alert, Badge, Card, CardBody, CardHeader, DescriptionList, PageHeader } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { displayName, formatDate, formatDateTime } from "@/lib/format";
import { SERVICE_PLANS, TENANT_STATUS, TENANT_STEPS, tenantNextSteps } from "@/lib/enterprise";
import { uuidSchema } from "@/lib/validation";
import { OverageReviewForm } from "@/components/enterprise/contract-forms";
import { recordTenantUsage } from "@/server/actions/contracts";
import { authorizeTenantExport, confirmTenantSecurity, generateWorkspace } from "@/server/actions/enterprise";
import { requireEnterpriseStaff } from "@/server/auth";
import { enterpriseActor, getTenant, tenantUsageRecords } from "@/server/queries/enterprise";

export const metadata: Metadata = { title: "Espace de formation — Enterprise" };

const HISTORY_LABELS: Record<string, string> = {
  ...Object.fromEntries(Object.entries(TENANT_STATUS).map(([k, v]) => [k, v.label])),
  security_checked: "Contrôles de sécurité effectués",
  admin_invited: "Administrateur de l’entreprise invité",
  export_authorized: "Export des données autorisé",
  deletion_scheduled: "Suppression des données programmée",
};

export default async function TenantPage(props: PageProps<"/admin/partenariats/entreprises/espaces/[tenantId]">) {
  const viewer = await requireEnterpriseStaff();
  const { tenantId } = await props.params;
  if (!uuidSchema.safeParse(tenantId).success) notFound();
  const [detail, actor] = await Promise.all([getTenant(tenantId), enterpriseActor(viewer)]);
  if (!detail) notFound();
  const { tenant: t, checklist, usage, history, contacts, proposals } = detail;
  const readings = t.institution_id ? await tenantUsageRecords(t.id) : null;
  const month = new Date().toISOString().slice(0, 7) + "-01";
  const monthLabel = (d: string) => new Date(d).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const open = !["closed", "cancelled"].includes(t.status);
  const setupOpen = ["provisioning", "active", "suspended"].includes(t.status);
  const done = TENANT_STEPS.filter((s) => checklist[s.key]).length;
  const seatsUsed = (usage?.employees ?? 0) + (usage?.invited ?? 0);

  return (
    <>
      <Link href="/admin/partenariats/entreprises/espaces" className="mb-3 inline-flex items-center gap-1.5 text-label text-ink-600 hover:text-ink-900">
        <ArrowLeft className="size-4" aria-hidden /> Espaces de formation
      </Link>
      <PageHeader
        title={t.display_name}
        description={`/entreprise/${t.slug} · ${SERVICE_PLANS[t.service_plan]}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={TENANT_STATUS[t.status].tone}>{TENANT_STATUS[t.status].label}</Badge>
            <Link href={`/admin/partenariats/entreprises/clients/${t.organization_id}`} className="text-label text-accent-700 hover:underline">
              Fiche client — {t.organization?.name}
            </Link>
            {actor.manager && open && t.status !== "offboarding" ? (
              <Drawer
                title="Configuration de l’espace"
                width="max-w-2xl"
                trigger={
                  <Button variant="secondary">
                    <Pencil aria-hidden /> Modifier
                  </Button>
                }
              >
                <div className="p-5">
                  <TenantForm
                    organizationId={t.organization_id}
                    organizationName={t.organization?.name ?? t.display_name}
                    tenant={t}
                    contacts={contacts.map((c) => ({ id: c.id, label: c.email ? `${c.full_name} — ${c.email}` : c.full_name }))}
                    proposals={proposals.map((p) => ({ id: p.id, label: `${p.reference} — ${p.title}` }))}
                  />
                </div>
              </Drawer>
            ) : null}
          </div>
        }
      />

      {t.status === "requested" ? (
        <Alert tone="warning" className="mb-6">
          En attente de l’autorisation d’un approbateur habilité. Aucun espace n’existe encore et aucun collaborateur ne peut être invité.
        </Alert>
      ) : null}
      {t.status === "offboarding" ? (
        <Alert tone="warning" className="mb-6">
          Fin de contrat en cours : plus aucun nouveau collaborateur. Étapes : export autorisé (approbateur) → date de suppression des données →
          fermeture de l’espace. Rien n’est supprimé immédiatement.
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Mise en place" description={`${done} étape(s) sur ${TENANT_STEPS.length} — vérifiées à partir des données, pas cochées à la main.`} />
            <ol className="divide-y divide-line">
              {TENANT_STEPS.map((s, i) => {
                const ok = Boolean(checklist[s.key]);
                return (
                  <li key={s.key} className="flex items-start gap-3 px-5 py-3">
                    <span
                      className={cn(
                        "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-caption font-semibold",
                        ok ? "bg-success-600 text-white" : "border border-line-strong text-ink-500",
                      )}
                      aria-hidden
                    >
                      {ok ? <Check className="size-3.5" /> : i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-body", ok ? "text-ink-700" : "font-medium text-ink-900")}>
                        {s.label} <span className="sr-only">{ok ? "(fait)" : "(à faire)"}</span>
                      </p>
                      <p className="text-caption text-ink-500">{s.who}</p>
                      <StepAction stepKey={s.key} ok={ok} tenant={t} actor={actor} isAdmin={viewer.isSanadyAdmin} />
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>

          <Card>
            <CardHeader title="Configuration" />
            <CardBody>
              <DescriptionList
                items={[
                  { term: "Collaborateurs autorisés", value: `${t.max_learners} (utilisés : ${seatsUsed}, invitations comprises)` },
                  { term: "Stockage", value: t.storage_allowance_gb ? `${t.storage_allowance_gb} Go` : "—" },
                  { term: "Vidéo", value: t.video_minutes_allowance ? `${t.video_minutes_allowance.toLocaleString("fr-FR")} minutes / an` : "—" },
                  { term: "Contrat", value: t.contract_start_on && t.contract_end_on ? `du ${formatDate(t.contract_start_on)} au ${formatDate(t.contract_end_on)}` : "—" },
                  { term: "Support", value: [t.support_level, t.support_email].filter(Boolean).join(" · ") || "—" },
                  { term: "Document de fin", value: t.certificate_kind === "attestation" ? "Attestation de formation" : "Certificat de fin de formation" },
                  { term: "Autorisé par", value: t.authorizer ? `${displayName(t.authorizer)}${t.authorized_at ? ` le ${formatDateTime(t.authorized_at)}` : ""}` : "—" },
                  { term: "Sécurité vérifiée par", value: t.checker ? `${displayName(t.checker)}${t.security_checked_at ? ` le ${formatDateTime(t.security_checked_at)}` : ""}` : "—" },
                ]}
              />
            </CardBody>
          </Card>

          {readings ? (
            <Card id="utilisation">
              <CardHeader
                title="Relevés mensuels"
                description={
                  readings.contracts[0]
                    ? `Comparés au contrat ${readings.contracts[0].reference}. Un dépassement est signalé pour examen : rien n’est facturé automatiquement.`
                    : "Aucun contrat signé rattaché : les limites de l’espace servent de référence."
                }
              />
              <CardBody className="space-y-4">
                {readings.now ? (
                  <p className="text-label text-ink-700">
                    Ce mois-ci, à l’instant : {readings.now.active_learners} actif(s), {readings.now.enrolled_learners} inscrit(s), {readings.now.completions} parcours terminé(s),{" "}
                    {Number(readings.now.storage_mb).toLocaleString("fr-FR")} Mo de contenus de l’entreprise.
                  </p>
                ) : null}
                {actor.manager ? (
                  <ActionButton action={recordTenantUsage.bind(null, t.id, month)}>Enregistrer le relevé de {monthLabel(month)}</ActionButton>
                ) : null}
                {readings.records.length ? (
                  <ul className="divide-y divide-line rounded-xl border border-line">
                    {readings.records.map((r) => (
                      <li key={r.id} className="space-y-2 px-3 py-3">
                        <p className="flex flex-wrap items-center gap-2 font-medium text-ink-900">
                          {monthLabel(r.period)}
                          {r.overage ? <Badge tone={r.reviewed_at ? "neutral" : "danger"}>{r.reviewed_at ? "Dépassement examiné" : "Dépassement"}</Badge> : <Badge tone="success">Dans les limites</Badge>}
                        </p>
                        <p className="text-caption text-ink-600">
                          {r.active_learners} actif(s) · {r.enrolled_learners} inscrit(s){r.learner_limit ? ` / ${r.learner_limit} prévus` : ""} · {r.completions} terminé(s) ·{" "}
                          {Number(r.storage_mb).toLocaleString("fr-FR")} Mo{r.storage_limit_gb ? ` / ${r.storage_limit_gb} Go` : ""}
                        </p>
                        {r.review_note ? <p className="text-label text-ink-700">Suite donnée : {r.review_note}</p> : null}
                        {r.overage && !r.reviewed_at && actor.manager ? <OverageReviewForm id={r.id} tenantId={t.id} /> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-body text-ink-600">Aucun relevé enregistré.</p>
                )}
                <p className="text-caption text-ink-500">Les minutes de vidéo regardées ne sont pas encore mesurées.</p>
              </CardBody>
            </Card>
          ) : null}

          {usage && t.institution_id ? (
            <Card>
              <CardHeader title="Utilisation" description="Chiffres réels de l’espace. Les noms des collaborateurs restent visibles par l’entreprise uniquement." />
              <CardBody>
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {[
                    ["Collaborateurs actifs", usage.employees],
                    ["Invitations en attente", usage.invited],
                    ["Actifs (30 jours)", usage.active_30d],
                    ["Formations ouvertes", usage.courses],
                    ["Formations de l’entreprise", usage.private_courses],
                    ["Parcours terminés", usage.completions],
                    ["Attestations délivrées", usage.certificates],
                    ["Administrateurs", usage.admins],
                  ].map(([k, v]) => (
                    <div key={k as string} className="rounded-xl border border-line p-3">
                      <dt className="text-caption text-ink-500">{k}</dt>
                      <dd className="mt-1 text-title font-semibold tabular-nums text-ink-900">{v}</dd>
                    </div>
                  ))}
                </dl>
              </CardBody>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          {t.status === "requested" && actor.signatory ? (
            <Card>
              <CardHeader title="Autorisation (approbateur)" />
              <CardBody>
                <AuthorizeTenantForm id={t.id} />
              </CardBody>
            </Card>
          ) : null}

          {setupOpen || t.status === "offboarding" ? (
            <Card>
              <CardHeader title="Statut de l’espace" />
              <CardBody>
                <TenantStatusForm id={t.id} options={tenantNextSteps(t.status, actor)} />
              </CardBody>
            </Card>
          ) : null}

          {setupOpen && actor.manager ? (
            <Card>
              <CardHeader title="Administrateur de l’entreprise" description="Il invite ensuite les collaborateurs et attribue les formations." />
              {usage?.admin_invitations.length ? (
                <ul className="divide-y divide-line border-b border-line">
                  {usage.admin_invitations.map((i) => (
                    <li key={i.id} className="px-5 py-3">
                      <p className="truncate font-medium text-ink-900">{i.email}</p>
                      <p className="text-caption text-ink-500">
                        {i.accepted ? "Invitation acceptée" : i.sent ? "E-mail envoyé" : "Lien remis à la main"}
                        {!i.accepted ? ` · expire le ${formatDate(i.expires_at)}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : null}
              <CardBody>
                <InviteTenantAdminForm id={t.id} />
              </CardBody>
            </Card>
          ) : null}

          {t.status === "offboarding" || t.status === "closed" ? (
            <Card>
              <CardHeader title="Fin de contrat" />
              <CardBody className="space-y-4">
                {t.termination_note ? <p className="whitespace-pre-line text-body text-ink-800">{t.termination_note}</p> : null}
                <p className="text-label text-ink-700">
                  Export des données :{" "}
                  {t.export_authorized_at ? `autorisé par ${t.exporter ? displayName(t.exporter) : "un approbateur"} le ${formatDateTime(t.export_authorized_at)}` : "non autorisé"}
                </p>
                {!t.export_authorized_at && t.status === "offboarding" && actor.signatory ? (
                  <ActionButton
                    action={authorizeTenantExport.bind(null, t.id)}
                    confirm={{ title: "Autoriser l’export ?", description: "L’entreprise pourra exporter ses rapports et ses données de suivi.", confirmLabel: "Autoriser" }}
                  >
                    Autoriser l’export (approbateur)
                  </ActionButton>
                ) : null}
                {actor.manager ? <DeletionDateForm id={t.id} value={t.deletion_due_on} /> : t.deletion_due_on ? <p>Suppression prévue le {formatDate(t.deletion_due_on)}.</p> : null}
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Historique" description={`Demande créée le ${formatDateTime(t.created_at)}`} />
            <CardBody>
              <HistoryList history={history} labels={HISTORY_LABELS} />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function StepAction({
  stepKey,
  ok,
  tenant: t,
  actor,
  isAdmin,
}: {
  stepKey: string;
  ok: boolean;
  tenant: { id: string; status: string; institution_id: string | null };
  actor: { manager: boolean; signatory: boolean };
  isAdmin: boolean;
}) {
  if (ok) return null;
  if (stepKey === "workspace" && t.status === "authorized" && actor.manager) {
    return (
      <div className="mt-2">
        <ActionButton
          variant="accent"
          action={generateWorkspace.bind(null, t.id)}
          confirm={{ title: "Générer l’espace ?", description: "L’espace sécurisé de l’entreprise est créé ; son adresse ne pourra plus changer.", confirmLabel: "Générer" }}
        >
          Générer l’espace
        </ActionButton>
      </div>
    );
  }
  if (stepKey === "security" && t.institution_id && isAdmin) {
    return (
      <div className="mt-2">
        <ActionButton
          action={confirmTenantSecurity.bind(null, t.id)}
          confirm={{
            title: "Confirmer les contrôles de sécurité ?",
            description: "Vous attestez avoir vérifié : double authentification de l’administrateur SANADY, formations réservées à cet espace, aucune donnée d’un autre client.",
            confirmLabel: "Confirmer",
          }}
        >
          <ShieldCheck aria-hidden /> Confirmer les contrôles
        </ActionButton>
      </div>
    );
  }
  if (stepKey === "catalog" && t.institution_id) {
    return (
      <p className="mt-1 inline-flex items-center gap-1 text-caption text-ink-600">
        <Circle className="size-3" aria-hidden /> L’équipe pédagogique ouvre les formations à l’espace (Formations → Autorisations).
      </p>
    );
  }
  return null;
}
