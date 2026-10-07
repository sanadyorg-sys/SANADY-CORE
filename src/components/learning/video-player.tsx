"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Gauge, Maximize, Minimize, Pause, Play, RotateCcw, RotateCw, Volume2, VolumeX } from "lucide-react";
import { Menu, MenuItem, MenuLabel } from "@/components/ui/overlay";
import { cn } from "@/lib/cn";
import { formatClock } from "@/lib/format";
import { createClient } from "@/lib/supabase/browser";
import type { ProgressUpdate } from "@/lib/types";

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];
const FLUSH_INTERVAL_MS = 15_000;
const BUCKETS = 100;

/**
 * Accessible HTML5 video player with resume, speed control and
 * deduplicated coverage tracking.
 *
 * Coverage model: the video is split into 100 buckets (1 % each). Only
 * buckets crossed during continuous playback are recorded — seeking never
 * marks content as watched, and replaying the same segment adds nothing.
 * The server merges buckets as a set and rejects implausible jumps.
 */
export function VideoPlayer({
  lessonId,
  source,
  resumePosition,
  initialBuckets,
  completionThreshold,
  onProgress,
  trackProgress = true,
}: {
  lessonId: string;
  source: { type: "mp4" | "hls"; url: string; poster?: string };
  resumePosition: number;
  initialBuckets: number[];
  completionThreshold: number;
  onProgress?: (update: ProgressUpdate) => void;
  /** False in administrator preview: nothing is recorded. */
  trackProgress?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pending = useRef<Set<number>>(new Set());
  const lastTime = useRef<number | null>(null);
  const seeking = useRef(false);
  const flushing = useRef(false);
  const lastSentPosition = useRef<number>(resumePosition);

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState(false);
  const [watched, setWatched] = useState<Set<number>>(() => new Set(initialBuckets));
  const [syncError, setSyncError] = useState(false);

  // ─── Source attachment (native MP4/HLS, or hls.js) ───────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let hls: { destroy(): void } | null = null;
    if (source.type === "hls" && !video.canPlayType("application/vnd.apple.mpegurl")) {
      let cancelled = false;
      import("hls.js").then(({ default: Hls }) => {
        if (cancelled) return;
        if (!Hls.isSupported()) {
          setError(true);
          return;
        }
        const instance = new Hls({ capLevelToPlayerSize: true });
        instance.loadSource(source.url);
        instance.attachMedia(video);
        instance.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal) setError(true);
        });
        hls = instance;
      });
      return () => {
        cancelled = true;
        hls?.destroy();
      };
    }
    video.src = source.url;
    return () => {
      video.removeAttribute("src");
      video.load();
    };
  }, [source.type, source.url]);

  // ─── Progress synchronisation ────────────────────────────────────────────
  const flush = useCallback(async () => {
    const video = videoRef.current;
    if (!trackProgress || !video || flushing.current) return;
    const position = Math.floor(video.currentTime || 0);
    const buckets = [...pending.current];
    if (buckets.length === 0 && Math.abs(position - lastSentPosition.current) < 5) return;

    flushing.current = true;
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("record_video_progress", {
      p_lesson: lessonId,
      p_buckets: buckets,
      p_position: position,
      p_duration: Math.floor(video.duration || 0) || null,
    });
    flushing.current = false;

    if (rpcError) {
      setSyncError(true);
      return; // Keep pending buckets; they are retried on the next flush.
    }
    setSyncError(false);
    buckets.forEach((b) => pending.current.delete(b));
    lastSentPosition.current = position;
    onProgress?.(data as ProgressUpdate);
  }, [lessonId, onProgress, trackProgress]);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(flush, FLUSH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [playing, flush]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      void flush();
    };
  }, [flush]);

  // ─── Fullscreen state ────────────────────────────────────────────────────
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // ─── Media events ────────────────────────────────────────────────────────
  const markRange = (from: number, to: number, d: number) => {
    const start = Math.max(0, Math.floor((from / d) * BUCKETS));
    const end = Math.min(BUCKETS - 1, Math.floor((to / d) * BUCKETS));
    let added = false;
    for (let b = start; b <= end; b++) {
      if (!watched.has(b) && !pending.current.has(b)) {
        pending.current.add(b);
        added = true;
      }
    }
    if (added) setWatched((prev) => new Set([...prev, ...pending.current]));
  };

  const onTimeUpdate = () => {
    const video = videoRef.current!;
    const t = video.currentTime;
    const d = video.duration;
    setTime(t);
    if (!d || !Number.isFinite(d)) return;
    if (!video.paused && !seeking.current && lastTime.current !== null) {
      const delta = t - lastTime.current;
      // Normal playback only: a forward step consistent with the speed.
      if (delta > 0 && delta <= 2 + 2 * video.playbackRate) markRange(lastTime.current, t, d);
    }
    lastTime.current = t;
  };

  const onLoadedMetadata = () => {
    const video = videoRef.current!;
    setDuration(video.duration);
    if (resumePosition > 5 && resumePosition < video.duration - 5) {
      video.currentTime = resumePosition;
    }
    lastTime.current = video.currentTime;
  };

  // ─── Controls ────────────────────────────────────────────────────────────
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => setError(true));
    else video.pause();
  };
  const seekBy = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(Math.max(0, video.currentTime + seconds), video.duration || 0);
  };
  const changeRate = (r: number) => {
    if (videoRef.current) videoRef.current.playbackRate = r;
    setRate(r);
  };
  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  };
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void containerRef.current?.requestFullscreen?.();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === "INPUT" && e.key !== " ") return;
    switch (e.key) {
      case " ":
      case "k":
        e.preventDefault();
        togglePlay();
        break;
      case "ArrowLeft":
        e.preventDefault();
        seekBy(-5);
        break;
      case "ArrowRight":
        e.preventDefault();
        seekBy(5);
        break;
      case "j":
        seekBy(-10);
        break;
      case "l":
        seekBy(10);
        break;
      case "m":
        toggleMute();
        break;
      case "f":
        toggleFullscreen();
        break;
    }
  };

  const coverage = watched.size / BUCKETS;
  const playedPct = duration ? (time / duration) * 100 : 0;

  return (
    <div>
      <div
        ref={containerRef}
        role="region"
        aria-label="Lecteur vidéo"
        tabIndex={0}
        onKeyDown={onKeyDown}
        className={cn(
          "group relative overflow-hidden bg-ink-900 focus-visible:outline-offset-4",
          fullscreen ? "flex h-full items-center" : "aspect-video rounded-lg",
        )}
      >
        <video
          ref={videoRef}
          poster={source.type === "hls" ? source.poster : undefined}
          playsInline
          preload="metadata"
          controlsList="nodownload"
          disablePictureInPicture={false}
          onContextMenu={(e) => e.preventDefault()}
          onClick={togglePlay}
          onPlay={() => setPlaying(true)}
          onPause={() => {
            setPlaying(false);
            void flush();
          }}
          onEnded={() => {
            setPlaying(false);
            void flush();
          }}
          onTimeUpdate={onTimeUpdate}
          onLoadedMetadata={onLoadedMetadata}
          onSeeking={() => {
            seeking.current = true;
          }}
          onSeeked={() => {
            seeking.current = false;
            lastTime.current = videoRef.current?.currentTime ?? null;
          }}
          onVolumeChange={() => {
            setMuted(videoRef.current?.muted ?? false);
            setVolume(videoRef.current?.volume ?? 1);
          }}
          onError={() => setError(true)}
          className="h-full w-full bg-black object-contain"
        />

        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink-900/90 p-6 text-center text-white">
            <p className="text-card font-semibold">La vidéo n’a pas pu être chargée.</p>
            <p className="max-w-sm text-label text-ink-300">Vérifiez votre connexion puis rechargez la page. Votre progression est conservée.</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-1 rounded-md bg-white px-3.5 py-2 text-label font-medium text-ink-900 hover:bg-ink-100"
            >
              Recharger
            </button>
          </div>
        ) : null}

        {!playing && !error ? (
          <button
            onClick={togglePlay}
            className="absolute left-1/2 top-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-brand-800 shadow-pop transition-transform hover:scale-105"
            aria-label={time > 0 ? "Reprendre la lecture" : "Lire la vidéo"}
          >
            <Play className="ml-1 size-7" fill="currentColor" aria-hidden />
          </button>
        ) : null}

        <div
          className={cn(
            "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-2 pt-10 text-white transition-opacity",
            playing ? "opacity-0 focus-within:opacity-100 group-hover:opacity-100" : "opacity-100",
          )}
        >
          <div className="relative mb-1 flex h-5 items-center">
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={Math.min(time, duration || 0)}
              onChange={(e) => {
                if (videoRef.current) videoRef.current.currentTime = Number(e.target.value);
              }}
              aria-label="Position de lecture"
              aria-valuetext={`${formatClock(time)} sur ${formatClock(duration)}`}
              className="video-range h-5 w-full cursor-pointer appearance-none bg-transparent"
              style={{ ["--played" as string]: `${playedPct}%` }}
            />
          </div>
          <div className="flex items-center gap-1">
            <ControlButton label={playing ? "Pause" : "Lecture"} onClick={togglePlay}>
              {playing ? <Pause className="size-5" fill="currentColor" /> : <Play className="size-5" fill="currentColor" />}
            </ControlButton>
            <ControlButton label="Reculer de 10 secondes" onClick={() => seekBy(-10)}>
              <RotateCcw className="size-[18px]" />
            </ControlButton>
            <ControlButton label="Avancer de 10 secondes" onClick={() => seekBy(10)}>
              <RotateCw className="size-[18px]" />
            </ControlButton>
            <ControlButton label={muted ? "Activer le son" : "Couper le son"} onClick={toggleMute}>
              {muted || volume === 0 ? <VolumeX className="size-[18px]" /> : <Volume2 className="size-[18px]" />}
            </ControlButton>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (videoRef.current) {
                  videoRef.current.volume = v;
                  videoRef.current.muted = v === 0;
                }
              }}
              aria-label="Volume"
              className="video-range hidden h-5 w-20 cursor-pointer appearance-none bg-transparent sm:block"
              style={{ ["--played" as string]: `${(muted ? 0 : volume) * 100}%` }}
            />
            <span className="tabular ml-2 text-caption text-white/90">
              {formatClock(time)} / {formatClock(duration)}
            </span>
            <div className="ml-auto flex items-center gap-1">
              <Menu
                trigger={
                  <button
                    className="flex h-8 items-center gap-1 rounded-md px-2 text-caption font-semibold hover:bg-white/15"
                    aria-label={`Vitesse de lecture : ${rate}×`}
                  >
                    <Gauge className="size-4" aria-hidden /> {rate}×
                  </button>
                }
              >
                <MenuLabel>Vitesse de lecture</MenuLabel>
                {SPEEDS.map((s) => (
                  <MenuItem key={s} onSelect={() => changeRate(s)}>
                    <span className={cn("tabular", s === rate && "font-semibold text-accent-700")}>
                      {s === 1 ? "Normale" : `${s}×`}
                    </span>
                  </MenuItem>
                ))}
              </Menu>
              <ControlButton label={fullscreen ? "Quitter le plein écran" : "Plein écran"} onClick={toggleFullscreen}>
                {fullscreen ? <Minimize className="size-[18px]" /> : <Maximize className="size-[18px]" />}
              </ControlButton>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-caption text-ink-500">
        <span>
          Contenu visionné : <span className="tabular font-medium text-ink-700">{Math.round(coverage * 100)} %</span>
          {" · "}la leçon est validée à {Math.round(completionThreshold * 100)} %
        </span>
        {syncError ? (
          <span role="status" className="text-warning-700">
            Synchronisation interrompue — nouvelle tentative automatique.
          </span>
        ) : (
          <span className="hidden sm:inline">Raccourcis : Espace (lecture), ← → (5 s), F (plein écran)</span>
        )}
      </div>
    </div>
  );
}

function ControlButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex size-8 items-center justify-center rounded-md hover:bg-white/15 focus-visible:outline-white"
    >
      {children}
    </button>
  );
}
