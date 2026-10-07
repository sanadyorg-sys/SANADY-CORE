import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AttemptQuestions, AttemptSummary } from "@/components/learning/attempt-review";
import { createClient } from "@/lib/supabase/server";
import type { AttemptResult } from "@/lib/types";
import { requireInstitutionAdmin } from "@/server/auth";

export const metadata: Metadata = { title: "Détail d’une évaluation" };

export default async function InstitutionAttemptPage(
  props: PageProps<"/etablissement/[institutionId]/suivi/[userId]/tentatives/[attemptId]">,
) {
  const { institutionId, userId, attemptId } = await props.params;
  await requireInstitutionAdmin(institutionId);
  const supabase = await createClient();
  // get_attempt_result enforces visibility (assigned course of a consenting member).
  const { data, error } = await supabase.rpc("get_attempt_result", { p_attempt: attemptId });
  if (error || !data) notFound();
  const result = data as AttemptResult;

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href={`/etablissement/${institutionId}/suivi/${userId}`}
        className="mb-5 inline-flex items-center gap-1.5 text-label font-medium text-ink-600 hover:text-ink-900"
      >
        <ArrowLeft className="size-4" aria-hidden /> Retour au suivi de l’enseignant
      </Link>
      <h1 className="mb-6 text-title font-semibold text-ink-900">Détail de l’évaluation</h1>
      <AttemptSummary result={result} />
      <section className="mt-8">
        <h2 className="mb-4 text-section font-semibold text-ink-900">Réponses</h2>
        <AttemptQuestions result={result} />
      </section>
    </div>
  );
}
