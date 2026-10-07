import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Confidentialité et données personnelles" };

/*
 * Information notice for learners and institutions.
 * LEGAL REVIEW REQUIRED before production: the data controller's legal
 * identity, the CNDP declaration/authorization references (Law No. 09-08)
 * and the retention periods below must be confirmed by the operator.
 * See docs/security-and-privacy.md.
 */
export default async function PrivacyPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("public_platform_info");
  const info = data as { issuer?: string; support_email?: string | null } | null;
  const operator = info?.issuer ?? "SANADY";
  const contact = info?.support_email;

  return (
    <div className="min-h-dvh bg-surface">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link href="/" className="rounded-sm">
            <Wordmark className="text-lg" />
          </Link>
          <Link href="/" className="text-label font-medium text-teal-700 hover:underline">
            Retour à la plateforme
          </Link>
        </div>
      </header>
      <main id="contenu" className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-display font-semibold text-ink-900">Confidentialité et données personnelles</h1>
        <p className="mt-3 text-reading text-ink-600">
          Cette notice explique quelles données SANADY traite, pourquoi, et qui peut les consulter. Elle s’adresse aux enseignants
          et aux établissements utilisateurs de la plateforme.
        </p>

        <div className="mt-10 space-y-10 text-reading text-ink-700 [&_h2]:mb-3 [&_h2]:text-section [&_h2]:font-semibold [&_h2]:text-ink-900 [&_li]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-6">
          <section>
            <h2>1. Responsable du traitement</h2>
            <p>
              Les données sont traitées par{" "}
              {operator === "SANADY" ? "l’opérateur de la plateforme SANADY" : `${operator}, opérateur de la plateforme SANADY`}, dans le
              respect de la loi n° 09-08
              relative à la protection des personnes physiques à l’égard du traitement des données à caractère personnel.
              {contact ? (
                <>
                  {" "}
                  Contact : <a href={`mailto:${contact}`} className="font-medium text-teal-700 underline">{contact}</a>.
                </>
              ) : null}
            </p>
          </section>

          <section>
            <h2>2. Données traitées</h2>
            <ul>
              <li>Identité et contact : nom, prénom, adresse e-mail, fonction et discipline (facultatives).</li>
              <li>Affiliations : établissements auxquels vous êtes rattaché(e) et date de votre accord.</li>
              <li>
                Suivi pédagogique : leçons commencées et terminées, couverture des vidéos et des documents consultés, position de
                reprise.
              </li>
              <li>Évaluations : réponses soumises, scores, nombre de tentatives.</li>
              <li>Certificats : numéro, date d’obtention, formation concernée.</li>
              <li>Sécurité : journaux techniques de connexion et d’administration.</li>
            </ul>
            <p className="mt-3">
              Le suivi du visionnage mesure une activité (portions de vidéo lues, pages affichées). Il ne mesure ni l’attention ni la
              compréhension, et n’est jamais utilisé pour évaluer automatiquement vos compétences.
            </p>
          </section>

          <section>
            <h2>3. Finalités</h2>
            <ul>
              <li>Vous donner accès aux formations qui vous sont attribuées et vous permettre de reprendre là où vous vous êtes arrêté(e).</li>
              <li>Corriger les évaluations et délivrer les certificats.</li>
              <li>Permettre à votre établissement d’accompagner les formations qu’il vous a affectées.</li>
              <li>Assurer la sécurité de la plateforme.</li>
            </ul>
          </section>

          <section>
            <h2>4. Qui peut consulter vos données ?</h2>
            <ul>
              <li>
                <strong className="font-semibold text-ink-900">Vous-même</strong> : l’ensemble de vos données.
              </li>
              <li>
                <strong className="font-semibold text-ink-900">Votre établissement</strong>, uniquement si vous l’avez rejoint en donnant
                votre accord : votre nom, votre e-mail et, <em>pour les seules formations qu’il vous a affectées</em>, votre progression,
                vos résultats aux évaluations et l’état de votre certificat. Vos formations personnelles ne lui sont jamais visibles.
              </li>
              <li>
                <strong className="font-semibold text-ink-900">L’équipe d’administration SANADY</strong>, pour la gestion de la plateforme et
                l’accompagnement des apprenants.
              </li>
              <li>
                <strong className="font-semibold text-ink-900">Toute personne disposant de votre numéro de certificat</strong> : votre nom, le
                titre de la formation et la date d’obtention, afin d’en vérifier l’authenticité.
              </li>
            </ul>
            <p className="mt-3">Vous pouvez quitter un établissement à tout moment depuis votre profil ; son accès à vos données prend alors fin.</p>
          </section>

          <section>
            <h2>5. Durées de conservation</h2>
            <ul>
              <li>Données de compte et de suivi : pendant la durée d’utilisation du compte, puis supprimées ou anonymisées dans un délai de 3 ans après la dernière activité.</li>
              <li>Certificats : conservés afin de permettre leur vérification, sauf demande de suppression.</li>
              <li>Journaux d’administration : 3 ans.</li>
            </ul>
          </section>

          <section>
            <h2>6. Vos droits</h2>
            <p>
              Vous disposez d’un droit d’accès, de rectification et d’opposition pour motifs légitimes. Vos nom et fonction sont
              modifiables à tout moment depuis votre profil. Pour toute autre demande, contactez l’administration SANADY
              {contact ? ` à l’adresse ${contact}` : ""}. Vous pouvez également saisir la Commission nationale de contrôle de la protection
              des données à caractère personnel (CNDP).
            </p>
          </section>

          <section>
            <h2>7. Sécurité et hébergement</h2>
            <p>
              Les accès sont contrôlés par rôle et appliqués directement dans la base de données. Les documents et vidéos de formation
              sont stockés de manière privée et ne sont accessibles qu’aux personnes autorisées, par des liens temporaires. Les mots de
              passe ne sont jamais stockés en clair.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
