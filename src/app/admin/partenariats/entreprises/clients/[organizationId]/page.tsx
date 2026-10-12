import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, Handshake, Mail, Pencil, Phone, Plus, Star } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { TenantForm } from "@/components/enterprise/tenant-forms";
import { ClientForm, EnterpriseContactForm, EnterpriseNoteForm, EnterpriseStatusForm, EnterpriseTaskForm, ProposalForm } from "@/components/enterprise/admin-forms";
import { HistoryList, NotesList } from "@/components/partnerships/timeline";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/overlay";
import { Badge, Card, CardBody, CardHeader, DescriptionList, PageHeader } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { displayName, formatDate, formatDateTime } from "@/lib/format";
import {
  EMPLOYEE_COUNTS,
  ENTERPRISE_ORDER,
  ENTERPRISE_PIPELINE,
  ENTERPRISE_SERVICES,
  PROPOSAL_STATUS,
  REQUEST_STATUS,
  enterpriseNextSteps,
  enterpriseStageTone,
  SERVICE_PLANS,
  TENANT_STATUS,
  lineTotal,
} from "@/lib/enterprise";
import { ORG_TYPES, formatAmount } from "@/lib/partnerships";
import { uuidSchema } from "@/lib/validation";
import { setEnterpriseTaskDone } from "@/server/actions/enterprise";
import { requireEnterpriseStaff } from "@/server/auth";
import { enterpriseActor, enterpriseTeam, getClient, tenantForOrganization } from "@/server/queries/enterprise";

export const metadata: Metadata = { title: "Client — Enterprise" };
const MAIN = ENTERPRISE_ORDER.slice(0, 11);

export default async function ClientPage(props: PageProps<"/admin/partenariats/entreprises/clients/[organizationId]">) {
  const viewer = await requireEnterpriseStaff();
  const { organizationId } = await props.params;
  if (!uuidSchema.safeParse(organizationId).success) notFound();
  const [detail, actor, team, tenant] = await Promise.all([getClient(organizationId), enterpriseActor(viewer), enterpriseTeam(), tenantForOrganization(organizationId)]);
  if (!detail) notFound();
  const { client: c, contacts, notes, history, tasks, requests, proposals } = detail;
  const stageIndex = MAIN.indexOf(c.enterprise_status);
  const today = new Date().toISOString().slice(0, 10);
  const others = team.filter((m) => m.id !== viewer.id);
  const labels: Record<string, string> = { ...ENTERPRISE_PIPELINE };

  return (
    <>
      <Link href="/admin/partenariats/entreprises/clients" className="mb-3 inline-flex items-center gap-1.5 text-label text-ink-600 hover:text-ink-900">
        <ArrowLeft className="size-4" aria-hidden /> Clients et prospects
      </Link>
      <PageHeader
        title={c.name}
        description={[ORG_TYPES[c.org_type], c.country, c.city].filter(Boolean).join(" · ")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={enterpriseStageTone(c.enterprise_status)}>{ENTERPRISE_PIPELINE[c.enterprise_status]}</Badge>
            {actor.manager ? (
              <Drawer
                title="Modifier le suivi client"
                width="max-w-xl"
                trigger={
                  <Button variant="secondary">
                    <Pencil aria-hidden /> Modifier
                  </Button>
                }
              >
                <div className="p-5">
                  <ClientForm client={c} team={others} />
                </div>
              </Drawer>
            ) : null}
          </div>
        }
      />

      {c.status ? (
        <p className="mb-4 inline-flex items-center gap-2 rounded-xl border border-line bg-ink-25 px-3 py-2 text-label text-ink-700">
          <Handshake className="size-4 text-accent-700" aria-hidden /> Cette organisation est aussi suivie comme partenaire de la Fondation : les deux relations, leurs accords et leurs montants restent distincts.
        </p>
      ) : null}

      <Card className="mb-6 overflow-x-auto p-4">
        <ol className="flex min-w-max items-center gap-1" aria-label="Étapes du client">
          {MAIN.map((s, i) => (
            <li key={s} className="flex items-center gap-1">
              <span
                className={cn("rounded-lg px-2.5 py-1 text-caption", i === stageIndex ? "bg-accent-700 font-semibold text-white" : i < stageIndex ? "bg-accent-50 text-accent-900" : "text-ink-500")}
                aria-current={i === stageIndex ? "step" : undefined}
              >
                {ENTERPRISE_PIPELINE[s]}
              </span>
              {i < MAIN.length - 1 ? <span aria-hidden className="h-px w-3 bg-line-strong" /> : null}
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader
              title="Propositions commerciales"
              actions={
                actor.manager ? (
                  <Drawer
                    title="Nouvelle proposition"
                    description="Créée en brouillon. Les lignes et prix sont ajoutés ensuite, puis la proposition est approuvée avant envoi."
                    width="max-w-xl"
                    trigger={
                      <Button size="sm" variant="secondary">
                        <Plus aria-hidden /> Nouvelle proposition
                      </Button>
                    }
                  >
                    <div className="p-5">
                      <ProposalForm organizationId={c.id} />
                    </div>
                  </Drawer>
                ) : null
              }
            />
            {proposals.length ? (
              <ul className="divide-y divide-line">
                {proposals.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <Link href={`/admin/partenariats/entreprises/propositions/${p.id}`} className="font-medium text-ink-900 hover:text-accent-700 hover:underline">
                        {p.title}
                      </Link>
                      <span className="block text-caption text-ink-500">
                        {p.reference} · {ENTERPRISE_SERVICES[p.service].short}
                      </span>
                    </div>
                    <span className="flex items-center gap-3">
                      <span className="tabular text-label font-semibold text-ink-800">{formatAmount(p.lines.reduce((t, l) => t + lineTotal(l), 0), p.currency)}</span>
                      <Badge tone={PROPOSAL_STATUS[p.status].tone}>{PROPOSAL_STATUS[p.status].label}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <CardBody>
                <p className="text-body text-ink-600">Aucune proposition.</p>
              </CardBody>
            )}
          </Card>

          <Card>
            <CardHeader title="Profil" />
            <CardBody>
              <DescriptionList
                items={[
                  { term: "Effectif", value: c.employee_count ? `${EMPLOYEE_COUNTS[c.employee_count as keyof typeof EMPLOYEE_COUNTS]} salariés` : "—" },
                  { term: "Services envisagés", value: c.enterprise_services.map((s) => ENTERPRISE_SERVICES[s].label).join(", ") || "—" },
                  { term: "Secteur", value: c.sector ?? "—" },
                  { term: "Responsable du compte", value: c.manager ? displayName(c.manager) : "—" },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Contacts" description="Partagés avec la fiche partenaire, le cas échéant." />
            {contacts.length ? (
              <ul className="divide-y divide-line">
                {contacts.map((ct) => (
                  <li key={ct.id} className="px-5 py-3">
                    <p className="font-medium text-ink-900">
                      {ct.full_name}{" "}
                      {ct.is_primary ? (
                        <Badge tone="accent">
                          <Star className="size-3" aria-hidden /> Principal
                        </Badge>
                      ) : null}
                    </p>
                    {ct.job_title ? <p className="text-caption text-ink-500">{ct.job_title}</p> : null}
                    <p className="mt-1 flex flex-wrap gap-x-4 text-label text-ink-700">
                      {ct.email ? (
                        <a href={`mailto:${ct.email}`} className="inline-flex items-center gap-1 hover:text-accent-700 hover:underline">
                          <Mail className="size-3.5" aria-hidden /> {ct.email}
                        </a>
                      ) : null}
                      {ct.phone ? (
                        <a href={`tel:${ct.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 hover:text-accent-700 hover:underline">
                          <Phone className="size-3.5" aria-hidden /> {ct.phone}
                        </a>
                      ) : null}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
            {actor.manager ? (
              <CardBody className={contacts.length ? "border-t border-line" : undefined}>
                <EnterpriseContactForm organizationId={c.id} />
              </CardBody>
            ) : null}
          </Card>

          <Card>
            <CardHeader title="Notes et réunions" description="Visibles par l’équipe Enterprise uniquement." />
            <CardBody className="space-y-5">
              {actor.manager ? <EnterpriseNoteForm organizationId={c.id} /> : null}
              <NotesList notes={notes} />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Étape du client" />
            <CardBody>
              <EnterpriseStatusForm
                kind="client"
                id={c.id}
                options={enterpriseNextSteps(c.enterprise_status, actor).map((s) => ({ value: s, label: ENTERPRISE_PIPELINE[s] }))}
                submitLabel="Changer d’étape"
                help={!actor.signatory ? "« Contrat signé » est réservé aux approbateurs habilités, après la validation institutionnelle." : undefined}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Espace de formation" description="Espace sécurisé des collaborateurs du client (formule plateforme ou complète)." />
            <CardBody className="space-y-3">
              {tenant && !["closed", "cancelled"].includes(tenant.status) ? (
                <>
                  <p className="flex flex-wrap items-center gap-2 text-body text-ink-800">
                    <Badge tone={TENANT_STATUS[tenant.status].tone}>{TENANT_STATUS[tenant.status].label}</Badge>
                    {SERVICE_PLANS[tenant.service_plan]} · {tenant.max_learners} collaborateurs
                  </p>
                  <Link href={`/admin/partenariats/entreprises/espaces/${tenant.id}`} className="text-label font-medium text-accent-700 hover:underline">
                    Ouvrir l’espace /entreprise/{tenant.slug}
                  </Link>
                </>
              ) : ["contract_signed", "onboarding", "active_service", "renewal"].includes(c.enterprise_status) ? (
                actor.manager ? (
                  <Drawer
                    title="Préparer l’espace de formation"
                    description="La création sera ensuite autorisée par un approbateur habilité."
                    width="max-w-2xl"
                    trigger={<Button variant="accent">Préparer l’espace de formation</Button>}
                  >
                    <div className="p-5">
                      <TenantForm
                        organizationId={c.id}
                        organizationName={c.name}
                        contacts={contacts.map((x) => ({ id: x.id, label: x.email ? `${x.full_name} — ${x.email}` : x.full_name }))}
                        proposals={proposals.filter((p) => p.status === "accepted").map((p) => ({ id: p.id, label: `${p.reference} — ${p.title}` }))}
                      />
                    </div>
                  </Drawer>
                ) : (
                  <p className="text-body text-ink-600">Le responsable entreprises peut préparer l’espace.</p>
                )
              ) : (
                <p className="text-body text-ink-600">Disponible après la signature du contrat (étape « Contrat signé »).</p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Tâches de suivi" />
            {tasks.length ? (
              <ul className="divide-y divide-line">
                {tasks.map((t) => {
                  const late = !t.done_at && t.due_on && t.due_on < today;
                  return (
                    <li key={t.id} className="flex items-start justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className={cn("text-body", t.done_at ? "text-ink-500 line-through" : "font-medium text-ink-900")}>{t.title}</p>
                        <p className="mt-0.5 flex flex-wrap gap-x-2 text-caption text-ink-500">
                          {t.due_on ? (
                            <span className={late ? "inline-flex items-center gap-1 font-semibold text-danger-600" : "inline-flex items-center gap-1"}>
                              <CalendarClock className="size-3.5" aria-hidden /> {late ? "En retard — " : ""}
                              {formatDate(t.due_on)}
                            </span>
                          ) : null}
                          {t.assignee ? <span>{displayName(t.assignee)}</span> : null}
                        </p>
                      </div>
                      {actor.manager ? <ActionButton action={setEnterpriseTaskDone.bind(null, t.id, !t.done_at, c.id)}>{t.done_at ? "Rouvrir" : "Terminer"}</ActionButton> : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {actor.manager ? (
              <CardBody className={tasks.length ? "border-t border-line" : undefined}>
                <EnterpriseTaskForm organizationId={c.id} team={others} />
              </CardBody>
            ) : null}
          </Card>
          {requests.length ? (
            <Card>
              <CardHeader title="Demandes reçues" />
              <ul className="divide-y divide-line">
                {requests.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <Link href={`/admin/partenariats/entreprises/demandes/${r.id}`} className="font-mono text-label text-accent-700 hover:underline">
                      {r.reference}
                    </Link>
                    <span className="text-caption text-ink-500">
                      {REQUEST_STATUS[r.status].label} · {formatDate(r.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
          <Card>
            <CardHeader title="Historique" description={`Fiche créée le ${formatDateTime(c.created_at)}`} />
            <CardBody>
              <HistoryList history={history} labels={labels} />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
