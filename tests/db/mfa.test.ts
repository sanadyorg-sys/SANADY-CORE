/**
 * Administrator two-factor authentication is enforced by the database:
 * a password-only (aal1) session never carries administrator privileges.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, newToken, uid } from "./harness";

let db: TestDb;
let admin: string;

beforeAll(async () => {
  db = await TestDb.create();
  admin = await db.createAdmin();
});
afterAll(async () => db?.close());

describe("administrator 2FA", () => {
  it("grants admin privileges to a two-factor (aal2) session", async () => {
    const overview = await db.as(admin, (q) => q<{ o: { institutions: number } }>(`select public.platform_overview() as o`));
    expect(overview[0]!.o).toHaveProperty("institutions");
  });

  it("refuses admin functions to a password-only (aal1) session", async () => {
    await expect(
      db.as(admin, (q) => q(`select public.platform_overview()`), "authenticated", "aal1"),
    ).rejects.toThrow(/forbidden/);
    await expect(
      db.as(admin, (q) => q(`select public.create_invitation('teacher', $1, null, $2)`, [`x.${uid()}@e.test`, newToken().hash]), "authenticated", "aal1"),
    ).rejects.toThrow(/forbidden/);
  });

  it("refuses admin table writes and admin-only reads to an aal1 session", async () => {
    await expect(
      db.as(admin, (q) => q(`insert into public.courses (title) values ('Cours sans 2FA')`), "authenticated", "aal1"),
    ).rejects.toThrow(/row-level security/);
    const logs = await db.as(admin, (q) => q(`select id from public.audit_logs`), "authenticated", "aal1");
    expect(logs).toEqual([]);
  });

  it("still lets the administrator see their own role (to be guided to 2FA)", async () => {
    const rows = await db.as(admin, (q) => q(`select role from public.platform_roles where user_id = $1`, [admin]), "authenticated", "aal1");
    expect(rows).toHaveLength(1);
  });

  it("does not affect regular users, who keep working with aal1", async () => {
    const teacher = await db.createUser(`t.${uid()}@e.test`);
    const rows = await db.as(teacher, (q) => q(`select id from public.profiles where id = $1`, [teacher]), "authenticated", "aal1");
    expect(rows).toHaveLength(1);
  });
});
