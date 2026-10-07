import { Mail, RotateCw, X } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { EmptyState } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/surface";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { formatDate, formatDateTime } from "@/lib/format";
import { INVITATION_KINDS } from "@/lib/labels";
import type { Invitation } from "@/lib/types";
import { reissueInvitation, revokeInvitation } from "@/server/actions/invitations";

export function invitationState(inv: Invitation): { label: string; tone: "success" | "warning" | "neutral" | "teal" | "danger" } {
  if (inv.accepted_at) return { label: "Acceptée", tone: "success" };
  if (inv.revoked_at) return { label: "Annulée", tone: "neutral" };
  if (new Date(inv.expires_at).getTime() <= Date.now()) return { label: "Expirée", tone: "warning" };
  return { label: inv.email_sent_at ? "Envoyée" : "En attente d’envoi", tone: "teal" };
}

/** Invitations with status and actions (re-send, cancel). */
export function InvitationTable({
  invitations,
  showKind = false,
  institutionNames,
}: {
  invitations: Invitation[];
  showKind?: boolean;
  institutionNames?: Record<string, string>;
}) {
  if (invitations.length === 0) {
    return <EmptyState compact icon={Mail} title="Aucune invitation" description="Les invitations envoyées apparaîtront ici." />;
  }
  return (
    <Table caption="Invitations">
      <THead>
        <tr>
          <TH>Destinataire</TH>
          {showKind ? <TH>Type</TH> : null}
          <TH>Statut</TH>
          <TH>Créée le</TH>
          <TH>Expiration</TH>
          <TH align="right">
            <span className="sr-only">Actions</span>
          </TH>
        </tr>
      </THead>
      <TBody>
        {invitations.map((inv) => {
          const state = invitationState(inv);
          const open = !inv.accepted_at && !inv.revoked_at;
          return (
            <TR key={inv.id}>
              <TD>
                <p className="font-medium text-ink-900">{inv.email}</p>
                {inv.enrollment_code_id ? <p className="text-caption text-ink-500">Demande via code d’inscription</p> : null}
              </TD>
              {showKind ? (
                <TD>
                  <p>{INVITATION_KINDS[inv.kind]}</p>
                  {inv.institution_id && institutionNames?.[inv.institution_id] ? (
                    <p className="text-caption text-ink-500">{institutionNames[inv.institution_id]}</p>
                  ) : null}
                </TD>
              ) : null}
              <TD>
                <Badge tone={state.tone}>{state.label}</Badge>
              </TD>
              <TD className="whitespace-nowrap">{formatDateTime(inv.created_at)}</TD>
              <TD className="whitespace-nowrap">{inv.accepted_at ? `Acceptée le ${formatDate(inv.accepted_at)}` : formatDate(inv.expires_at)}</TD>
              <TD align="right">
                {open ? (
                  <div className="flex justify-end gap-1">
                    {!inv.enrollment_code_id ? (
                      <ActionButton variant="ghost" action={reissueInvitation.bind(null, inv.id)}>
                        <RotateCw aria-hidden /> Renvoyer
                      </ActionButton>
                    ) : null}
                    <ActionButton
                      variant="danger-ghost"
                      action={revokeInvitation.bind(null, inv.id)}
                      confirm={{
                        title: "Annuler cette invitation ?",
                        description: `Le lien envoyé à ${inv.email} ne fonctionnera plus.`,
                        confirmLabel: "Annuler l’invitation",
                      }}
                    >
                      <X aria-hidden /> Annuler
                    </ActionButton>
                  </div>
                ) : null}
              </TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}
