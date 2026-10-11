import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, Mail, Search, UserCheck } from "lucide-react";
import { AccessRequestForm } from "@/components/site/access-request-form";
import { buttonClasses } from "@/components/ui/button";
import { getViewer } from "@/server/auth";
import { getCatalog } from "@/server/queries/public";

export const metadata: Metadata = {
  title: "Demander un accès",
  description: "Demandez votre accès gratuit aux formations SANADY pour les enseignants.",
};

const STEPS = [
  { icon: Mail, title: "Vous envoyez votre demande", text: "Quelques informations suffisent." },
  { icon: Search, title: "L’équipe SANADY l’étudie", text: "Chaque demande est examinée individuellement." },
  { icon: UserCheck, title: "Vous recevez une invitation", text: "Un lien personnel, valable plusieurs jours, par e-mail." },
  { icon: KeyRound, title: "Vous créez votre compte", text: "Et vous commencez votre première formation." },
];

export default async function AccessRequestPage({ searchParams }: PageProps<"/demande-acces">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const [viewer, catalog] = await Promise.all([getViewer(), getCatalog()]);
  const institution = one(sp.profil) === "etablissement";
  const courseId = catalog.courses.some((c) => c.id === one(sp.formation)) ? one(sp.formation) : undefined;

  return (
    <div className="bg-ink-25">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_1.15fr] lg:gap-16 lg:px-8 lg:py-16">
        <div>
          <p className="text-label font-semibold uppercase tracking-wider text-accent-700">
            {institution ? "Établissements partenaires" : "Accès sur invitation"}
          </p>
          <h1 className="mt-2 text-[2.25rem] font-extrabold leading-tight tracking-tight text-ink-900">
            {institution ? "Devenir établissement partenaire" : "Demander un accès à SANADY"}
          </h1>
          <p className="mt-4 text-reading text-ink-600">
            {institution
              ? "Présentez votre établissement : l’équipe de la Fondation Sanady vous recontacte pour ouvrir votre espace et inviter vos enseignants."
              : "Les formations SANADY sont gratuites et réservées aux enseignants. Pour garantir la qualité de la communauté, chaque compte est créé sur invitation."}
          </p>
          <ol className="mt-8 space-y-5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-accent-700 shadow-xs ring-1 ring-line">
                  <s.icon className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block text-card font-semibold text-ink-900">
                    {i + 1}. {s.title}
                  </span>
                  <span className="text-body text-ink-600">{s.text}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-8 rounded-lg border border-line bg-surface p-4 text-body text-ink-600">
            Votre établissement vous a remis un code d’inscription ?{" "}
            <Link href="/rejoindre" className="font-medium text-accent-700 hover:underline">
              Rejoindre avec un code
            </Link>
          </div>
        </div>

        <div className="relative rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
          {viewer ? (
            <div className="py-6 text-center">
              <h2 className="text-[1.375rem] font-bold text-ink-900">Vous avez déjà un compte</h2>
              <p className="mt-2 text-body text-ink-600">Vous êtes connecté(e) en tant que {viewer.email}.</p>
              <Link href="/mon-espace" className={buttonClasses({ variant: "accent", size: "lg", className: "mt-6" })}>
                Accéder à mon espace
              </Link>
            </div>
          ) : (
            <AccessRequestForm courses={catalog.courses.map((c) => ({ id: c.id, title: c.title }))} courseId={courseId} institution={institution} />
          )}
        </div>
      </div>
    </div>
  );
}
