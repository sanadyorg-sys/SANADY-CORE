import { parsePeriod } from "@/lib/period";
import { uuidSchema } from "@/lib/validation";
import { csvResponse, pct, toCsv } from "@/server/csv";
import { getViewer } from "@/server/auth";
import { getTeacherSummaries } from "@/server/queries/institution";
import { getInstitutionReport } from "@/server/queries/reports";

/**
 * CSV exports for an institution's administrators (and SANADY admins).
 * The database functions refuse any other caller and only count courses the
 * institution assigned.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/exports/etablissement/[institutionId]/[report]">) {
  const { institutionId, report } = await ctx.params;
  const viewer = await getViewer();
  if (!viewer || !uuidSchema.safeParse(institutionId).success) return new Response("Accès refusé.", { status: 401 });
  const allowed = viewer.supervisedInstitutions.some((i) => i.id === institutionId) || (viewer.isCourseStaff && viewer.aal === "aal2");
  if (!allowed) return new Response("Accès refusé.", { status: 403 });

  const period = parsePeriod(Object.fromEntries(new URL(request.url).searchParams));
  const suffix = `${period.from}_${period.to}`;

  try {
    if (report === "formations") {
      const data = await getInstitutionReport(institutionId, period.from, period.to);
      return csvResponse(
        `formations_${suffix}.csv`,
        toCsv(
          ["Formation", "Affectée à", "Commencée", "Terminée", "Achèvement (%)", "Score moyen sur la période (%)", "Certificats"],
          data.courses.map((c) => [c.title, c.assigned, c.started, c.completed, pct(c.completion_rate), c.average_score === null ? null : Number(c.average_score), c.certificates]),
        ),
      );
    }
    if (report === "enseignants") {
      const teachers = await getTeacherSummaries(institutionId);
      return csvResponse(
        `enseignants_${new Date().toISOString().slice(0, 10)}.csv`,
        toCsv(
          ["Nom", "E-mail", "Membre depuis", "Formations affectées", "Terminées", "Certificats", "Dernière activité", "Évaluations à débloquer", "Inactif"],
          teachers.map((t) => [
            t.full_name,
            t.email,
            t.joined_at?.slice(0, 10),
            t.assigned_courses,
            t.completed_courses,
            t.certificates,
            t.last_activity_at?.slice(0, 10) ?? "",
            t.exhausted_quizzes,
            t.inactive ? "Oui" : "Non",
          ]),
        ),
      );
    }
  } catch {
    return new Response("Accès refusé.", { status: 403 });
  }
  return new Response("Rapport inconnu.", { status: 404 });
}
