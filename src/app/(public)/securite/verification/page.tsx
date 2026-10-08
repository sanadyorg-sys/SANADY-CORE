import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Smartphone } from "lucide-react";
import { MfaVerifyForm } from "@/components/auth/mfa-forms";
import { safeRedirectPath } from "@/lib/validation";
import { requireViewer } from "@/server/auth";

export const metadata: Metadata = { title: "Vérification en deux étapes" };

export default async function MfaVerifyPage(props: PageProps<"/securite/verification">) {
  const viewer = await requireViewer({ allowOnboarding: true, allowPendingMfa: true });
  const { suite } = await props.searchParams;
  const next = safeRedirectPath(suite, viewer.isSanadyAdmin ? "/admin" : "/espace");
  if (!viewer.mfaEnrolled) redirect(`/securite/activer?suite=${encodeURIComponent(next)}`);
  if (viewer.aal === "aal2") redirect(next);

  return (
    <>
      <div className="mb-5 flex size-14 items-center justify-center rounded-xl bg-accent-500 text-white shadow-sm">
        <Smartphone className="size-7" strokeWidth={1.8} aria-hidden />
      </div>
      <h1 className="text-[1.75rem] font-extrabold leading-tight tracking-[-0.02em] text-ink-900">Vérification en deux étapes</h1>
      <p className="mb-7 mt-1.5 text-body text-ink-600">Saisissez le code généré par votre application d’authentification.</p>
      <MfaVerifyForm suite={next} />
    </>
  );
}
