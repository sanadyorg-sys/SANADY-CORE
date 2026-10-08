import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ChevronDown, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Aide" };

const QUESTIONS: Array<{ q: string; a: React.ReactNode }> = [
  {
    q: "Comment obtenir un accès à SANADY ?",
    a: "L’accès se fait uniquement sur invitation. Vous recevez un e-mail de la Fondation Sanady ou de votre établissement, ou votre établissement vous remet un code d’inscription.",
  },
  {
    q: "J’ai reçu un code d’inscription : que faire ?",
    a: (
      <>
        Rendez-vous sur <Link href="/rejoindre">Rejoindre avec un code</Link>, saisissez le code et votre adresse e-mail. Vous recevrez un lien de
        confirmation pour activer votre compte.
      </>
    ),
  },
  {
    q: "Mon lien d’invitation ne fonctionne plus.",
    a: "Une invitation est personnelle, ne peut servir qu’une fois et expire au bout de quelques jours. Demandez une nouvelle invitation à la personne qui vous l’a envoyée.",
  },
  {
    q: "J’ai oublié mon mot de passe.",
    a: (
      <>
        Utilisez <Link href="/mot-de-passe-oublie">Mot de passe oublié</Link> : vous recevrez un lien pour en choisir un nouveau, valable une heure.
      </>
    ),
  },
  {
    q: "Comment fonctionnent les évaluations ?",
    a: "Chaque module se termine par une évaluation, accessible une fois ses leçons obligatoires terminées. Le seuil de réussite est de 70 % et vous disposez de trois tentatives.",
  },
  {
    q: "Comment vérifier un certificat ?",
    a: (
      <>
        Scannez le code QR du certificat ou saisissez son numéro sur la page <Link href="/verifier">Vérifier un certificat</Link>.
      </>
    ),
  },
];

export default async function HelpPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("public_platform_info");
  const contact = (data as { support_email?: string | null } | null)?.support_email;

  return (
    <>
      <Link href="/connexion" className="mb-6 inline-flex items-center gap-1.5 text-label font-medium text-ink-600 hover:text-ink-900">
        <ArrowLeft className="size-4" aria-hidden /> Retour à la connexion
      </Link>
      <h1 className="text-title font-semibold text-ink-900">Besoin d’aide&nbsp;?</h1>
      <p className="mb-6 mt-1 text-body text-ink-600">Les réponses aux questions les plus fréquentes.</p>

      <div className="divide-y divide-line rounded-xl border border-line">
        {QUESTIONS.map(({ q, a }) => (
          <details key={q} className="group px-4 [&_a]:font-medium [&_a]:text-accent-700 [&_a]:underline">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3.5 text-body font-medium text-ink-900 [&::-webkit-details-marker]:hidden">
              {q}
              <ChevronDown className="size-4 shrink-0 text-ink-400 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <p className="pb-4 text-body leading-relaxed text-ink-600">{a}</p>
          </details>
        ))}
      </div>

      <div className="mt-6 rounded-xl bg-ink-50 px-5 py-4 text-body text-ink-700">
        {contact ? (
          <p className="flex items-start gap-2.5">
            <Mail className="mt-0.5 size-4 shrink-0 text-accent-600" aria-hidden />
            <span>
              Une autre question ? Écrivez-nous à{" "}
              <a href={`mailto:${contact}`} className="font-medium text-accent-700 underline">
                {contact}
              </a>
              .
            </span>
          </p>
        ) : (
          <p>Une autre question ? Contactez la personne qui vous a invité(e) ou votre établissement.</p>
        )}
      </div>
    </>
  );
}
