import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, FileText } from "lucide-react";
import { CreateClientForm, EnterpriseNoteForm, EnterpriseStatusForm } from "@/components/enterprise/admin-forms";
import { HistoryList, NotesList } from "@/components/partnerships/timeline";
import { buttonClasses } from "@/components/ui/button";
import { Alert, Badge, Card, CardBody, CardHeader, DescriptionList, PageHeader } from "@/components/ui/surface";
import { formatDateTime } from "@/lib/format";
import { EMPLOYEE_COUNTS, ENTERPRISE_SERVICES, EXISTING_CONTENT, LANGUAGES, REQUEST_STATUS } from "@/lib/enterprise";
import { ORG_TYPES } from "@/lib/partnerships";
import { uuidSchema } from "@/lib/validation";
import { requireEnterpriseStaff } from "@/server/auth";
import { enterpriseActor, getRequest, linkableOrganizations } from "@/server/queries/enterprise";

export const metadata: Metadata = { title: "Demande entreprise" };

const ACTIONS: Record<string, Array<{ value: string; label: string }>> = {
  received: [
    { value: "qualified", label: "Qualifier la demande" },
    { value: "declined", label: "Ne pas retenir" },
    { value: "withdrawn", label: "Retirée par l’organisation" },
    { value: "spam", label: "Indésirable (spam)" },
  ],
  qualified: [
    { value: "declined", label: "Ne pas retenir" },
    { value: "withdrawn", label: "Retirée par l’organisation" },
  ],
  declined: [{ value: "received", label: "Rouvrir" }],
  withdrawn: [{ value: "received", label: "Rouvrir" }],
};

export default async function EnterpriseRequestPage(props: PageProps<"/admin/partenariats/entreprises/demandes/[requestId]">) {
  const viewer = await requireEnterpriseStaff();
  const { requestId } = await props.params;
  if (!uuidSchema.safeParse(requestId).success) notFound();
  const [detail, actor] = await Promise.all([getRequest(requestId), enterpriseActor(viewer)]);
  if (!detail) notFound();
  const { request: r, documents, notes, history } = detail;
  const open = r.status === "received" || r.status === "qualified";
  const candidates = open && actor.manager ? await linkableOrganizations(r.org_name) : [];
  const labels = Object.fromEntries(Object.entries(REQUEST_STATUS).map(([k, v]) => [k, v.label]));

  return (
    <>
      <Link href="/admin/partenariats/entreprises" className="mb-3 inline-flex items-center gap-1.5 text-label text-ink-600 hover:text-ink-900">
        <ArrowLeft className="size-4" aria-hidden /> Demandes entreprises
      </Link>
      <PageHeader title={r.org_name} description={`${r.reference} · reçue le ${formatDateTime(r.created_at)}`} actions={<Badge tone={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</Badge>} />
      {r.status === "spam" ? (
        <Alert tone="warning" className="mb-6">
          Demande indésirable : ses documents ne peuvent pas être ouverts.
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Besoin de formation" description={ENTERPRISE_SERVICES[r.service].label} />
            <CardBody className="space-y-4">
              <DescriptionList
                items={[
                  { term: "Thème", value: r.topic },
                  { term: "Public", value: r.target_population },
                  { term: "Apprenants estimés", value: r.learner_count ?? "—" },
                  { term: "Contenus existants", value: EXISTING_CONTENT[r.existing_content as keyof typeof EXISTING_CONTENT] },
                  { term: "Langue", value: LANGUAGES[r.language as keyof typeof LANGUAGES] },
                  { term: "Calendrier", value: r.timeline ?? "—" },
                ]}
              />
              {[
                ["Résultats attendus", r.outcomes],
                ["Suivi et rapports", r.reporting],
                ["Accessibilité", r.accessibility],
                ["Informations complémentaires", r.extra],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k}>
                    <h3 className="text-label font-semibold text-ink-600">{k}</h3>
                    <p className="mt-1 whitespace-pre-line text-body text-ink-800">{v}</p>
                  </div>
                ))}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Organisation et contact" />
            <CardBody>
              <DescriptionList
                items={[
                  { term: "Type", value: ORG_TYPES[r.org_type] },
                  { term: "Effectif", value: `${EMPLOYEE_COUNTS[r.employee_count as keyof typeof EMPLOYEE_COUNTS]} salariés` },
                  { term: "Pays / ville", value: [r.country, r.city].filter(Boolean).join(", ") },
                  { term: "Secteur", value: r.sector ?? "—" },
                  { term: "Contact", value: `${r.contact_name} — ${r.contact_title}` },
                  {
                    term: "E-mail",
                    value: (
                      <a href={`mailto:${r.contact_email}`} className="text-accent-700 hover:underline">
                        {r.contact_email}
                      </a>
                    ),
                  },
                  { term: "Téléphone", value: r.contact_phone ?? "—" },
                  { term: "Consentement", value: formatDateTime(r.consent_at) },
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Documents" />
            {documents.length ? (
              <ul className="divide-y divide-line">
                {documents.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 px-5 py-3">
                    <FileText className="size-5 shrink-0 text-accent-700" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-body text-ink-800">{d.file_name}</span>
                    {r.status !== "spam" ? (
                      <a href={`/api/entreprises/documents/${d.id}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
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
              {actor.manager ? <EnterpriseNoteForm requestId={r.id} /> : null}
              <NotesList notes={notes} />
            </CardBody>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Suite à donner" />
            <CardBody className="space-y-5">
              {r.organization_id ? (
                <Link href={`/admin/partenariats/entreprises/clients/${r.organization_id}`} className={buttonClasses({ variant: "accent", className: "w-full" })}>
                  <Building2 aria-hidden /> Ouvrir la fiche client
                </Link>
              ) : open && actor.manager ? (
                <CreateClientForm requestId={r.id} candidates={candidates.map((c) => ({ id: c.id, name: c.name, partner: c.is_partner }))} />
              ) : null}
              {actor.manager ? <EnterpriseStatusForm kind="request" id={r.id} options={ACTIONS[r.status] ?? []} /> : <p className="text-caption text-ink-500">Lecture seule pour votre rôle.</p>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Historique" />
            <CardBody>
              <HistoryList history={history} labels={labels} />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
