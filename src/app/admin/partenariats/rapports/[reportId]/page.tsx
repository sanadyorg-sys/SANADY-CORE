import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Pencil } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { ReportForm } from "@/components/partnerships/impact-forms";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/overlay";
import { Alert, Badge, Card, CardBody, CardHeader, DescriptionList, PageHeader } from "@/components/ui/surface";
import { displayName, formatDate, formatDateTime } from "@/lib/format";
import { REPORT_STATUS, dimensionLabel } from "@/lib/partnerships";
import { uuidSchema } from "@/lib/validation";
import { setReportStatus } from "@/server/actions/impact";
import { requirePartnershipStaff } from "@/server/auth";
import { linkOptions } from "@/server/queries/agreements";
import { getReport, partnerReportData } from "@/server/queries/impact";
import { pipelineActor } from "@/server/queries/partnerships";

export const metadata: Metadata = { title: "Rapport au partenaire" };

export default async function ReportPage(props: PageProps<"/admin/partenariats/rapports/[reportId]">) {
  const viewer = await requirePartnershipStaff();
  const { reportId } = await props.params;
  if (!uuidSchema.safeParse(reportId).success) notFound();
  const [r, data, actor] = await Promise.all([getReport(reportId), partnerReportData(reportId), pipelineActor(viewer)]);
  if (!r || !data) notFound();
  const links = await linkOptions(r.organization_id);
  const received = data.contributions.filter((c) => c.stage === "delivered" || c.stage === "verified").length;

  return (
    <>
      <Link href="/admin/partenariats/rapports" className="mb-3 inline-flex items-center gap-1.5 text-label text-ink-600 hover:text-ink-900">
        <ArrowLeft className="size-4" aria-hidden /> Rapports aux partenaires
      </Link>
      <PageHeader
        title={r.title}
        description={`${r.reference} · ${r.organization?.name ?? ""} · du ${formatDate(r.period_start)} au ${formatDate(r.period_end)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={REPORT_STATUS[r.status].tone}>{REPORT_STATUS[r.status].label}</Badge>
            <a
              href={`/api/partenariats/rapports/${r.id}`}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-line-strong bg-surface px-3.5 text-body text-ink-800 hover:bg-ink-50"
            >
              <Download className="size-4" aria-hidden /> {r.status === "draft" ? "Aperçu PDF (brouillon)" : "Télécharger le PDF"}
            </a>
            {r.status === "draft" && actor.staff ? (
              <Drawer
                title="Modifier le rapport"
                width="max-w-2xl"
                trigger={
                  <Button variant="secondary">
                    <Pencil aria-hidden /> Modifier
                  </Button>
                }
              >
                <div className="p-5">
                  <ReportForm organizationId={r.organization_id} report={r} agreements={links.agreements} />
                </div>
              </Drawer>
            ) : null}
          </div>
        }
      />
      {r.status === "draft" ? (
        <Alert tone="info" className="mb-6">
          Brouillon : relisez le contenu ci-dessous (données vérifiées uniquement). Un approbateur approuve le rapport avant sa transmission au partenaire.
        </Alert>
      ) : r.status === "approved" ? (
        <Alert tone="success" className="mb-6">
          Approuvé{r.approver ? ` par ${displayName(r.approver)}` : ""} le {r.approved_at ? formatDateTime(r.approved_at) : "—"}. Transmettez le PDF au partenaire puis enregistrez la transmission.
        </Alert>
      ) : (
        <Alert tone="success" className="mb-6">
          Transmis au partenaire le {r.shared_at ? formatDateTime(r.shared_at) : "—"}.
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader title="Contenu du rapport" description="Exactement ce que reprend le PDF." />
          <CardBody>
            <DescriptionList
              items={[
                { term: "Conventions", value: data.agreements.length ? data.agreements.map((a) => `${a.reference} — ${a.title}`).join(" ; ") : "Aucune convention signée" },
                { term: "Projets soutenus", value: data.projects.length ? data.projects.map((p) => p.title).join(" ; ") : "—" },
                { term: "Contributions", value: `${data.contributions.length} convenue(s), ${received} reçue(s)` },
                { term: "Activités réalisées", value: `${data.milestones.length} étape(s) achevée(s) sur la période` },
                {
                  term: "Indicateurs vérifiés",
                  value: data.metrics.length
                    ? data.metrics.map((m) => `${dimensionLabel(m.dimension, m.label)} : ${m.value}${m.unit ? ` ${m.unit}` : ""} (${m.type === "output" ? "réalisation" : "résultat"})`).join(" ; ")
                    : "Aucun indicateur vérifié sur la période",
                },
                { term: "Difficultés et limites", value: r.challenges ?? "Non renseigné" },
                { term: "Perspectives", value: r.future_opportunities ?? "Non renseigné" },
              ]}
            />
          </CardBody>
        </Card>
        <Card className="self-start">
          <CardHeader title="Statut" />
          <CardBody className="space-y-3">
            {r.status === "draft" && actor.signatory ? (
              <ActionButton
                variant="accent"
                size="md"
                action={setReportStatus.bind(null, r.id, "approved")}
                confirm={{ title: "Approuver ce rapport ?", description: "Son contenu sera figé ; il pourra être transmis au partenaire.", confirmLabel: "Approuver" }}
              >
                Approuver le rapport
              </ActionButton>
            ) : null}
            {r.status === "approved" && actor.staff ? (
              <>
                <ActionButton
                  variant="accent"
                  size="md"
                  action={setReportStatus.bind(null, r.id, "shared")}
                  confirm={{ title: "Enregistrer la transmission ?", description: "Indique que le PDF a été envoyé au partenaire (date enregistrée).", confirmLabel: "Enregistrer" }}
                >
                  Transmis au partenaire
                </ActionButton>
                <ActionButton action={setReportStatus.bind(null, r.id, "draft")}>Renvoyer en brouillon</ActionButton>
              </>
            ) : null}
            {r.status === "draft" && !actor.signatory ? <p className="text-label text-ink-600">L’approbation revient à un approbateur habilité.</p> : null}
            {r.status === "shared" ? <p className="text-label text-ink-600">Rapport transmis : il reste disponible ici.</p> : null}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
