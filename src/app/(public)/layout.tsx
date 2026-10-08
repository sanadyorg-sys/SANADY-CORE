import Image from "next/image";
import Link from "next/link";
import { Award, ClipboardCheck, PlayCircle } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import classroom from "../../../public/brand/sanady-classroom-portrait.jpg";

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
        <Image
          src={classroom}
          alt=""
          fill
          priority
          placeholder="blur"
          className="object-cover object-[50%_28%]"
          sizes="(min-width: 1024px) 54vw, 0px"
        />
        {/* Gradient guarantees readable white text over the photo. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(to_top,rgb(12_10_9/0.92)_0%,rgb(12_10_9/0.72)_30%,rgb(12_10_9/0.15)_58%,transparent_75%)]"
        />

        <Link href="/" className="relative w-fit rounded-2xl bg-white/95 px-5 py-3.5 shadow-sm backdrop-blur-sm">
          <BrandLogo className="h-12" priority />
        </Link>

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
