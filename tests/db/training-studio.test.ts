/**
 * SANADY Enterprise, phase E4: custom training production studio. Projects
 * run on the existing course engine: trainers author, the pedagogical team
 * reviews, the client reviews, an approver gives the final approval (with a
 * frozen version), and only then can the course be published and launched
 * in the client's workspace.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, newToken, uid } from "./harness";

let db: TestDb;
let admin: string;
let approver: string;
let manager: string;
let production: string;
let pedagogy: string;
let trainer: string;
let partnership: string;
let tenant: { org: string; id: string; inst: string; director: string };
let otherDirector: string;

async function staff(role: string) {
  const id = await db.createUser(`${role}.${uid()}@sanady.test`);
  await db.rpc(admin, "set_platform_role", [id, role]);
  return id;
}

async function activeWorkspace() {
  const [o] = await db.sql<{ id: string }>(
    `insert into public.partner_organizations (name, org_type, status, enterprise_status) values ($1, 'entreprise', null, 'contract_signed') returning id`,
    [`Client ${uid()}`],
  );
  const org = o!.id;
  const slug = `client-${uid()}`;
  const config = JSON.stringify({ display_name: slug, slug, service_plan: "complete", max_learners: "50", storage_allowance_gb: "5", contract_start_on: "2026-01-01", contract_end_on: "2030-12-31" });
  const id = await db.rpc<string>(manager, "save_enterprise_tenant", [null, org, config]);
  await db.rpc(approver, "authorize_enterprise_tenant", [id, true, null]);
  const inst = await db.rpc<string>(manager, "generate_enterprise_workspace", [id]);
  const director = await db.createUser(`dir.${uid()}@client.test`);
  const [{ email }] = (await db.sql<{ email: string }>(`select email from public.profiles where id = $1`, [director])) as [{ email: string }];
  const { hash } = newToken();
  await db.rpc(manager, "invite_tenant_admin", [id, email, hash]);
  await db.rpc(null, "accept_invitation", [hash, director, false], "service_role");
  // Catalogue step: one published SANADY course opened to the workspace.
  const [c] = await db.sql<{ id: string }>(`insert into public.courses (title, status) values ('Socle commun', 'draft') returning id`);
  await db.sql(`update public.courses set status = 'published' where id = $1`, [c!.id]).catch(() => undefined);
  await db.sql(`insert into public.course_permissions (course_id, institution_id) values ($1, $2)`, [c!.id, inst]);
  await db.sql(`update public.enterprise_tenants set security_checked_at = now() where id = $1`, [id]);
  await db.sql(`update public.enterprise_tenants set status = 'active', activated_at = now() where id = $1`, [id]);
  return { org, id, inst, director };
}

/** Fills the project course with publishable content (as the database owner). */
async function fillCourse(courseId: string) {
  const [cat] = await db.sql<{ id: string }>(`insert into public.course_categories (name) values ($1) returning id`, [`Cat ${uid()}`]);
  await db.sql(`update public.courses set description = 'Description complète de la formation.', objectives = '{Objectif}', category_id = $2 where id = $1`, [courseId, cat!.id]);
  const modules = await db.sql<{ id: string }>(`select id from public.modules where course_id = $1 order by position`, [courseId]);
  for (const m of modules) {
    await db.sql(
      `insert into public.lessons (module_id, course_id, title, kind, position, pdf_path, pdf_page_count) values ($1, $2, 'Support', 'pdf', 0, 'x/support.pdf', 3)`,
      [m.id, courseId],
    );
    const [q] = await db.sql<{ id: string }>(`insert into public.quizzes (module_id, course_id, title) values ($1, $2, 'Quiz') returning id`, [m.id, courseId]);
    const [qu] = await db.sql<{ id: string }>(`insert into public.questions (quiz_id, kind, prompt, position) values ($1, 'single', 'Question ?', 0) returning id`, [q!.id]);
    await db.sql(`insert into public.question_options (question_id, label, is_correct, position) values ($1, 'Oui', true, 0), ($1, 'Non', false, 1)`, [qu!.id]);
  }
}

const BRIEF = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    title: "Sécurité au poste de travail",
    target_audience: "Opérateurs de production",
    objectives: "Appliquer les règles de sécurité au poste et réagir à un incident.",
    ownership: "company",
    client_review_required: true,
    ...extra,
  });

beforeAll(async () => {
  db = await TestDb.create();
  admin = await db.createAdmin();
  const other = await db.createAdmin();
  approver = await staff("partnership_manager");
  await db.rpc(other, "set_partnership_signatory", [approver, true]);
  manager = await staff("enterprise_manager");
  production = await staff("production_manager");
  pedagogy = await staff("training_manager");
  trainer = await staff("trainer");
  partnership = await staff("partnership_coordinator");
  tenant = await activeWorkspace();
  otherDirector = (await activeWorkspace()).director;
});
afterAll(async () => db?.close());

describe("training projects (brief §13)", () => {
  it("are run by enterprise and production managers only", async () => {
    expect(await db.rpcError(partnership, "save_training_project", [null, tenant.org, BRIEF()])).toMatch(/forbidden/);
    expect(await db.rpcError(trainer, "save_training_project", [null, tenant.org, BRIEF()])).toMatch(/forbidden/);
    const id = await db.rpc<string>(production, "save_training_project", [null, tenant.org, BRIEF({ tenant_id: tenant.id })]);
    const [p] = await db.sql<{ reference: string; status: string; lead_id: string }>(`select reference, status, lead_id from public.training_projects where id = $1`, [id]);
    expect(p!.reference).toMatch(/^FS-\d{4}-\d{4}$/);
    expect(p).toMatchObject({ status: "brief", lead_id: production });
  });

  it("follow the twelve steps, with an approver's approval before publication", async () => {
    const id = await db.rpc<string>(manager, "save_training_project", [null, tenant.org, BRIEF({ tenant_id: tenant.id, objectives: "" })]);
    expect(await db.rpcError(manager, "set_training_status", [id, "design", null])).toMatch(/objectives_required/);
    await db.rpc(manager, "save_training_project", [id, tenant.org, BRIEF({ tenant_id: tenant.id })]);
    await db.rpc(manager, "set_training_status", [id, "design", null]);

    // Curriculum, then the draft course built from it, reserved to the client.
    expect(await db.rpcError(production, "create_project_course", [id])).toMatch(/outline_required/);
    await db.rpc(production, "save_outline_item", [null, id, "Les règles", null]);
    await db.rpc(production, "save_outline_item", [null, id, "Réagir à un incident", "Exercices"]);
    const course = await db.rpc<string>(production, "create_project_course", [id]);
    const [c] = await db.sql<{ status: string; tenant_private: boolean; owner_institution_id: string; ownership: string }>(
      `select status, tenant_private, owner_institution_id, ownership from public.courses where id = $1`, [course]);
    expect(c).toEqual({ status: "draft", tenant_private: true, owner_institution_id: tenant.inst, ownership: "company" });
    const mods = await db.sql<{ title: string }>(`select title from public.modules where course_id = $1 order by position`, [course]);
    expect(mods.map((m) => m.title)).toEqual(["Les règles", "Réagir à un incident"]);
    await db.rpc(production, "set_training_status", [id, "production", null]);

    // Trainers and tasks: the assignee moves their own task, not others'.
    await db.rpc(production, "assign_project_trainer", [id, trainer, true]);
    const mine = await db.rpc<string>(production, "save_training_task", [null, id, JSON.stringify({ kind: "video", title: "Tourner la vidéo", assigned_to: trainer })]);
    const theirs = await db.rpc<string>(production, "save_training_task", [null, id, JSON.stringify({ kind: "quiz", title: "Écrire le quiz", assigned_to: pedagogy })]);
    expect(await db.as(trainer, (q) => q(`select 1 from public.training_projects where id = $1`, [id]))).toHaveLength(1);
    const listed = await db.as(production, (q) => q<{ id: string }>(`select id from public.project_trainers($1)`, [id]));
    expect(listed.map((r) => r.id)).toEqual([trainer]);
    expect(await db.as(partnership, (q) => q(`select id from public.project_trainers($1)`, [id]))).toEqual([]);
    await db.rpc(trainer, "set_training_task_status", [mine, "done"]);
    expect(await db.rpcError(trainer, "set_training_task_status", [theirs, "done"])).toMatch(/forbidden/);
    expect(await db.rpcError(production, "set_training_status", [id, "internal_review", null])).toMatch(/tasks_open/);
    await db.rpc(pedagogy, "set_training_task_status", [theirs, "done"]);
    expect(await db.rpcError(production, "set_training_status", [id, "internal_review", null])).toMatch(/course_not_publishable/);

    await fillCourse(course);
    await db.rpc(production, "set_training_status", [id, "internal_review", null]);
    expect((await db.sql<{ status: string }>(`select status from public.courses where id = $1`, [course]))[0]!.status).toBe("review");

    // Internal review: the pedagogical team only.
    expect(await db.rpcError(production, "record_training_review", [id, "internal", "approved", null])).toMatch(/forbidden/);
    await db.rpc(pedagogy, "record_training_review", [id, "internal", "approved", "Conforme"]);

    // Client review: its own company administrator, not another company's.
    expect(await db.rpcError(otherDirector, "record_training_review", [id, "client", "approved", null])).toMatch(/forbidden/);
    await db.rpc(tenant.director, "record_training_review", [id, "client", "changes_requested", "Ajouter un exemple d’incident"]);
    let [p] = await db.sql<{ status: string }>(`select status from public.training_projects where id = $1`, [id]);
    expect(p!.status).toBe("production");
    expect((await db.sql<{ status: string }>(`select status from public.courses where id = $1`, [course]))[0]!.status).toBe("draft");

    // Second round.
    await db.rpc(production, "set_training_status", [id, "internal_review", null]);
    await db.rpc(pedagogy, "record_training_review", [id, "internal", "approved", null]);
    await db.rpc(tenant.director, "record_training_review", [id, "client", "approved", "Validé par la DRH"]);

    // No publication before the approver's approval; the admin is no approver.
    expect(await db.rpcError(pedagogy, "approve_course", [course])).toMatch(/project_not_approved/);
    expect(await db.rpcError(admin, "set_training_status", [id, "approved", null])).toMatch(/forbidden/);
    await db.rpc(approver, "set_training_status", [id, "approved", "Conforme au contrat"]);
    const [v] = await db.sql<{ version: number; snapshot: { modules: Array<{ title: string; quiz: { questions: unknown[] } }> } }>(
      `select version, snapshot from public.training_versions where project_id = $1`, [id]);
    expect(v!.version).toBe(1);
    expect(v!.snapshot.modules.map((m) => m.title)).toEqual(["Les règles", "Réagir à un incident"]);
    expect(v!.snapshot.modules[0]!.quiz.questions).toHaveLength(1);

    // Publication by the pedagogical team moves the project; launch opens it to the workspace.
    await db.rpc(pedagogy, "approve_course", [course]);
    [p] = await db.sql<{ status: string }>(`select status from public.training_projects where id = $1`, [id]);
    expect(p!.status).toBe("published");
    await db.rpc(production, "set_training_status", [id, "launched", null]);
    const grants = await db.sql(`select 1 from public.course_permissions where course_id = $1 and institution_id = $2 and revoked_at is null`, [course, tenant.inst]);
    expect(grants).toHaveLength(1);

    // An update is a new version, approved again; version 1 stays as it was.
    await db.rpc(production, "set_training_status", [id, "production", "Mise à jour annuelle"]);
    const [p2] = await db.sql<{ version: number; status: string }>(`select version, status from public.training_projects where id = $1`, [id]);
    expect(p2).toEqual({ version: 2, status: "production" });
    await db.rpc(production, "save_outline_item", [null, id, "Nouveau module", null]);
    const versions = await db.sql(`select 1 from public.training_versions where project_id = $1`, [id]);
    expect(versions).toHaveLength(1);
    const history = await db.sql<{ to_status: string }>(`select to_status from public.enterprise_history where project_id = $1 order by created_at`, [id]);
    expect(history.map((h) => h.to_status)).toEqual(
      expect.arrayContaining(["brief", "design", "course_created", "production", "internal_review", "client_review", "approval", "approved", "published", "launched"]),
    );
  });

  it("a company course needs the client's workspace", async () => {
    const id = await db.rpc<string>(production, "save_training_project", [null, tenant.org, BRIEF()]);
    await db.rpc(production, "set_training_status", [id, "design", null]);
    await db.rpc(production, "save_outline_item", [null, id, "Module", null]);
    expect(await db.rpcError(production, "create_project_course", [id])).toMatch(/tenant_required/);
  });

  it("company administrators see their own workspace's projects only", async () => {
    const own = await db.as(tenant.director, (q) => q<{ reference: string }>(`select reference from public.workspace_training_projects($1)`, [tenant.inst]));
    expect(own.length).toBeGreaterThan(0);
    const foreign = await db.as(otherDirector, (q) => q(`select reference from public.workspace_training_projects($1)`, [tenant.inst]));
    expect(foreign).toEqual([]);
    expect(await db.as(tenant.director, (q) => q(`select 1 from public.training_projects`))).toEqual([]);
  });
});
