/**
 * The client previews the draft course of a custom-training project while
 * its review is awaited: read-only, its own company only, never the answers.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, buildCourse, uid, type BuiltCourse } from "./harness";

let db: TestDb;
let clientAdmin: string;
let employee: string;
let otherAdmin: string;
let project: string;
let course: BuiltCourse;

async function company(name: string) {
  const [{ id: org }] = (await db.sql<{ id: string }>(`insert into public.partner_organizations (name, org_type, enterprise_status) values ($1, 'entreprise', 'active_service') returning id`, [name])) as [{ id: string }];
  await db.sql(`select set_config('sanady.tenant_sync', 'on', false)`);
  const [{ id: inst }] = (await db.sql<{ id: string }>(`insert into public.institutions (name, identifier, type, contact_email, kind) values ($1, $2, 'autre', 'c@c.test', 'enterprise') returning id`, [name, `ENT-${uid().toUpperCase()}`])) as [{ id: string }];
  const [{ id: tenant }] = (await db.sql<{ id: string }>(`insert into public.enterprise_tenants (organization_id, institution_id, slug, display_name, service_plan, max_learners, status, activated_at) values ($1, $2, $3, $4, 'complete', 50, 'active', now()) returning id`, [org, inst, `c-${uid()}`, name])) as [{ id: string }];
  await db.sql(`select set_config('sanady.tenant_sync', '', false)`);
  return { org, inst, tenant };
}
async function member(inst: string, role: "admin" | "teacher") {
  const u = await db.createUser(`${role}.${uid()}@client.test`);
  await db.sql(`insert into public.institution_memberships (institution_id, user_id, role, source, consented_at) values ($1, $2, $3, 'admin', now())`, [inst, u, role]);
  return u;
}
const setStatus = (s: string) => db.sql(`update public.training_projects set status = $2 where id = $1`, [project, s]);

beforeAll(async () => {
  db = await TestDb.create();
  const admin = await db.createAdmin();
  course = await buildCourse(
    db,
    admin,
    { modules: [{ lessons: [{ kind: "pdf", pages: 3 }], questions: [{ kind: "single", options: [false, true] }] }] },
    { publish: false, title: "Sécurité sur chantier" },
  );
  const a = await company("Société A");
  const b = await company("Société B");
  clientAdmin = await member(a.inst, "admin");
  employee = await member(a.inst, "teacher");
  otherAdmin = await member(b.inst, "admin");
  [{ id: project }] = (await db.sql<{ id: string }>(
    `insert into public.training_projects (reference, organization_id, tenant_id, title, target_audience, course_id, status) values ($1, $2, $3, 'Formation sécurité', 'Chefs d’équipe', $4, 'production') returning id`,
    [`FS-T-${uid()}`, a.org, a.tenant, course.courseId],
  )) as [{ id: string }];
  await db.sql(`insert into storage.buckets (id, name) values ('course-media', 'course-media') on conflict do nothing`);
  await db.sql(`insert into storage.objects (bucket_id, name) values ('course-media', $1)`, [`${course.courseId}/lecon.pdf`]);
});
afterAll(async () => db?.close());

describe("client preview of the course", () => {
  it("opens only while the client's review (or the approval) is awaited", async () => {
    expect(await db.rpcError(clientAdmin, "client_course_preview", [project])).toMatch(/forbidden/);
    await setStatus("client_review");
    const p = await db.rpc<{ course_title: string; modules: Array<{ lessons: unknown[]; quiz: { questions: Array<{ prompt: string; options: string[] }> } }> }>(clientAdmin, "client_course_preview", [project]);
    expect(p.course_title).toBe("Sécurité sur chantier");
    expect(p.modules[0]!.lessons).toHaveLength(1);
    // Labels only: no correctness anywhere in the payload.
    expect(JSON.stringify(p)).not.toMatch(/is_correct|explanation/);
    expect(p.modules[0]!.quiz.questions[0]!.options).toHaveLength(2);
    await setStatus("approved");
    expect(await db.rpcError(clientAdmin, "client_course_preview", [project])).toMatch(/forbidden/);
    await setStatus("client_review");
  });

  it("reads the course, its lessons and files — never the answers", async () => {
    const lessons = await db.as(clientAdmin, (q) => q(`select id from public.lessons where course_id = $1`, [course.courseId]));
    expect(lessons).toHaveLength(1);
    expect(await db.as(clientAdmin, (q) => q(`select name from storage.objects where bucket_id = 'course-media'`))).toHaveLength(1);
    expect(await db.as(clientAdmin, (q) => q(`select is_correct from public.question_options`))).toEqual([]);
  });

  it("is closed to employees and to other companies", async () => {
    for (const who of [employee, otherAdmin]) {
      expect(await db.rpcError(who, "client_course_preview", [project])).toMatch(/forbidden/);
      expect(await db.as(who, (q) => q(`select id from public.lessons where course_id = $1`, [course.courseId]))).toEqual([]);
      expect(await db.as(who, (q) => q(`select name from storage.objects where bucket_id = 'course-media'`))).toEqual([]);
    }
  });

  it("is announced in the company's project list", async () => {
    const [{ institution_id: inst }] = (await db.sql<{ institution_id: string }>(`select t.institution_id from public.training_projects p join public.enterprise_tenants t on t.id = p.tenant_id where p.id = $1`, [project])) as [{ institution_id: string }];
    const [row] = await db.as(clientAdmin, (q) => q<{ can_preview: boolean }>(`select can_preview from public.workspace_training_projects($1)`, [inst]));
    expect(row!.can_preview).toBe(true);
  });
});
