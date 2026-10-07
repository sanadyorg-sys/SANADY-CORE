import type { Metadata } from "next";
import { CategoryManager, SettingsForm } from "@/components/admin/settings-forms";
import { Alert, Card, CardBody, CardHeader, DescriptionList, PageHeader } from "@/components/ui/surface";
import { formatDateTime } from "@/lib/format";
import { serverEnv } from "@/lib/server-env";
import { requireSanadyAdmin } from "@/server/auth";
import { getCategories, getSettings } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Paramètres" };

export default async function SettingsPage() {
  await requireSanadyAdmin();
  const [settings, categories] = await Promise.all([getSettings(), getCategories()]);
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
