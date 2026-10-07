"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useRef } from "react";
import { Alert } from "@/components/ui/surface";
import { Skeleton } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import type { ProgressUpdate } from "@/lib/types";
import { VideoPlayer } from "./video-player";

const PdfReader = dynamic(() => import("./pdf-reader"), {
  ssr: false,
  loading: () => <Skeleton className="aspect-[1/1.2] w-full" />,
});

export type LessonMedia =
  | { kind: "video"; source: { type: "mp4" | "hls"; url: string; poster?: string } }
  | { kind: "pdf"; url: string; pageCount: number }
  | { kind: "unavailable"; message: string };

/**
 * Hosts the lesson media and reacts to progress updates from the server
 * (completion notice, curriculum refresh, certificate announcement).
 * In preview mode (administrators) no progress is recorded.
 */
export function LessonExperience({
  lessonId,
  media,
  resumePosition,
  watchedBuckets,
  pagesViewed,
  completionThreshold,
  preview = false,
}: {
  lessonId: string;
  media: LessonMedia;
  resumePosition: number;
  watchedBuckets: number[];
  pagesViewed: number[];
  completionThreshold: number;
  preview?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const announced = useRef(false);

  const onProgress = useCallback(
    (update: ProgressUpdate) => {
      if (update.lesson_completed_now && !announced.current) {
        announced.current = true;
        toast({ tone: "success", title: "Leçon terminée", description: "Votre progression a été enregistrée." });
        router.refresh();
      }
      if (update.certificate_issued) {
        toast({
          tone: "success",
          title: "Formation terminée",
          description: "Félicitations ! Votre certificat est disponible dans « Mes certificats ».",
        });
      }
    },
    [router, toast],
  );

  if (media.kind === "unavailable") {
    return <Alert tone="warning" title="Contenu indisponible">{media.message}</Alert>;
  }

  if (media.kind === "video") {
    return (
      <VideoPlayer
        lessonId={lessonId}
        source={media.source}
        resumePosition={preview ? 0 : resumePosition}
        initialBuckets={watchedBuckets}
        completionThreshold={completionThreshold}
        onProgress={preview ? undefined : onProgress}
        trackProgress={!preview}
      />
    );
  }

  return (
    <PdfReader
      lessonId={lessonId}
      url={media.url}
      pageCount={media.pageCount}
      resumePage={preview ? 1 : resumePosition}
      initialViewed={pagesViewed}
      completionThreshold={completionThreshold}
      onProgress={preview ? undefined : onProgress}
      trackProgress={!preview}
    />
  );
}
