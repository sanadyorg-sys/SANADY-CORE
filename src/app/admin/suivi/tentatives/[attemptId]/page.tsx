import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AttemptQuestions, AttemptSummary } from "@/components/learning/attempt-review";
import { createClient } from "@/lib/supabase/server";
import type { AttemptResult } from "@/lib/types";
import { requireSanadyAdmin } from "@/server/auth";

export const metadata: Metadata = { title: "Détail d’une évaluation" };

export default async function AdminAttemptPage(props: PageProps<"/admin/suivi/tentatives/[attemptId]">) {
  const { attemptId } = await props.params;
  await requireSanadyAdmin();
  const supabase = await createClient();
  const [{ data, error }, { data: owner }] = await Promise.all([
    supabase.rpc("get_attempt_result", { p_attempt: attemptId }),
    supabase.from("quiz_attempts").select("user_id").eq("id", attemptId).maybeSingle(),
  ]);
  if (error || !data) notFound();
  const result = data as AttemptResult;
  const userId = (owner as { user_id: string } | null)?.user_id;

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href={userId ? `/admin/enseignants/${userId}` : "/admin/suivi"}
        className="mb-5 inline-flex items-center gap-1.5 text-label font-medium text-ink-600 hover:text-ink-900"
      >
        <ArrowLeft className="size-4" aria-hidden /> Retour à la fiche
      </Link>
      <h1 className="mb-6 text-title font-semibold text-ink-900">Détail de l’évaluation</h1>
      <AttemptSummary result={result} />
      <section className="mt-8">
        <h2 className="mb-4 text-section font-semibold text-ink-900">Réponses (bonnes réponses affichées)</h2>
        <AttemptQuestions result={result} />
      </section>
    </div>
  );
}
