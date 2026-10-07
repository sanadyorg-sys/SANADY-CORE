import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";

/** Horizontally scrollable on small screens; header row stays readable. */
export function Table({ className, children, caption }: { className?: string; children: ReactNode; caption?: string }) {
  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <table className="w-full min-w-[640px] border-collapse text-left text-body">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="border-b border-line bg-ink-25">{children}</thead>;
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-line">{children}</tbody>;
}

export function TR({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("transition-colors hover:bg-ink-25", className)} {...props} />;
}

export function TH({ className, align, ...props }: ThHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" | "center" }) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap px-4 py-2.5 text-caption font-semibold uppercase tracking-wide text-ink-500",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      {...props}
    />
  );
}

export function TD({ className, align, ...props }: TdHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" | "center" }) {
  return (
    <td
      className={cn(
        "px-4 py-3 align-middle text-ink-800",
        align === "right" && "text-right tabular",
        align === "center" && "text-center",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Server-driven pagination (page number in the URL), so lists stay
 * shareable, bookmarkable and fast on large institutions.
 */
export function Pagination({
  page,
  pageSize,
  total,
  hrefFor,
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefFor: (page: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const linkClass =
    "inline-flex h-8 items-center gap-1 rounded-md border border-line-strong bg-surface px-2.5 text-label font-medium text-ink-700 hover:bg-ink-50";
  const disabledClass = "pointer-events-none opacity-45";

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
      <p className="text-label text-ink-500">
        <span className="tabular">{formatNumber(from)}</span>–<span className="tabular">{formatNumber(to)}</span> sur{" "}
        <span className="tabular">{formatNumber(total)}</span>
      </p>
      <div className="flex items-center gap-2">
        <Link
          href={hrefFor(page - 1)}
          aria-disabled={page <= 1}
          tabIndex={page <= 1 ? -1 : undefined}
          className={cn(linkClass, page <= 1 && disabledClass)}
        >
          <ChevronLeft className="size-4" aria-hidden />
          Précédent
        </Link>
        <span className="tabular text-label text-ink-600">
          Page {page} / {pages}
        </span>
        <Link
          href={hrefFor(page + 1)}
          aria-disabled={page >= pages}
          tabIndex={page >= pages ? -1 : undefined}
          className={cn(linkClass, page >= pages && disabledClass)}
        >
          Suivant
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
    </nav>
  );
}

/** Builds a URL preserving existing search params. */
export function withParams(path: string, params: Record<string, string | number | undefined | null>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const qs = sp.toString();
  return qs ? `${path}?${qs}` : path;
}
