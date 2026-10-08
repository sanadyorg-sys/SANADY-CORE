import Image from "next/image";
import Link from "next/link";
import { Award, ClipboardCheck, PlayCircle } from "lucide-react";
import { BrandLogo, BrandTagline } from "@/components/brand/brand-logo";
import classroom from "../../../public/brand/sanady-classroom.jpg";

const FEATURES = [
  { icon: PlayCircle, label: "À votre rythme" },
  { icon: ClipboardCheck, label: "Quiz par module" },
  { icon: Award, label: "Certificat vérifiable" },
];

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* ─── Brand panel (large screens) ─────────────────────────────────── */}
      <aside className="relative hidden overflow-hidden bg-ink-50 lg:flex lg:flex-col lg:px-12 lg:py-10 xl:px-16">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 right-[-6rem] size-[26rem] rounded-full border-[44px] border-accent-500/10"
        />
        <Link href="/" className="relative w-fit rounded-sm">
          <BrandLogo className="h-14" priority />
        </Link>

        <div className="relative mt-auto max-w-[36rem] pt-10">
          <p className="text-label font-semibold uppercase tracking-[0.14em] text-accent-700">Formation des enseignants</p>
          <p className="mt-3 text-[2.75rem] font-extrabold leading-[1.05] tracking-[-0.03em] text-ink-900 xl:text-[3.25rem]">
            Ensemble, faisons grandir l’éducation.
          </p>
          <p className="mt-4 max-w-md text-[1.0625rem] leading-relaxed text-ink-600">
            Des parcours pour enrichir vos pratiques et accompagner chaque élève.
          </p>

          <figure className="mt-8 overflow-hidden rounded-2xl shadow-sm ring-1 ring-black/5">
            <Image
              src={classroom}
              alt="Une élève souriante en classe"
              placeholder="blur"
              priority
              className="aspect-[16/9] h-auto w-full object-cover"
              sizes="(min-width: 1280px) 576px, (min-width: 1024px) 45vw, 0px"
            />
          </figure>

          <ul className="mt-7 flex flex-wrap items-center gap-y-3 divide-x divide-line">
            {FEATURES.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2.5 px-5 first:pl-0 last:pr-0">
                <Icon className="size-7 shrink-0 text-accent-500" strokeWidth={1.6} aria-hidden />
                <span className="text-body font-medium text-ink-800">{label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mt-auto pt-10">
          <BrandTagline className="h-12" />
          <svg aria-hidden viewBox="0 0 120 10" className="mt-1 h-2.5 w-24 text-accent-500">
            <path d="M2 7 C 30 2, 70 2, 118 5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
      </aside>

      {/* ─── Form side ────────────────────────────────────────────────────── */}
      <div className="flex min-h-dvh flex-col bg-surface">
        <header className="flex h-20 items-center justify-between px-6 sm:px-10">
          <Link href="/" className="rounded-sm lg:invisible">
            <BrandLogo className="h-11" priority />
          </Link>
          <Link href="/aide" className="text-body font-medium text-accent-700 hover:underline">
            Besoin d’aide&nbsp;?
          </Link>
        </header>
        <main id="contenu" className="flex flex-1 items-center justify-center px-6 py-8">
          <div className="w-full max-w-[440px]">{children}</div>
        </main>
        <footer className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 px-6 py-6 text-caption text-ink-500">
          <Link href="/verifier" className="hover:text-ink-800 hover:underline">
            Vérifier un certificat
          </Link>
          <span aria-hidden className="hidden h-3 w-px bg-line-strong sm:block" />
          <Link href="/confidentialite" className="hover:text-ink-800 hover:underline">
            Confidentialité et données personnelles
          </Link>
        </footer>
      </div>
    </div>
  );
}
