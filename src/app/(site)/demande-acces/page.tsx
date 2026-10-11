import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, Mail, Search, UserCheck } from "lucide-react";
import { BrandDots, SmileUnderline } from "@/components/brand/brand-decor";
import { AccessRequestForm } from "@/components/site/access-request-form";
import { buttonClasses } from "@/components/ui/button";
import { Reveal } from "@/components/ui/motion";
import { getViewer } from "@/server/auth";
import { getCatalog } from "@/server/queries/public";

export const metadata: Metadata = {
  title: "Demander un accès",
  description: "Demandez votre accès gratuit aux formations SANADY pour les enseignants.",
};

const STEPS = [
  { icon: Mail, title: "Vous envoyez votre demande", text: "Quelques informations simples sur votre fonction ou établissement." },
  { icon: Search, title: "L’équipe SANADY l’étudie", text: "Vérification sous 24 à 48 heures ouvrées." },
  { icon: UserCheck, title: "Vous recevez une invitation", text: "Un lien d'activation personnel et sécurisé par e-mail." },
  { icon: KeyRound, title: "Vous créez votre compte", text: "Et commencez aussitôt votre première formation." },
];

export default async function AccessRequestPage({ searchParams }: PageProps<"/demande-acces">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const [viewer, catalog] = await Promise.all([getViewer(), getCatalog()]);
  const institution = one(sp.profil) === "etablissement";
  const courseId = catalog.courses.some((c) => c.id === one(sp.formation)) ? one(sp.formation) : undefined;

  return (
    <div className="relative overflow-hidden bg-ink-25">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-dots opacity-25" />
      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_1.15fr] lg:gap-16 lg:px-8 lg:py-16">
        <Reveal>
          <p className="inline-flex items-center gap-2 text-label font-bold uppercase tracking-wider text-accent-700">
            <BrandDots />
            {institution ? "Établissements partenaires" : "Accès sur invitation"}
          </p>
          <h1 className="mt-3 text-[2.25rem] font-extrabold leading-tight tracking-tight text-ink-900 sm:text-[2.5rem]">
            {institution ? (
              <>
                Devenir <SmileUnderline className="text-accent-700">établissement</SmileUnderline> partenaire
              </>
            ) : (
              <>
                Demander un <SmileUnderline className="text-accent-700">accès</SmileUnderline> à SANADY
              </>
            )}
          </h1>
          <p className="mt-4 text-reading leading-relaxed text-ink-600">
            {institution
              ? "Présentez votre établissement : l’équipe de la Fondation Sanady vous recontacte pour ouvrir votre espace dédié et inviter l'ensemble de votre corps professoral."
              : "Les formations SANADY sont 100 % gratuites et réservées aux enseignants. Pour garantir la qualité et la bienveillance de la communauté, chaque compte est validé sur invitation."}
          </p>

          <ol className="mt-8 space-y-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4 rounded-xl border border-line/60 bg-surface/80 p-3.5 shadow-2xs backdrop-blur-xs">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-700 shadow-xs">
                  <s.icon className="size-5" aria-hidden />
                </span>
                <div>
                  <span className="block text-card font-bold text-ink-900">
                    {i + 1}. {s.title}
                  </span>
                  <span className="text-body text-ink-600">{s.text}</span>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-8 rounded-2xl border border-line bg-surface p-4 text-body text-ink-600 shadow-xs">
            Votre établissement vous a remis un code d’inscription ?{" "}
            <Link href="/rejoindre" className="font-semibold text-accent-700 hover:underline">
              Rejoindre avec un code →
            </Link>
          </div>
        </Reveal>

        <Reveal delay={120} className="relative rounded-3xl border border-line bg-surface p-6 shadow-md sm:p-8">
          {viewer ? (
            <div className="py-12 text-center">
              <h2 className="text-[1.5rem] font-extrabold text-ink-900">Vous avez déjà un compte</h2>
              <p className="mt-2 text-body text-ink-600">Vous êtes connecté(e) en tant que <span className="font-semibold text-ink-900">{viewer.email}</span>.</p>
              <Link href="/mon-espace" className={buttonClasses({ variant: "accent", size: "xl", className: "mt-6 rounded-xl shadow-xs" })}>
                Accéder à mon espace
              </Link>
            </div>
          ) : (
            <AccessRequestForm courses={catalog.courses.map((c) => ({ id: c.id, title: c.title }))} courseId={courseId} institution={institution} />
          )}
        </Reveal>
      </div>
    </div>
  );
}
