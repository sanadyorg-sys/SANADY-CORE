import Image from "next/image";
import Link from "next/link";
import { BrandLogo, BrandTagline } from "@/components/brand/brand-logo";
import classroom from "../../../public/brand/sanady-classroom.jpg";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="relative hidden overflow-hidden border-r border-line bg-ink-50 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full border-[28px] border-accent-500/10" />
        <div className="relative">
          <Link href="/" className="inline-block rounded-sm">
            <BrandLogo className="h-16" priority />
          </Link>
          <BrandTagline className="mt-5 h-11" />
        </div>

        <div className="relative max-w-md">
          <figure className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
            <Image
              src={classroom}
              alt="Élèves en classe, Fondation Sanady"
              placeholder="blur"
              className="aspect-[697/400] h-auto w-full object-cover"
              sizes="(min-width: 1024px) 448px, 0px"
            />
          </figure>
          <p className="mt-8 text-section font-semibold leading-snug text-ink-900">
            Plateforme de formation et de développement professionnel des enseignants.
          </p>
          <ul className="mt-4 space-y-2.5 text-body text-ink-600">
            {[
              "Des parcours structurés, à suivre à votre rythme.",
              "Une évaluation à l’issue de chaque module.",
              "Un certificat vérifiable à la fin de chaque formation.",
            ].map((item) => (
              <li key={item} className="flex gap-3">
                <span className="mt-[7px] size-2 shrink-0 rounded-full bg-accent-500" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-caption text-ink-500">Accès sur invitation uniquement · Service gratuit</p>
      </aside>

      <div className="flex min-h-dvh flex-col bg-surface">
        <header className="flex h-20 items-center px-6 lg:hidden">
          <Link href="/" className="rounded-sm">
            <BrandLogo className="h-11" priority />
          </Link>
        </header>
        <main id="contenu" className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="w-full max-w-[420px]">{children}</div>
        </main>
        <footer className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 px-6 py-6 text-caption text-ink-500">
          <Link href="/verifier" className="hover:text-ink-800 hover:underline">
            Vérifier un certificat
          </Link>
          <Link href="/confidentialite" className="hover:text-ink-800 hover:underline">
            Confidentialité et données personnelles
          </Link>
        </footer>
      </div>
    </div>
  );
}
