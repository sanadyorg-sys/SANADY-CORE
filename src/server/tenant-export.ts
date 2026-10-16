import "server-only";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { toCsv } from "@/server/csv";
import { buildZip } from "@/server/zip";

/**
 * End-of-contract bundle of a company space: what the company is entitled
 * to receive before any deletion. The caller must have checked
 * public.can_export_tenant() first (the route does). Read with the server
 * key, limited to this space: its members, and only their records on the
 * courses the company assigned or owns. Team internal notes are excluded.
 */

type Row = Record<string, unknown>;
const d = (v: unknown) => (typeof v === "string" ? v.slice(0, 10) : null);
const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));

type Page = { range: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }> };

/** Every row, 1 000 at a time (the API never returns more per request). */
async function all<T>(query: () => Page): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query().range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return out;
  }
}

/** Same, for a long list of ids, split so that request URLs stay short. */
async function allIn<T>(ids: string[], query: (chunk: string[]) => Page): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 100) out.push(...(await all<T>(() => query(ids.slice(i, i + 100)))));
  return out;
}

export async function buildTenantExport(tenantId: string, requestedBy: string) {
  const db = createAdminClient();
  const { data: t } = await db.from("enterprise_tenants").select("id, display_name, institution_id, organization:partner_organizations(name)").eq("id", tenantId).single();
  const tenant = t as unknown as { id: string; display_name: string; institution_id: string; organization: { name: string } | null };
  const inst = tenant.institution_id;

  const [members, departments, assignments, owned, usage, support] = await Promise.all([
    all<Row>(() => db.from("institution_memberships").select("user_id, role, status, created_at, revoked_at, department_id, user:profiles!institution_memberships_user_id_fkey(full_name, email)").eq("institution_id", inst).order("created_at")),
    all<Row>(() => db.from("enterprise_departments").select("id, name").eq("institution_id", inst).order("name")),
    all<Row>(() => db.from("course_assignments").select("user_id, course_id, assigned_at, due_on, revoked_at").eq("institution_id", inst).order("assigned_at")),
    all<Row>(() => db.from("courses").select("id, title, summary, description, objectives, status").eq("owner_institution_id", inst).order("created_at")),
    all<Row>(() => db.from("enterprise_usage_records").select("period, active_learners, enrolled_learners, completions, storage_mb, learner_limit, overage, review_note").eq("tenant_id", tenantId).order("period")),
    all<Row>(() => db.from("enterprise_support_requests").select("id, reference, category, priority, subject, status, created_at, first_response_at, resolved_at, closed_at").eq("tenant_id", tenantId).order("created_at")),
  ]);
  const people = members as unknown as Array<Row & { user_id: string; user: { full_name: string | null; email: string } | null; department_id: string | null }>;
  const userIds = [...new Set(people.map((m) => m.user_id))];
  const name = new Map(people.map((m) => [m.user_id, m.user?.full_name || m.user?.email || ""]));
  const email = new Map(people.map((m) => [m.user_id, m.user?.email ?? ""]));
  const dept = new Map((departments as Array<{ id: string; name: string }>).map((x) => [x.id, x.name]));
  const ownedCourses = owned as unknown as Array<{ id: string; title: string; summary: string; description: string; objectives: string[]; status: string }>;
  const scope = [...new Set([...(assignments as Array<{ course_id: string }>).map((a) => a.course_id), ...ownedCourses.map((c) => c.id)])];
  const courseRows = await allIn<{ id: string; title: string }>(scope, (ids) => db.from("courses").select("id, title").in("id", ids).order("id"));
  const title = new Map(courseRows.map((c) => [c.id, c.title]));

  const inScope = <T extends { user_id: string; course_id: string }>(rows: T[]) => rows.filter((r) => userIds.includes(r.user_id) && scope.includes(r.course_id));
  // Per member, on the courses in scope only.
  const byUsers = <T>(select: string, table: string) =>
    allIn<T>(userIds, (ids) => db.from(table).select(select).in("user_id", ids).in("course_id", scope.length ? scope : ["00000000-0000-0000-0000-000000000000"]).order("user_id"));
  const [enrollments, attempts, certificates, progress] = await Promise.all([
    byUsers<Row & { user_id: string; course_id: string }>("user_id, course_id, status, enrolled_at, started_at, completed_at", "enrollments"),
    byUsers<Row & { user_id: string; course_id: string; quiz: { title: string } | null }>("user_id, course_id, attempt_number, status, score_percent, passed, submitted_at, voided_at, quiz:quizzes(title)", "quiz_attempts"),
    byUsers<Row & { user_id: string; course_id: string; verification_code: string }>("user_id, course_id, certificate_number, verification_code, issued_at, revoked_at", "certificates"),
    byUsers<{ user_id: string; course_id: string; status: string }>("user_id, course_id, status", "lesson_progress"),
  ]);
  const done = new Map<string, number>();
  for (const p of inScope(progress)) {
    if (p.status === "completed") done.set(`${p.user_id}:${p.course_id}`, (done.get(`${p.user_id}:${p.course_id}`) ?? 0) + 1);
  }

  const supportRows = support as Array<Row & { id: string; reference: string }>;
  const messages = await allIn<{ request_id: string; from_team: boolean; body: string; created_at: string }>(supportRows.map((x) => x.id), (ids) =>
    db.from("enterprise_support_messages").select("request_id, from_team, body, created_at").in("request_id", ids).eq("internal", false).order("created_at"),
  );
  const ref = new Map(supportRows.map((s) => [s.id, s.reference]));

  // The company's own courses: full content (it belongs to the company), and the list of their files.
  const content = await Promise.all(
    ownedCourses.map(async (c) => {
      const [{ data: modules }, { data: lessons }, { data: quizzes }] = await Promise.all([
        db.from("modules").select("id, title, description, position").eq("course_id", c.id).is("archived_at", null).order("position"),
        db.from("lessons").select("module_id, title, description, kind, position, is_mandatory, estimated_minutes, video_ref, pdf_path, pdf_page_count").eq("course_id", c.id).is("archived_at", null).order("position"),
        db.from("quizzes").select("id, module_id, title, instructions, pass_threshold, max_attempts").eq("course_id", c.id),
      ]);
      const qz = (quizzes ?? []) as Array<{ id: string; module_id: string } & Row>;
      const { data: questions } = qz.length
        ? await db.from("questions").select("id, quiz_id, kind, prompt, points, explanation, position, options:question_options(label, is_correct, position)").in("quiz_id", qz.map((q) => q.id)).is("archived_at", null).order("position")
        : { data: [] };
      const { data: files } = await db.storage.from("course-media").list(c.id, { limit: 1000 });
      return {
        course: { title: c.title, summary: c.summary, description: c.description, objectives: c.objectives, status: c.status },
        modules: ((modules ?? []) as Array<{ id: string; title: string; description: string; position: number }>).map((m) => {
          const q = qz.find((x) => x.module_id === m.id) as ({ id: string; title: unknown; instructions: unknown; pass_threshold: unknown; max_attempts: unknown } | undefined);
          type Q = { quiz_id: string; kind: string; prompt: string; points: number; explanation: string; position: number; options: Array<{ label: string; is_correct: boolean; position: number }> };
          return {
            title: m.title,
            description: m.description,
            position: m.position,
            lessons: ((lessons ?? []) as Array<Row & { module_id: string }>)
              .filter((l) => l.module_id === m.id)
              .map((l) => ({ title: l.title, description: l.description, kind: l.kind, position: l.position, mandatory: l.is_mandatory, estimated_minutes: l.estimated_minutes, video: l.video_ref, pdf: l.pdf_path, pages: l.pdf_page_count })),
            quiz: q
              ? {
                  title: q.title,
                  instructions: q.instructions,
                  pass_threshold: q.pass_threshold,
                  max_attempts: q.max_attempts,
                  questions: ((questions ?? []) as Q[])
                    .filter((x) => x.quiz_id === q.id)
                    .map((x) => ({
                      kind: x.kind,
                      prompt: x.prompt,
                      points: x.points,
                      explanation: x.explanation,
                      options: [...x.options].sort((a, b) => a.position - b.position).map((o) => ({ label: o.label, correct: o.is_correct })),
                    })),
                }
              : null,
          };
        }),
        files: ((files ?? []) as Array<{ name: string; metadata: { size?: number } | null }>).map((f) => ({ path: `${c.id}/${f.name}`, size_bytes: f.metadata?.size ?? null })),
      };
    }),
  );

  const now = new Date();
  const verify = (code: string) => `${publicEnv.appUrl}/verifier/${code}`;
  const files = [
    {
      name: "LISEZMOI.txt",
      data: [
        `Export des données de l’espace de formation « ${tenant.display_name} » (${tenant.organization?.name ?? ""})`,
        `Plateforme SANADY — Fondation Sanady. Établi le ${now.toLocaleString("fr-FR", { timeZone: "Africa/Casablanca" })} à la demande de ${requestedBy}.`,
        "",
        "Contenu :",
        "- collaborateurs.csv : personnes de l’espace, rôle, service, dates.",
        "- services.csv : services (départements) de l’entreprise.",
        "- affectations.csv : formations affectées, dates limites.",
        "- progression.csv : inscriptions, leçons terminées, achèvement.",
        "- evaluations.csv : tentatives aux évaluations (score, résultat).",
        "- attestations.csv : attestations et certificats, avec leur adresse de vérification.",
        "- assistance.csv et assistance-messages.csv : demandes d’assistance et échanges (sans les notes internes de l’équipe).",
        "- utilisation.csv : relevés mensuels d’utilisation.",
        "- formations-entreprise.json : contenu complet des formations propres à l’entreprise (modules, leçons, évaluations, bonnes réponses) et liste de leurs fichiers.",
        "",
        "Les fichiers vidéo et PDF des formations ne sont pas inclus (taille) : leur liste figure dans formations-entreprise.json ; l’équipe SANADY les transmet sur demande.",
        "Seules figurent les données liées à cet espace : rien sur les autres formations ou établissements des personnes concernées.",
        "Fichiers CSV : séparateur « ; », encodage UTF-8 (ouverture directe dans Excel).",
      ].join("\r\n"),
    },
    {
      name: "collaborateurs.csv",
      data: toCsv(
        ["Nom", "E-mail", "Rôle", "Service", "Statut", "Depuis le", "Retiré le"],
        people.map((m) => [name.get(m.user_id), email.get(m.user_id), m.role === "admin" ? "Administrateur" : m.role === "supervisor" ? "Superviseur" : "Collaborateur", m.department_id ? dept.get(m.department_id) : null, m.status === "active" ? "Actif" : "Retiré", d(m.created_at), d(m.revoked_at)]),
      ),
    },
    { name: "services.csv", data: toCsv(["Service"], (departments as Array<{ name: string }>).map((x) => [x.name])) },
    {
      name: "affectations.csv",
      data: toCsv(
        ["Collaborateur", "E-mail", "Formation", "Affectée le", "Date limite", "Retirée le"],
        (assignments as Array<Row & { user_id: string; course_id: string }>).map((a) => [name.get(a.user_id), email.get(a.user_id), title.get(a.course_id), d(a.assigned_at), d(a.due_on), d(a.revoked_at)]),
      ),
    },
    {
      name: "progression.csv",
      data: toCsv(
        ["Collaborateur", "E-mail", "Formation", "Statut", "Inscrit le", "Commencé le", "Terminé le", "Leçons terminées"],
        inScope(enrollments).map((e) => [
          name.get(e.user_id), email.get(e.user_id), title.get(e.course_id), e.status === "completed" ? "Terminée" : "En cours", d(e.enrolled_at), d(e.started_at), d(e.completed_at), done.get(`${e.user_id}:${e.course_id}`) ?? 0,
        ]),
      ),
    },
    {
      name: "evaluations.csv",
      data: toCsv(
        ["Collaborateur", "E-mail", "Formation", "Évaluation", "Tentative", "Score (%)", "Résultat", "Passée le", "Annulée"],
        inScope(attempts).map((a) => [
          name.get(a.user_id), email.get(a.user_id), title.get(a.course_id), a.quiz?.title, n(a.attempt_number), n(a.score_percent),
          a.status !== "submitted" ? "En cours" : a.passed ? "Réussie" : "Non réussie", d(a.submitted_at), a.voided_at ? "Oui" : "",
        ]),
      ),
    },
    {
      name: "attestations.csv",
      data: toCsv(
        ["Collaborateur", "E-mail", "Formation", "Numéro", "Délivrée le", "Vérification", "Révoquée le"],
        inScope(certificates).map((c) => [
          name.get(c.user_id), email.get(c.user_id), title.get(c.course_id), c.certificate_number as string, d(c.issued_at), verify(c.verification_code), d(c.revoked_at),
        ]),
      ),
    },
    {
      name: "assistance.csv",
      data: toCsv(
        ["Référence", "Type", "Priorité", "Objet", "Statut", "Ouverte le", "Première réponse", "Résolue le", "Fermée le"],
        supportRows.map((s) => [s.reference, s.category as string, s.priority as string, s.subject as string, s.status as string, d(s.created_at), d(s.first_response_at), d(s.resolved_at), d(s.closed_at)]),
      ),
    },
    {
      name: "assistance-messages.csv",
      data: toCsv(
        ["Référence", "De", "Date", "Message"],
        messages.map((m) => [ref.get(m.request_id), m.from_team ? "Équipe SANADY" : "Entreprise", d(m.created_at), m.body]),
      ),
    },
    {
      name: "utilisation.csv",
      data: toCsv(
        ["Mois", "Collaborateurs actifs", "Inscrits", "Parcours terminés", "Stockage (Mo)", "Limite de collaborateurs", "Dépassement", "Suite donnée"],
        usage.map((u) => [String(u.period).slice(0, 7), n(u.active_learners), n(u.enrolled_learners), n(u.completions), n(u.storage_mb), n(u.learner_limit), u.overage ? "Oui" : "Non", (u.review_note as string) ?? null]),
      ),
    },
    { name: "formations-entreprise.json", data: JSON.stringify({ space: tenant.display_name, exported_at: now.toISOString(), courses: content }, null, 2) },
  ];
  return { bytes: buildZip(files, now), fileName: `export-${tenant.display_name.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}-${now.toISOString().slice(0, 10)}.zip` };
}
