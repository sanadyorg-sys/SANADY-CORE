import type { Metadata } from "next";
import { Download, FileText } from "lucide-react";
import { EmptyState } from "@/components/ui/feedback";
import { Card, PageHeader } from "@/components/ui/surface";
import { formatDate } from "@/lib/format";
import { requirePartnerMember } from "@/server/auth";
import { portalOverview } from "@/server/queries/portal";

export const metadata: Metadata = { title: "Rapports — Espace partenaire" };

export default async function PartnerReports() {
  await requirePartnerMember();
  const v = await portalOverview();
  const reports = v?.reports ?? [];
  return (
    <>
      <PageHeader title="Rapports" description="Rapports d’impact transmis par la Fondation : données vérifiées, chiffres agrégés." />
      {reports.length === 0 ? (
        <Card>
          <EmptyState icon={FileText} title="Aucun rapport pour le moment" description="Les rapports approuvés et transmis par la Fondation apparaîtront ici." />
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {reports.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="font-medium text-ink-900">{r.title}</p>
                  <p className="text-caption text-ink-500">
                    {r.reference} · du {formatDate(r.period_start)} au {formatDate(r.period_end)} · transmis le {formatDate(r.shared_at)}
                  </p>
                </div>
                <a
                  href={`/api/espace-partenaire/rapports/${r.id}`}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-line-strong bg-surface px-3.5 text-body text-ink-800 hover:bg-ink-50"
                >
                  <Download className="size-4" aria-hidden /> Télécharger (PDF)
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
