import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/auth-forms";
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
      <h1 className="text-title font-semibold text-ink-900">Connexion</h1>
      <p className="mb-8 mt-1 text-body text-ink-600">Accédez à votre espace de formation SANADY.</p>
      <SignInForm suite={suite} notice={motif} />
      <div className="mt-8 border-t border-line pt-6 text-body text-ink-600">
        <p>
          L’accès à SANADY se fait uniquement sur invitation. Votre établissement vous a remis un code d’inscription ?{" "}
          <Link href="/rejoindre" className="font-medium text-teal-700 hover:underline">
            Rejoindre avec un code
          </Link>
        </p>
      </div>
    </>
  );
}
