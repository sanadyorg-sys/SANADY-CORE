import type { Metadata } from "next";
import { DeliverableForm } from "@/components/partnerships/portal-forms";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/surface";
import { formatDateTime } from "@/lib/format";
import { requirePartnerMember } from "@/server/auth";
import { portalOverview } from "@/server/queries/portal";

export const metadata: Metadata = { title: "Livrables — Espace partenaire" };

const STATUS = {
  submitted: { label: "Transmis", tone: "brand" },
  accepted: { label: "Accepté", tone: "success" },
  returned: { label: "À compléter", tone: "warning" },
} as const;

export default async function PartnerDeliverables() {
  await requirePartnerMember();
  const v = await portalOverview();
  const agreements = (v?.agreements ?? []).filter((a) => a.status !== "completed").map((a) => ({ id: a.id, label: `${a.reference} — ${a.title}` }));
  const items = v?.deliverables ?? [];
  return (
    <>
      <PageHeader title="Livrables" description="Transmettez à la Fondation les documents prévus par votre convention (PDF)." />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
        <Card className="self-start">
          <CardHeader title="Nouveau livrable" />
          <CardBody>
            <DeliverableForm agreements={agreements} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Livrables transmis" />
          {items.length ? (
            <ul className="divide-y divide-line">
              {items.map((d) => (
                <li key={d.id} className="px-5 py-3">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-ink-900">
                    {d.title} <Badge tone={STATUS[d.status].tone}>{STATUS[d.status].label}</Badge>
                  </p>
                  <p className="text-caption text-ink-500">
                    {formatDateTime(d.created_at)}
                    {d.agreement ? ` · ${d.agreement}` : ""} · {d.files.join(", ")}
                  </p>
                  {d.review_comment ? <p className="mt-1 text-label text-ink-700">Commentaire de la Fondation : {d.review_comment}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <CardBody>
              <p className="text-body text-ink-600">Aucun livrable transmis.</p>
            </CardBody>
          )}
        </Card>
      </div>
    </>
  );
}
