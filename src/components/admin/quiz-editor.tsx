"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, CircleCheck, Pencil, Plus, Trash2, X } from "lucide-react";
import { removeQuestion, reorderQuestions, saveQuestion, updateQuiz } from "@/server/actions/courses";
import { ActionButton } from "@/components/common/action-button";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormActions, FormMessage, SubmitButton, useActionToast } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { Badge, Card } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { QUESTION_KINDS } from "@/lib/labels";
import { INITIAL_ACTION_STATE, type Quiz } from "@/lib/types";
import type { EditorQuestion } from "@/server/queries/admin";

export function QuizSettingsForm({ quiz }: { quiz: Quiz }) {
  const [state, action] = useActionState(updateQuiz, INITIAL_ACTION_STATE);
  useActionToast(state);
  return (
    <form action={action} className="space-y-4" noValidate>
      {!state.ok ? <FormMessage state={state} /> : null}
      <input type="hidden" name="id" value={quiz.id} />
      <input type="hidden" name="course_id" value={quiz.course_id} />
      <Field label="Titre" error={state.fieldErrors?.title}>
        <Input name="title" defaultValue={quiz.title} required maxLength={200} />
      </Field>
      <Field label="Consignes" optional hint="Affichées avant le début de l’évaluation." error={state.fieldErrors?.instructions}>
        <Textarea name="instructions" defaultValue={quiz.instructions} rows={4} />
      </Field>
      <FormActions>
        <SubmitButton>Enregistrer</SubmitButton>
      </FormActions>
    </form>
  );
}

export function QuestionList({ quiz, questions }: { quiz: Quiz; questions: EditorQuestion[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const totalPoints = questions.reduce((s, q) => s + q.points, 0);

  const move = (index: number, delta: number) =>
    startTransition(async () => {
      const ids = questions.map((q) => q.id);
      const [id] = ids.splice(index, 1);
      ids.splice(index + delta, 0, id!);
      const res = await reorderQuestions(quiz.id, quiz.course_id, ids);
      if (!res.ok) toast({ tone: "danger", title: res.message ?? "Réorganisation impossible." });
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-label text-ink-600">
          {questions.length} question{questions.length > 1 ? "s" : ""} · {totalPoints} point{totalPoints > 1 ? "s" : ""} au total
        </p>
        <QuestionDialog quiz={quiz} />
      </div>
      {questions.length === 0 ? (
        <Card>
          <EmptyState
            compact
            title="Aucune question"
            description="Une évaluation doit comporter au moins une question pour que la formation puisse être publiée."
          />
        </Card>
      ) : (
        <ol className="space-y-3">
          {questions.map((q, i) => (
            <li key={q.id}>
              <Card className="p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <span className="tabular flex size-7 shrink-0 items-center justify-center rounded-md bg-ink-100 text-caption font-semibold text-ink-700">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-line text-body font-medium text-ink-900">{q.prompt}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Badge tone="navy">{QUESTION_KINDS[q.kind]}</Badge>
                      <Badge>
                        {q.points} point{q.points > 1 ? "s" : ""}
                      </Badge>
                      {q.explanation ? <Badge tone="teal">Explication</Badge> : null}
                    </div>
                    <ul className="mt-3 space-y-1">
                      {q.options.map((o) => (
                        <li key={o.id} className={cn("flex items-start gap-2 text-label", o.is_correct ? "font-medium text-success-700" : "text-ink-600")}>
                          {o.is_correct ? (
                            <CircleCheck className="mt-0.5 size-3.5 shrink-0" aria-label="Bonne réponse" />
                          ) : (
                            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ink-300" aria-hidden />
                          )}
                          {o.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <Button variant="ghost" size="icon-sm" aria-label={`Monter la question ${i + 1}`} disabled={i === 0 || pending} onClick={() => move(i, -1)}>
                      <ArrowUp />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Descendre la question ${i + 1}`}
                      disabled={i === questions.length - 1 || pending}
                      onClick={() => move(i, 1)}
                    >
                      <ArrowDown />
                    </Button>
                    <QuestionDialog quiz={quiz} question={q} index={i + 1} />
                    <ActionButton
                      variant="danger-ghost"
                      size="icon-sm"
                      action={removeQuestion.bind(null, q.id, quiz.course_id)}
                      confirm={{
                        title: `Supprimer la question ${i + 1} ?`,
                        description: "Si des enseignants y ont déjà répondu, elle sera archivée afin de préserver leurs résultats.",
                        confirmLabel: "Supprimer",
                      }}
                    >
                      <Trash2 aria-label="Supprimer la question" />
                    </ActionButton>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

interface DraftOption {
  key: string;
  id: string | null;
  label: string;
  is_correct: boolean;
}

function QuestionDialog({ quiz, question, index }: { quiz: Quiz; question?: EditorQuestion; index?: number }) {
  const initialOptions = (): DraftOption[] =>
    question
      ? question.options.map((o) => ({ key: o.id, id: o.id, label: o.label, is_correct: o.is_correct }))
      : [
          { key: crypto.randomUUID(), id: null, label: "", is_correct: true },
          { key: crypto.randomUUID(), id: null, label: "", is_correct: false },
        ];

  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"single" | "multiple">(question?.kind ?? "single");
  const [prompt, setPrompt] = useState(question?.prompt ?? "");
  const [explanation, setExplanation] = useState(question?.explanation ?? "");
  const [points, setPoints] = useState(question?.points ?? 1);
  const [options, setOptions] = useState<DraftOption[]>(initialOptions);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const reset = () => {
    setKind(question?.kind ?? "single");
    setPrompt(question?.prompt ?? "");
    setExplanation(question?.explanation ?? "");
    setPoints(question?.points ?? 1);
    setOptions(initialOptions());
    setError(null);
  };

  const correctCount = options.filter((o) => o.is_correct).length;
  const toggleCorrect = (key: string) =>
    setOptions((prev) =>
      prev.map((o) => (kind === "single" ? { ...o, is_correct: o.key === key } : o.key === key ? { ...o, is_correct: !o.is_correct } : o)),
    );

  const submit = () =>
    startTransition(async () => {
      setError(null);
      if (kind === "single" && correctCount !== 1) return setError("Sélectionnez exactement une bonne réponse.");
      if (kind === "multiple" && correctCount < 1) return setError("Sélectionnez au moins une bonne réponse.");
      const res = await saveQuestion({
        quizId: quiz.id,
        courseId: quiz.course_id,
        questionId: question?.id ?? null,
        kind,
        prompt,
        explanation,
        points,
        options: options.map(({ id, label, is_correct }) => ({ id, label, is_correct })),
      });
      if (!res.ok) return setError(res.message ?? "Enregistrement impossible.");
      toast({ tone: "success", title: res.message ?? "Question enregistrée." });
      setOpen(false);
      if (!question) reset();
      router.refresh();
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset();
      }}
      size="lg"
      title={question ? `Modifier la question ${index}` : "Nouvelle question"}
      description="Les bonnes réponses ne sont jamais transmises aux enseignants avant la correction."
      trigger={
        question ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Modifier la question ${index}`}>
            <Pencil />
          </Button>
        ) : (
          <Button size="sm">
            <Plus aria-hidden /> Ajouter une question
          </Button>
        )
      }
      footer={
        <>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            Annuler
          </Button>
          <Button onClick={submit} loading={pending}>
            Enregistrer la question
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? (
          <p role="alert" className="rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-label font-medium text-danger-700">
            {error}
          </p>
        ) : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
          <Field label="Type de question">
            <Select
              value={kind}
              onChange={(e) => {
                const next = e.target.value as "single" | "multiple";
                setKind(next);
                if (next === "single" && correctCount !== 1) {
                  const firstCorrect = options.find((o) => o.is_correct)?.key ?? options[0]?.key;
                  setOptions((prev) => prev.map((o) => ({ ...o, is_correct: o.key === firstCorrect })));
                }
              }}
            >
              <option value="single">Réponse unique</option>
              <option value="multiple">Réponses multiples</option>
            </Select>
          </Field>
          <Field label="Points">
            <Input type="number" min={1} max={100} value={points} onChange={(e) => setPoints(Math.max(1, Number(e.target.value) || 1))} />
          </Field>
        </div>
        <Field label="Énoncé">
          <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} maxLength={2000} />
        </Field>

        <fieldset>
          <legend className="mb-2 text-label font-medium text-ink-800">
            Réponses proposées{" "}
            <span className="font-normal text-ink-500">
              — cochez {kind === "single" ? "la bonne réponse" : "toutes les bonnes réponses"}
            </span>
          </legend>
          <ul className="space-y-2">
            {options.map((o, i) => (
              <li key={o.key} className="flex items-center gap-2">
                <input
                  type={kind === "single" ? "radio" : "checkbox"}
                  name="correct"
                  checked={o.is_correct}
                  onChange={() => toggleCorrect(o.key)}
                  aria-label={`Réponse ${i + 1} correcte`}
                  className="size-4 shrink-0 accent-teal-600"
                />
                <Input
                  value={o.label}
                  onChange={(e) => setOptions((prev) => prev.map((x) => (x.key === o.key ? { ...x, label: e.target.value } : x)))}
                  placeholder={`Réponse ${i + 1}`}
                  aria-label={`Libellé de la réponse ${i + 1}`}
                  maxLength={500}
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Retirer la réponse ${i + 1}`}
                  disabled={options.length <= 2}
                  onClick={() => setOptions((prev) => prev.filter((x) => x.key !== o.key))}
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            disabled={options.length >= 10}
            onClick={() => setOptions((prev) => [...prev, { key: crypto.randomUUID(), id: null, label: "", is_correct: false }])}
          >
            <Plus aria-hidden /> Ajouter une réponse
          </Button>
        </fieldset>

        <Field
          label="Explication"
          optional
          hint="Affichée après la soumission. Elle doit aider à progresser sans révéler directement la bonne réponse."
        >
          <Textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={3} maxLength={4000} />
        </Field>
      </div>
    </Dialog>
  );
}
