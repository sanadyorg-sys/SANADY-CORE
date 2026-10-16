import type { Metadata } from "next";
import { Archive, MessagesSquare, Pencil, Plus, RotateCcw } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { TemplateForm } from "@/components/partnerships/template-forms";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Drawer } from "@/components/ui/overlay";
import { Alert, Badge, Card, PageHeader } from "@/components/ui/surface";
import { LinkTabs } from "@/components/ui/tabs";
import { formatRelative } from "@/lib/format";
import { TEMPLATE_CATEGORIES } from "@/lib/partnerships";
import { requirePartnershipStaff } from "@/server/auth";
import { setTemplateArchived } from "@/server/actions/templates";
import { listTemplates } from "@/server/queries/templates";

export const metadata: Metadata = { title: "Modèles de messages" };

const BASE = "/admin/partenariats/modeles";

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ onglet?: string }> }) {
  await requirePartnershipStaff();
  const archived = (await searchParams).onglet === "archives";
  const rows = await listTemplates({ archived });
  return (
    <>
      <PageHeader
        title="Modèles de messages"
        description="Textes réutilisables pour écrire aux partenaires : premier contact, accusé de réception, relance, renouvellement, rapport, remerciements."
        actions={
          <Drawer
            title="Nouveau modèle"
            width="max-w-xl"
            trigger={
              <Button>
                <Plus aria-hidden /> Nouveau modèle
              </Button>
            }
          >
            <div className="p-5">
              <TemplateForm />
            </div>
          </Drawer>
        }
      />
      <Alert tone="info" className="mb-4">
        Un message s’écrit depuis la fiche de l’organisation (« Écrire au partenaire ») : les champs entre {"{{ }}"} sont remplis, vous relisez, puis vous l’envoyez vous-même. Chaque message est ajouté à l’historique des échanges.
      </Alert>
      <LinkTabs
        className="mb-4"
        activeHref={archived ? `${BASE}?onglet=archives` : BASE}
        items={[
          { href: BASE, label: "Modèles actifs" },
          { href: `${BASE}?onglet=archives`, label: "Archivés" },
        ]}
      />
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={MessagesSquare} title={archived ? "Aucun modèle archivé" : "Aucun modèle"} description="Créez un modèle pour gagner du temps dans vos échanges avec les partenaires." />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((t) => (
            <Card key={t.id} className="flex flex-col p-5">
              <div>
                <Badge tone="neutral">{TEMPLATE_CATEGORIES[t.category]}</Badge>
                <h2 className="mt-2 text-section font-semibold text-ink-900">{t.title}</h2>
                <p className="mt-0.5 text-caption text-ink-500">Mis à jour {formatRelative(t.updated_at)}</p>
              </div>
              <p className="mt-3 text-label font-medium text-ink-800">{t.subject}</p>
              <p className="mt-1 line-clamp-4 whitespace-pre-line text-body text-ink-600">{t.body}</p>
              <div className="mt-4 flex flex-wrap justify-end gap-2 pt-1">
                {archived ? (
                  <ActionButton action={setTemplateArchived.bind(null, t.id, false)}>
                    <RotateCcw aria-hidden /> Rétablir
                  </ActionButton>
                ) : (
                  <>
                    <ActionButton variant="ghost" action={setTemplateArchived.bind(null, t.id, true)} confirm={{ title: "Archiver ce modèle ?", description: "Il ne sera plus proposé dans les messages. Vous pourrez le rétablir.", confirmLabel: "Archiver", tone: "primary" }}>
                      <Archive aria-hidden /> Archiver
                    </ActionButton>
                    <Drawer
                      title="Modifier le modèle"
                      width="max-w-xl"
                      trigger={
                        <Button variant="secondary" size="sm">
                          <Pencil aria-hidden /> Modifier
                        </Button>
                      }
                    >
                      <div className="p-5">
                        <TemplateForm template={t} />
                      </div>
                    </Drawer>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
