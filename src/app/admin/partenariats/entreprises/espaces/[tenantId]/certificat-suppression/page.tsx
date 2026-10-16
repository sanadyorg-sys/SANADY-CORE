import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PrintButton } from "@/components/common/print-button";
import { BrandLogo } from "@/components/brand/brand-logo";
import { formatDate, formatDateTime } from "@/lib/format";
import { uuidSchema } from "@/lib/validation";
import { requireEnterpriseStaff } from "@/server/auth";
import { getTenant, tenantDeletion } from "@/server/queries/enterprise";

export const metadata: Metadata = { title: "Certificat de suppression" };

/** Printable deletion certificate, to hand to the organisation (no personal data). */
export default async function DeletionCertificatePage(props: PageProps<"/admin/partenariats/entreprises/espaces/[tenantId]/certificat-suppression">) {
  await requireEnterpriseStaff();
  const { tenantId } = await props.params;
  if (!uuidSchema.safeParse(tenantId).success) notFound();
  const [detail, del] = await Promise.all([getTenant(tenantId), tenantDeletion(tenantId)]);
  const c = del.deletion?.status === "executed" ? del.deletion.certificate : null;
  if (!detail || !c) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/admin/partenariats/entreprises/espaces/${tenantId}#suppression`} className="inline-flex items-center gap-1.5 text-label text-ink-600 hover:text-ink-900">
          <ArrowLeft className="size-4" aria-hidden /> Espace de formation
        </Link>
        <PrintButton />
      </div>
      <article className="rounded-2xl border border-line bg-white p-8 text-ink-900 print:border-0 print:p-0">
        <BrandLogo className="h-10" />
        <h1 className="mt-6 text-title font-semibold">Certificat de suppression de données</h1>
        <p className="mt-2 text-body text-ink-700">
          La Fondation Sanady certifie avoir supprimé, le <strong>{formatDateTime(c.executed_at)}</strong>, les données de l’espace de formation « {c.space} » de l’organisation <strong>{c.organisation}</strong>, sur la plateforme SANADY.
        </p>
        <h2 className="mt-6 text-section font-semibold">Données supprimées</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-body text-ink-800">
          <li>Comptes utilisés uniquement pour cet espace, avec leurs progressions, résultats et attestations : {c.deleted.accounts}</li>
          <li>Rattachements de personnes ayant aussi un autre espace (leur compte est conservé) : {c.deleted.memberships}</li>
          <li>Formations propres à l’organisation, avec leurs contenus : {c.deleted.courses}</li>
          <li>Fichiers (vidéos, documents, logo) : {c.deleted.files}</li>
          <li>Demandes d’assistance : {c.deleted.support_requests}</li>
        </ul>
        <h2 className="mt-6 text-section font-semibold">Données conservées</h2>
        <p className="mt-2 text-body text-ink-800">{c.kept}</p>
        <h2 className="mt-6 text-section font-semibold">Déroulement</h2>
        <ul className="mt-2 space-y-1 text-body text-ink-800">
          <li>Suppression proposée le {formatDate(c.proposed_at)}{c.proposed_by ? ` par ${c.proposed_by}` : ""}.</li>
          <li>Avis écrit adressé à l’organisation le {formatDate(c.notice_sent_on)}.</li>
          <li>
            Données remises à l’organisation le {formatDate(c.data_delivered_on)} : {c.delivery_method}.
          </li>
          <li>Suppression confirmée le {formatDate(c.confirmed_at)}{c.confirmed_by ? ` par ${c.confirmed_by}` : ""}, puis réalisée après un délai de 30 jours.</li>
        </ul>
        <p className="mt-8 text-caption text-ink-500">Document établi à partir du registre de la plateforme SANADY. Il ne contient aucune donnée personnelle des collaborateurs.</p>
      </article>
    </div>
  );
}
