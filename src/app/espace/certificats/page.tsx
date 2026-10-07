import type { Metadata } from "next";
import { Award, Download, ExternalLink } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { EmptyState } from "@/components/ui/feedback";
import { Badge, Card, PageHeader } from "@/components/ui/surface";
import { publicEnv } from "@/lib/env";
import { formatDate, formatDuration } from "@/lib/format";
import { requireViewer } from "@/server/auth";
import { getCertificates } from "@/server/queries/learning";

export const metadata: Metadata = { title: "Mes certificats" };

export default async function CertificatesPage() {
  const viewer = await requireViewer();
  const certificates = await getCertificates(viewer.id);

  return (
    <>
      <PageHeader
        title="Mes certificats"
        description="Chaque certificat comporte un numéro unique et un code QR permettant à toute personne d’en vérifier l’authenticité."
      />
      {certificates.length === 0 ? (
        <Card>
          <EmptyState
            icon={Award}
            title="Aucun certificat pour le moment"
            description="Un certificat est délivré automatiquement lorsque toutes les leçons obligatoires d’une formation sont terminées et que toutes ses évaluations sont réussies."
          />
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {certificates.map((c) => {
            const verifyUrl = `${publicEnv.appUrl}/verifier/${c.verification_code}`;
            return (
              <li key={c.id}>
                <Card className="flex h-full flex-col p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700 ring-1 ring-teal-100">
                      <Award className="size-5" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        {c.revoked_at ? <Badge tone="danger">Révoqué</Badge> : <Badge tone="success" dot>Valide</Badge>}
                        <span className="font-mono text-caption text-ink-500">{c.certificate_number}</span>
                      </div>
                      <h2 className="text-card font-semibold text-ink-900">{c.course_title}</h2>
                      <p className="mt-1 text-label text-ink-500">
                        Achevée le {formatDate(c.completed_at)} · Durée indicative {formatDuration(c.course_duration_minutes)}
                      </p>
                    </div>
                  </div>
                  {c.revoked_at ? (
                    <p className="mt-4 text-label text-danger-700">
                      Révoqué le {formatDate(c.revoked_at)}
                      {c.revoke_reason ? ` — ${c.revoke_reason}` : ""}.
                    </p>
                  ) : (
                    <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
                      <a href={`/api/certificats/${c.id}`} className={buttonClasses({ size: "sm" })}>
                        <Download aria-hidden /> Télécharger (PDF)
                      </a>
                      <CopyButton value={verifyUrl} label="Copier le lien de vérification" copiedLabel="Lien copié" />
                      <a href={verifyUrl} target="_blank" rel="noreferrer" className={buttonClasses({ variant: "ghost", size: "sm" })}>
                        <ExternalLink aria-hidden /> Page de vérification
                      </a>
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
