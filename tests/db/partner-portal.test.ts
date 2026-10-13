/**
 * Partenariats & Coopération, phase 6: the optional partner portal. Off by
 * default; an administrator switches it on; a partnership manager invites
 * one contact of an active partner. A partner sees only their organisation,
 * and only what is meant for partners.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, newToken, uid } from "./harness";

let db: TestDb;
let admin: string;
let coordinator: string;
let manager: string;
let approver: string;
let orgA: string;
let orgB: string;
let agreementA: string;

async function invite(by: string, org: string, email: string) {
  const { hash } = newToken();
  await db.rpc(by, "invite_partner_member", [org, email, hash]);
  return hash;
}
async function partner(org: string) {
  const id = await db.createUser(`contact.${uid()}@partenaire.test`);
  const [{ email }] = (await db.sql<{ email: string }>(`select email from public.profiles where id = $1`, [id])) as [{ email: string }];
  const hash = await invite(manager, org, email);
  await db.rpc(null, "accept_invitation", [hash, id, false], "service_role");
  return id;
}

beforeAll(async () => {
  db = await TestDb.create();
  admin = await db.createAdmin();
  const other = await db.createAdmin();
  const staff = async (role: string) => {
    const id = await db.createUser(`${role}.${uid()}@sanady.test`);
    await db.rpc(admin, "set_platform_role", [id, role]);
    return id;
  };
  coordinator = await staff("partnership_coordinator");
  manager = await staff("partnership_manager");
  approver = await staff("partnership_manager");
  await db.rpc(other, "set_partnership_signatory", [approver, true]);
  const mk = async (name: string, status: string) =>
    (await db.sql<{ id: string }>(`insert into public.partner_organizations (name, org_type, status) values ($1, 'entreprise', $2) returning id`, [name, status]))[0]!.id;
  orgA = await mk(`Partenaire A ${uid()}`, "implementation");
  orgB = await mk(`Partenaire B ${uid()}`, "implementation");
  agreementA = await db.rpc<string>(coordinator, "save_partnership_agreement", [null, orgA, JSON.stringify({ title: "Convention A", intervention_field: "soutien-scolaire", objectives: "Accompagner 200 élèves de collège en mathématiques." })]);
  await db.sql(`update public.partnership_agreements set status = 'active' where id = $1`, [agreementA]);
  await db.rpc(coordinator, "add_partnership_note", [null, orgA, "Note interne confidentielle"]);
});
afterAll(async () => db?.close());

describe("partner portal (brief V2 §15)", () => {
  it("is off by default and switched on by an administrator only", async () => {
    expect(await db.rpcError(manager, "invite_partner_member", [orgA, "x@partenaire.test", newToken().hash])).toMatch(/portal_disabled/);
    expect(await db.rpcError(manager, "set_partner_portal", [true])).toMatch(/forbidden/);
    await db.rpc(admin, "set_partner_portal", [true]);
  });

  it("invites contacts of active partners, by a partnership manager only", async () => {
    expect(await db.rpcError(coordinator, "invite_partner_member", [orgA, "y@partenaire.test", newToken().hash])).toMatch(/forbidden/);
    const prospect = (await db.sql<{ id: string }>(`insert into public.partner_organizations (name, org_type, status) values ('Prospect', 'entreprise', 'prospect') returning id`))[0]!.id;
    expect(await db.rpcError(manager, "invite_partner_member", [prospect, "z@partenaire.test", newToken().hash])).toMatch(/partnership_not_active/);
    const [{ email }] = (await db.sql<{ email: string }>(`select email from public.profiles where id = $1`, [coordinator])) as [{ email: string }];
    expect(await db.rpcError(manager, "invite_partner_member", [orgA, email, newToken().hash])).toMatch(/invalid_input/);
  });

  it("shows a partner only their organisation, and only what is meant for partners", async () => {
    const a = await partner(orgA);
    const b = await partner(orgB);
    // Shared report is visible; a draft is not.
    const shared = await db.rpc<string>(coordinator, "save_partner_report", [null, orgA, JSON.stringify({ title: "Rapport partagé", period_start: "2026-01-01", period_end: "2026-12-31" })]);
    await db.rpc(approver, "set_report_status", [shared, "approved"]);
    await db.rpc(coordinator, "set_report_status", [shared, "shared"]);
    const draft = await db.rpc<string>(coordinator, "save_partner_report", [null, orgA, JSON.stringify({ title: "Rapport en préparation", period_start: "2026-01-01", period_end: "2026-12-31" })]);

    const view = await db.rpc<{ organization: { id: string }; agreements: Array<{ id: string }>; reports: Array<{ id: string }> }>(a, "portal_overview", []);
    expect(view.organization.id).toBe(orgA);
    expect(view.agreements.map((x) => x.id)).toEqual([agreementA]);
    expect(view.reports.map((x) => x.id)).toEqual([shared]);
    expect(JSON.stringify(view)).not.toMatch(/confidentielle/);
    expect(await db.rpc(a, "portal_report_data", [shared])).toBeTruthy();
    expect(await db.rpcError(a, "portal_report_data", [draft])).toMatch(/not_found/);
    expect(await db.rpcError(b, "portal_report_data", [shared])).toMatch(/not_found/);
    expect((await db.rpc<{ organization: { id: string } }>(b, "portal_overview", [])).organization.id).toBe(orgB);

    // No internal table is readable by a partner.
    const read = await db.as(a, async (q) => ({
      notes: await q(`select 1 from public.partnership_notes`),
      agreements: await q(`select 1 from public.partnership_agreements`),
      messages: await q(`select 1 from public.partner_messages`),
      members: await q(`select 1 from public.partner_portal_members`),
    }));
    expect(read).toEqual({ notes: [], agreements: [], messages: [], members: [] });
    expect(await db.rpcError(a, "partner_report_data", [shared])).toMatch(/forbidden/);
    // Partner contacts are not counted as SANADY teachers.
    expect((await db.sql<{ only: boolean }>(`select private.is_enterprise_only_user($1) as only`, [a]))[0]!.only).toBe(true);
  });

  it("lets partners submit deliverables and talk with the team, within their organisation", async () => {
    const a = await partner(orgA);
    const id = randomUUID();
    expect(await db.rpcError(a, "submit_partner_deliverable", [id, JSON.stringify({ title: "Rapport d’activité" }), "[]"])).toMatch(/document_required/);
    expect(await db.rpcError(a, "submit_partner_deliverable", [id, JSON.stringify({ title: "Rapport d’activité" }), JSON.stringify([{ path: `agreements/${id}/x.pdf`, name: "x.pdf", size: 10 }])])).toMatch(/invalid_input/);
    await db.rpc(a, "submit_partner_deliverable", [id, JSON.stringify({ title: "Rapport d’activité", agreement_id: agreementA }), JSON.stringify([{ path: `deliverables/${id}/x.pdf`, name: "x.pdf", size: 10 }])]);
    expect(await db.rpcError(a, "review_partner_deliverable", [id, "accepted", null])).toMatch(/forbidden/);
    await db.rpc(coordinator, "review_partner_deliverable", [id, "returned", "Merci d’ajouter les listes de présence"]);

    await db.rpc(a, "post_partner_message", [orgA, "Bonjour, voici notre question."]);
    expect(await db.rpcError(a, "post_partner_message", [orgB, "Intrusion"])).toMatch(/forbidden/);
    await db.rpc(coordinator, "post_partner_message", [orgA, "Bonjour, nous revenons vers vous."]);
    const view = await db.rpc<{ messages: Array<{ from_partner: boolean; author: string }>; deliverables: Array<{ status: string }> }>(a, "portal_overview", []);
    expect(view.deliverables[0]!.status).toBe("returned");
    expect(view.messages.at(-1)).toMatchObject({ from_partner: false, author: "Équipe SANADY" });
  });

  it("closes access when switched off or revoked", async () => {
    const a = await partner(orgA);
    const [m] = await db.sql<{ id: string }>(`select id from public.partner_portal_members where user_id = $1`, [a]);
    await db.rpc(manager, "revoke_partner_member", [m!.id]);
    expect(await db.rpcError(a, "portal_overview", [])).toMatch(/forbidden/);
    const c = await partner(orgA);
    await db.rpc(admin, "set_partner_portal", [false]);
    expect(await db.rpcError(c, "portal_overview", [])).toMatch(/forbidden/);
  });
});

describe("the team side of the portal", () => {
  it("sees partner invitations and contact names, never other invitations", async () => {
    await db.rpc(admin, "set_partner_portal", [true]);
    const p = await partner(orgA);
    await invite(manager, orgB, `pending.${uid()}@partenaire.test`);
    const seen = await db.as(coordinator, async (q) => ({
      invitations: await q<{ kind: string }>(`select kind::text from public.invitations`),
      name: await q<{ full_name: string }>(`select full_name from public.profiles where id = $1`, [p]),
    }));
    expect(seen.invitations.every((i) => i.kind === "partner_member")).toBe(true);
    expect(seen.invitations.length).toBeGreaterThan(0);
    expect(seen.name).toHaveLength(1);
  });
});
