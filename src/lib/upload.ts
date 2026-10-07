"use client";

import { Upload } from "tus-js-client";
import { createClient } from "@/lib/supabase/browser";

const CHUNK_SIZE = 6 * 1024 * 1024; // Required by Supabase resumable uploads.

export interface UploadHandle {
  promise: Promise<void>;
  abort: () => void;
}

/**
 * Resumable (TUS) upload to Supabase Storage with the administrator's
 * session. Storage RLS decides whether the upload is allowed. Interrupted
 * uploads resume automatically; large videos are supported.
 */
export function uploadToStorage({
  bucket,
  path,
  file,
  onProgress,
}: {
  bucket: "course-media" | "course-covers";
  path: string;
  file: File;
  onProgress?: (ratio: number) => void;
}): UploadHandle {
  let upload: Upload | null = null;
  let aborted = false;

  const promise = (async () => {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Session expirée : reconnectez-vous.");

    await new Promise<void>((resolve, reject) => {
      upload = new Upload(file, {
        endpoint: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/upload/resumable`,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: { authorization: `Bearer ${token}`, "x-upsert": "false" },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        chunkSize: CHUNK_SIZE,
        metadata: {
          bucketName: bucket,
          objectName: path,
          contentType: file.type || "application/octet-stream",
          cacheControl: "3600",
        },
        onError: (error) => reject(error),
        onProgress: (sent, total) => onProgress?.(total ? sent / total : 0),
        onSuccess: () => resolve(),
      });
      if (aborted) return reject(new Error("Téléversement annulé."));
      upload.findPreviousUploads().then((previous) => {
        if (previous[0]) upload!.resumeFromPreviousUpload(previous[0]);
        upload!.start();
      });
    });
  })();

  return {
    promise,
    abort: () => {
      aborted = true;
      void (upload as Upload | null)?.abort(true);
    },
  };
}

/** Safe object name: keeps the extension, removes accents and spaces. */
export function safeFileName(name: string) {
  const dot = name.lastIndexOf(".");
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
    .toLowerCase();
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const id = crypto.randomUUID().slice(0, 8);
  return `${id}-${base || "fichier"}${ext ? `.${ext}` : ""}`;
}

/** Reads a local video file's duration (seconds) without uploading it. */
export function readVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const d = Number.isFinite(video.duration) ? Math.round(video.duration) : null;
      URL.revokeObjectURL(url);
      resolve(d && d > 0 ? d : null);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    video.src = url;
  });
}
