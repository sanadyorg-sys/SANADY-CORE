/**
 * E-mail notifications: events queue messages in the same transaction;
 * preferences are respected (deletion notices always sent); internal notes
 * never notify; reminders are idempotent; only the server sends.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, buildCourse, uid } from "./harness";

let db: TestDb;
let admin: string;
let manager: string;
let teacher: string;
let quiet: string;
let school: string;
let courseId: string;

const outbox = (kind: string, user?: string) =>
  db.sql<{ kind: string; payload: Record<string, unknown> }>(`select kind, payload from public.notification_outbox where kind = $1 ${user ? "and user_id = $2" : ""} order by created_at`, user ? [kind, user] : [kind]);

beforeAll(async () => {
  db = await TestDb.create();
  admin = await db.createAdmin();
  manager = await db.createUser(`ent.${uid()}@sanady.test`);
  await db.rpc(admin, "set_platform_role", [manager, "enterprise_manager"]);
  teacher = await db.createUser(`prof.${uid()}@ecole.test`);
  quiet = await db.createUser(`calme.${uid()}@ecole.test`);
  await db.as(quiet, (q) => q(`update public.profiles set email_notifications = false where id = auth.uid()`));
  [{ id: school }] = (await db.sql<{ id: string }>(`insert into public.institutions (name, identifier, type, contact_email) values ('École Notif', $1, 'autre', 'n@n.test') returning id`, [`EC-${uid().toUpperCase()}`])) as [{ id: string }];
  courseId = (await buildCourse(db, admin, { modules: [{ lessons: [{ kind: "pdf" }], questions: [{ kind: "single", options: [true, false] }] }] }, { title: "Formation notifiée" })).courseId;
});
afterAll(async () => db?.close());

describe("e-mail notifications", () => {
  it("queue a message when a course is assigned, respecting the person's preference", async () => {
    for (const u of [teacher, quiet]) await db.sql(`insert into public.course_assignments (institution_id, user_id, course_id, due_on) values ($1, $2, $3, current_date + 3)`, [school, u, courseId]);
    const rows = await outbox("course_assigned", teacher);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.payload).toMatchObject({ course: "Formation notifiée", institution: "École Notif" });
    expect(await outbox("course_assigned", quiet)).toEqual([]);
  });

  it("send daily reminders once only", async () => {
    expect(await db.rpcError(manager, "queue_daily_notifications", [])).toMatch(/permission denied/);
    await db.rpc(null, "queue_daily_notifications", [], "service_role");
    await db.rpc(null, "queue_daily_notifications", [], "service_role");
    expect(await outbox("assignment_due", teacher)).toHaveLength(1);
    expect(await outbox("assignment_due", quiet)).toEqual([]);
  });

  it("notify a certificate, and the support conversation — never internal notes", async () => {
    await db.sql(`insert into public.certificates (user_id, course_id, certificate_number, verification_code, recipient_name, course_title, completed_at) values ($1, $2, 'SND-2026-AAAA0001', $3, 'Prof', 'Formation notifiée', now())`, [teacher, courseId, `${uid()}${uid()}${uid()}${uid()}`]);
    expect(await outbox("certificate_issued", teacher)).toHaveLength(1);

    const [{ id: org }] = (await db.sql<{ id: string }>(`insert into public.partner_organizations (name, org_type, enterprise_status) values ('Société Notif', 'entreprise', 'active_service') returning id`)) as [{ id: string }];
    await db.sql(`select set_config('sanady.tenant_sync', 'on', false)`);
    const [{ id: inst }] = (await db.sql<{ id: string }>(`insert into public.institutions (name, identifier, type, contact_email, kind) values ('Société Notif', $1, 'autre', 's@s.test', 'enterprise') returning id`, [`ENT-${uid().toUpperCase()}`])) as [{ id: string }];
    await db.sql(`insert into public.enterprise_tenants (organization_id, institution_id, slug, display_name, service_plan, max_learners, status, activated_at) values ($1, $2, $3, 'Société Notif', 'complete', 10, 'active', now())`, [org, inst, `n-${uid()}`]);
    await db.sql(`select set_config('sanady.tenant_sync', '', false)`);
    const companyAdmin = await db.createUser(`admin.${uid()}@societe.test`);
    await db.sql(`insert into public.institution_memberships (institution_id, user_id, role, source) values ($1, $2, 'admin', 'admin')`, [inst, companyAdmin]);
    const req = await db.rpc<string>(companyAdmin, "open_support_request", [inst, JSON.stringify({ category: "access", priority: "urgent", subject: "Accès impossible", body: "Personne ne peut se connecter ce matin." })]);
    expect(await outbox("support_opened", manager)).toHaveLength(1);
    // The opening message does not notify twice; an internal note never notifies.
    expect(await outbox("support_client_reply")).toEqual([]);
    await db.rpc(manager, "post_support_message", [req, "Note : vérifier les journaux.", true]);
    expect(await outbox("support_reply", companyAdmin)).toEqual([]);
    await db.rpc(manager, "post_support_message", [req, "Nous regardons cela.", false]);
    expect(await outbox("support_reply", companyAdmin)).toHaveLength(1);
    await db.rpc(companyAdmin, "post_support_message", [req, "Merci, voici une capture.", false]);
    expect(await outbox("support_client_reply", manager)).toHaveLength(1);
  });

  it("are sent by the server only, each message claimed once", async () => {
    expect(await db.rpcError(teacher, "claim_notifications", [10])).toMatch(/permission denied/);
    const first = await db.as(null, (q) => q<{ id: string; email: string }>(`select * from public.claim_notifications(100)`), "service_role");
    expect(first.length).toBeGreaterThan(0);
    expect(first.every((r) => r.email.includes("@"))).toBe(true);
    const again = await db.as(null, (q) => q(`select * from public.claim_notifications(100)`), "service_role");
    expect(again).toEqual([]);
    await db.rpc(null, "complete_notification", [first[0]!.id, true, null], "service_role");
    const [r] = await db.sql<{ status: string }>(`select status from public.notification_outbox where id = $1`, [first[0]!.id]);
    expect(r!.status).toBe("sent");
  });
});
