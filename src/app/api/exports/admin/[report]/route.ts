import { createClient } from "@/lib/supabase/server";
import { parsePeriod } from "@/lib/period";
import { csvResponse, pct, toCsv } from "@/server/csv";
import { getViewer } from "@/server/auth";
import { getAdminReport } from "@/server/queries/reports";

/**
 * CSV exports for SANADY administrators. Authorization is enforced twice:
 * here (admin with a 2FA session) and in the database (admin_report and RLS
 * refuse anyone else).
 */
export async function GET(request: Request, ctx: RouteContext<"/api/exports/admin/[report]">) {
  const viewer = await getViewer();
  if (!viewer || !viewer.isSanadyAdmin || viewer.aal !== "aal2") return new Response("Accès refusé.", { status: 401 });

  const { report } = await ctx.params;
  const period = parsePeriod(Object.fromEntries(new URL(request.url).searchParams));
  const suffix = `${period.from}_${period.to}`;

  if (report === "certificats") {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("certificates")
      .select("certificate_number, recipient_name, course_title, completed_at, issued_at, revoked_at, revoke_reason")
      .gte("issued_at", `${period.from}T00:00:00+01:00`)
      .lte("issued_at", `${period.to}T23:59:59+01:00`)
      .order("issued_at");
    if (error) return new Response("Export impossible.", { status: 500 });
    const rows = (data ?? []) as Array<Record<string, string | null>>;
    return csvResponse(
      `sanady-certificats_${suffix}.csv`,
      toCsv(
        ["Numéro", "Titulaire", "Formation", "Terminée le", "Délivré le", "Statut", "Motif de révocation"],
        rows.map((c) => [
          c.certificate_number,
          c.recipient_name,
          c.course_title,
          c.completed_at?.slice(0, 10),
          c.issued_at?.slice(0, 10),
          c.revoked_at ? "Révoqué" : "Valide",
          c.revoke_reason,
        ]),
      ),
    );
  }

  let data;
  try {
    data = await getAdminReport(period.from, period.to);
  } catch {
    return new Response("Accès refusé.", { status: 403 });
  }

  if (report === "formations") {
    return csvResponse(
      `sanady-formations_${suffix}.csv`,
      toCsv(
        ["Formation", "Statut", "Inscrits", "Commencée", "Terminée", "Achèvement (%)", "Actifs sur la période", "Score moyen (%)", "Certificats"],
        data.courses.map((c) => [c.title, c.status === "archived" ? "Archivée" : "Publiée", c.enrolled, c.started, c.completed, pct(c.completion_rate), c.active_in_period, c.average_score === null ? null : Number(c.average_score), c.certificates]),
      ),
    );
  }
  if (report === "etablissements") {
    return csvResponse(
      `sanady-etablissements_${suffix}.csv`,
      toCsv(
        ["Établissement", "Ville", "Enseignants", "Affectations", "Terminées", "Achèvement (%)", "Actifs sur la période", "Certificats"],
        data.institutions.map((i) => [i.name, i.city, i.teachers, i.assignments, i.completed, pct(i.completion_rate), i.active_in_period, i.certificates]),
      ),
    );
  }
  if (report === "evaluations") {
    return csvResponse(
      `sanady-evaluations_${suffix}.csv`,
      toCsv(
        ["Formation", "Module", "Évaluation", "Enseignants", "Tentatives", "Score moyen (%)", "Ont réussi (%)", "Réussite 1re tentative (%)"],
        data.quizzes.map((q) => [q.course_title, q.module_position, q.title, q.learners, q.attempts, q.average_score === null ? null : Number(q.average_score), pct(q.pass_rate), pct(q.first_attempt_pass_rate)]),
      ),
    );
  }
  return new Response("Rapport inconnu.", { status: 404 });
}
