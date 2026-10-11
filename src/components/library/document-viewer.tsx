"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { ChevronLeft, ChevronRight, Minus, Plus, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/feedback";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const ZOOMS = [0.75, 1, 1.25, 1.5, 2];

/**
 * Read-only PDF viewer for library resources: page navigation (buttons,
 * page field, arrow keys), zoom, fit to width. Nothing is recorded.
 */
export default function DocumentViewer({ url, title, pageCount }: { url: string; title: string; pageCount?: number | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [numPages, setNumPages] = useState(pageCount ?? 1);
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [zoom, setZoom] = useState(1);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const goTo = (target: number) => {
    const next = Math.min(Math.max(1, target), numPages);
    setPage(next);
    setPageInput(String(next));
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
            <label htmlFor="document-page" className="sr-only">
              Aller à la page
            </label>
            <input
              id="document-page"
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
        aria-label={`${title}, page ${page} sur ${numPages}`}
        className="max-h-[78dvh] overflow-auto bg-ink-100 p-3 sm:p-6"
      >
        {loadError ? (
          <div className="py-16 text-center">
            <p className="text-card font-semibold text-ink-900">Le document n’a pas pu être chargé.</p>
            <p className="mt-1 text-body text-ink-500">Rechargez la page pour réessayer.</p>
          </div>
        ) : width > 0 ? (
          <Document
            file={url}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            onLoadError={() => setLoadError(true)}
            loading={<Skeleton className="mx-auto aspect-[1/1.41] w-full max-w-3xl" />}
            className="flex justify-center"
          >
            <Page pageNumber={page} width={Math.min(width - 24, 1100) * zoom} loading={<Skeleton className="aspect-[1/1.41]" />} className="shadow-sm" />
          </Document>
        ) : null}
      </div>
    </div>
  );
}
