import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="relative hidden overflow-hidden bg-navy-800 text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:48px_48px]"
        />
        <Link href="/" className="relative w-fit rounded-sm">
          <Wordmark tone="light" className="text-xl" />
        </Link>
        <div className="relative max-w-md">
          <p className="text-display font-semibold leading-tight text-white">
            Plateforme de formation et de développement professionnel des enseignants.
          </p>
          <ul className="mt-8 space-y-3 text-body text-navy-100">
            <li className="flex gap-3">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-teal-300" aria-hidden />
              Des parcours structurés, à suivre à votre rythme.
            </li>
            <li className="flex gap-3">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-teal-300" aria-hidden />
              Une évaluation à l’issue de chaque module.
            </li>
            <li className="flex gap-3">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-teal-300" aria-hidden />
              Un certificat vérifiable à la fin de chaque formation.
            </li>
          </ul>
        </div>
        <p className="relative text-caption text-navy-200">Accès sur invitation uniquement · Service gratuit</p>
      </aside>

      <div className="flex min-h-dvh flex-col bg-surface">
        <header className="flex h-16 items-center px-6 lg:hidden">
          <Link href="/" className="rounded-sm">
            <Wordmark className="text-lg" />
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
