import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock, TicketCheck } from "lucide-react";
import { SignInForm } from "@/components/auth/auth-forms";
import { buttonClasses } from "@/components/ui/button";
import { getViewer, homeFor } from "@/server/auth";

export const metadata: Metadata = { title: "Connexion" };

const NOTICES: Record<string, string> = {
  compte_suspendu: "Votre compte est suspendu. Contactez l’administration SANADY pour plus d’informations.",
  session: "Votre session a expiré. Veuillez vous reconnecter.",
  mot_de_passe: "Votre mot de passe a été mis à jour. Vous pouvez vous connecter.",
};

export default async function SignInPage(props: PageProps<"/connexion">) {
  const searchParams = await props.searchParams;
  const viewer = await getViewer();
  if (viewer && viewer.profile.status === "active") redirect(homeFor(viewer));

  const suite = typeof searchParams.suite === "string" ? searchParams.suite : undefined;
  const motif = typeof searchParams.motif === "string" ? NOTICES[searchParams.motif] : undefined;

  return (
    <>
      <div className="mb-5 flex size-14 items-center justify-center rounded-xl bg-accent-600 text-white shadow-sm">
        <Lock className="size-7" strokeWidth={1.8} aria-hidden />
      </div>
      <h1 className="text-[1.875rem] font-extrabold leading-tight tracking-[-0.02em] text-ink-900">Bienvenue sur SANADY</h1>
      <p className="mb-8 mt-1.5 text-[1.0625rem] text-ink-600">Connectez-vous à votre espace de formation.</p>

      <SignInForm suite={suite} notice={motif} />

      <div className="my-7 h-px bg-line" />

      <section aria-labelledby="code-title" className="rounded-xl border border-line bg-ink-25 px-5 py-5 text-center">
        <h2 id="code-title" className="flex items-center justify-center gap-2.5 text-card font-semibold text-ink-900">
          <TicketCheck className="size-6 text-accent-600" strokeWidth={1.7} aria-hidden />
          Vous avez un code d’inscription&nbsp;?
        </h2>
        <Link href="/rejoindre" className={buttonClasses({ variant: "accent-outline", size: "lg", className: "mt-4 w-full" })}>
          Rejoindre avec un code
        </Link>
      </section>

      <p className="mt-5 text-label text-ink-500">L’accès à la plateforme se fait uniquement sur invitation.</p>
    </>
  );
}
