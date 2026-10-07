import { Ban, Ticket } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { CopyButton } from "@/components/ui/copy-button";
import { EmptyState, ProgressBar } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/surface";
import { formatDate } from "@/lib/format";
import type { EnrollmentCode } from "@/lib/types";
import { revokeEnrollmentCodeAction } from "@/server/actions/enrollment-codes";

function codeState(c: EnrollmentCode) {
  if (c.revoked_at) return { label: "Désactivé", tone: "neutral" as const };
  if (new Date(c.expires_at).getTime() <= Date.now()) return { label: "Expiré", tone: "warning" as const };
  if (c.uses_count >= c.max_uses) return { label: "Complet", tone: "warning" as const };
  return { label: "Actif", tone: "success" as const };
}

export function EnrollmentCodeList({ codes, institutionId, joinUrl }: { codes: EnrollmentCode[]; institutionId: string; joinUrl: string }) {
  if (codes.length === 0) {
    return (
      <EmptyState
        compact
        icon={Ticket}
        title="Aucun code d’inscription"
        description="Un code permet à vos enseignants de rejoindre l’établissement eux-mêmes, sans invitation individuelle."
      />
    );
  }
  return (
    <ul className="divide-y divide-line">
      {codes.map((c) => {
        const state = codeState(c);
        const active = state.label === "Actif";
        return (
          <li key={c.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
            <div className="min-w-[200px] flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-section font-semibold tracking-[0.08em] text-ink-900">{c.code}</span>
                <Badge tone={state.tone}>{state.label}</Badge>
              </div>
              <p className="mt-0.5 text-caption text-ink-500">
                {c.label ? `${c.label} · ` : ""}Créé le {formatDate(c.created_at)} · expire le {formatDate(c.expires_at)}
              </p>
            </div>
            <div className="w-48">
              <ProgressBar value={c.uses_count / c.max_uses} label="Utilisations" size="sm" />
              <p className="tabular mt-1 text-caption text-ink-600">
                {c.uses_count} / {c.max_uses} inscription{c.max_uses > 1 ? "s" : ""}
              </p>
            </div>
            {active ? (
              <div className="flex gap-1">
                <CopyButton value={`${c.code}`} label="Copier le code" variant="ghost" />
                <CopyButton value={joinUrl} label="Copier le lien" variant="ghost" copiedLabel="Lien copié" />
                <ActionButton
                  variant="danger-ghost"
                  action={revokeEnrollmentCodeAction.bind(null, c.id, institutionId)}
                  confirm={{
                    title: `Désactiver le code ${c.code} ?`,
                    description: "Il ne pourra plus être utilisé. Les enseignants déjà inscrits restent membres de l’établissement.",
                    confirmLabel: "Désactiver",
                  }}
                >
                  <Ban aria-hidden /> Désactiver
                </ActionButton>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
