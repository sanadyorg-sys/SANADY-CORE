import type { Metadata } from "next";
import { CategoryManager, SettingsForm } from "@/components/admin/settings-forms";
import { ActionButton } from "@/components/common/action-button";
import { Alert, Card, CardBody, CardHeader, DescriptionList, PageHeader } from "@/components/ui/surface";
import { formatDateTime } from "@/lib/format";
import { serverEnv } from "@/lib/server-env";
import { requireSanadyAdmin } from "@/server/auth";
import { setPartnerPortal } from "@/server/actions/portal";
import { getCategories, getSettings } from "@/server/queries/admin";
import { portalEnabled } from "@/server/queries/portal";

export const metadata: Metadata = { title: "Paramètres" };

export default async function SettingsPage() {
  await requireSanadyAdmin();
  const [settings, categories, portal] = await Promise.all([getSettings(), getCategories(), portalEnabled()]);
  const emailConfigured = Boolean(serverEnv.resendApiKey);
  const muxConfigured = Boolean(serverEnv.mux);

  return (
    <>
      <PageHeader title="Paramètres" description={`Dernière modification le ${formatDateTime(settings.updated_at)}.`} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Card>
          <CardHeader title="Paramètres de la plateforme" />
          <CardBody>
            <SettingsForm settings={settings} />
          </CardBody>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Espace partenaire"
              description="Accès des organisations partenaires à leurs conventions, rapports et échanges (/espace-partenaire). À ouvrir sur autorisation de la Fondation."
            />
            <CardBody className="space-y-3">
              <p className="text-body text-ink-800">{portal ? "Activé : les contacts invités peuvent se connecter." : "Désactivé : aucun compte partenaire n’a accès."}</p>
              {portal ? (
                <ActionButton
                  variant="danger-ghost"
                  size="md"
                  action={setPartnerPortal.bind(null, false)}
                  confirm={{ title: "Désactiver l’espace partenaire ?", description: "Tous les partenaires perdent l’accès immédiatement ; rien n’est supprimé.", confirmLabel: "Désactiver" }}
                >
                  Désactiver l’espace partenaire
                </ActionButton>
              ) : (
                <ActionButton
                  variant="accent"
                  size="md"
                  action={setPartnerPortal.bind(null, true)}
                  confirm={{
                    title: "Activer l’espace partenaire ?",
                    description: "Confirmez que la Fondation a autorisé l’ouverture de comptes aux partenaires externes. Les responsables des partenariats pourront ensuite inviter des contacts.",
                    confirmLabel: "Activer",
                  }}
                >
                  Activer l’espace partenaire
                </ActionButton>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Catégories de formation" />
            <CardBody>
              <CategoryManager categories={categories} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Services externes" description="État de la configuration du serveur." />
            <CardBody className="py-1">
              <DescriptionList
                items={[
                  { term: "Envoi d’e-mails", value: emailConfigured ? "Configuré (Resend)" : "Non configuré" },
                  { term: "Vidéo adaptative", value: muxConfigured ? "Configurée (Mux, lecture signée)" : "Non configurée" },
                  { term: "Règles d’évaluation", value: "Seuil 70 % · 3 tentatives (fixées)" },
                ]}
              />
            </CardBody>
          </Card>
          {!emailConfigured ? (
            <Alert tone="warning" title="E-mails non configurés">
              Les invitations sont créées mais aucun e-mail n’est envoyé : les liens sont affichés à l’administrateur, et l’inscription
              par code est indisponible. Renseignez RESEND_API_KEY et EMAIL_FROM.
            </Alert>
          ) : null}
        </div>
      </div>
    </>
  );
}
