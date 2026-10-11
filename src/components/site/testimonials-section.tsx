import { Award, CheckCircle2, Quote, Sparkles, Star } from "lucide-react";
import { BrandDots } from "@/components/brand/brand-decor";

interface Testimonial {
  quote: string;
  author: string;
  role: string;
  location: string;
  impactTag: string;
  certifiedYear: string;
  initials: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "Le module sur la rétroaction formative a transformé ma façon de corriger. Mes élèves de 5e année n'ont plus peur de se tromper au tableau : l'erreur est devenue un point de départ pour réfléchir ensemble.",
    author: "Khadija R.",
    role: "Professeure de Français, Cycle Primaire",
    location: "Académie Casablanca-Settat",
    impactTag: "+35% de participation active",
    certifiedYear: "Certifiée SANADY 2025",
    initials: "KR",
  },
  {
    quote:
      "Avec les ateliers par niveau réel (TaRL), j'ai pu identifier en une semaine pourquoi six de mes élèves bloquaient sur les soustractions à retenue. En trois semaines de jeux ciblés, le retard était comblé.",
    author: "Yassine B.",
    role: "Enseignant de Mathématiques, Collège",
    location: "Académie Marrakech-Safi",
    impactTag: "Lacunes comblées en 3 semaines",
    certifiedYear: "Certifié SANADY 2024",
    initials: "YB",
  },
  {
    quote:
      "Toute l'équipe pédagogique de notre groupe scolaire a suivi le parcours Climat Scolaire. Les rituels d'entrée et les contrats bienveillants ont apaisé les tensions et renforcé l'esprit d'équipe des professeurs.",
    author: "Nadia M.",
    role: "Directrice d'Établissement Primaire",
    location: "Direction Provinciale Taroudant",
    impactTag: "Climat scolaire serein",
    certifiedYear: "Établissement Pilote SANADY",
    initials: "NM",
  },
];

export function TestimonialsSection() {
  return (
    <section className="relative overflow-hidden bg-surface py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 text-label font-bold uppercase tracking-wider text-accent-700">
              <BrandDots /> Témoignages & Récits de classe
            </p>
            <h2 className="mt-2 text-[1.875rem] font-extrabold leading-tight tracking-tight text-ink-900 sm:text-[2.25rem]">
              Ce que les enseignants en disent
            </h2>
            <p className="mt-3 text-reading leading-relaxed text-ink-600">
              Découvrez les retours d’expérience de professeurs et directeurs qui appliquent chaque jour
              les démarches SANADY dans leurs classes à travers le Maroc.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-line bg-ink-25/80 px-4 py-2 text-label font-semibold text-ink-800 shadow-xs">
            <div className="flex text-accent-500">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="size-4 fill-accent-500 text-accent-500" aria-hidden />
              ))}
            </div>
            <span>98 % de satisfaction enseignante</span>
          </div>
        </div>

        {/* ─── Testimonials Grid ─────────────────────────────────────────── */}
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.author}
              className="card-shine glow-card flex flex-col justify-between rounded-3xl border border-line bg-surface p-7 shadow-xs transition duration-300 hover:-translate-y-1.5 hover:border-accent-500/40 hover:shadow-lg"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1 text-caption font-bold text-accent-800">
                    <Sparkles className="size-3 text-accent-600" aria-hidden />
                    {t.impactTag}
                  </span>
                  <Quote className="size-6 text-ink-200" aria-hidden />
                </div>

                <p className="mt-5 text-body leading-relaxed text-ink-700 sm:text-[0.9375rem]">
                  «&nbsp;{t.quote}&nbsp;»
                </p>
              </div>

              <div className="mt-6 border-t border-line/70 pt-5">
                <div className="flex items-center gap-3.5">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-brand-700 text-label font-extrabold text-white shadow-xs">
                    {t.initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="block text-card font-bold text-ink-900">{t.author}</span>
                      <CheckCircle2 className="size-4 text-success-600" aria-label="Compte vérifié" />
                    </div>
                    <span className="block truncate text-caption font-medium text-ink-600">{t.role}</span>
                    <span className="block truncate text-caption text-ink-500">{t.location}</span>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-1.5 text-caption font-medium text-accent-700">
                  <Award className="size-3.5" aria-hidden />
                  <span>{t.certifiedYear}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
