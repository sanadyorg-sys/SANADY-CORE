"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { ChevronLeft, ChevronRight, Minus, Plus, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressBar, Skeleton } from "@/components/ui/feedback";
import { createClient } from "@/lib/supabase/browser";
import type { ProgressUpdate } from "@/lib/types";

// Same-origin worker copied to /public at install time (scripts/copy-pdf-worker.mjs).
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const DWELL_MS = 3_000;
const FLUSH_INTERVAL_MS = 10_000;
const ZOOMS = [0.75, 1, 1.25, 1.5, 2];

/**
 * Integrated PDF reader (one page at a time, fit-to-width).
 * A page counts as consulted after being displayed for 3 seconds; opening the
 * document never completes the lesson on its own.
 */
export default function PdfReader({
  lessonId,
  url,
  pageCount,
  resumePage,
  initialViewed,
  completionThreshold,
  onProgress,
  trackProgress = true,
}: {
  lessonId: string;
  url: string;
  pageCount: number;
  resumePage: number;
  initialViewed: number[];
  completionThreshold: number;
  onProgress?: (update: ProgressUpdate) => void;
  /** False in administrator preview: nothing is recorded. */
  trackProgress?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [numPages, setNumPages] = useState(pageCount);
  const [page, setPage] = useState(Math.min(Math.max(1, resumePage || 1), pageCount));
  const [zoom, setZoom] = useState(1);
  const [viewed, setViewed] = useState<Set<number>>(() => new Set(initialViewed));
  const [loadError, setLoadError] = useState(false);
  const [pageInput, setPageInput] = useState(String(page));
  const pending = useRef<Set<number>>(new Set());
  const flushing = useRef(false);
  const lastSentPage = useRef(resumePage);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const flush = useCallback(async () => {
    if (!trackProgress || flushing.current) return;
    const pages = [...pending.current];
    if (pages.length === 0 && page === lastSentPage.current) return;
    flushing.current = true;
    const { data, error } = await createClient().rpc("record_document_progress", {
      p_lesson: lessonId,
      p_pages: pages,
      p_current_page: page,
    });
    flushing.current = false;
    if (error) return;
    const update = data as ProgressUpdate;
    pages.forEach((p) => pending.current.delete(p));
    lastSentPage.current = page;
    if (update.pages_viewed) setViewed((prev) => new Set([...prev, ...update.pages_viewed!]));
    onProgress?.(update);
  }, [lessonId, onProgress, page, trackProgress]);

  // Dwell timer: the current page is consulted after DWELL_MS on screen.
  const [rendered, setRendered] = useState(false);
  useEffect(() => {
    if (!rendered || viewed.has(page)) return;
    const timer = setTimeout(() => {
      pending.current.add(page);
      setViewed((prev) => new Set([...prev, page]));
    }, DWELL_MS);
    return () => clearTimeout(timer);
  }, [page, rendered, viewed]);

  useEffect(() => {
    const timer = setInterval(flush, FLUSH_INTERVAL_MS);
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [flush]);

  // Flush on unmount (leaving the lesson).
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);
  useEffect(() => () => void flushRef.current(), []);

  const goTo = (target: number) => {
    const next = Math.min(Math.max(1, target), numPages);
    setRendered(false);
    setPage(next);
    setPageInput(String(next));
    void flush();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    if (e.key === "ArrowRight" || e.key === "PageDown") {
      e.preventDefault();
      goTo(page + 1);
    } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
      e.preventDefault();
      goTo(page - 1);
    }
  };

  const ratio = viewed.size / numPages;
  const required = Math.ceil(completionThreshold * numPages);

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-ink-25 px-3 py-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => goTo(page - 1)} disabled={page <= 1} aria-label="Page précédente">
            <ChevronLeft />
          </Button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              goTo(Number(pageInput) || page);
            }}
            className="flex items-center gap-1.5 text-label text-ink-600"
          >
            <label htmlFor={`page-${lessonId}`} className="sr-only">
              Aller à la page
            </label>
            <input
              id={`page-${lessonId}`}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              className="tabular h-8 w-12 rounded-md border border-line-strong bg-surface text-center text-label"
            />
            <span className="tabular">/ {numPages}</span>
          </form>
          <Button variant="ghost" size="icon-sm" onClick={() => goTo(page + 1)} disabled={page >= numPages} aria-label="Page suivante">
            <ChevronRight />
          </Button>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setZoom((z) => ZOOMS[Math.max(0, ZOOMS.indexOf(z) - 1)]!)}
            disabled={zoom === ZOOMS[0]}
            aria-label="Zoom arrière"
          >
            <Minus />
          </Button>
          <span className="tabular w-12 text-center text-label text-ink-600">{Math.round(zoom * 100)} %</span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setZoom((z) => ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(z) + 1)]!)}
            disabled={zoom === ZOOMS.at(-1)}
            aria-label="Zoom avant"
          >
            <Plus />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => setZoom(1)} aria-label="Ajuster à la largeur" title="Ajuster à la largeur">
            <ScanLine />
          </Button>
        </div>
      </div>

      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        role="region"
        aria-label={`Document, page ${page} sur ${numPages}`}
        className="max-h-[78dvh] overflow-auto bg-ink-100 p-3 sm:p-6"
      >
        {loadError ? (
          <div className="py-16 text-center">
            <p className="text-card font-semibold text-ink-900">Le document n’a pas pu être chargé.</p>
            <p className="mt-1 text-body text-ink-500">Rechargez la page. Votre progression est conservée.</p>
          </div>
        ) : width > 0 ? (
          <Document
            file={url}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            onLoadError={() => setLoadError(true)}
            loading={<Skeleton className="mx-auto aspect-[1/1.41] w-full max-w-3xl" />}
            className="flex justify-center"
          >
            <Page
              pageNumber={page}
              width={Math.min(width - 24, 1100) * zoom}
              onRenderSuccess={() => setRendered(true)}
              loading={<Skeleton className="aspect-[1/1.41]" />}
              className="shadow-sm"
            />
          </Document>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line px-4 py-3">
        <div className="min-w-[180px] flex-1">
          <ProgressBar value={ratio} label="Pages consultées" size="sm" />
        </div>
        <p className="text-caption text-ink-500">
          Pages consultées : <span className="tabular font-medium text-ink-700">{viewed.size}</span>/{numPages}
          {" · "}validation après {required} page{required > 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
}
