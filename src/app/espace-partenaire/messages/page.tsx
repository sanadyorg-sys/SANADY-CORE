import type { Metadata } from "next";
import { PortalMessageForm } from "@/components/partnerships/portal-forms";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { requirePartnerMember } from "@/server/auth";
import { portalOverview } from "@/server/queries/portal";

export const metadata: Metadata = { title: "Échanges — Espace partenaire" };

export default async function PartnerMessages() {
  await requirePartnerMember();
  const v = await portalOverview();
  const messages = v?.messages ?? [];
  return (
    <>
      <PageHeader
        title="Échanges avec la Fondation"
        description={v?.representative ? `Votre interlocuteur : ${v.representative}` : "Vos messages sont lus par l’équipe partenariats."}
      />
      <Card>
        <CardHeader title="Conversation" />
        <CardBody className="space-y-3">
          {messages.length ? (
            <ol className="space-y-3" aria-label="Messages">
              {messages.map((m) => (
                <li key={m.id} className={cn("max-w-[85%] rounded-2xl px-4 py-3", m.from_partner ? "ml-auto bg-accent-50" : "bg-ink-50")}>
                  <p className="whitespace-pre-line text-body text-ink-900">{m.body}</p>
                  <p className="mt-1 text-caption text-ink-500">
                    {m.author ?? (m.from_partner ? "Vous" : "Équipe SANADY")} · {formatDateTime(m.created_at)}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-body text-ink-600">Aucun message pour l’instant.</p>
          )}
        </CardBody>
        <CardBody className="border-t border-line">
          <PortalMessageForm />
        </CardBody>
      </Card>
    </>
  );
}
