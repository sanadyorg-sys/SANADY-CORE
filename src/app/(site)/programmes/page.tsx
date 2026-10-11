import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Compass,
  GraduationCap,
  Hammer,
  HeartHandshake,
  Palmtree,
  Sparkles,
  Users,
} from "lucide-react";
import { BrandDots, SmileUnderline } from "@/components/brand/brand-decor";
import { buttonClasses } from "@/components/ui/button";
import { Reveal } from "@/components/ui/motion";
import classroomPhoto from "../../../../public/brand/sanady-student-classroom-1.jpg";

export const metadata: Metadata = {
  title: "Programmes Éducatifs",
  description:
    "Découvrez les programmes de la Fondation Sanady articulés autour de trois pôles : Apprentissage, Avenir et Éveil.",
};

const POLES = [
  {
    badge: "Pôle 1",
    title: "Autour de l’Apprentissage",
    description:
      "Renforcer les fondamentaux académiques des élèves et perfectionner les pratiques pédagogiques des enseignants.",
    tagColor: "bg-accent-100 text-accent-800 border-accent-300",
    programs: [
      {
        icon: GraduationCap,
        name: "Soutien scolaire spécialisé",
        highlight: "Pédagogie active & intensive",
        text: "Des cours de soutien dispensés en dehors des heures de cours régulières par des enseignants d’écoles publiques spécialement sélectionnés et formés par la Fondation Sanady.",
      },
      {
        icon: Users,
        name: "Formation continue des enseignants",
        highlight: "500 enseignants formés",
        text: "Une dizaine de moments de formation par an, encadrés par plus d’une dizaine de superviseurs locaux et régionaux, pour moderniser les compétences des enseignants et accompagner les réformes de la Vision 2015-2030.",
      },
    ],
  },
  {
    badge: "Pôle 2",
    title: "Autour de l’Avenir",
    description:
      "Accompagner chaque jeune vers l'autonomie, l'épanouissement professionnel et l'accès aux études supérieures.",
    tagColor: "bg-sky-100 text-sky-800 border-sky-300",
    programs: [
      {
        icon: Compass,
        name: "Orientation scolaire et professionnelle",
        highlight: "Choix éclairés & métiers d'avenir",
        text: "Un dispositif dès la 2e année du collège : séances collectives, entretiens individuels et forum annuel pour informer les jeunes et les accompagner dans leurs choix d’études et de carrière.",
      },
      {
        icon: HeartHandshake,
        name: "Assistance aux bourses d’études",
        highlight: "Égalité des chances & mentorat",
        text: "Préparation aux concours, assistance aux inscriptions et aux entretiens, pour que les élèves de milieux défavorisés accèdent aux meilleures opportunités d’études supérieures.",
      },
    ],
  },
  {
    badge: "Pôle 3",
    title: "Autour de l’Éveil",
    description:
      "Favoriser l'épanouissement personnel des élèves et réhabiliter leur cadre d'apprentissage quotidien.",
    tagColor: "bg-emerald-100 text-emerald-800 border-emerald-300",
    programs: [
      {
        icon: Palmtree,
        name: "Activités parascolaires",
        highlight: "Culture, sport & citoyenneté",
        text: "Ateliers (sciences, sécurité routière, développement personnel), fêtes scolaires, excursions et activités sportives pour ouvrir les horizons des élèves par l’art, la culture et le sport.",
      },
      {
        icon: Hammer,
        name: "Réhabilitation des écoles publiques",
        highlight: "Milieux ruraux et péri-urbains",
        text: "Rénovation des locaux, construction de sanitaires, mise en place de bibliothèques et équipement informatique des écoles d’intervention.",
      },
    ],
  },
];

export default function ProgrammesPage() {
  return (
    <>
      {/* ─── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-brand-900 text-white">
        <Image
          src={classroomPhoto}
          alt="Élèves attentifs en classe au Maroc"
          fill
          priority
          placeholder="blur"
          className="-z-10 object-cover opacity-25"
          sizes="100vw"
        />
        <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(15_23_42/0.85)_0%,rgb(15_23_42/0.95)_100%)]" />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-dots-light opacity-15" />

        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <p className="inline-flex items-center gap-2 rounded-full border border-accent-500/40 bg-accent-500/10 px-3.5 py-1 text-label font-semibold text-accent-400">
            <Sparkles className="size-4" aria-hidden /> Programmes officiels Fondation Sanady
          </p>
          <h1 className="mt-5 max-w-3xl text-[2.25rem] font-extrabold leading-tight tracking-tight sm:text-[3rem]">
            Trois pôles d’intervention pour la{" "}
            <SmileUnderline className="text-accent-400">réussite</SmileUnderline> de chaque élève.
          </h1>
          <p className="mt-5 max-w-2xl text-[1.125rem] leading-relaxed text-brand-200">
            Depuis 2009, la Fondation Sanady déploie un modèle global d’accompagnement éducatif dans les écoles publiques du Maroc,
            articulé autour de l’apprentissage, de l’avenir et de l’éveil.
          </p>
        </div>
      </section>

      {/* ─── Chiffres clés des programmes ─────────────────────────────────── */}
      <section aria-label="Impact des programmes" className="relative border-b border-line bg-surface">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-dots opacity-20" />
        <div className="relative mx-auto grid max-w-7xl grid-cols-2 divide-y divide-line sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x lg:divide-line">
          {[
            { value: "2009", label: "Année de création (utilité publique)" },
            { value: "+220", label: "Enseignants formés par an" },
            { value: "10+", label: "Superviseurs pédagogiques terrain" },
            { value: "100%", label: "Gratuit pour les enseignants" },
          ].map((item) => (
            <div key={item.label} className="px-4 py-8 text-center sm:px-6">
              <span className="block text-[2.25rem] font-extrabold tabular tracking-tight text-accent-700 sm:text-[2.75rem]">
                {item.value}
              </span>
              <span className="mt-1 block text-body font-medium text-ink-600">{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Les 3 Pôles ──────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="space-y-16">
          {POLES.map((pole) => (
            <Reveal key={pole.title} className="rounded-3xl border border-line bg-surface p-8 shadow-xs sm:p-10">
              <div className="max-w-3xl">
                <span className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1 text-label font-bold uppercase tracking-wider ${pole.tagColor}`}>
                  <BrandDots /> {pole.badge}
                </span>
                <h2 className="mt-3 text-[1.875rem] font-extrabold tracking-tight text-ink-900">{pole.title}</h2>
                <p className="mt-2 text-reading text-ink-600">{pole.description}</p>
              </div>

              <div className="mt-8 grid gap-6 sm:grid-cols-2">
                {pole.programs.map((prog, i) => (
                  <Reveal
                    as="div"
                    key={prog.name}
                    delay={i * 80}
                    className="card-shine flex flex-col justify-between rounded-2xl border border-line bg-ink-25/50 p-6 shadow-xs transition duration-300 hover:-translate-y-1 hover:border-accent-500/40 hover:bg-surface hover:shadow-md"
                  >
                    <div>
                      <span className="flex size-12 items-center justify-center rounded-xl bg-accent-50 text-accent-700">
                        <prog.icon className="size-6" aria-hidden />
                      </span>
                      <h3 className="mt-4 text-section font-bold text-ink-900">{prog.name}</h3>
                      <p className="mt-1 text-caption font-semibold text-accent-700">{prog.highlight}</p>
                      <p className="mt-3 text-body leading-relaxed text-ink-600">{prog.text}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ─── Lien avec la formation en ligne ──────────────────────────────── */}
      <section className="bg-ink-50">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <Reveal className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-brand-800 p-8 text-white shadow-xl sm:p-12 md:flex-row md:items-center">
            <div>
              <p className="inline-flex items-center gap-2 text-label font-bold uppercase tracking-wider text-accent-400">
                <BrandDots /> Pour les enseignants
              </p>
              <h2 className="mt-2 text-[1.75rem] font-extrabold leading-tight tracking-tight sm:text-[2rem]">
                Accédez aux modules de formation en ligne
              </h2>
              <p className="mt-2 max-w-xl text-reading text-brand-200">
                Retrouvez l’ensemble des modules pédagogiques conçus selon l’expérience de terrain de la Fondation Sanady.
              </p>
            </div>
            <Link href="/formations" className={buttonClasses({ variant: "accent", size: "xl", className: "rounded-xl shadow-lg" })}>
              <BookOpen className="size-5" aria-hidden /> Parcourir les formations <ArrowRight aria-hidden />
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  );
}
