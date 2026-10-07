"use client";

import { useRef, useState } from "react";
import { UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { formatBytes } from "@/lib/media";
import type { ActionState } from "@/lib/types";
import { uploadToStorage, type UploadHandle } from "@/lib/upload";

/**
 * Drag-and-drop uploader with progress and cancellation. After the upload,
 * `onUploaded` registers the file server-side (which validates it).
 */
export function FileUploader({
  bucket,
  accept,
  maxBytes,
  buildPath,
  onUploaded,
  label,
  hint,
}: {
  bucket: "course-media" | "course-covers";
  accept: string;
  maxBytes: number;
  buildPath: (file: File) => string;
  onUploaded: (path: string, file: File) => Promise<ActionState>;
  label: string;
  hint: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handle = useRef<UploadHandle | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const toast = useToast();

  const accepted = accept.split(",").map((a) => a.trim());
  const start = async (file: File) => {
    setError(null);
    if (!accepted.some((a) => (a.endsWith("/*") ? file.type.startsWith(a.slice(0, -1)) : file.type === a))) {
      setError("Format de fichier non pris en charge.");
      return;
    }
    if (file.size > maxBytes) {
      setError(`Fichier trop volumineux (maximum ${formatBytes(maxBytes)}).`);
      return;
    }
    const path = buildPath(file);
    setFileName(file.name);
    setProgress(0);
    handle.current = uploadToStorage({ bucket, path, file, onProgress: setProgress });
    try {
      await handle.current.promise;
      setProgress(1);
      const res = await onUploaded(path, file);
      if (res.ok) toast({ tone: "success", title: res.message ?? "Fichier enregistré." });
      else setError(res.message ?? "Le fichier n’a pas pu être enregistré.");
    } catch (err) {
      setError(err instanceof Error && err.message.includes("annulé") ? "Téléversement annulé." : "Le téléversement a échoué. Vérifiez votre connexion et réessayez.");
    } finally {
      setProgress(null);
      setFileName(null);
      handle.current = null;
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const uploading = progress !== null;

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!uploading) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file && !uploading) void start(file);
        }}
        className={cn(
          "rounded-lg border border-dashed px-5 py-6 text-center transition-colors",
          dragging ? "border-teal-600 bg-teal-50/60" : "border-line-strong bg-ink-25",
        )}
      >
        {uploading ? (
          <div className="mx-auto max-w-md space-y-3 text-left">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-body font-medium text-ink-800">{fileName}</p>
              <Button variant="ghost" size="icon-sm" aria-label="Annuler le téléversement" onClick={() => handle.current?.abort()}>
                <X />
              </Button>
            </div>
            <ProgressBar value={progress ?? 0} label="Progression du téléversement" showValue />
            <p className="text-caption text-ink-500">Vous pouvez continuer à travailler ; ne fermez pas cet onglet.</p>
          </div>
        ) : (
          <>
            <UploadCloud className="mx-auto size-6 text-ink-400" aria-hidden />
            <p className="mt-2 text-body font-medium text-ink-800">{label}</p>
            <p className="mt-0.5 text-caption text-ink-500">{hint}</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => inputRef.current?.click()}>
              Choisir un fichier
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept={accept}
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void start(file);
              }}
            />
          </>
        )}
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-label font-medium text-danger-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
