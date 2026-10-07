/**
 * Scenarios 1–4: invitation acceptance, expired invitations,
 * institution creation, institutional enrollment (invitation and code).
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

async function createInstitution(by = admin) {
  return db.as(by, async (q) => {
    const [row] = await q<{ id: string }>(
      `insert into public.institutions (name, identifier, type, contact_email)
       values ($1, $2, 'lycee', 'contact@lycee.test') returning id`,
      [`Lycée ${uid()}`, `LYC-${uid().toUpperCase()}`],
    );
    return row!.id;
  });
}

async function makeInstitutionAdmin(institutionId: string) {
  const email = `direction.${uid()}@lycee.test`;
  const { hash } = newToken();
  await db.rpc(admin, "create_invitation", ["institution_admin", email, institutionId, hash]);
  const userId = await db.createUser(email, "Directrice", "Pédagogique");
  await db.rpc(null, "accept_invitation", [hash, userId, false], "service_role");
  return userId;
}

describe("1. Secure invitation acceptance", () => {
  it("activates an individual teacher exactly once", async () => {
    const email = `enseignant.${uid()}@ecole.test`;
    const { hash } = newToken();
    await db.rpc(admin, "create_invitation", ["teacher", email, null, hash]);

    const described = await db.rpc<{ state: string; account_exists: boolean }>(null, "describe_invitation", [hash], "service_role");
    expect(described).toMatchObject({ state: "valid", account_exists: false });

    const teacher = await db.createUser(email);
    const result = await db.rpc<{ kind: string }>(null, "accept_invitation", [hash, teacher, false], "service_role");
    expect(result.kind).toBe("teacher");

    // Single use: a second acceptance is refused.
    expect(await db.rpcError(null, "accept_invitation", [hash, teacher, false], "service_role")).toBe(
      "invitation_already_accepted",
    );
  });

  it("stores only the token hash and hides it from clients", async () => {
    const email = `hash.${uid()}@ecole.test`;
    const { token, hash } = newToken();
    const id = await db.rpc<string>(admin, "create_invitation", ["teacher", email, null, hash]);
    const [row] = await db.sql<{ token_hash: string }>(`select token_hash from public.invitations where id = $1`, [id]);
    expect(row!.token_hash).toBe(hash);
    expect(row!.token_hash).not.toContain(token);
    await expect(db.as(admin, (q) => q(`select token_hash from public.invitations`))).rejects.toThrow(/permission denied/);
  });

  it("rejects acceptance by an account with a different e-mail", async () => {
    const { hash } = newToken();
    await db.rpc(admin, "create_invitation", ["teacher", `cible.${uid()}@ecole.test`, null, hash]);
    const intruder = await db.createUser(`intrus.${uid()}@ecole.test`);
    expect(await db.rpcError(null, "accept_invitation", [hash, intruder, false], "service_role")).toBe(
      "invitation_email_mismatch",
    );
  });

  it("is not callable by learners or anonymous visitors", async () => {
    const { hash } = newToken();
    await db.rpc(admin, "create_invitation", ["teacher", `x.${uid()}@ecole.test`, null, hash]);
    const someone = await db.createUser(`y.${uid()}@ecole.test`);
    expect(await db.rpcError(someone, "accept_invitation", [hash, someone, false])).toMatch(/permission denied/);
    expect(await db.rpcError(null, "accept_invitation", [hash, someone, false], "anon")).toMatch(/permission denied/);
  });

  it("forbids teachers from inviting anyone", async () => {
    const teacher = await db.createUser(`t.${uid()}@ecole.test`);
    expect(await db.rpcError(teacher, "create_invitation", ["teacher", `z.${uid()}@ecole.test`, null, newToken().hash])).toBe(
      "forbidden",
    );
  });

  it("supports revocation and replaces a previous open invitation", async () => {
    const email = `rev.${uid()}@ecole.test`;
    const first = newToken();
    const second = newToken();
    const firstId = await db.rpc<string>(admin, "create_invitation", ["teacher", email, null, first.hash]);
    await db.rpc(admin, "create_invitation", ["teacher", email, null, second.hash]);
    const [old] = await db.sql<{ revoked_at: string | null }>(`select revoked_at from public.invitations where id = $1`, [firstId]);
    expect(old!.revoked_at).not.toBeNull();

    const secondId = (await db.sql<{ id: string }>(`select id from public.invitations where token_hash = $1`, [second.hash]))[0]!.id;
    await db.rpc(admin, "revoke_invitation", [secondId]);
    const user = await db.createUser(email);
    expect(await db.rpcError(null, "accept_invitation", [second.hash, user, false], "service_role")).toBe("invitation_revoked");
  });

  it("records invitations in the audit log", async () => {
    const { hash } = newToken();
    const id = await db.rpc<string>(admin, "create_invitation", ["teacher", `audit.${uid()}@ecole.test`, null, hash]);
    const logs = await db.as(admin, (q) =>
      q<{ action: string; actor_id: string }>(`select action, actor_id from public.audit_logs where entity_id = $1`, [id]),
    );
    expect(logs).toContainEqual({ action: "insert", actor_id: admin });
  });
});

describe("2. Expired invitation rejection", () => {
  it("refuses an expired invitation and reports it as expired", async () => {
    const email = `expire.${uid()}@ecole.test`;
    const { hash } = newToken();
    await db.rpc(admin, "create_invitation", ["teacher", email, null, hash]);
    await db.sql(`update public.invitations set expires_at = now() - interval '1 minute' where token_hash = $1`, [hash]);

    const described = await db.rpc<{ state: string }>(null, "describe_invitation", [hash], "service_role");
    expect(described.state).toBe("expired");

    const user = await db.createUser(email);
    expect(await db.rpcError(null, "accept_invitation", [hash, user, false], "service_role")).toBe("invitation_expired");
  });
});

describe("3. Institution creation", () => {
  it("lets SANADY administrators create institutions", async () => {
    const id = await createInstitution();
    const rows = await db.as(admin, (q) => q(`select id from public.institutions where id = $1`, [id]));
    expect(rows).toHaveLength(1);
  });

  it("refuses institution creation by anyone else", async () => {
    const teacher = await db.createUser(`t.${uid()}@ecole.test`);
    await expect(createInstitution(teacher)).rejects.toThrow(/row-level security/);
  });

  it("validates the institution identifier format", async () => {
    await expect(
      db.as(admin, (q) =>
        q(`insert into public.institutions (name, identifier, type, contact_email) values ('X Y', 'bad id', 'lycee', 'a@b.co')`),
      ),
    ).rejects.toThrow(/check constraint/);
  });

  it("onboards the institution administrator through an invitation", async () => {
    const inst = await createInstitution();
    const director = await makeInstitutionAdmin(inst);
    const [m] = await db.sql<{ role: string; status: string }>(
      `select role, status from public.institution_memberships where institution_id = $1 and user_id = $2`,
      [inst, director],
    );
    expect(m).toEqual({ role: "admin", status: "active" });
    const overview = await db.rpc<{ registered_teachers: number }>(director, "institution_overview", [inst]);
    expect(overview.registered_teachers).toBe(0);
  });
});

describe("4. Institutional enrollment", () => {
  it("method A — e-mail invitation requires explicit consent", async () => {
    const inst = await createInstitution();
    const director = await makeInstitutionAdmin(inst);
    const email = `prof.${uid()}@ecole.test`;
    const { hash } = newToken();
    await db.rpc(director, "create_invitation", ["institution_teacher", email, inst, hash]);
    const teacher = await db.createUser(email);

    expect(await db.rpcError(null, "accept_invitation", [hash, teacher, false], "service_role")).toBe("consent_required");
    await db.rpc(null, "accept_invitation", [hash, teacher, true], "service_role");

    const members = await db.as(director, (q) =>
      q<{ user_id: string; consented_at: string | null }>(
        `select user_id, consented_at from public.institution_memberships where institution_id = $1 and role = 'teacher'`,
        [inst],
      ),
    );
    expect(members).toHaveLength(1);
    expect(members[0]!.consented_at).not.toBeNull();
  });

  it("institution admins can only invite into their own institution", async () => {
    const instA = await createInstitution();
    const instB = await createInstitution();
    const directorA = await makeInstitutionAdmin(instA);
    expect(
      await db.rpcError(directorA, "create_invitation", ["institution_teacher", `x.${uid()}@e.test`, instB, newToken().hash]),
    ).toBe("forbidden");
    expect(await db.rpcError(directorA, "create_invitation", ["teacher", `x.${uid()}@e.test`, null, newToken().hash])).toBe(
      "forbidden",
    );
  });

  it("method B — enrollment codes enforce consent, limits, expiry and revocation", async () => {
    const inst = await createInstitution();
    const director = await makeInstitutionAdmin(inst);
    const codeId = await db.rpc<string>(director, "create_enrollment_code", [
      inst, "ABCD-EFGH-JK23", "Rentrée", 2, new Date(Date.now() + 86_400_000).toISOString(),
    ]);

    const t1 = await db.createUser(`c1.${uid()}@e.test`);
    const t2 = await db.createUser(`c2.${uid()}@e.test`);
    const t3 = await db.createUser(`c3.${uid()}@e.test`);

    expect(await db.rpcError(t1, "redeem_enrollment_code", ["ABCD-EFGH-JK23", false])).toBe("consent_required");
    await db.rpc(t1, "redeem_enrollment_code", ["abcd-efgh-jk23", true]); // case-insensitive
    expect(await db.rpcError(t1, "redeem_enrollment_code", ["ABCD-EFGH-JK23", true])).toBe("already_member");
    await db.rpc(t2, "redeem_enrollment_code", ["ABCD-EFGH-JK23", true]);
    expect(await db.rpcError(t3, "redeem_enrollment_code", ["ABCD-EFGH-JK23", true])).toBe("code_exhausted");

    const [code] = await db.sql<{ uses_count: number }>(`select uses_count from public.enrollment_codes where id = $1`, [codeId]);
    expect(code!.uses_count).toBe(2);

    // Expiry and revocation.
    const expiring = await db.rpc<string>(director, "create_enrollment_code", [
      inst, "MNPQ-RSTU-VW45", null, 10, new Date(Date.now() + 86_400_000).toISOString(),
    ]);
    await db.sql(`update public.enrollment_codes set expires_at = now() - interval '1 second' where id = $1`, [expiring]);
    expect(await db.rpcError(t3, "redeem_enrollment_code", ["MNPQ-RSTU-VW45", true])).toBe("code_expired");

    const revocable = await db.rpc<string>(director, "create_enrollment_code", [
      inst, "XYZA-BCDE-FG67", null, 10, new Date(Date.now() + 86_400_000).toISOString(),
    ]);
    await db.rpc(director, "revoke_enrollment_code", [revocable]);
    expect(await db.rpcError(t3, "redeem_enrollment_code", ["XYZA-BCDE-FG67", true])).toBe("code_revoked");
    expect(await db.rpcError(t3, "redeem_enrollment_code", ["NOPE-NOPE-NOPE", true])).toBe("invalid_code");
  });

  it("method B for new accounts — e-mail verification invitation bound to the code", async () => {
    const inst = await createInstitution();
    const director = await makeInstitutionAdmin(inst);
    await db.rpc(director, "create_enrollment_code", [
      inst, "HJKL-MNPQ-RS89", null, 1, new Date(Date.now() + 86_400_000).toISOString(),
    ]);
    const email = `nouveau.${uid()}@e.test`;
    const { hash } = newToken();
    await db.rpc(null, "create_code_invitation", ["HJKL-MNPQ-RS89", email, hash], "service_role");
    const user = await db.createUser(email);
    await db.rpc(null, "accept_invitation", [hash, user, true], "service_role");

    const [m] = await db.sql<{ source: string }>(
      `select source from public.institution_memberships where institution_id = $1 and user_id = $2`,
      [inst, user],
    );
    expect(m!.source).toBe("code");
    // Code is now exhausted (max 1).
    const state = await db.rpc<{ state: string }>(null, "describe_enrollment_code", ["HJKL-MNPQ-RS89"], "service_role");
    expect(state.state).toBe("exhausted");
  });

  it("a teacher can leave an institution; their own records remain", async () => {
    const inst = await createInstitution();
    const director = await makeInstitutionAdmin(inst);
    await db.rpc(director, "create_enrollment_code", [inst, "TUVW-XYZA-BC23", null, 5, new Date(Date.now() + 86_400_000).toISOString()]);
    const t = await db.createUser(`leave.${uid()}@e.test`);
    await db.rpc(t, "redeem_enrollment_code", ["TUVW-XYZA-BC23", true]);
    await db.rpc(t, "leave_institution", [inst]);
    const rows = await db.as(director, (q) =>
      q(`select 1 from public.institution_memberships where institution_id = $1 and user_id = $2 and status = 'active'`, [inst, t]),
    );
    expect(rows).toHaveLength(0);
  });
});
