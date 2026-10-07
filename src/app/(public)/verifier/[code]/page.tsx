import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, CircleX, SearchX } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { Alert, Card, DescriptionList } from "@/components/ui/surface";
import { formatDate, formatDuration } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { VerifiedCertificate } from "@/lib/types";
import { clientIp, rateLimit } from "@/server/rate-limit";

export const metadata: Metadata = { title: "Vérification de certificat", referrer: "no-referrer" };

export default async function VerifyCertificatePage(props: PageProps<"/verifier/[code]">) {
  const { code: rawCode } = await props.params;
  const code = decodeURIComponent(rawCode).trim().slice(0, 64);

  if (!(await rateLimit(`verify:${await clientIp()}`, 60, 15 * 60))) {
    return <Alert tone="warning">Trop de vérifications. Veuillez patienter quelques minutes avant de réessayer.</Alert>;
  }

  const supabase = await createClient();
  const { data } = await supabase.rpc("verify_certificate", { p_code: code });
  const cert = data as VerifiedCertificate | null;

  const back = (
    <Link href="/verifier" className={buttonClasses({ variant: "secondary", className: "mt-6 w-full" })}>
      Vérifier un autre certificat
    </Link>
  );

  if (!cert) {
    return (
      <>
        <div className="mb-6 flex size-11 items-center justify-center rounded-lg border border-line bg-ink-25 text-ink-500">
          <SearchX className="size-5" aria-hidden />
        </div>
        <h1 className="text-title font-semibold text-ink-900">Certificat introuvable</h1>
        <p className="mt-2 text-body text-ink-600">
          Aucun certificat SANADY ne correspond à cette référence. Vérifiez la saisie ou scannez à nouveau le code QR.
        </p>
        {back}
      </>
    );
  }

  const valid = cert.status === "valid";
  return (
    <>
      <div
        className={
          valid
            ? "mb-6 flex size-11 items-center justify-center rounded-lg bg-success-50 text-success-600"
            : "mb-6 flex size-11 items-center justify-center rounded-lg bg-danger-50 text-danger-600"
        }
      >
        {valid ? <BadgeCheck className="size-6" aria-hidden /> : <CircleX className="size-6" aria-hidden />}
      </div>
      <h1 className="text-title font-semibold text-ink-900">{valid ? "Certificat authentique" : "Certificat révoqué"}</h1>
      <p className="mb-6 mt-2 text-body text-ink-600">
        {valid
          ? `Ce certificat a bien été délivré par ${cert.issuer} et n’a pas été révoqué.`
          : `Ce certificat a été délivré par ${cert.issuer}, puis révoqué. Il n’est plus valable.`}
      </p>
      <Card className="px-5 py-1">
        <DescriptionList
          items={[
            { term: "Titulaire", value: cert.recipient_name },
            { term: "Formation", value: cert.course_title },
            { term: "Durée indicative", value: formatDuration(cert.course_duration_minutes) },
            { term: "Achevée le", value: formatDate(cert.completed_at) },
            { term: "Numéro", value: <span className="font-mono">{cert.certificate_number}</span> },
          ]}
        />
      </Card>
      <p className="mt-4 text-caption text-ink-500">
        Ce certificat atteste du suivi complet d’une formation sur la plateforme SANADY et de la réussite de ses évaluations.
        Il ne constitue pas un diplôme ni une certification professionnelle réglementée.
      </p>
      {back}
    </>
  );
}
