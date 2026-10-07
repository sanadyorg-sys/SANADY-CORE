import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/auth/auth-forms";
import { homeFor, requireViewer } from "@/server/auth";

export const metadata: Metadata = { title: "Bienvenue" };

export default async function OnboardingPage() {
  const viewer = await requireViewer({ allowOnboarding: true });
  if (viewer.profile.onboarded_at) redirect(homeFor(viewer));
  const p = viewer.profile;

  return (
    <>
      <h1 className="text-title font-semibold text-ink-900">Bienvenue sur SANADY</h1>
      <p className="mb-8 mt-1 text-body text-ink-600">
        Vérifiez vos informations. Votre nom figurera sur les certificats délivrés à l’issue de vos formations.
      </p>
      <OnboardingForm
        defaults={{
          first_name: p.first_name,
          last_name: p.last_name,
          job_title: p.job_title ?? "",
          subject_area: p.subject_area ?? "",
        }}
      />
    </>
  );
}
