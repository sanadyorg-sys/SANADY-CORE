/**
 * Public site: only published courses explicitly listed by a SANADY
 * administrator are visible to visitors, without content or media; access
 * requests are server-only and readable by SANADY administrators only.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, buildCourse, newToken, uid } from "./harness";

let db: TestDb;
let admin: string;
let listed: string;
let unlisted: string;
let draft: string;

const spec = {
  modules: [
    { lessons: [{ kind: "video" as const, mandatory: false, duration: 85 }, { kind: "pdf" as const, pages: 3 }], questions: [{ kind: "single" as const, options: [true, false] }] },
  ],
};

beforeAll(async () => {
  db = await TestDb.create();
  admin = await db.createAdmin();
  listed = (await buildCourse(db, admin, spec, { title: "Cours public" })).courseId;
  unlisted = (await buildCourse(db, admin, spec, { title: "Cours réservé" })).courseId;
  draft = (await buildCourse(db, admin, spec, { publish: false, title: "Cours brouillon" })).courseId;
  await db.as(admin, (q) => q(`update public.courses set public_listing = true where id = any($1::uuid[])`, [[listed, draft]]));
});
afterAll(async () => db?.close());

type Catalog = { courses: Array<{ id: string; lesson_count: number; video_count: number; quiz_count: number }>; stats: { courses: number } };

describe("public catalog", () => {
  it("lists only published courses marked for public listing", async () => {
    const catalog = await db.rpc<Catalog>(null, "public_catalog", [], "anon");
    expect(catalog.courses.map((c) => c.id)).toEqual([listed]);
    expect(catalog.courses[0]).toMatchObject({ lesson_count: 2, video_count: 1, quiz_count: 1 });
    expect(catalog.stats.courses).toBe(1);
  });

  it("describes a listed course's program without any media reference or answer", async () => {
    const course = await db.rpc<Record<string, unknown>>(null, "public_course", [listed], "anon");
    expect(course).toMatchObject({ title: "Cours public" });
    const text = JSON.stringify(course);
    expect(text).not.toContain("x/y.mp4");
    expect(text).not.toContain("x/y.pdf");
    expect(text).not.toContain("is_correct");
    expect(text).toContain("question_count");
  });

  it("returns nothing for unlisted or draft courses", async () => {
    expect(await db.rpc(null, "public_course", [unlisted], "anon")).toBeNull();
    expect(await db.rpc(null, "public_course", [draft], "anon")).toBeNull();
  });
});

describe("access requests", () => {
  it("cannot be created directly by visitors or users", async () => {
    const args = ["Amal", "Bennani", `amal.${uid()}@e.test`];
    expect(await db.rpcError(null, "request_access", args, "anon")).toMatch(/permission denied/);
    expect(await db.rpcError(admin, "request_access", args)).toMatch(/permission denied/);
  });

  it("keeps one pending request per address and ignores existing accounts", async () => {
    const email = `amal.${uid()}@e.test`;
    await db.rpc(null, "request_access", ["Amal", "Bennani", email, null, null, null, null, "Premier message", listed], "service_role");
    await db.rpc(null, "request_access", ["Amal", "Bennani", email.toUpperCase(), null, null, null, null, "Second message", null], "service_role");
    const rows = await db.sql<{ message: string; course_id: string }>(`select message, course_id from public.access_requests where email = $1`, [email]);
    expect(rows).toEqual([{ message: "Second message", course_id: listed }]);

    const existing = `deja.${uid()}@e.test`;
    await db.createUser(existing);
    await db.rpc(null, "request_access", ["Déjà", "Inscrit", existing], "service_role");
    expect(await db.sql(`select 1 from public.access_requests where email = $1`, [existing])).toEqual([]);
  });

  it("are visible to and resolved by SANADY administrators only", async () => {
    const email = `karim.${uid()}@e.test`;
    await db.rpc(null, "request_access", ["Karim", "Tazi", email], "service_role");
    const [req] = await db.sql<{ id: string }>(`select id from public.access_requests where email = $1`, [email]);

    const teacher = await db.createUser(`t.${uid()}@e.test`);
    expect(await db.as(teacher, (q) => q(`select id from public.access_requests`))).toEqual([]);
    expect(await db.rpcError(teacher, "resolve_access_request", [req!.id, "rejected", null])).toMatch(/forbidden/);
    expect(await db.rpcError(admin, "resolve_access_request", [req!.id, "approved", null])).toMatch(/invalid_input/);

    const invitationId = await db.rpc<string>(admin, "create_invitation", ["teacher", email, null, newToken().hash]);
    await db.rpc(admin, "resolve_access_request", [req!.id, "approved", invitationId]);
    const [after] = await db.sql<{ status: string; handled_by: string }>(`select status, handled_by from public.access_requests where id = $1`, [req!.id]);
    expect(after).toEqual({ status: "approved", handled_by: admin });
    expect(await db.rpcError(admin, "resolve_access_request", [req!.id, "rejected", null])).toMatch(/not_found/);
  });

  it("records institution partnership requests, approvable without an invitation", async () => {
    const email = `direction.${uid()}@e.test`;
    await db.createUser(email);
    await db.rpc(null, "request_access", ["Nadia", "Berrada", email, null, null, "Lycée Test", "Rabat", "Partenariat", null, "institution"], "service_role");
    const [req] = await db.sql<{ id: string; kind: string }>(`select id, kind from public.access_requests where email = $1`, [email]);
    expect(req!.kind).toBe("institution");
    await db.rpc(admin, "resolve_access_request", [req!.id, "approved", null]);
  });
});
