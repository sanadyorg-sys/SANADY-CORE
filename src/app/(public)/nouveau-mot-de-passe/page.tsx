import type { Metadata } from "next";
import Link from "next/link";
import { NewPasswordForm } from "@/components/auth/auth-forms";
import { Alert } from "@/components/ui/surface";
import { getViewer } from "@/server/auth";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

export default async function NewPasswordPage() {
  const viewer = await getViewer();
  return (
    <>
      <h1 className="text-title font-semibold text-ink-900">Définir un nouveau mot de passe</h1>
      <p className="mb-8 mt-1 text-body text-ink-600">Choisissez un mot de passe que vous n’utilisez sur aucun autre service.</p>
      {viewer ? (
        <NewPasswordForm />
      ) : (
        <Alert tone="warning" title="Lien expiré ou invalide">
          Ce lien de réinitialisation n’est plus valable. <Link href="/mot-de-passe-oublie">Refaire une demande</Link>.
        </Alert>
      )}
    </>
  );
}
