import { displayName, formatDateTime } from "@/lib/format";
import type { HistoryEntry, Note } from "@/server/queries/partnerships";

/** Status changes, newest first (append-only in the database). */
export function HistoryList({ history, labels }: { history: HistoryEntry[]; labels: Record<string, string> }) {
  if (!history.length) return <p className="text-body text-ink-600">Aucun changement.</p>;
  return (
    <ol className="relative space-y-4 border-l border-line pl-5">
      {history.map((h) => (
        <li key={h.id} className="relative">
          <span aria-hidden className="absolute -left-[1.6rem] top-1.5 size-2.5 rounded-full border-2 border-surface bg-accent-600" />
          <p className="text-body font-medium text-ink-900">
            {h.from_status ? `${labels[h.from_status] ?? h.from_status} → ` : ""}
            {labels[h.to_status] ?? h.to_status}
          </p>
          <p className="text-caption text-ink-500">
            {formatDateTime(h.created_at)}
            {h.by ? ` · ${displayName(h.by)}` : " · Formulaire public"}
          </p>
          {h.note ? <p className="mt-1 whitespace-pre-line text-label text-ink-700">{h.note}</p> : null}
        </li>
      ))}
    </ol>
  );
}

/** Internal notes, newest first. */
export function NotesList({ notes }: { notes: Note[] }) {
  if (!notes.length) return <p className="text-body text-ink-600">Aucune note pour l’instant.</p>;
  return (
    <ul className="space-y-3">
      {notes.map((n) => (
        <li key={n.id} className="rounded-xl border border-line bg-ink-25 p-4">
          <p className="whitespace-pre-line text-body text-ink-800">{n.body}</p>
          <p className="mt-2 text-caption text-ink-500">
            {displayName(n.author)} · {formatDateTime(n.created_at)}
          </p>
        </li>
      ))}
    </ul>
  );
}
