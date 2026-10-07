import { Award, BookOpenCheck, CircleCheck, CirclePlay, ClipboardCheck, ClipboardX, Flag, RotateCcw, UserPlus } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { EVENT_LABELS } from "@/lib/labels";
import type { LearningEventType } from "@/lib/types";
import type { ActivityItem } from "@/server/queries/learning";

const ICONS: Record<LearningEventType, React.ComponentType<{ className?: string }>> = {
  enrolled: UserPlus,
  lesson_started: CirclePlay,
  video_checkpoint: CirclePlay,
  lesson_completed: CircleCheck,
  quiz_started: ClipboardCheck,
  quiz_submitted: ClipboardCheck,
  quiz_passed: BookOpenCheck,
  quiz_failed: ClipboardX,
  quiz_attempts_reset: RotateCcw,
  course_completed: Flag,
  certificate_issued: Award,
};

function detail(item: ActivityItem) {
  const score = typeof item.metadata?.score_percent === "number" || typeof item.metadata?.score_percent === "string"
    ? ` · ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(Number(item.metadata.score_percent))} %`
    : "";
  if (item.lesson) return item.lesson.title;
  if (item.quiz) return `${item.quiz.title}${score}`;
  return null;
}

export function ActivityList({ items, showCourse = true }: { items: ActivityItem[]; showCourse?: boolean }) {
  return (
    <ol className="relative space-y-4">
      {items.map((item, index) => {
        const Icon = ICONS[item.event_type];
        const positive = ["lesson_completed", "quiz_passed", "course_completed", "certificate_issued"].includes(item.event_type);
        return (
          <li key={item.id} className="relative flex gap-3">
            {index < items.length - 1 ? (
              <span aria-hidden className="absolute left-[13px] top-7 h-[calc(100%-4px)] w-px bg-line" />
            ) : null}
            <span
              className={
                positive
                  ? "relative flex size-[27px] shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700 ring-1 ring-teal-100"
                  : "relative flex size-[27px] shrink-0 items-center justify-center rounded-full bg-ink-50 text-ink-500 ring-1 ring-line"
              }
            >
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 pb-0.5">
              <p className="text-body font-medium text-ink-800">{EVENT_LABELS[item.event_type]}</p>
              {detail(item) ? <p className="truncate text-label text-ink-600">{detail(item)}</p> : null}
              <p className="text-caption text-ink-500">
                {showCourse && item.course ? `${item.course.title} · ` : ""}
                <time dateTime={item.occurred_at}>{formatDateTime(item.occurred_at)}</time>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
