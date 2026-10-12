/**
 * Partenariats & Coopération (brief V2, phases 1–2): public applications, partnership
 * staff, the organisation pipeline and signing authority. Every boundary is
 * enforced by the database.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, uid } from "./harness";

let db: TestDb;
let admin: string;
let otherAdmin: string;
let coordinator: string;
let manager: string;
let trainingManager: string;
let teacher: string;

const APPLICATION = {
  org_name: "Fondation Exemple",
  org_type: "fondation",
  country: "Maroc",
  city: "Rabat",
  website: "https://exemple.test",
  sector: "Éducation",
  org_description: "Une fondation d’entreprise engagée pour l’éducation au Maroc.",
  contact_name: "Samira Benali",
  contact_title: "Responsable RSE",
  contact_email: "Samira.Benali@Exemple.test",
  contact_phone: "+212 600 000 000",
  intervention_field: "formation-continue",
  contribution_type: "financier",
  contribution: "Soutien financier à la production.",
  cooperation: "Financer la production de trois formations en ligne pour les enseignants du primaire.",
};

async function submit(overrides: Record<string, unknown> = {}, documents: unknown[] = []) {
  const id = randomUUID();
  const ref = await db.rpc<string>(null, "submit_partnership_application", [id, JSON.stringify({ ...APPLICATION, ...overrides }), JSON.stringify(documents)], "service_role");
  return { id, ref };
}

async function staff(role: string) {
  const id = await db.createUser(`${role}.${uid()}@sanady.test`);
  await db.rpc(admin, "set_platform_role", [id, role]);
  return id;
}

beforeAll(async () => {
  db = await TestDb.create();
  admin = await db.createAdmin();
  otherAdmin = await db.createAdmin();
  coordinator = await staff("partnership_coordinator");
  manager = await staff("partnership_manager");
  trainingManager = await staff("training_manager");
  teacher = await db.createUser(`prof.${uid()}@sanady.test`);
});
afterAll(async () => db?.close());

describe("public application", () => {
  it("is accepted only from the server (service role) and gets a reference", async () => {
    const { id, ref } = await submit({ org_name: "Entreprise A" });
    expect(ref).toMatch(/^PART-\d{4}-\d{4}$/);
    const [row] = await db.sql<{ status: string; contact_email: string }>(`select status, contact_email from public.partnership_applications where id = $1`, [id]);
    expect(row).toEqual({ status: "received", contact_email: "samira.benali@exemple.test" });
    expect(await db.rpcError(null, "submit_partnership_application", [randomUUID(), JSON.stringify(APPLICATION), "[]"], "anon")).toMatch(/permission denied/);
    expect(await db.rpcError(teacher, "submit_partnership_application", [randomUUID(), JSON.stringify(APPLICATION), "[]"])).toMatch(/permission denied/);
  });

  it("returns the same reference for a double submission", async () => {
    const first = await submit({ org_name: "Entreprise Doublon" });
    const second = await submit({ org_name: "Entreprise Doublon" });
    expect(second.ref).toBe(first.ref);
  });

  it("validates fields and documents", async () => {
    await expect(submit({ org_name: "Courte", cooperation: "Trop court" })).rejects.toThrow(/check constraint/);
    await expect(submit({ org_name: "Mauvais type", contribution_type: "commission" })).rejects.toThrow(/invalid input value/);
    await expect(submit({ org_name: "Mauvais domaine", intervention_field: "marketing" })).rejects.toThrow(/invalid_input/);
    const id0 = randomUUID();
    const word = [{ path: `applications/${id0}/a.docx`, name: "a.docx", mime: "application/msword", size: 10 }];
    expect(await db.rpcError(null, "submit_partnership_application", [id0, JSON.stringify({ ...APPLICATION, org_name: "Word" }), JSON.stringify(word)], "service_role")).toMatch(/invalid_input/);
    const id = randomUUID();
    const bad = [{ path: "applications/other/x.pdf", name: "x.pdf", mime: "application/pdf", size: 10 }];
    expect(await db.rpcError(null, "submit_partnership_application", [id, JSON.stringify({ ...APPLICATION, org_name: "Chemin" }), JSON.stringify(bad)], "service_role")).toMatch(/invalid_input/);
    const good = [{ path: `applications/${id}/projet.pdf`, name: "projet.pdf", mime: "application/pdf", size: 2048 }];
    await db.rpc(null, "submit_partnership_application", [id, JSON.stringify({ ...APPLICATION, org_name: "Avec document" }), JSON.stringify(good)], "service_role");
    const docs = await db.sql(`select file_name from public.partnership_documents where application_id = $1`, [id]);
    expect(docs).toEqual([{ file_name: "projet.pdf" }]);
  });
});

describe("who can read", () => {
  it("partnership staff only, from a two-factor session", async () => {
    await submit({ org_name: "Lisible" });
    const count = (u: string, aal: "aal1" | "aal2" = "aal2") =>
      db.as(u, (q) => q<{ n: number }>(`select count(*)::int as n from public.partnership_applications`), "authenticated", aal).then((r) => r[0]!.n);
    expect(await count(coordinator)).toBeGreaterThan(0);
    expect(await count(manager)).toBeGreaterThan(0);
    expect(await count(admin)).toBeGreaterThan(0);
    expect(await count(coordinator, "aal1")).toBe(0);
    expect(await count(trainingManager)).toBe(0);
    expect(await count(teacher)).toBe(0);
    expect(await db.as(null, (q) => q(`select id from public.partnership_applications`), "anon").catch((e: Error) => e.message)).toMatch(/permission denied/);
  });
});

describe("application review", () => {
  it("follows the allowed transitions and keeps the history", async () => {
    const { id } = await submit({ org_name: "Transitions" });
    expect(await db.rpcError(teacher, "set_partnership_application_status", [id, "under_review", null])).toMatch(/forbidden/);
    await db.rpc(coordinator, "set_partnership_application_status", [id, "under_review", "Premier examen"]);
    expect(await db.rpcError(coordinator, "set_partnership_application_status", [id, "spam", null])).toMatch(/invalid_transition/);
    await db.rpc(coordinator, "set_partnership_application_status", [id, "declined", "Hors champ"]);
    await db.rpc(coordinator, "set_partnership_application_status", [id, "under_review", "Réouverte"]);
    const history = await db.sql<{ to_status: string }>(`select to_status from public.partnership_status_history where application_id = $1 order by created_at, id`, [id]);
    expect(history.map((h) => h.to_status).sort()).toEqual(["declined", "received", "under_review", "under_review"].sort());
  });

  it("creates the organisation and its primary contact from an application", async () => {
    const { id } = await submit({ org_name: "Future Partenaire" });
    const org = await db.rpc<string>(manager, "create_partner_from_application", [id]);
    const [o] = await db.sql<{ name: string; status: string; fields: string; contributions: string }>(
      `select name, status, fields::text, contributions::text from public.partner_organizations where id = $1`,
      [org],
    );
    expect(o).toEqual({ name: "Future Partenaire", status: "proposal_received", fields: "{formation-continue}", contributions: "{financier}" });
    const [c] = await db.sql<{ is_primary: boolean; email: string }>(`select is_primary, email from public.partner_contacts where organization_id = $1`, [org]);
    expect(c).toEqual({ is_primary: true, email: "samira.benali@exemple.test" });
    const [a] = await db.sql<{ status: string; organization_id: string }>(`select status, organization_id from public.partnership_applications where id = $1`, [id]);
    expect(a).toEqual({ status: "accepted", organization_id: org });
    expect(await db.rpcError(manager, "create_partner_from_application", [id])).toMatch(/invalid_transition/);
  });

  it("keeps notes internal to the partnership team", async () => {
    const { id } = await submit({ org_name: "Notes" });
    await db.rpc(coordinator, "add_partnership_note", [id, null, "Appel prévu jeudi."]);
    expect(await db.rpcError(teacher, "add_partnership_note", [id, null, "x"])).toMatch(/forbidden/);
    const read = (u: string) => db.as(u, (q) => q(`select body from public.partnership_notes where application_id = $1`, [id]));
    expect(await read(manager)).toEqual([{ body: "Appel prévu jeudi." }]);
    expect(await read(trainingManager)).toEqual([]);
  });
});

describe("pipeline and institutional approval", () => {
  let org: string;

  beforeAll(async () => {
    org = await db.rpc<string>(coordinator, "save_partner_organization", [
      null,
      JSON.stringify({ name: "Université Partenaire", org_type: "universite", fields: ["orientation", "bourses"], contributions: ["expertise"] }),
    ]);
  });

  it("rejects unknown fields of intervention", async () => {
    expect(await db.rpcError(coordinator, "save_partner_organization", [null, JSON.stringify({ name: "X", org_type: "autre", fields: ["marketing"] })])).toMatch(/invalid_input/);
  });

  it("lets staff move the early steps and only the manager submit for validation", async () => {
    await db.rpc(coordinator, "set_partner_status", [org, "negotiation", null]);
    expect(await db.rpcError(coordinator, "set_partner_status", [org, "institutional_validation", null])).toMatch(/forbidden/);
    expect(await db.rpcError(admin, "set_partner_status", [org, "institutional_validation", null])).toMatch(/forbidden/);
    await db.rpc(manager, "set_partner_status", [org, "institutional_validation", "Recommandée"]);
    // Under validation, the early steps are closed to everyone.
    expect(await db.rpcError(coordinator, "set_partner_status", [org, "negotiation", null])).toMatch(/invalid_transition/);
    // An administrator is not an approver by default; neither is the manager.
    expect(await db.rpcError(admin, "set_partner_status", [org, "agreement_signed", null])).toMatch(/forbidden/);
    expect(await db.rpcError(manager, "set_partner_status", [org, "agreement_signed", null])).toMatch(/forbidden/);
    expect(await db.rpcError(coordinator, "set_partner_status", [org, "rejected", null])).toMatch(/forbidden/);
  });

  it("never lets an administrator appoint themself as approver", async () => {
    expect(await db.rpcError(admin, "set_partnership_signatory", [admin, true])).toMatch(/forbidden/);
    expect(await db.rpcError(manager, "set_partnership_signatory", [manager, true])).toMatch(/forbidden/);
    expect(await db.rpcError(admin, "set_partnership_signatory", [teacher, true])).toMatch(/invalid_input/);
    await db.rpc(otherAdmin, "set_partnership_signatory", [admin, true]);
    expect(await db.rpcError(otherAdmin, "set_partnership_signatory", [admin, true])).toMatch(/already_exists/);
  });

  it("requires the grant and a two-factor session to validate, then follows implementation", async () => {
    await expect(
      db.as(admin, (q) => q(`select public.set_partner_status($1, 'agreement_signed', null)`, [org]), "authenticated", "aal1"),
    ).rejects.toThrow(/forbidden/);
    await db.rpc(admin, "set_partner_status", [org, "agreement_signed", "Convention validée"]);
    expect(await db.rpcError(coordinator, "set_partner_status", [org, "monitoring", null])).toMatch(/invalid_transition/);
    await db.rpc(coordinator, "set_partner_status", [org, "implementation", null]);
    await db.rpc(coordinator, "set_partner_status", [org, "monitoring", null]);
    await db.rpc(coordinator, "set_partner_status", [org, "renewal_or_closure", null]);
    const [o] = await db.sql<{ status: string }>(`select status from public.partner_organizations where id = $1`, [org]);
    expect(o!.status).toBe("renewal_or_closure");
  });

  it("lets an approver reject a partnership under validation, and stops once the grant is revoked", async () => {
    const make = async (name: string) => {
      const id = await db.rpc<string>(coordinator, "save_partner_organization", [null, JSON.stringify({ name, org_type: "entreprise" })]);
      await db.rpc(coordinator, "set_partner_status", [id, "evaluation", null]);
      await db.rpc(manager, "set_partner_status", [id, "institutional_validation", null]);
      return id;
    };
    const refused = await make("Entreprise refusée");
    await db.rpc(admin, "set_partner_status", [refused, "rejected", "Hors mission"]);
    const later = await make("Entreprise B");
    await db.rpc(otherAdmin, "set_partnership_signatory", [admin, false]);
    expect(await db.rpcError(admin, "set_partner_status", [later, "agreement_signed", null])).toMatch(/forbidden/);
  });

  it("records every decision in the audit trail and the history", async () => {
    const rows = await db.sql<{ action: string }>(`select action from public.audit_logs where entity_id = $1`, [org]);
    expect(rows.map((r) => r.action)).toEqual(expect.arrayContaining(["partner_created", "partner_status"]));
    const history = await db.sql<{ to_status: string }>(`select to_status from public.partnership_status_history where organization_id = $1`, [org]);
    expect(history.map((h) => h.to_status)).toEqual(expect.arrayContaining(["prospect", "institutional_validation", "agreement_signed", "renewal_or_closure"]));
  });
});

describe("follow-up tasks", () => {
  it("are created, assigned to partnership staff only and closed", async () => {
    const org = await db.rpc<string>(coordinator, "save_partner_organization", [null, JSON.stringify({ name: "Fondation T", org_type: "fondation" })]);
    const task = await db.rpc<string>(coordinator, "save_partnership_task", [null, org, "Relancer pour la proposition écrite", "2026-11-02", manager]);
    expect(await db.rpcError(coordinator, "save_partnership_task", [null, org, "Tâche", null, teacher])).toMatch(/invalid_input/);
    expect(await db.rpcError(teacher, "save_partnership_task", [null, org, "Tâche", null, null])).toMatch(/forbidden/);
    await db.rpc(manager, "set_partnership_task_done", [task, true]);
    const [t] = await db.sql<{ done: boolean; assigned_to: string }>(`select done_at is not null as done, assigned_to from public.partnership_tasks where id = $1`, [task]);
    expect(t).toEqual({ done: true, assigned_to: manager });
    expect(await db.as(trainingManager, (q) => q(`select id from public.partnership_tasks`))).toEqual([]);
  });
});

describe("fields of intervention", () => {
  it("are the Foundation's six programmes, readable when signed in and changed by no one directly", async () => {
    const rows = await db.as(teacher, (q) => q<{ slug: string }>(`select slug from public.intervention_fields order by position`));
    expect(rows.map((r) => r.slug)).toEqual(["soutien-scolaire", "formation-continue", "orientation", "bourses", "parascolaire", "rehabilitation"]);
    await expect(db.as(admin, (q) => q(`update public.intervention_fields set name = 'X'`))).rejects.toThrow(/permission denied/);
  });
});

describe("contacts", () => {
  it("keeps a single primary contact", async () => {
    const org = await db.rpc<string>(coordinator, "save_partner_organization", [null, JSON.stringify({ name: "Association C", org_type: "association" })]);
    await db.rpc(coordinator, "save_partner_contact", [null, org, JSON.stringify({ full_name: "Premier", is_primary: true })]);
    await db.rpc(coordinator, "save_partner_contact", [null, org, JSON.stringify({ full_name: "Second", email: "Second@Asso.test", is_primary: true })]);
    const rows = await db.sql<{ full_name: string; is_primary: boolean; email: string | null }>(`select full_name, is_primary, email from public.partner_contacts where organization_id = $1 order by full_name`, [org]);
    expect(rows).toEqual([
      { full_name: "Premier", is_primary: false, email: null },
      { full_name: "Second", is_primary: true, email: "second@asso.test" },
    ]);
  });
});

describe("retention", () => {
  it("purges only closed applications older than 24 months", async () => {
    const old = await submit({ org_name: "Ancienne refusée" });
    const recent = await submit({ org_name: "Récente refusée" });
    const open = await submit({ org_name: "Ancienne ouverte" });
    for (const a of [old, recent]) await db.rpc(coordinator, "set_partnership_application_status", [a.id, "declined", null]);
    await db.sql(`update public.partnership_applications set updated_at = now() - interval '25 months' where id = any($1)`, [[old.id, open.id]]);
    const n = await db.rpc<number>(null, "purge_partnership_applications", [[old.id, recent.id, open.id]], "service_role");
    expect(n).toBe(1);
    expect(await db.rpcError(admin, "purge_partnership_applications", [[recent.id]])).toMatch(/permission denied/);
  });
});
