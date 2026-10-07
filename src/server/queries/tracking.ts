import "server-only";
import type { LearnerCourseDetail } from "@/components/tracking/learner-progress";
import { getAttempts, getCourseOutline, getLearnerCourses, getRecentActivity } from "./learning";

/**
 * Loads a learner's courses for supervision. Visibility is enforced by the
 * database: an institution administrator only receives the courses their
 * institution assigned (learner_courses + RLS on progress tables).
 * `courseFilter` narrows further (e.g. to one institution's assignments
 * when the viewer administers several institutions).
 */
export async function getLearnerDetails(userId: string, courseFilter?: (courseId: string) => boolean) {
  const summaries = (await getLearnerCourses(userId)).filter((c) => !courseFilter || courseFilter(c.course_id));
  const allowed = new Set(summaries.map((s) => s.course_id));
  const [attempts, activity] = await Promise.all([getAttempts(userId), getRecentActivity(userId, { limit: 40 })]);

  const details: LearnerCourseDetail[] = await Promise.all(
    summaries.map(async (summary) => ({
      summary,
      outline: await getCourseOutline(summary.course_id, userId),
      attempts: attempts.filter((a) => a.course_id === summary.course_id),
    })),
  );

  return {
    courses: details,
    activity: activity.filter((a) => a.course && allowed.has(a.course.id)).slice(0, 15),
  };
}
