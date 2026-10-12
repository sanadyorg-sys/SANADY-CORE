import { Download, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { Badge } from "@/components/ui/surface";
import { formatDateTime } from "@/lib/format";
import { DOCUMENT_KINDS } from "@/lib/partnerships";
import { deleteDocument } from "@/server/actions/agreements";
import type { DocumentRow } from "@/server/queries/agreements";

/** Documents of an agreement or a contribution (opened through a 60-second signed link). */
export function DocumentList({
  documents,
  target,
  targetId,
  canDelete,
}: {
  documents: DocumentRow[];
  target: "agreement" | "contribution";
  targetId: string;
  canDelete: (d: DocumentRow) => boolean;
}) {
  if (!documents.length) return <p className="text-body text-ink-600">Aucun document.</p>;
  return (
    <ul className="divide-y divide-line rounded-xl border border-line">
      {documents.map((d) => (
        <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-body font-medium text-ink-900">
              <span className="truncate">{d.file_name}</span>
              <Badge tone={d.kind === "signed" || d.kind === "evidence" ? "success" : "neutral"}>{DOCUMENT_KINDS[d.kind]}</Badge>
            </p>
            <p className="text-caption text-ink-500">
              {Math.max(1, Math.round(d.file_size / 1024))} Ko · {formatDateTime(d.created_at)}
            </p>
          </div>
          <div className="flex gap-1">
            <a
              href={`/api/partenariats/documents/${d.id}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong px-3 text-label text-ink-800 hover:bg-ink-50"
            >
              <Download className="size-3.5" aria-hidden /> Télécharger
            </a>
            {canDelete(d) ? (
              <ActionButton
                variant="danger-ghost"
                action={deleteDocument.bind(null, d.id, target, targetId)}
                confirm={{ title: "Supprimer ce document ?", description: `« ${d.file_name} » sera supprimé définitivement.`, confirmLabel: "Supprimer" }}
              >
                <Trash2 aria-hidden /> <span className="sr-only">Supprimer {d.file_name}</span>
              </ActionButton>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
