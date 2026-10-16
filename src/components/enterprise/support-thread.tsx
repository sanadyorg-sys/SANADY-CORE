import { Lock } from "lucide-react";
import { cn } from "@/lib/cn";
import { displayName, formatDateTime } from "@/lib/format";
import type { SupportMessage } from "@/server/queries/support";

/** Conversation of a support request. Internal notes are only ever returned to the team (RLS). */
export function SupportThread({ messages, team }: { messages: SupportMessage[]; team: boolean }) {
  return (
    <ol className="space-y-3">
      {messages.map((m) => {
        const who = m.from_team ? (team && m.author ? displayName(m.author) : "Équipe SANADY") : m.author ? displayName(m.author) : "Entreprise";
        return (
          <li
            key={m.id}
            className={cn(
              "rounded-xl border px-4 py-3",
              m.internal ? "border-warning-200 bg-warning-50" : m.from_team ? "border-line bg-ink-50" : "border-line bg-surface",
            )}
          >
            <p className="flex flex-wrap items-center gap-x-2 text-caption text-ink-500">
              <span className="font-semibold text-ink-800">{who}</span>
              {m.from_team && team ? <span>· équipe</span> : null}
              {m.internal ? (
                <span className="inline-flex items-center gap-1 font-medium text-warning-700">
                  <Lock className="size-3" aria-hidden /> Note interne
                </span>
              ) : null}
              <span>· {formatDateTime(m.created_at)}</span>
            </p>
            <p className="mt-1.5 whitespace-pre-line text-body text-ink-800">{m.body}</p>
          </li>
        );
      })}
    </ol>
  );
}
