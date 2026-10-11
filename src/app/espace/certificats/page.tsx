import type { Metadata } from "next";
import { Award, CheckCircle2, Download, ExternalLink, Sparkles } from "lucide-react";
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
        title="Mes certificats et attestations"
        description="Chaque certificat atteste votre réussite et comporte un code QR cryptographique et un identifiant unique vérifiables par les académies et établissements."
      />
      {certificates.length === 0 ? (
        <Card>
          <EmptyState
            icon={Award}
            title="Aucun certificat pour le moment"
            description="Un certificat est délivré automatiquement dès que toutes les leçons obligatoires d’une formation sont achevées et que l'ensemble des quiz sont validés avec succès (score minimal de 70 %)."
          />
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {certificates.map((c) => {
            const verifyUrl = `${publicEnv.appUrl}/verifier/${c.verification_code}`;
            const completionDate = c.completed_at ? new Date(c.completed_at) : new Date();
            const linkedInUrl = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(
              c.course_title,
            )}&organizationName=${encodeURIComponent("Fondation Sanady")}&issueYear=${completionDate.getFullYear()}&issueMonth=${
              completionDate.getMonth() + 1
            }&certUrl=${encodeURIComponent(verifyUrl)}&certId=${encodeURIComponent(c.certificate_number)}`;

            return (
              <li key={c.id}>
                <Card className="flex h-full flex-col overflow-hidden border border-line shadow-sm hover:shadow-md transition-shadow duration-200">
                  {/* Decorative Diploma Accent Header */}
                  <div className="h-2 w-full bg-gradient-to-r from-accent-500 via-amber-500 to-accent-600" />

                  <div className="flex flex-1 flex-col p-5 sm:p-6">
                    <div className="flex items-start gap-4">
                      <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-700 ring-1 ring-accent-200 shadow-sm">
                        <Award className="size-6" aria-hidden />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex flex-wrap items-center gap-2">
                          {c.revoked_at ? (
                            <Badge tone="danger">Révoqué</Badge>
                          ) : (
                            <Badge tone="success" dot>
                              Authentique
                            </Badge>
                          )}
                          <span className="font-mono text-caption text-ink-500 font-medium">
                            {c.certificate_number}
                          </span>
                        </div>

                        <h2 className="text-base sm:text-lg font-bold text-ink-900 leading-snug">
                          {c.course_title}
                        </h2>

                        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-label text-ink-600">
                          <span>Achevée le <strong className="font-semibold text-ink-800">{formatDate(c.completed_at)}</strong></span>
                          <span aria-hidden className="text-line-strong">•</span>
                          <span>Durée <strong className="font-semibold text-ink-800">{formatDuration(c.course_duration_minutes)}</strong></span>
                          <span aria-hidden className="text-line-strong">•</span>
                          <span className="inline-flex items-center gap-1 text-success-700 font-medium text-xs">
                            <CheckCircle2 className="size-3.5" aria-hidden /> Score ≥ 70 %
                          </span>
                        </div>
                      </div>
                    </div>

                    {c.revoked_at ? (
                      <p className="mt-4 rounded-lg bg-danger-50 p-3 text-label text-danger-800">
                        Révoqué le {formatDate(c.revoked_at)}
                        {c.revoke_reason ? ` — ${c.revoke_reason}` : ""}.
                      </p>
                    ) : (
                      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line/70 pt-4">
                        <a
                          href={`/api/certificats/${c.id}`}
                          className={buttonClasses({ size: "sm", variant: "primary", className: "gap-1.5 shadow-sm" })}
                        >
                          <Download className="size-4" aria-hidden /> Télécharger (PDF)
                        </a>

                        <a
                          href={linkedInUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={buttonClasses({
                            size: "sm",
                            variant: "secondary",
                            className: "gap-1.5 text-[#0A66C2] hover:text-[#084e96]",
                          })}
                        >
                          <Sparkles className="size-3.5" aria-hidden /> Partager sur LinkedIn
                        </a>

                        <CopyButton value={verifyUrl} label="Copier le lien" copiedLabel="Lien copié !" />

                        <a
                          href={verifyUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={buttonClasses({ variant: "ghost", size: "sm", className: "gap-1.5" })}
                        >
                          <ExternalLink className="size-3.5" aria-hidden /> Page publique
                        </a>
                      </div>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
