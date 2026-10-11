import Link from "next/link";
import { BrandLogo } from "@/components/brand/brand-logo";

const COLUMNS = [
  {
    title: "Plateforme",
    links: [
      { href: "/formations", label: "Catalogue des formations" },
      { href: "/demande-acces", label: "Demander un accès" },
      { href: "/connexion", label: "Se connecter" },
      { href: "/rejoindre", label: "Rejoindre avec un code" },
    ],
  },
  {
    title: "Fondation",
    links: [
      { href: "/a-propos", label: "À propos de SANADY" },
      { href: "/a-propos#programmes", label: "Nos programmes" },
      { href: "/ressources", label: "Ressources institutionnelles" },
      { href: "/a-propos#etablissements", label: "Pour les établissements" },
      { href: "/verifier", label: "Vérifier un certificat" },
      { href: "/aide", label: "Aide" },
    ],
  },
];

export function SiteFooter({ supportEmail }: { supportEmail?: string | null }) {
  return (
    <footer className="bg-brand-800 text-brand-100">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-8">
        <div>
          <BrandLogo variant="light" className="h-11" />
          <p className="mt-4 max-w-xs text-body leading-relaxed text-brand-200">
            La plateforme de formation et de développement professionnel des enseignants de la Fondation Sanady.
          </p>
          <p className="mt-3 text-label font-semibold text-accent-500">Préparons les adultes du Maroc de demain.</p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h2 className="text-label font-semibold uppercase tracking-wider text-white">{col.title}</h2>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-body text-brand-200 transition-colors hover:text-white hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div>
          <h2 className="text-label font-semibold uppercase tracking-wider text-white">Informations</h2>
          <ul className="mt-4 space-y-2.5">
            <li>
              <Link href="/confidentialite" className="text-body text-brand-200 transition-colors hover:text-white hover:underline">
                Confidentialité et données
              </Link>
            </li>
            {supportEmail ? (
              <li>
                <a href={`mailto:${supportEmail}`} className="break-all text-body text-brand-200 transition-colors hover:text-white hover:underline">
                  {supportEmail}
                </a>
              </li>
            ) : null}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-caption text-brand-300 sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} Fondation Sanady. Tous droits réservés.</p>
          <p>Accès sur invitation · Formations gratuites</p>
        </div>
      </div>
    </footer>
  );
}
