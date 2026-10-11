"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Award,
  Clock,
  ExternalLink,
  HeartHandshake,
  Maximize2,
  Play,
  Sparkles,
  Users,
} from "lucide-react";
import classroomPoster from "../../../public/brand/sanady-student-classroom-1.jpg";

interface VideoSpotlightProps {
  id?: string;
  className?: string;
  initialTime?: number; // default 51
  showDetails?: boolean;
}

export function VideoSpotlight({
  id = "video-fondation",
  className = "",
  initialTime = 51,
  showDetails = true,
}: VideoSpotlightProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [startTime, setStartTime] = useState(initialTime);

  const youtubeVideoId = "1Ahl5WiRbZY";
  const embedSrc = `https://www.youtube-nocookie.com/embed/${youtubeVideoId}?autoplay=1&start=${startTime}&rel=0&modestbranding=1&playsinline=1`;

  return (
    <section id={id} className={`relative overflow-hidden bg-brand-900 py-16 text-white sm:py-24 ${className}`}>
      {/* Ambient background decoration */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-dots-light opacity-12" />
      <div aria-hidden className="pointer-events-none absolute -right-32 top-1/4 size-[34rem] rounded-full bg-accent-500/10 blur-3xl animate-aurora" />
      <div aria-hidden className="pointer-events-none absolute -left-32 bottom-0 size-[28rem] rounded-full bg-accent-600/10 blur-2xl animate-blob" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-accent-500/30 bg-accent-500/10 px-3.5 py-1 text-label font-bold uppercase tracking-wider text-accent-400">
            <Sparkles className="size-4" aria-hidden />
            <span>Film Institutionnel Officiel</span>
          </p>
          <h2 className="mt-3 text-[1.875rem] font-extrabold leading-tight tracking-tight sm:text-[2.5rem]">
            La Fondation SANADY en action
          </h2>
          <p className="mt-3 text-[1.0625rem] leading-relaxed text-brand-200">
            Découvrez en images l’impact concret de la Fondation auprès des élèves et des enseignants
            dans les écoles publiques du Maroc.
          </p>
        </div>

        {/* Video Player Card */}
        <div className="mt-10 mx-auto max-w-5xl">
          <div className="relative aspect-video overflow-hidden rounded-3xl border border-white/15 bg-black/60 shadow-2xl ring-1 ring-white/10">
            {isPlaying ? (
              <iframe
                src={embedSrc}
                title="Fondation SANADY — Film Institutionnel"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                className="size-full border-0"
              />
            ) : (
              <div className="group relative size-full cursor-pointer" onClick={() => setIsPlaying(true)}>
                <Image
                  src={classroomPoster}
                  alt="Aperçu vidéo Fondation Sanady"
                  fill
                  priority
                  placeholder="blur"
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  sizes="(min-width: 1280px) 1024px, 100vw"
                />
                {/* Dark gradient overlay */}
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/30 transition-opacity duration-300 group-hover:opacity-85"
                />

                {/* Central animated Play Button */}
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                  <button
                    type="button"
                    aria-label="Lancer la vidéo de la Fondation Sanady"
                    className="relative flex size-20 sm:size-24 items-center justify-center rounded-full bg-accent-600 text-white shadow-2xl transition duration-300 group-hover:scale-110 group-hover:bg-accent-500"
                  >
                    {/* Pulsing ring animation */}
                    <span
                      aria-hidden
                      className="absolute inset-0 -z-10 animate-ping rounded-full bg-accent-500/40 opacity-75"
                    />
                    <Play className="size-8 sm:size-10 translate-x-0.5 fill-white stroke-white" aria-hidden />
                  </button>

                  <div className="mt-5 max-w-lg">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-caption font-semibold text-accent-300 backdrop-blur-md">
                      <Clock className="size-3.5" aria-hidden /> Démarre à 0:51 · Durée ~3 min
                    </span>
                    <p className="mt-2 text-section font-bold text-white sm:text-[1.25rem]">
                      Regarder le reportage de terrain de la Fondation Sanady
                    </p>
                    <p className="mt-1 hidden text-caption text-brand-200 sm:block">
                      Cliquez pour démarrer la lecture instantanément
                    </p>
                  </div>
                </div>

                {/* Corner controls */}
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-caption font-medium text-brand-200 sm:bottom-6 sm:left-6 sm:right-6">
                  <span className="rounded-lg bg-black/60 px-2.5 py-1 backdrop-blur-sm">
                    Fondation SANADY · YouTube Officiel
                  </span>
                  <span className="flex items-center gap-1 rounded-lg bg-black/60 px-2.5 py-1 backdrop-blur-sm">
                    <Maximize2 className="size-3.5" aria-hidden /> Plein écran disponible
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Quick timeline playback toggles */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-2 text-caption text-brand-300">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-brand-200">Point de lecture :</span>
              <button
                type="button"
                onClick={() => {
                  setStartTime(51);
                  setIsPlaying(true);
                }}
                className={`rounded-lg px-2.5 py-1 transition ${
                  startTime === 51 && isPlaying
                    ? "bg-accent-600 font-bold text-white"
                    : "border border-white/10 bg-white/5 text-brand-200 hover:bg-white/15"
                }`}
              >
                0:51 (Moment fort recommandé)
              </button>
              <button
                type="button"
                onClick={() => {
                  setStartTime(0);
                  setIsPlaying(true);
                }}
                className={`rounded-lg px-2.5 py-1 transition ${
                  startTime === 0 && isPlaying
                    ? "bg-accent-600 font-bold text-white"
                    : "border border-white/10 bg-white/5 text-brand-200 hover:bg-white/15"
                }`}
              >
                0:00 (Depuis le début)
              </button>
            </div>

            <a
              href="https://www.youtube.com/watch?v=1Ahl5WiRbZY&t=51s"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-accent-300 underline-offset-4 hover:underline"
            >
              <span>Ouvrir sur YouTube</span>
              <ExternalLink className="size-3" aria-hidden />
            </a>
          </div>
        </div>

        {/* Supporting Pillars (Edraak / Pluralsight impact layout) */}
        {showDetails ? (
          <div className="mt-14 mx-auto max-w-5xl grid gap-5 sm:grid-cols-3">
            <div className="glow-card rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xs transition hover:border-accent-500/30 hover:bg-white/[0.07]">
              <span className="flex size-11 items-center justify-center rounded-xl bg-accent-500/20 text-accent-400">
                <HeartHandshake className="size-5" aria-hidden />
              </span>
              <h3 className="mt-3 text-card font-bold text-white">Depuis 2009 au service de l’école</h3>
              <p className="mt-1 text-caption leading-relaxed text-brand-200">
                La Fondation combat l’abandon et l’échec scolaires des élèves de l’école publique issus de milieux
                défavorisés, ruraux et péri-urbains.
              </p>
            </div>

            <div className="glow-card rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xs transition hover:border-accent-500/30 hover:bg-white/[0.07]">
              <span className="flex size-11 items-center justify-center rounded-xl bg-accent-500/20 text-accent-400">
                <Users className="size-5" aria-hidden />
              </span>
              <h3 className="mt-3 text-card font-bold text-white">Accompagnement des enseignants</h3>
              <p className="mt-1 text-caption leading-relaxed text-brand-200">
                Des centaines de professeurs du secteur public formés chaque année par nos superviseurs pédagogiques
                aux meilleures méthodes de remédiation active.
              </p>
            </div>

            <div className="glow-card rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xs transition hover:border-accent-500/30 hover:bg-white/[0.07]">
              <span className="flex size-11 items-center justify-center rounded-xl bg-accent-500/20 text-accent-400">
                <Award className="size-5" aria-hidden />
              </span>
              <h3 className="mt-3 text-card font-bold text-white">Plateforme de formation SANADY</h3>
              <p className="mt-1 text-caption leading-relaxed text-brand-200">
                Des modules en ligne courts, interactifs et gratuits, complétés par des évaluations formatives
                et des certificats vérifiables par QR code.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
