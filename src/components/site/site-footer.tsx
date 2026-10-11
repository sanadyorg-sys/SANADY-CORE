import Link from "next/link";
import { BrandLogo } from "@/components/brand/brand-logo";
import { BrandDots } from "@/components/brand/brand-decor";

const COLUMNS = [
  {
    title: "Plateforme",
    links: [
      { href: "/formations", label: "Catalogue des formations" },
      { href: "/programmes", label: "Programmes éducatifs" },
      { href: "/ressources", label: "Mallette & Ressources" },
      { href: "/demande-acces", label: "Demander un accès" },
      { href: "/connexion", label: "Se connecter" },
      { href: "/rejoindre", label: "Rejoindre avec un code" },
    ],
  },
  {
    title: "Fondation",
    links: [
      { href: "/a-propos", label: "À propos de SANADY" },
      { href: "/a-propos#etablissements", label: "Pour les établissements" },
      { href: "/verifier", label: "Vérifier un certificat" },
      { href: "/aide", label: "Aide & FAQ" },
    ],
  },
];

export function SiteFooter({ supportEmail }: { supportEmail?: string | null }) {
  return (
    <footer className="relative bg-brand-900 text-brand-100">
      {/* Top subtle Moroccan accent border */}
      <div aria-hidden className="h-1 w-full bg-gradient-to-r from-accent-600 via-accent-400 to-accent-600" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-dots-light opacity-10" />

      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-8">
        <div>
          <BrandLogo variant="light" className="h-11" />
          <p className="mt-4 max-w-xs text-body leading-relaxed text-brand-200">
            La plateforme de formation et de développement professionnel des enseignants de la Fondation Sanady.
          </p>
          <p className="mt-3.5 inline-flex items-center gap-2 text-label font-bold text-accent-400">
            <BrandDots /> Préparons les adultes du Maroc de demain.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h2 className="text-label font-bold uppercase tracking-wider text-white">{col.title}</h2>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-body text-brand-200 transition-colors hover:text-accent-400">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div>
          <h2 className="text-label font-bold uppercase tracking-wider text-white">Informations</h2>
          <ul className="mt-4 space-y-2.5">
            <li>
              <Link href="/confidentialite" className="text-body text-brand-200 transition-colors hover:text-accent-400">
                Confidentialité et données
              </Link>
            </li>
            {supportEmail ? (
              <li>
                <a href={`mailto:${supportEmail}`} className="break-all text-body text-brand-200 transition-colors hover:text-accent-400">
                  {supportEmail}
                </a>
              </li>
            ) : null}
          </ul>
        </div>
      </div>
      <div className="relative border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-caption text-brand-300 sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} Fondation Sanady. Reconnue d’utilité publique. Tous droits réservés.</p>
          <p className="flex items-center gap-2">
            <span>Accès sur invitation</span>
            <span>·</span>
            <span>Formations gratuites au Maroc</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
