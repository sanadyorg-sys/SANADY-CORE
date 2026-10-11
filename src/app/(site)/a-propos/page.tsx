import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BarChart3, CheckCircle2, FileText, HeartHandshake, Lightbulb, Mail, ShieldCheck, Sparkles, Users } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import classroom from "../../../../public/brand/sanady-classroom.jpg";

export const metadata: Metadata = {
  title: "À propos",
  description: "SANADY, la plateforme de formation des enseignants de la Fondation Sanady.",
};

const VALUES = [
  { icon: Lightbulb, title: "Utile en classe", text: "Des contenus courts, concrets et directement applicables avec vos élèves." },
  { icon: HeartHandshake, title: "Bienveillance", text: "L’erreur fait partie de l’apprentissage — pour les élèves comme pour les enseignants." },
  { icon: ShieldCheck, title: "Respect des données", text: "Vos formations personnelles restent privées ; vous décidez de rejoindre un établissement." },
  { icon: Sparkles, title: "Exigence", text: "Des évaluations à chaque module et un certificat qui atteste d’un parcours réellement suivi." },
];

export default async function AboutPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("public_platform_info");
  const supportEmail = (data as { support_email?: string | null } | null)?.support_email;

  return (
    <>
      <section className="relative isolate overflow-hidden bg-brand-800">
        <Image src={classroom} alt="" fill priority placeholder="blur" className="-z-10 object-cover opacity-35" sizes="100vw" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(12_10_9/0.92)_0%,rgb(12_10_9/0.6)_60%,rgb(12_10_9/0.3)_100%)]" />
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <p className="text-label font-semibold uppercase tracking-[0.2em] text-accent-500">À propos</p>
          <h1 className="mt-4 max-w-3xl text-[2.5rem] font-extrabold leading-[1.08] tracking-tight text-white sm:text-[3.25rem]">
            Préparons les adultes du Maroc de demain.
          </h1>
          <p className="mt-6 max-w-2xl text-[1.125rem] leading-relaxed text-white/90">
            SANADY est la plateforme de formation de la Fondation Sanady. Elle accompagne les enseignants dans leur développement
            professionnel, parce que la qualité de l’éducation commence par celles et ceux qui enseignent.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-20">
        <div>
          <h2 className="text-[1.875rem] font-bold leading-tight tracking-tight text-ink-900">Notre mission</h2>
          <div className="mt-5 space-y-4 text-reading text-ink-700">
            <p>
              Offrir à chaque enseignant un accès simple et gratuit à des formations de qualité, conçues avec des spécialistes de
              l’éducation et pensées pour la réalité des classes marocaines.
            </p>
            <p>
              Chaque formation alterne vidéos, documents et évaluations. Les enseignants avancent à leur rythme, sur l’appareil de leur
              choix, et obtiennent un certificat vérifiable lorsqu’ils ont validé l’ensemble du parcours.
            </p>
          </div>
        </div>
        <ul className="grid gap-5 sm:grid-cols-2">
          {VALUES.map((v) => (
            <li key={v.title} className="rounded-xl border border-line bg-surface p-6">
              <v.icon className="size-6 text-accent-700" aria-hidden />
              <h3 className="mt-3 text-section font-semibold text-ink-900">{v.title}</h3>
              <p className="mt-1.5 text-body leading-relaxed text-ink-600">{v.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="etablissements" className="scroll-mt-24 bg-ink-25">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            <p className="text-label font-semibold uppercase tracking-wider text-accent-700">Établissements partenaires</p>
            <h2 className="mt-2 text-[1.875rem] font-bold leading-tight tracking-tight text-ink-900">Un espace dédié à votre établissement</h2>
            <p className="mt-3 text-reading text-ink-600">
              La Fondation Sanady autorise des formations pour votre établissement. Vous les affectez à vos enseignants et suivez leur
              progression, dans le respect de leur vie privée.
            </p>
          </div>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Users, title: "Inviter", text: "Par e-mail ou avec un code d’inscription, avec date d’expiration et limite d’utilisation." },
              { icon: CheckCircle2, title: "Affecter", text: "Choisissez les formations adaptées à chaque enseignant, avec une échéance si besoin." },
              { icon: BarChart3, title: "Suivre", text: "Leçons, résultats aux évaluations et certificats, enseignant par enseignant." },
              { icon: FileText, title: "Rendre compte", text: "Téléchargez des rapports individuels de progression en PDF." },
            ].map((f) => (
              <li key={f.title} className="rounded-xl border border-line bg-surface p-6">
                <span className="flex size-11 items-center justify-center rounded-lg bg-accent-50 text-accent-700">
                  <f.icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-section font-semibold text-ink-900">{f.title}</h3>
                <p className="mt-1.5 text-body leading-relaxed text-ink-600">{f.text}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-3xl text-body text-ink-600">
            Un établissement ne voit la progression d’un enseignant que pour les formations qu’il lui a affectées, et seulement après
            l’accord de l’enseignant. Ses formations personnelles restent privées.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/demande-acces?profil=etablissement" className={buttonClasses({ variant: "accent", size: "lg" })}>
              Devenir partenaire
            </Link>
            {supportEmail ? (
              <a href={`mailto:${supportEmail}`} className={buttonClasses({ variant: "secondary", size: "lg" })}>
                <Mail aria-hidden /> {supportEmail}
              </a>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
