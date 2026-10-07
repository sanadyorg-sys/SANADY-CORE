"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, CircleCheck, ClipboardCheck, FileText, Lock, PlayCircle, Circle, TriangleAlert } from "lucide-react";
import { ProgressRing } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";
import { formatClock } from "@/lib/format";
import { quizStatusLabel } from "@/lib/quiz";
import type { OutlineLesson, OutlineModule, OutlineQuiz } from "@/server/queries/learning";

function lessonMeta(lesson: OutlineLesson) {
  if (lesson.kind === "video" && lesson.video_duration_seconds) return formatClock(lesson.video_duration_seconds);
  if (lesson.kind === "pdf" && lesson.pdf_page_count) return `${lesson.pdf_page_count} p.`;
  if (lesson.estimated_minutes) return `${lesson.estimated_minutes} min`;
  return null;
}

function LessonStatusIcon({ lesson }: { lesson: OutlineLesson }) {
  if (lesson.status === "completed") return <CircleCheck className="size-[18px] text-success-600" aria-label="Terminée" />;
  if (lesson.status === "in_progress")
    return <ProgressRing value={lesson.progress_ratio} size={18} label={`En cours, ${Math.round(lesson.progress_ratio * 100)} %`} />;
  return <Circle className="size-[18px] text-ink-300" aria-label="Non commencée" />;
}

export function Curriculum({
  courseId,
  modules,
  currentLessonId,
  currentQuizId,
  interactive = true,
  basePath,
}: {
  courseId: string;
  modules: OutlineModule[];
  currentLessonId?: string;
  currentQuizId?: string;
  /** When false, items are not links (e.g. institution read-only view). */
  interactive?: boolean;
  /** Defaults to the learner routes. */
  basePath?: string;
}) {
  const base = basePath ?? `/espace/formations/${courseId}`;
  const initiallyOpen = new Set(
    modules
      .filter(
        (m) =>
          m.lessons.some((l) => l.id === currentLessonId) ||
          m.quiz?.id === currentQuizId ||
          (!currentLessonId && !currentQuizId && !m.completed),
      )
      .map((m) => m.id)
      .slice(0, currentLessonId || currentQuizId ? 1 : 2),
  );
  const [open, setOpen] = useState<Set<string>>(initiallyOpen.size ? initiallyOpen : new Set(modules[0] ? [modules[0].id] : []));

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <ol className="space-y-2">
      {modules.map((m, mi) => {
        const isOpen = open.has(m.id);
        const done = m.lessons.filter((l) => l.status === "completed").length;
        const panelId = `module-${m.id}`;
        return (
          <li key={m.id} className="overflow-hidden rounded-lg border border-line bg-surface">
            <h3>
              <button
                type="button"
                onClick={() => toggle(m.id)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-ink-25"
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-md text-caption font-semibold",
                    m.completed ? "bg-success-50 text-success-700" : "bg-ink-100 text-ink-600",
                  )}
                >
                  {m.completed ? <CircleCheck className="size-4" aria-label="Module validé" /> : mi + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-semibold text-ink-900">{m.title}</span>
                  <span className="text-caption text-ink-500">
                    {done}/{m.lessons.length} leçon{m.lessons.length > 1 ? "s" : ""}
                    {m.quiz ? ` · Évaluation ${m.quiz.passed ? "réussie" : "à valider"}` : ""}
                  </span>
                </span>
                <ChevronDown className={cn("size-4 shrink-0 text-ink-400 transition-transform", isOpen && "rotate-180")} aria-hidden />
              </button>
            </h3>
            <div id={panelId} hidden={!isOpen} className="border-t border-line">
              <ul className="py-1">
                {m.lessons.map((lesson) => {
                  const current = lesson.id === currentLessonId;
                  const content = (
                    <>
                      <LessonStatusIcon lesson={lesson} />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-body", current ? "font-semibold text-navy-800" : "text-ink-800")}>
                          {lesson.title}
                        </span>
                        <span className="flex items-center gap-1.5 text-caption text-ink-500">
                          {lesson.kind === "video" ? <PlayCircle className="size-3.5" aria-hidden /> : <FileText className="size-3.5" aria-hidden />}
                          {lesson.kind === "video" ? "Vidéo" : "Document"}
                          {lessonMeta(lesson) ? ` · ${lessonMeta(lesson)}` : ""}
                          {!lesson.is_mandatory ? " · Facultative" : ""}
                        </span>
                      </span>
                    </>
                  );
                  return (
                    <li key={lesson.id}>
                      {interactive ? (
                        <Link
                          href={`${base}/lecons/${lesson.id}`}
                          aria-current={current ? "page" : undefined}
                          className={cn(
                            "flex items-start gap-3 px-4 py-2.5 transition-colors",
                            current ? "bg-navy-50 shadow-[inset_3px_0_0_var(--color-navy-700)]" : "hover:bg-ink-25",
                          )}
                        >
                          {content}
                        </Link>
                      ) : (
                        <div className="flex items-start gap-3 px-4 py-2.5">{content}</div>
                      )}
                    </li>
                  );
                })}
                {m.quiz ? <QuizRow quiz={m.quiz} href={`${base}/evaluations/${m.quiz.id}`} current={m.quiz.id === currentQuizId} interactive={interactive} /> : null}
              </ul>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function QuizRow({ quiz, href, current, interactive }: { quiz: OutlineQuiz; href: string; current: boolean; interactive: boolean }) {
  const status = quizStatusLabel(quiz);
  const Icon = quiz.passed ? CircleCheck : quiz.exhausted ? TriangleAlert : quiz.unlocked ? ClipboardCheck : Lock;
  const content = (
    <>
      <Icon
        className={cn(
          "size-[18px] shrink-0",
          status.tone === "success" && "text-success-600",
          status.tone === "danger" && "text-danger-600",
          status.tone === "muted" && "text-ink-300",
          (status.tone === "teal" || status.tone === "warning") && "text-teal-600",
        )}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className={cn("block text-body", current ? "font-semibold text-navy-800" : "font-medium text-ink-800")}>
          Évaluation du module
        </span>
        <span
          className={cn(
            "text-caption",
            status.tone === "success" && "text-success-700",
            status.tone === "danger" && "text-danger-600",
            status.tone === "warning" && "text-warning-700",
            (status.tone === "muted" || status.tone === "teal") && "text-ink-500",
          )}
        >
          {status.text}
        </span>
      </span>
    </>
  );
  return (
    <li className="mt-1 border-t border-dashed border-line">
      {interactive ? (
        <Link
          href={href}
          aria-current={current ? "page" : undefined}
          className={cn(
            "flex items-start gap-3 px-4 py-2.5 transition-colors",
            current ? "bg-navy-50 shadow-[inset_3px_0_0_var(--color-navy-700)]" : "hover:bg-ink-25",
          )}
        >
          {content}
        </Link>
      ) : (
        <div className="flex items-start gap-3 px-4 py-2.5">{content}</div>
      )}
    </li>
  );
}
