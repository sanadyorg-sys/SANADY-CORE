import Link from "next/link";
import { Search } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { buttonClasses } from "@/components/ui/button";
import { SiteMobileMenu, SiteNavLinks } from "./site-nav";

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:h-[4.5rem] lg:gap-6 lg:px-8">
        <Link href="/" className="shrink-0 rounded-sm" aria-label="SANADY — accueil">
          <BrandLogo className="h-9 lg:h-10" priority />
        </Link>
        <SiteNavLinks />
        <form action="/formations" role="search" className="ml-auto hidden max-w-xs flex-1 md:block xl:max-w-sm">
          <label className="relative block">
            <span className="sr-only">Rechercher une formation</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
            <input
              type="search"
              name="q"
              placeholder="Rechercher une formation"
              className="h-10 w-full rounded-full border border-line-strong bg-ink-25 pl-9 pr-4 text-body text-ink-900 placeholder:text-ink-500 focus:border-accent-600 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent-500/25"
            />
          </label>
        </form>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          {signedIn ? (
            <Link href="/mon-espace" className={buttonClasses({ variant: "accent", className: "max-sm:hidden" })}>
              Mon espace
            </Link>
          ) : (
            <>
              <Link href="/connexion" className={buttonClasses({ variant: "ghost", className: "max-sm:hidden" })}>
                Se connecter
              </Link>
              <Link href="/demande-acces" className={buttonClasses({ variant: "accent", className: "max-sm:hidden" })}>
                Demander un accès
              </Link>
            </>
          )}
          <SiteMobileMenu signedIn={signedIn} />
        </div>
      </div>
    </header>
  );
}
