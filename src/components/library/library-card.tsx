import Link from "next/link";
import { BookMarked, ClipboardList, ExternalLink, FileText, GraduationCap, Presentation, type LucideIcon } from "lucide-react";
import { LIBRARY_KINDS, SCHOOL_LEVELS } from "@/lib/labels";
import type { LibraryKind } from "@/lib/types";
import type { LibraryItem } from "@/server/queries/library";

export const KIND_ICONS: Record<LibraryKind, LucideIcon> = {
  guide: BookMarked,
  support: Presentation,
  fiche: ClipboardList,
  reference: FileText,
  externe: ExternalLink,
};

/** One library resource; the whole card links to its page. */
export function LibraryCard({ item, href }: { item: LibraryItem; href: string }) {
  const Icon = KIND_ICONS[item.kind];
  return (
    <article className="group relative flex flex-col rounded-xl border border-line bg-surface p-5 shadow-xs transition hover:border-line-strong hover:shadow-md">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-700">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-caption font-semibold uppercase tracking-wider text-accent-700">{LIBRARY_KINDS[item.kind]}</p>
          <h3 className="mt-0.5 text-card font-semibold text-ink-900">
            <Link href={href} className="after:absolute after:inset-0 focus-visible:outline-none">
              {item.title}
            </Link>
          </h3>
        </div>
      </div>
      {item.description ? <p className="mt-3 line-clamp-2 text-body text-ink-600">{item.description}</p> : null}
      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-4">
        {item.levels.map((l) => (
          <span key={l} className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-caption font-medium text-ink-700">
            <GraduationCap className="size-3" aria-hidden /> {SCHOOL_LEVELS[l]}
          </span>
        ))}
        {item.subject ? <span className="rounded-full bg-ink-100 px-2 py-0.5 text-caption font-medium text-ink-700">{item.subject}</span> : null}
      </div>
      <p className="mt-3 border-t border-line pt-3 text-caption text-ink-500">
        {item.source_label}
        {item.published_year ? ` · ${item.published_year}` : ""}
        {item.external_url ? " · lien externe" : item.page_count ? ` · ${item.page_count} p.` : ""}
      </p>
    </article>
  );
}
