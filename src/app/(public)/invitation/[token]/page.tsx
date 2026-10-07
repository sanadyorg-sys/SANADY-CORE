import type { Metadata } from "next";
import Link from "next/link";
import { ExistingAccountInvitationForm, NewAccountInvitationForm } from "@/components/auth/invitation-forms";
import { buttonClasses } from "@/components/ui/button";
import { Alert } from "@/components/ui/surface";
import { formatDate } from "@/lib/format";
import { INVITATION_KINDS } from "@/lib/labels";
import { getViewer } from "@/server/auth";
import { describeInvitation } from "@/server/queries/invitations";

export const metadata: Metadata = { title: "Invitation", referrer: "no-referrer" };

function Heading({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <>
      <h1 className="text-title font-semibold text-ink-900">{title}</h1>
      {children ? <div className="mb-8 mt-1 text-body text-ink-600">{children}</div> : <div className="mb-6" />}
    </>
  );
}

export default async function InvitationPage(props: PageProps<"/invitation/[token]">) {
  const { token } = await props.params;
  const invitation = await describeInvitation(token);

  if (invitation === "rate_limited") {
    return (
      <>
        <Heading title="Invitation" />
        <Alert tone="warning">Trop de tentatives. Veuillez patienter quelques minutes avant de réessayer.</Alert>
      </>
    );
  }

  if (!invitation || invitation.state !== "valid") {
    const messages = {
      invalid: { title: "Lien d’invitation invalide", body: "Ce lien n’est pas reconnu. Vérifiez qu’il a été copié en entier." },
      expired: {
        title: "Invitation expirée",
        body: "Cette invitation n’est plus valable. Demandez une nouvelle invitation à la personne qui vous l’a adressée.",
      },
      revoked: { title: "Invitation annulée", body: "Cette invitation a été annulée ou remplacée par une invitation plus récente." },
      accepted: { title: "Invitation déjà utilisée", body: "Cette invitation a déjà été acceptée. Connectez-vous avec votre compte." },
    } as const;
    const m = messages[(invitation?.state ?? "invalid") as keyof typeof messages];
    return (
      <>
        <Heading title={m.title} />
        <Alert tone={invitation?.state === "accepted" ? "info" : "warning"}>{m.body}</Alert>
        <Link href="/connexion" className={buttonClasses({ variant: "secondary", className: "mt-6 w-full" })}>
          Aller à la connexion
        </Link>
      </>
    );
  }

  const viewer = await getViewer();
  const needsConsent = invitation.kind === "institution_teacher";
  const scope = invitation.institution_name ? ` · ${invitation.institution_name}` : "";
  const intro = (
    <p>
      Invitation : <strong className="font-medium text-ink-900">{INVITATION_KINDS[invitation.kind]}</strong>
      {scope}. Valable jusqu’au {formatDate(invitation.expires_at)}.
    </p>
  );

  // Signed in with the invited address → one-click acceptance.
  if (viewer && viewer.email === invitation.email) {
    return (
      <>
        <Heading title="Accepter l’invitation">{intro}</Heading>
        <ExistingAccountInvitationForm
          token={token}
          institutionName={invitation.institution_name}
          needsConsent={needsConsent}
          label="Accepter l’invitation"
        />
      </>
    );
  }

  // Signed in with another address.
  if (viewer) {
    return (
      <>
        <Heading title="Accepter l’invitation">{intro}</Heading>
        <Alert tone="warning" title="Adresse différente">
          Cette invitation a été adressée à {invitation.email}, mais vous êtes connecté(e) avec {viewer.email}.
        </Alert>
        <Link
          href={`/deconnexion`}
          className={buttonClasses({ variant: "secondary", className: "mt-6 w-full" })}
          prefetch={false}
        >
          Se déconnecter
        </Link>
      </>
    );
  }

  // Existing account, not signed in → sign in first, then come back.
  if (invitation.account_exists) {
    return (
      <>
        <Heading title="Accepter l’invitation">{intro}</Heading>
        <Alert tone="info">
          Un compte SANADY existe déjà pour {invitation.email}. Connectez-vous pour accepter l’invitation.
        </Alert>
        <Link
          href={`/connexion?suite=${encodeURIComponent(`/invitation/${token}`)}`}
          className={buttonClasses({ size: "lg", className: "mt-6 w-full" })}
        >
          Se connecter pour continuer
        </Link>
      </>
    );
  }

  return (
    <>
      <Heading title="Activer votre compte">{intro}</Heading>
      <NewAccountInvitationForm
        token={token}
        email={invitation.email}
        institutionName={invitation.institution_name}
        needsConsent={needsConsent}
      />
    </>
  );
}
