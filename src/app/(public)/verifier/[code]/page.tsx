import type { Metadata } from "next";
import Link from "next/link";
import {
  Award,
  BadgeCheck,
  CheckCircle2,
  CircleX,
  ExternalLink,
  SearchX,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { buttonClasses } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Alert } from "@/components/ui/surface";
import { publicEnv } from "@/lib/env";
import { formatDate, formatDuration } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { VerifiedCertificate } from "@/lib/types";
import { clientIp, rateLimit } from "@/server/rate-limit";

export const metadata: Metadata = {
  title: "Vérification de certificat d'authenticité",
  description: "Vérifiez l’authenticité des attestations et certificats de formation délivrés par la Fondation Sanady.",
  referrer: "no-referrer",
};

export default async function VerifyCertificatePage(props: PageProps<"/verifier/[code]">) {
  const { code: rawCode } = await props.params;
  const code = decodeURIComponent(rawCode).trim().slice(0, 64);

  if (!(await rateLimit(`verify:${await clientIp()}`, 60, 15 * 60))) {
    return (
      <div data-wide-layout="true" className="w-full">
        <Alert tone="warning">Trop de vérifications. Veuillez patienter quelques minutes avant de réessayer.</Alert>
      </div>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase.rpc("verify_certificate", { p_code: code });
  const cert = data as VerifiedCertificate | null;

  const backLink = (
    <Link href="/verifier" className={buttonClasses({ variant: "secondary", className: "w-full sm:w-auto" })}>
      Vérifier un autre certificat
    </Link>
  );

  if (!cert) {
    return (
      <div data-wide-layout="true" className="w-full text-center py-4">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl border border-line bg-ink-25 text-ink-500 shadow-sm">
          <SearchX className="size-7" aria-hidden />
        </div>
        <h1 className="text-2xl font-bold text-ink-900">Certificat introuvable</h1>
        <p className="mx-auto mt-2 max-w-md text-body text-ink-600">
          Aucun certificat SANADY ne correspond à la référence <span className="font-mono font-medium text-ink-900">{code}</span>. Vérifiez la saisie ou scannez à nouveau le code QR du certificat.
        </p>
        <div className="mt-8 flex justify-center">
          {backLink}
        </div>
      </div>
    );
  }

  const valid = cert.status === "valid";
  const verificationUrl = `${publicEnv.appUrl}/verifier/${encodeURIComponent(code)}`;

  const issueDate = cert.issued_at ? new Date(cert.issued_at) : new Date();
  const linkedInCertUrl = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(
    cert.course_title,
  )}&organizationName=${encodeURIComponent(cert.issuer || "Fondation Sanady")}&issueYear=${issueDate.getFullYear()}&issueMonth=${
    issueDate.getMonth() + 1
  }&certUrl=${encodeURIComponent(verificationUrl)}&certId=${encodeURIComponent(cert.certificate_number)}`;

  return (
    <div data-wide-layout="true" className="w-full space-y-6">
      {/* ─── Top Trust Status Banner ─────────────────────────────────── */}
      <div
        className={
          valid
            ? "flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-success-200 bg-gradient-to-r from-success-50/90 to-emerald-50/40 p-4 sm:p-5 text-success-900 shadow-sm"
            : "flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-danger-200 bg-gradient-to-r from-danger-50/90 to-rose-50/40 p-4 sm:p-5 text-danger-900 shadow-sm"
        }
      >
        <div className="flex items-center gap-3.5">
          <div
            className={
              valid
                ? "flex size-11 shrink-0 items-center justify-center rounded-xl bg-success-600 text-white shadow-sm ring-4 ring-success-100"
                : "flex size-11 shrink-0 items-center justify-center rounded-xl bg-danger-600 text-white shadow-sm ring-4 ring-danger-100"
            }
          >
            {valid ? <BadgeCheck className="size-6" aria-hidden /> : <CircleX className="size-6" aria-hidden />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-success-800">
                {valid ? "Authenticité certifiée" : "Document révoqué"}
              </span>
              {valid && (
                <span className="inline-flex items-center gap-1 rounded-full bg-success-100 px-2 py-0.5 text-[11px] font-semibold text-success-800">
                  <ShieldCheck className="size-3" aria-hidden /> Registre officiel
                </span>
              )}
            </div>
            <h1 className="text-lg font-bold text-ink-900 sm:text-xl">
              {valid ? "Certificat authentique et valide" : "Certificat révoqué"}
            </h1>
          </div>
        </div>

        <div className="text-xs text-ink-600 sm:text-right">
          <p className="font-mono font-medium text-ink-800">{cert.certificate_number}</p>
          <p className="text-caption text-ink-500">Délivré par {cert.issuer}</p>
        </div>
      </div>

      {/* ─── Digital Certificate / Diploma Card ─────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-accent-500/30 bg-gradient-to-b from-[#FFFDF9] via-white to-[#FDFBF7] p-6 sm:p-9 shadow-lg ring-1 ring-accent-500/10">
        {/* Subtle decorative diploma borders */}
        <div aria-hidden className="pointer-events-none absolute inset-2.5 rounded-xl border border-line/60" />
        <div aria-hidden className="pointer-events-none absolute inset-3 rounded-lg border border-accent-500/20" />

        {/* Certificate Header */}
        <div className="relative text-center">
          <div className="flex justify-center">
            <BrandLogo variant="orange" className="h-10 sm:h-12" priority />
          </div>
          <p className="mt-2 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-accent-700">
            Fondation Sanady • Développement Professionnel des Enseignants
          </p>

          <div className="mx-auto my-3 flex items-center justify-center gap-3">
            <span className="h-px w-16 bg-gradient-to-r from-transparent to-accent-300" />
            <Sparkles className="size-3.5 text-accent-500" aria-hidden />
            <span className="h-px w-16 bg-gradient-to-l from-transparent to-accent-300" />
          </div>

          <h2 className="text-sm sm:text-base font-bold uppercase tracking-wider text-ink-700">
            Attestation officielle de fin de formation
          </h2>
        </div>

        {/* Recipient Showcase */}
        <div className="relative mt-6 text-center">
          <p className="text-xs italic text-ink-500 sm:text-sm">
            Ce certificat est décerné avec reconnaissance à
          </p>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-ink-950 sm:text-3xl font-serif">
            {cert.recipient_name}
          </p>
          <div className="mx-auto mt-2 h-0.5 w-24 bg-accent-500" />
        </div>

        {/* Course Completion Details */}
        <div className="relative mt-5 text-center">
          <p className="text-xs text-ink-500 sm:text-sm">
            pour avoir validé l’intégralité du parcours certifiant
          </p>
          <p className="mt-1.5 text-base sm:text-lg font-bold text-accent-700">
            « {cert.course_title} »
          </p>
          <p className="mx-auto mt-2 max-w-lg text-[11px] sm:text-xs text-ink-500 leading-relaxed">
            et satisfait avec succès à l’ensemble des évaluations pédagogiques continues avec le niveau de maîtrise requis (score minimal de 70 % par module).
          </p>
        </div>

        {/* Verified Facts Grid */}
        <div className="relative mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-xl border border-line/80 bg-ink-25/50 p-3 sm:p-4 text-center">
          <div className="p-1">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-ink-500">Date d’achèvement</span>
            <span className="mt-0.5 block text-xs sm:text-sm font-semibold text-ink-900">{formatDate(cert.completed_at)}</span>
          </div>
          <div className="border-l border-line/60 p-1">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-ink-500">Durée indicative</span>
            <span className="mt-0.5 block text-xs sm:text-sm font-semibold text-ink-900">{formatDuration(cert.course_duration_minutes)}</span>
          </div>
          <div className="border-t border-line/60 sm:border-t-0 sm:border-l p-1">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-ink-500">Référence unique</span>
            <span className="mt-0.5 block font-mono text-xs sm:text-sm font-semibold text-ink-900 truncate">{cert.certificate_number}</span>
          </div>
          <div className="border-t sm:border-t-0 border-l border-line/60 p-1">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-ink-500">Statut de validation</span>
            <span className="mt-0.5 inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-success-700">
              <CheckCircle2 className="size-3.5" aria-hidden /> Validé (≥ 70 %)
            </span>
          </div>
        </div>

        {/* Bottom Seal & Signatory Row */}
        <div className="relative mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-line/60 pt-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-full bg-accent-50 text-accent-700 ring-2 ring-accent-200">
              <Award className="size-6" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-bold text-ink-900">{cert.issuer || "Fondation Sanady"}</p>
              <p className="text-caption text-ink-500">Organisme émetteur agréé</p>
            </div>
          </div>

          <div className="rounded-lg border border-accent-200/70 bg-accent-50/50 px-3 py-1.5 text-right">
            <p className="text-[11px] font-semibold text-accent-800">Sceau de Sécurité Cryptographique</p>
            <p className="font-mono text-[10px] text-ink-500">Vérification QR Code & RPC active</p>
          </div>
        </div>
      </div>

      {/* ─── Action Toolbar ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          {valid && (
            <a
              href={linkedInCertUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses({
                variant: "primary",
                size: "sm",
                className: "gap-1.5 bg-[#0A66C2] hover:bg-[#084e96] text-white border-transparent",
              })}
            >
              <ExternalLink className="size-3.5" aria-hidden />
              Ajouter à LinkedIn
            </a>
          )}
          <CopyButton value={verificationUrl} label="Copier le lien" copiedLabel="Lien copié !" />
        </div>

        <div>{backLink}</div>
      </div>

      {/* ─── Legal & Pedagogical Disclosure ─────────────────────────── */}
      <p className="text-center text-[11px] text-ink-500 leading-relaxed px-4">
        Ce certificat atteste le suivi complet d’une formation sur la plateforme SANADY et la réussite de ses évaluations.
        Il ne constitue ni un diplôme ni une certification professionnelle réglementée.
      </p>
    </div>
  );
}
