"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { errorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { StartedAttempt } from "@/lib/types";
import { uuidSchema } from "@/lib/validation";

export type StartResult = { ok: true; attempt: StartedAttempt } | { ok: false; message: string };

/** Starts or resumes the learner's attempt (never consumes an extra attempt). */
export async function startQuizAttempt(quizId: string): Promise<StartResult> {
  const id = uuidSchema.safeParse(quizId);
  if (!id.success) return { ok: false, message: errorMessage({ message: "not_found" }) };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_quiz_attempt", { p_quiz: id.data });
  if (error) return { ok: false, message: errorMessage(error) };
  return { ok: true, attempt: data as StartedAttempt };
}

const answersSchema = z.record(uuidSchema, z.array(uuidSchema).max(10)).refine((v) => Object.keys(v).length <= 200);

export type SubmitResult = { ok: true; attemptId: string } | { ok: false; message: string };

/** Submits answers; grading happens entirely in the database. */
export async function submitQuizAttempt(attemptId: string, answers: Record<string, string[]>, courseId: string): Promise<SubmitResult> {
  const id = uuidSchema.safeParse(attemptId);
  const parsed = answersSchema.safeParse(answers);
  if (!id.success || !parsed.success) return { ok: false, message: errorMessage({ message: "invalid_payload" }) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_quiz_attempt", { p_attempt: id.data, p_answers: parsed.data });
  if (error) return { ok: false, message: errorMessage(error) };

  revalidatePath(`/espace/formations/${courseId}`, "layout");
  revalidatePath("/espace");
  return { ok: true, attemptId: id.data };
}
