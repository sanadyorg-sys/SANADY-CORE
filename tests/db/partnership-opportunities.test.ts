/**
 * Partenariats & Coopération, phase 3: educational needs and projects
 * seeking partners. A need never becomes public by itself; a project is
 * visible to visitors only once an approver has approved it and the team
 * has published it.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, uid } from "./harness";

let db: TestDb;
let admin: string;
let otherAdmin: string;
let coordinator: string;
let teacher: string;

const NEED = {
  title: "Équiper deux salles de classe rurales",
  intervention_field: "rehabilitation",
  description: "Deux salles de classe sans mobilier adapté dans une école partenaire.",
  justification: "Les élèves travaillent sur des tables abîmées, ce qui gêne les apprentissages.",
  priority: "high",
  estimated_cost: "45000",
};

const OPPORTUNITY = {
  title: "Mobilier pour deux salles de classe",
  intervention_field: "rehabilitation",
  summary: "Financer ou fournir le mobilier de deux salles de classe d’une école rurale.",
  description: "La Fondation recherche un partenaire pour équiper deux salles de classe d’une école rurale : tables, chaises et rangements.",
  objectives: "Offrir de bonnes conditions de travail à 60 élèves.",
  beneficiaries: "60 élèves du primaire",
  geographic_scope: "Région de Casablanca-Settat",
  contribution_types: ["financier", "equipement"],
  expected_contribution: "Mobilier ou financement équivalent.",
  funding_target: "45000",
};

async function staff(role: string) {
  const id = await db.createUser(`${role}.${uid()}@sanady.test`);
  await db.rpc(admin, "set_platform_role", [id, role]);
  return id;
}
const publicList = () => db.rpc<Array<Record<string, unknown>>>(null, "public_partnership_opportunities", [], "anon");

beforeAll(async () => {
  db = await TestDb.create();
  admin = await db.createAdmin();
  otherAdmin = await db.createAdmin();
  coordinator = await staff("partnership_coordinator");
  teacher = await db.createUser(`prof.${uid()}@sanady.test`);
  await db.rpc(otherAdmin, "set_partnership_signatory", [admin, true]);
});
afterAll(async () => db?.close());

describe("educational needs", () => {
  it("are recorded by the team, reviewed, then decided by an approver only", async () => {
    const need = await db.rpc<string>(coordinator, "save_educational_need", [null, JSON.stringify(NEED)]);
    const [n] = await db.sql<{ reference: string; status: string; estimated_cost: string }>(`select reference, status, estimated_cost::text from public.educational_needs where id = $1`, [need]);
    expect(n!.reference).toMatch(/^BES-\d{4}-\d{4}$/);
    expect(n!.status).toBe("identified");
    expect(n!.estimated_cost).toBe("45000.00");

    expect(await db.rpcError(coordinator, "set_need_status", [need, "approved", null])).toMatch(/invalid_transition/);
    await db.rpc(coordinator, "set_need_status", [need, "internal_review", null]);
    expect(await db.rpcError(coordinator, "set_need_status", [need, "approved", null])).toMatch(/forbidden/);
    expect(await db.rpcError(otherAdmin, "set_need_status", [need, "approved", null])).toMatch(/forbidden/);
    await db.rpc(admin, "set_need_status", [need, "approved", "Besoin prioritaire"]);
    // Decided needs are frozen.
    expect(await db.rpcError(coordinator, "save_educational_need", [need, JSON.stringify({ ...NEED, title: "Autre titre pour le besoin" })])).toMatch(/invalid_transition/);
  });

  it("are internal: invisible to other users and never published by themselves", async () => {
    expect(await db.as(teacher, (q) => q(`select id from public.educational_needs`))).toEqual([]);
    expect(await db.rpcError(teacher, "save_educational_need", [null, JSON.stringify(NEED)])).toMatch(/forbidden/);
    expect(await publicList()).toEqual([]);
  });
});

describe("projects seeking partners", () => {
  let opp: string;

  it("can be drafted from an approved need only", async () => {
    const pending = await db.rpc<string>(coordinator, "save_educational_need", [null, JSON.stringify(NEED)]);
    expect(await db.rpcError(coordinator, "create_opportunity_from_need", [pending])).toMatch(/invalid_transition/);
    await db.rpc(coordinator, "set_need_status", [pending, "internal_review", null]);
    await db.rpc(admin, "set_need_status", [pending, "approved", null]);
    const draft = await db.rpc<string>(coordinator, "create_opportunity_from_need", [pending]);
    const [o] = await db.sql<{ status: string; need_id: string; reference: string }>(`select status, need_id, reference from public.partnership_opportunities where id = $1`, [draft]);
    expect(o).toMatchObject({ status: "draft", need_id: pending });
    expect(o!.reference).toMatch(/^OPP-\d{4}-\d{4}$/);
  });

  it("goes draft → review → approved (approver) → published, and only then is public", async () => {
    opp = await db.rpc<string>(coordinator, "save_partnership_opportunity", [null, JSON.stringify(OPPORTUNITY)]);
    expect(await db.rpcError(coordinator, "set_opportunity_status", [opp, "published", null])).toMatch(/invalid_transition/);
    await db.rpc(coordinator, "set_opportunity_status", [opp, "internal_review", null]);
    expect(await db.rpcError(coordinator, "set_opportunity_status", [opp, "approved", null])).toMatch(/forbidden/);
    expect(await db.rpcError(otherAdmin, "set_opportunity_status", [opp, "approved", null])).toMatch(/forbidden/);
    await expect(
      db.as(admin, (q) => q(`select public.set_opportunity_status($1, 'approved', null)`, [opp]), "authenticated", "aal1"),
    ).rejects.toThrow(/forbidden/);
    await db.rpc(admin, "set_opportunity_status", [opp, "approved", null]);
    expect(await publicList()).toEqual([]);
    // Approved content is frozen.
    expect(await db.rpcError(coordinator, "save_partnership_opportunity", [opp, JSON.stringify({ ...OPPORTUNITY, funding_target: "900000" })])).toMatch(/invalid_transition/);
    await db.rpc(coordinator, "set_opportunity_status", [opp, "published", null]);
    const list = await publicList();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ title: OPPORTUNITY.title, open: true, funding_target: 45000, contribution_types: ["financier", "equipement"] });
    expect(Object.keys(list[0]!)).not.toEqual(expect.arrayContaining(["id", "need_id", "created_by", "approved_by", "status"]));
  });

  it("keeps the tables themselves closed to visitors", async () => {
    await expect(db.as(null, (q) => q(`select id from public.partnership_opportunities`), "anon")).rejects.toThrow(/permission denied/);
  });

  it("accepts applications to an open project, which inherit its field", async () => {
    const [{ reference }] = (await db.sql<{ reference: string }>(`select reference from public.partnership_opportunities where id = $1`, [opp])) as [{ reference: string }];
    const app = {
      org_name: "Entreprise Mobilier",
      org_type: "entreprise",
      country: "Maroc",
      org_description: "Fabricant de mobilier scolaire engagé localement.",
      contact_name: "Karim Alaoui",
      contact_title: "Directeur",
      contact_email: "karim@mobilier.test",
      intervention_field: "orientation",
      contribution_type: "equipement",
      contribution: "Fourniture de 60 tables et chaises.",
      cooperation: "Livrer et installer le mobilier avant la rentrée scolaire.",
      opportunity: reference,
    };
    const id = randomUUID();
    await db.rpc(null, "submit_partnership_application", [id, JSON.stringify(app), "[]"], "service_role");
    const [a] = await db.sql<{ opportunity_id: string; intervention_field: string }>(`select opportunity_id, intervention_field from public.partnership_applications where id = $1`, [id]);
    expect(a).toEqual({ opportunity_id: opp, intervention_field: "rehabilitation" });
    expect(await db.rpcError(null, "submit_partnership_application", [randomUUID(), JSON.stringify({ ...app, org_name: "Autre", opportunity: "OPP-0000-0000" }), "[]"], "service_role")).toMatch(/invalid_input/);
  });

  it("shows a closed project as closed, refuses new applications, and can be archived", async () => {
    await db.rpc(coordinator, "set_opportunity_status", [opp, "closed", "Partenaire trouvé"]);
    const list = await publicList();
    expect(list[0]).toMatchObject({ open: false });
    const [{ reference }] = (await db.sql<{ reference: string }>(`select reference from public.partnership_opportunities where id = $1`, [opp])) as [{ reference: string }];
    expect(
      await db.rpcError(null, "submit_partnership_application", [randomUUID(), JSON.stringify({ org_name: "Tardive", org_type: "entreprise", country: "Maroc", org_description: "Une organisation qui arrive trop tard.", contact_name: "X Y", contact_title: "Z Z", contact_email: "x@y.test", intervention_field: "rehabilitation", contribution_type: "financier", contribution: "Un soutien financier.", cooperation: "Participer au projet de mobilier scolaire.", opportunity: reference }), "[]"], "service_role"),
    ).toMatch(/invalid_input/);
    await db.rpc(coordinator, "set_opportunity_status", [opp, "archived", null]);
    expect(await publicList()).toEqual([]);
    const history = await db.sql<{ to_status: string }>(`select to_status from public.partnership_status_history where opportunity_id = $1`, [opp]);
    expect(history.map((h) => h.to_status)).toEqual(expect.arrayContaining(["draft", "internal_review", "approved", "published", "closed", "archived"]));
  });

  it("refuses a past deadline and keeps notes internal", async () => {
    expect(await db.rpcError(coordinator, "save_partnership_opportunity", [null, JSON.stringify({ ...OPPORTUNITY, deadline: "2020-01-01" })])).toMatch(/invalid_input/);
    const draft = await db.rpc<string>(coordinator, "save_partnership_opportunity", [null, JSON.stringify(OPPORTUNITY)]);
    await db.rpc(coordinator, "add_partnership_target_note", [null, draft, "Valider le budget avec la direction."]);
    expect(await db.as(teacher, (q) => q(`select id from public.partnership_notes`))).toEqual([]);
  });
});
