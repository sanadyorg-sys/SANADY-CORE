import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, FileText } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { ApplicationStatusForm, NoteForm } from "@/components/partnerships/admin-forms";
import { HistoryList, NotesList } from "@/components/partnerships/timeline";
import { buttonClasses } from "@/components/ui/button";
import { Alert, Badge, Card, CardBody, CardHeader, DescriptionList, PageHeader } from "@/components/ui/surface";
import { formatDateTime } from "@/lib/format";
import { APPLICATION_STATUS, CONTRIBUTION_TYPES, INTERVENTION_FIELDS, ORG_TYPES } from "@/lib/partnerships";
import { uuidSchema } from "@/lib/validation";
import { createPartnerFromApplication } from "@/server/actions/partnerships";
import { requirePartnershipStaff } from "@/server/auth";
import { getApplication } from "@/server/queries/partnerships";

export const metadata: Metadata = { title: "Candidature de partenariat" };

const kb = (n: number) => `${Math.max(1, Math.round(n / 1024))} Ko`;

export default async function ApplicationPage(props: PageProps<"/admin/partenariats/candidatures/[applicationId]">) {
  await requirePartnershipStaff();
  const { applicationId } = await props.params;
  if (!uuidSchema.safeParse(applicationId).success) notFound();
  const detail = await getApplication(applicationId);
  if (!detail) notFound();
  const { application: a, documents, notes, history } = detail;
  const status = APPLICATION_STATUS[a.status];
  const canConvert = a.status === "received" || a.status === "under_review";

  return (
    <>
      <Link href="/admin/partenariats" className="mb-3 inline-flex items-center gap-1.5 text-label text-ink-600 hover:text-ink-900">
        <ArrowLeft className="size-4" aria-hidden /> Candidatures
      </Link>
      <PageHeader
        title={a.org_name}
        description={`${a.reference} · reçue le ${formatDateTime(a.created_at)}`}
        actions={<Badge tone={status.tone}>{status.label}</Badge>}
      />

      {a.status === "spam" ? (
        <Alert tone="warning" title="Candidature indésirable" className="mb-6">
          Ses documents ne peuvent pas être ouverts. Elle sera supprimée automatiquement 24 mois après ce classement.
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Organisation" />
            <CardBody>
              <DescriptionList
                items={[
                  { term: "Type", value: ORG_TYPES[a.org_type] },
                  { term: "Pays / ville", value: [a.country, a.city].filter(Boolean).join(", ") },
                  { term: "Secteur", value: a.sector ?? "—" },
                  {
                    term: "Site web",
                    value: a.website ? (
                      <a href={a.website} target="_blank" rel="noopener noreferrer nofollow" className="text-accent-700 hover:underline">
                        {a.website}
                      </a>
                    ) : (
                      "—"
                    ),
                  },
                ]}
              />
              <p className="mt-4 whitespace-pre-line text-body text-ink-800">{a.org_description}</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Contact" />
            <CardBody>
              <DescriptionList
                items={[
                  { term: "Nom", value: `${a.contact_name} — ${a.contact_title}` },
                  {
                    term: "E-mail",
                    value: (
                      <a href={`mailto:${a.contact_email}`} className="text-accent-700 hover:underline">
                        {a.contact_email}
                      </a>
                    ),
                  },
                  { term: "Téléphone", value: a.contact_phone ?? "—" },
                  { term: "Consentement", value: formatDateTime(a.consent_at) },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Proposition" />
            <CardBody className="space-y-4">
              <DescriptionList
                items={[
                  { term: "Domaine", value: INTERVENTION_FIELDS[a.intervention_field]?.name ?? a.intervention_field },
                  { term: "Type de contribution", value: CONTRIBUTION_TYPES[a.contribution_type] },
                  { term: "Calendrier souhaité", value: a.timeline ?? "—" },
                ]}
              />
              <div>
                <h3 className="text-label font-semibold text-ink-600">Contribution proposée</h3>
                <p className="mt-1 whitespace-pre-line text-body text-ink-800">{a.contribution}</p>
              </div>
              <div>
                <h3 className="text-label font-semibold text-ink-600">Coopération envisagée</h3>
                <p className="mt-1 whitespace-pre-line text-body text-ink-800">{a.cooperation}</p>
              </div>
              {a.extra ? (
                <div>
                  <h3 className="text-label font-semibold text-ink-600">Informations complémentaires</h3>
                  <p className="mt-1 whitespace-pre-line text-body text-ink-800">{a.extra}</p>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Documents" description="PDF vérifiés à la réception, stockés de façon privée." />
            {documents.length ? (
              <ul className="divide-y divide-line">
                {documents.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 px-5 py-3">
                    <FileText className="size-5 shrink-0 text-accent-700" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-body text-ink-800">{d.file_name}</span>
                    <span className="text-caption text-ink-500">{kb(d.file_size)}</span>
                    {a.status !== "spam" ? (
                      <a href={`/api/partenariats/documents/${d.id}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
                        Télécharger
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <CardBody>
                <p className="text-body text-ink-600">Aucun document joint.</p>
              </CardBody>
            )}
          </Card>

          <Card>
            <CardHeader title="Notes internes" />
            <CardBody className="space-y-5">
              <NoteForm applicationId={a.id} />
              <NotesList notes={notes} />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Suite à donner" />
            <CardBody className="space-y-5">
              {a.organization_id ? (
                <Link href={`/admin/partenariats/organisations/${a.organization_id}`} className={buttonClasses({ variant: "accent", className: "w-full" })}>
                  <Building2 aria-hidden /> Ouvrir la fiche organisation
                </Link>
              ) : canConvert ? (
                <div>
                  <ActionButton
                    variant="accent"
                    size="md"
                    action={createPartnerFromApplication.bind(null, a.id)}
                    confirm={{
                      title: "Créer la fiche organisation ?",
                      description: "La fiche reprend l’organisation, le contact principal et le domaine. Elle entre dans le suivi à l’étape « Proposition reçue ».",
                      confirmLabel: "Créer la fiche",
                    }}
                  >
                    <Building2 aria-hidden /> Créer la fiche organisation
                  </ActionButton>
                  <p className="mt-2 text-caption text-ink-500">À faire quand la proposition mérite un suivi.</p>
                </div>
              ) : null}
              <ApplicationStatusForm id={a.id} status={a.status} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Historique" />
            <CardBody>
              <HistoryList history={history} labels={Object.fromEntries(Object.entries(APPLICATION_STATUS).map(([k, v]) => [k, v.label]))} />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
