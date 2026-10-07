import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function ForgotPasswordPage() {
  return (
    <>
      <Link href="/connexion" className="mb-6 inline-flex items-center gap-1.5 text-label font-medium text-ink-600 hover:text-ink-900">
        <ArrowLeft className="size-4" aria-hidden /> Retour à la connexion
      </Link>
      <h1 className="text-title font-semibold text-ink-900">Mot de passe oublié</h1>
      <p className="mb-8 mt-1 text-body text-ink-600">
        Saisissez l’adresse e-mail de votre compte. Nous vous enverrons un lien pour définir un nouveau mot de passe.
      </p>
      <ForgotPasswordForm />
    </>
  );
}
