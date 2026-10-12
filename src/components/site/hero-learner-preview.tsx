"use client";

import { useEffect, useRef, useState } from "react";
import { Award, CheckCircle2, ClipboardCheck, FileText, PlayCircle } from "lucide-react";

const STEPS = [
  { icon: PlayCircle, label: "Vidéo d’introduction" },
  { icon: FileText, label: "Fiche pratique" },
  { icon: ClipboardCheck, label: "Évaluation du module" },
];

/**
 * Product preview in the hero (Pluralsight-style): a miniature of the teacher
 * space that plays once on load — the progress bar fills, the steps tick off,
 * then the certificate badge appears. Illustrative, labelled « Aperçu ».
 * Motion is CSS only (transform/opacity) and is skipped with reduced motion.
 * Below the fold (phones), the animation waits until the card is visible.
 */
export function HeroLearnerPreview({ courseTitle }: { courseTitle: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [waiting, setWaiting] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    setWaiting(true);
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setWaiting(false);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -15% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      aria-hidden
      data-wait={waiting || undefined}
      className="hero-preview w-[17.5rem] rounded-2xl border border-line bg-surface/95 p-4 shadow-xl backdrop-blur-sm sm:w-[19rem]"
    >
      <div className="flex items-center justify-between">
        <span className="text-caption font-semibold uppercase tracking-wider text-ink-500">Aperçu · Mon espace</span>
        <span className="hero-preview-pop rounded-full bg-accent-50 px-2 py-0.5 text-caption font-bold text-accent-800 [--i:0]">En cours</span>
      </div>
      <p className="mt-2 line-clamp-1 text-label font-bold text-ink-900">{courseTitle}</p>
      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-ink-100">
        <div className="hero-preview-bar h-full w-full rounded-full bg-accent-600" />
      </div>
      <ul className="mt-3 hidden space-y-1.5 sm:block">
        {STEPS.map((s, i) => (
          <li key={s.label} className="hero-preview-pop flex items-center gap-2 text-caption text-ink-700" style={{ "--i": i + 1 } as React.CSSProperties}>
            <s.icon className="size-3.5 text-ink-500" />
            <span className="flex-1">{s.label}</span>
            <CheckCircle2 className="size-4 text-success-600" />
          </li>
        ))}
      </ul>
      <div className="hero-preview-pop mt-3 flex items-center gap-2.5 rounded-xl bg-success-50 px-3 py-2 [--i:4]">
        <Award className="size-4 text-success-700" />
        <span className="text-caption font-semibold text-success-800">Certificat vérifiable par QR code</span>
      </div>
    </div>
  );
}
