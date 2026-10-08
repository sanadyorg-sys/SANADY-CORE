import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { MfaEnrollForm } from "@/components/auth/mfa-forms";
import { safeRedirectPath } from "@/lib/validation";
import { requireViewer } from "@/server/auth";

export const metadata: Metadata = { title: "Activer la double authentification" };

export default async function MfaEnrollPage(props: PageProps<"/securite/activer">) {
  const viewer = await requireViewer({ allowOnboarding: true, allowPendingMfa: true });
  const { suite } = await props.searchParams;
  const next = safeRedirectPath(suite, viewer.isSanadyAdmin ? "/admin" : "/espace/profil");
  if (viewer.mfaEnrolled && viewer.aal === "aal2") redirect(next);
  if (viewer.mfaEnrolled) redirect(`/securite/verification?suite=${encodeURIComponent(next)}`);

  return (
    <>
      <div className="mb-5 flex size-14 items-center justify-center rounded-xl bg-accent-500 text-white shadow-sm">
        <ShieldCheck className="size-7" strokeWidth={1.8} aria-hidden />
      </div>
      <h1 className="text-[1.75rem] font-extrabold leading-tight tracking-[-0.02em] text-ink-900">Double authentification</h1>
      <p className="mb-7 mt-1.5 text-body text-ink-600">
        {viewer.isSanadyAdmin
          ? "Obligatoire pour les administrateurs SANADY : un code temporaire, généré sur votre téléphone, protège votre compte même si votre mot de passe est dérobé."
          : "Protégez votre compte : à chaque connexion, un code temporaire généré sur votre téléphone vous sera demandé."}
      </p>
      <MfaEnrollForm suite={next} />
    </>
  );
}
