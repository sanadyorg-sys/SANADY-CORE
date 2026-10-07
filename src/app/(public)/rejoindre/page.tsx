import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RedeemCodeForm, RequestJoinForm } from "@/components/auth/join-forms";
import { getViewer } from "@/server/auth";

export const metadata: Metadata = { title: "Rejoindre un établissement" };

export default async function JoinPage() {
  const viewer = await getViewer();
  return (
    <>
      <Link
        href={viewer ? "/espace/profil" : "/connexion"}
        className="mb-6 inline-flex items-center gap-1.5 text-label font-medium text-ink-600 hover:text-ink-900"
      >
        <ArrowLeft className="size-4" aria-hidden /> {viewer ? "Retour à mon profil" : "Retour à la connexion"}
      </Link>
      <h1 className="text-title font-semibold text-ink-900">Rejoindre un établissement</h1>
      <p className="mb-8 mt-1 text-body text-ink-600">
        {viewer
          ? "Saisissez le code d’inscription remis par votre établissement pour l’associer à votre compte."
          : "Saisissez le code d’inscription remis par votre établissement. Si vous avez déjà un compte SANADY, vous pourrez l’utiliser."}
      </p>
      {viewer ? <RedeemCodeForm /> : <RequestJoinForm />}
    </>
  );
}
