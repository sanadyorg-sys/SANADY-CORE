import Image from "next/image";
import Link from "next/link";
import { Award, ClipboardCheck, PlayCircle } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import slogan from "../../../public/brand/sanady-phrase.png";

const FEATURES = [
  { icon: PlayCircle, label: "À votre rythme" },
  { icon: ClipboardCheck, label: "Quiz par module" },
  { icon: Award, label: "Certificat vérifiable" },
];

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      {/* ─── Brand panel (large screens): full-height photograph ─────────── */}
      <aside className="relative hidden overflow-hidden bg-brand-800 lg:flex lg:min-h-dvh lg:flex-col lg:justify-between lg:p-10 xl:p-12">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-dots-light opacity-15" />
        <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 size-[36rem] rounded-full bg-accent-600/15 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-24 size-[30rem] rounded-full bg-accent-500/10 blur-3xl" />

        <Link href="/" className="relative w-fit transition duration-200 hover:opacity-90">
          <BrandLogo variant="light" className="h-12 drop-shadow-sm" priority />
        </Link>

        {/* Foundation slogan (white lettering on transparent background). */}
        <Image
          src={slogan}
          alt="Accompagne ses enfants vers la réussite"
          priority
          className="relative mx-auto w-full max-w-[30rem] drop-shadow-lg"
          sizes="480px"
        />

        <div className="relative max-w-[38rem] text-white">
          <p className="text-label font-semibold uppercase tracking-[0.2em] text-white/85">Formation des enseignants</p>
          <p className="mt-3 text-[2.75rem] font-extrabold leading-[1.05] tracking-[-0.03em] xl:text-[3.25rem]">
            Ensemble, faisons grandir l’éducation.
          </p>
          <p className="mt-4 max-w-md text-[1.0625rem] leading-relaxed text-white/90">
            Des parcours pour enrichir vos pratiques et accompagner chaque élève.
          </p>
          <ul className="mt-7 flex flex-wrap items-center gap-y-3 divide-x divide-white/25">
            {FEATURES.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2.5 px-5 first:pl-0 last:pr-0">
                <Icon className="size-7 shrink-0 text-accent-500" strokeWidth={1.7} aria-hidden />
                <span className="text-body font-medium text-white">{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* ─── Form side ────────────────────────────────────────────────────── */}
      <div className="flex min-h-dvh flex-col bg-surface border-t-2 border-accent-500 lg:border-t-0">
        <header className="flex h-16 sm:h-20 items-center justify-between px-4 sm:px-10 border-b border-line/50 lg:border-b-0">
          <Link href="/" className="rounded-sm transition duration-200 hover:opacity-90">
            <BrandLogo variant="orange" className="h-8 sm:h-11" priority />
          </Link>
          <Link href="/aide" className="text-caption sm:text-body font-medium text-accent-700 hover:underline shrink-0">
            Besoin d’aide&nbsp;?
          </Link>
        </header>
        <main id="contenu" className="flex flex-1 items-center justify-center px-4 sm:px-6 py-6 sm:py-10">
          <div className="w-full max-w-[440px] has-[[data-wide-layout]]:max-w-2xl xl:has-[[data-wide-layout]]:max-w-3xl transition-[max-width] duration-300">
            {children}
          </div>
        </main>
        <footer className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 py-4 sm:py-6 text-xs sm:text-caption text-ink-500">
          <Link href="/verifier" className="hover:text-ink-800 hover:underline py-1">
            Vérifier un certificat
          </Link>
          <span aria-hidden className="hidden h-3 w-px bg-line-strong sm:block" />
          <Link href="/confidentialite" className="hover:text-ink-800 hover:underline py-1">
            Confidentialité et données personnelles
          </Link>
        </footer>
      </div>
    </div>
  );
}
