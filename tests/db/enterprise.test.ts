/**
 * SANADY Enterprise, phases E1-E2: corporate training requests and the
 * enterprise CRM. Commercial records stay separate from the partnership
 * (charitable) ones; commercial proposals are approved by an approver only.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, uid } from "./harness";

let db: TestDb;
let admin: string;
let otherAdmin: string;
let enterprise: string;
let production: string;
let partnership: string;
let teacher: string;

const REQUEST = {
  org_name: "Industrie Exemple SA",
  org_type: "entreprise",
  country: "Maroc",
  city: "Tanger",
  employee_count: "250-999",
  contact_name: "Leila Haddad",
  contact_title: "DRH",
  contact_email: "Leila.Haddad@Industrie.test",
  service: "complete",
  topic: "Sécurité au travail",
  target_population: "Opérateurs de production",
  learner_count: "300",
  outcomes: "Former 300 opérateurs aux règles de sécurité avant l’audit annuel.",
  existing_content: "partial",
  language: "fr",
};

async function staff(role: string) {
  const id = await db.createUser(`${role}.${uid()}@sanady.test`);
  await db.rpc(admin, "set_platform_role", [id, role]);
  return id;
}
async function submit(overrides: Record<string, unknown> = {}) {
  const id = randomUUID();
  const ref = await db.rpc<string>(null, "submit_enterprise_request", [id, JSON.stringify({ ...REQUEST, ...overrides }), "[]"], "service_role");
  return { id, ref };
}

beforeAll(async () => {
  db = await TestDb.create();
  admin = await db.createAdmin();
  otherAdmin = await db.createAdmin();
  enterprise = await staff("enterprise_manager");
  production = await staff("production_manager");
  partnership = await staff("partnership_coordinator");
  teacher = await db.createUser(`prof.${uid()}@sanady.test`);
});
afterAll(async () => db?.close());

describe("enterprise requests (public form)", () => {
  it("are accepted from the server only, with an ENT reference", async () => {
    const { id, ref } = await submit();
    expect(ref).toMatch(/^ENT-\d{4}-\d{4}$/);
    const [r] = await db.sql<{ status: string; contact_email: string; learner_count: number }>(`select status, contact_email, learner_count from public.enterprise_requests where id = $1`, [id]);
    expect(r).toEqual({ status: "received", contact_email: "leila.haddad@industrie.test", learner_count: 300 });
    expect(await db.rpcError(null, "submit_enterprise_request", [randomUUID(), JSON.stringify(REQUEST), "[]"], "anon")).toMatch(/permission denied/);
    expect((await submit()).ref).toBe(ref); // double submission
    await expect(submit({ org_name: "Autre", employee_count: "énorme" })).rejects.toThrow(/check constraint/);
  });

  it("are read by enterprise staff only — not by the partnership team", async () => {
    const count = (u: string, aal: "aal1" | "aal2" = "aal2") =>
      db.as(u, (q) => q<{ n: number }>(`select count(*)::int n from public.enterprise_requests`), "authenticated", aal).then((r) => r[0]!.n);
    expect(await count(enterprise)).toBeGreaterThan(0);
    expect(await count(production)).toBeGreaterThan(0);
    expect(await count(admin)).toBeGreaterThan(0);
    expect(await count(enterprise, "aal1")).toBe(0);
    expect(await count(partnership)).toBe(0);
    expect(await count(teacher)).toBe(0);
  });

  it("are handled by the enterprise manager (production manager only reads)", async () => {
    const { id } = await submit({ org_name: "Lecture seule" });
    expect(await db.rpcError(production, "set_enterprise_request_status", [id, "qualified", null])).toMatch(/forbidden/);
    await db.rpc(enterprise, "set_enterprise_request_status", [id, "qualified", "Besoin clair"]);
    expect(await db.rpcError(enterprise, "set_enterprise_request_status", [id, "spam", null])).toMatch(/invalid_transition/);
  });
});

describe("one organisation, two separate relationships", () => {
  let partnerOrg: string;
  let clientOrg: string;

  it("creates an enterprise-only client from a request (invisible to the partnership team)", async () => {
    const { id } = await submit({ org_name: "Client Seul" });
    clientOrg = await db.rpc<string>(enterprise, "create_enterprise_client", [id, null]);
    const [o] = await db.sql<{ status: string | null; enterprise_status: string }>(`select status, enterprise_status from public.partner_organizations where id = $1`, [clientOrg]);
    expect(o).toEqual({ status: null, enterprise_status: "qualified" });
    expect(await db.as(partnership, (q) => q(`select id from public.partner_organizations where id = $1`, [clientOrg]))).toEqual([]);
    expect(await db.as(enterprise, (q) => q(`select id from public.partner_organizations where id = $1`, [clientOrg]))).toHaveLength(1);
    const contacts = await db.as(partnership, (q) => q(`select id from public.partner_contacts where organization_id = $1`, [clientOrg]));
    expect(contacts).toEqual([]);
  });

  it("links a request to an existing partner without duplicating it", async () => {
    partnerOrg = await db.rpc<string>(partnership, "save_partner_organization", [null, JSON.stringify({ name: "Partenaire et Client", org_type: "entreprise" })]);
    expect(await db.as(enterprise, (q) => q(`select id from public.partner_organizations where id = $1`, [partnerOrg]))).toEqual([]);
    const { id } = await submit({ org_name: "Partenaire et Client" });
    await db.rpc(enterprise, "create_enterprise_client", [id, partnerOrg]);
    const [o] = await db.sql<{ status: string; enterprise_status: string }>(`select status, enterprise_status from public.partner_organizations where id = $1`, [partnerOrg]);
    expect(o).toEqual({ status: "prospect", enterprise_status: "qualified" });
    expect(await db.as(enterprise, (q) => q(`select id from public.partner_organizations where id = $1`, [partnerOrg]))).toHaveLength(1);
    const { id: again } = await submit({ org_name: "Partenaire et Client bis" });
    expect(await db.rpcError(enterprise, "create_enterprise_client", [again, partnerOrg])).toMatch(/already_exists/);
  });

  it("keeps commercial notes and tasks away from the partnership team, and vice versa", async () => {
    await db.rpc(enterprise, "add_enterprise_note", [partnerOrg, null, null, "Tarif discuté en réunion."]);
    await db.rpc(partnership, "add_partnership_note", [null, partnerOrg, "Mécénat envisagé pour la réhabilitation."]);
    expect(await db.as(partnership, (q) => q(`select body from public.enterprise_notes`))).toEqual([]);
    expect(await db.as(enterprise, (q) => q(`select body from public.partnership_notes`))).toEqual([]);
    await db.rpc(enterprise, "save_enterprise_task", [partnerOrg, "Envoyer la proposition", null, null]);
    expect(await db.rpcError(enterprise, "save_enterprise_task", [partnerOrg, "Tâche", null, partnership])).toMatch(/invalid_input/);
  });

  it("follows the enterprise pipeline; only an approver signs", async () => {
    for (const s of ["discovery", "needs_assessment", "proposal", "negotiation", "institutional_approval"]) {
      await db.rpc(enterprise, "set_enterprise_status", [clientOrg, s, null]);
    }
    expect(await db.rpcError(enterprise, "set_enterprise_status", [clientOrg, "contract_signed", null])).toMatch(/forbidden/);
    expect(await db.rpcError(admin, "set_enterprise_status", [clientOrg, "contract_signed", null])).toMatch(/forbidden/);
    await db.rpc(otherAdmin, "set_partnership_signatory", [admin, true]);
    await db.rpc(admin, "set_enterprise_status", [clientOrg, "contract_signed", "Contrat validé"]);
    expect(await db.rpcError(enterprise, "set_enterprise_status", [clientOrg, "negotiation", null])).toMatch(/invalid_transition/);
    await db.rpc(enterprise, "set_enterprise_status", [clientOrg, "onboarding", null]);
    await db.rpc(enterprise, "set_enterprise_status", [clientOrg, "active_service", null]);
    const history = await db.sql<{ to_status: string }>(`select to_status from public.enterprise_history where organization_id = $1`, [clientOrg]);
    expect(history.map((h) => h.to_status)).toEqual(expect.arrayContaining(["qualified", "institutional_approval", "contract_signed", "active_service"]));
  });

  it("lets the partnership team open a partnership with an existing client", async () => {
    expect(await db.rpcError(partnership, "set_partner_status", [clientOrg, "negotiation", null])).toMatch(/invalid_transition/);
  });
});

describe("commercial proposals", () => {
  let org: string;
  let proposal: string;

  beforeAll(async () => {
    org = await db.rpc<string>(enterprise, "save_enterprise_client", [null, JSON.stringify({ name: "Banque Exemple", org_type: "entreprise", services: ["sur_mesure"] })]);
  });

  it("are built from configurable lines (no fixed prices)", async () => {
    proposal = await db.rpc<string>(enterprise, "save_enterprise_proposal", [null, org, JSON.stringify({ title: "Formation conformité 2027", service: "sur_mesure", currency: "MAD" })]);
    const [p] = await db.sql<{ reference: string }>(`select reference from public.enterprise_proposals where id = $1`, [proposal]);
    expect(p!.reference).toMatch(/^PROP-\d{4}-\d{4}$/);
    await db.rpc(enterprise, "save_proposal_line", [null, proposal, JSON.stringify({ category: "needs_analysis", label: "Analyse des besoins", quantity: "2", unit: "jours", unit_price: "6000" })]);
    await db.rpc(enterprise, "save_proposal_line", [null, proposal, JSON.stringify({ category: "video_production", label: "Vidéos (6 × 5 min)", quantity: "6", unit: "vidéos", unit_price: "4500" })]);
    const [t] = await db.sql<{ total: string }>(`select sum(quantity * unit_price)::text total from public.enterprise_proposal_lines where proposal_id = $1`, [proposal]);
    expect(t!.total).toBe("39000.0000");
    expect(await db.rpcError(production, "save_proposal_line", [null, proposal, JSON.stringify({ category: "other", label: "X", unit_price: "1" })])).toMatch(/forbidden/);
  });

  it("are approved by an approver only, then frozen and sent", async () => {
    await db.rpc(enterprise, "set_proposal_status", [proposal, "internal_review", null]);
    expect(await db.rpcError(enterprise, "set_proposal_status", [proposal, "approved", null])).toMatch(/forbidden/);
    expect(await db.rpcError(otherAdmin, "set_proposal_status", [proposal, "approved", null])).toMatch(/forbidden/);
    await db.rpc(admin, "set_proposal_status", [proposal, "approved", null]); // admin holds the grant (previous describe)
    expect(await db.rpcError(enterprise, "save_proposal_line", [null, proposal, JSON.stringify({ category: "other", label: "Ajout", unit_price: "1" })])).toMatch(/invalid_transition/);
    await db.rpc(enterprise, "set_proposal_status", [proposal, "sent", null]);
    await db.rpc(enterprise, "set_proposal_status", [proposal, "accepted", "Bon de commande reçu"]);
    expect(await db.rpcError(enterprise, "set_proposal_status", [proposal, "draft", null])).toMatch(/invalid_transition/);
  });

  it("cannot be approved empty, and stay invisible to other users", async () => {
    const empty = await db.rpc<string>(enterprise, "save_enterprise_proposal", [null, org, JSON.stringify({ title: "Proposition vide", service: "plateforme" })]);
    await db.rpc(enterprise, "set_proposal_status", [empty, "internal_review", null]);
    expect(await db.rpcError(admin, "set_proposal_status", [empty, "approved", null])).toMatch(/invalid_input/);
    expect(await db.as(partnership, (q) => q(`select id from public.enterprise_proposals`))).toEqual([]);
    expect(await db.as(teacher, (q) => q(`select id from public.enterprise_proposal_lines`))).toEqual([]);
  });
});

describe("roles", () => {
  it("only administrators grant the new roles, and approvers are never self-appointed", async () => {
    expect(await db.rpcError(enterprise, "set_platform_role", [teacher, "enterprise_manager"])).toMatch(/forbidden/);
    expect(await db.rpcError(otherAdmin, "set_partnership_signatory", [otherAdmin, true])).toMatch(/forbidden/);
    await db.rpc(otherAdmin, "set_partnership_signatory", [enterprise, true]);
    const [s] = await db.sql<{ n: number }>(`select count(*)::int n from public.partnership_signatories where user_id = $1 and revoked_at is null`, [enterprise]);
    expect(s!.n).toBe(1);
  });
});

describe("duplicate prevention", () => {
  it("lets an enterprise manager find existing organisations by name only", async () => {
    await db.rpc(partnership, "save_partner_organization", [null, JSON.stringify({ name: "Groupe Atlas Industries", org_type: "entreprise" })]);
    const found = await db.as(enterprise, (q) => q<{ name: string; is_partner: boolean }>(`select name, is_partner from public.find_organizations_for_enterprise('atlas')`));
    expect(found).toEqual([{ name: "Groupe Atlas Industries", is_partner: true }]);
    expect(await db.rpcError(partnership, "find_organizations_for_enterprise", ["atlas"])).toMatch(/forbidden/);
    expect(await db.rpcError(enterprise, "find_organizations_for_enterprise", ["ab"])).toMatch(/invalid_input/);
  });
});

describe("staff names in histories", () => {
  it("lets enterprise and partnership staff see other staff members' profiles, never teachers'", async () => {
    const see = (viewer: string, target: string) => db.as(viewer, (q) => q(`select id from public.profiles where id = $1`, [target]));
    expect(await see(enterprise, admin)).toHaveLength(1);
    expect(await see(partnership, enterprise)).toHaveLength(1);
    expect(await see(enterprise, teacher)).toEqual([]);
    expect(await see(teacher, enterprise)).toEqual([]);
  });
});
