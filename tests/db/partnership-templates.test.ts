/**
 * Communication templates for partner relations (brief V2 §14): reusable
 * messages, sent one at a time by a person, and written to the contact
 * history. Partnership staff only.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, uid } from "./harness";

let db: TestDb;
let coordinator: string;
let enterprise: string;
let org: string;
let contact: string;

beforeAll(async () => {
  db = await TestDb.create();
  const admin = await db.createAdmin();
  const staff = async (role: string) => {
    const id = await db.createUser(`${role}.${uid()}@sanady.test`);
    await db.rpc(admin, "set_platform_role", [id, role]);
    return id;
  };
  coordinator = await staff("partnership_coordinator");
  enterprise = await staff("enterprise_manager");
  [{ id: org }] = (await db.sql<{ id: string }>(`insert into public.partner_organizations (name, org_type, status) values ($1, 'fondation', 'negotiation') returning id`, [`Partenaire ${uid()}`])) as [{ id: string }];
  [{ id: contact }] = (await db.sql<{ id: string }>(`insert into public.partner_contacts (organization_id, full_name, email) values ($1, 'Salma Idrissi', 'salma@partenaire.test') returning id`, [org])) as [{ id: string }];
});
afterAll(async () => db?.close());

describe("communication templates (brief V2 §14)", () => {
  it("come with generic starter templates, readable by partnership staff only", async () => {
    const rows = await db.as(coordinator, (q) => q<{ category: string; body: string }>(`select category, body from public.partnership_templates where archived_at is null`));
    expect(rows.map((r) => r.category).sort()).toEqual(["acknowledgement", "decline", "first_contact", "follow_up", "renewal", "report", "thanks"]);
    // Placeholders only: no figure about the Foundation in the starter texts.
    for (const r of rows) expect(r.body).not.toMatch(/\d{3,}/);
    expect(await db.as(enterprise, (q) => q(`select 1 from public.partnership_templates`))).toEqual([]);
  });

  it("are written and archived by the team", async () => {
    expect(await db.rpcError(enterprise, "save_partnership_template", [null, JSON.stringify({ category: "other", title: "Invitation", subject: "Invitation", body: "Bonjour {{contact}}, ..." })])).toMatch(/forbidden/);
    const id = await db.rpc<string>(coordinator, "save_partnership_template", [null, JSON.stringify({ category: "other", title: "Invitation à un événement", subject: "Invitation — {{organisation}}", body: "Bonjour {{contact}}, nous serions ravis de vous accueillir." })]);
    await db.rpc(coordinator, "set_partnership_template_archived", [id, true]);
    const [t] = await db.sql<{ archived_at: string | null }>(`select archived_at from public.partnership_templates where id = $1`, [id]);
    expect(t!.archived_at).not.toBeNull();
  });

  it("record each message sent in the organisation's contact history", async () => {
    await db.rpc(coordinator, "record_partner_communication", [org, contact, "copy", "Suite de notre échange", "Bonjour Salma, ...", null]);
    const [n] = await db.sql<{ body: string }>(`select body from public.partnership_notes where organization_id = $1 order by created_at desc limit 1`, [org]);
    expect(n!.body).toMatch(/^Message préparé \(envoyé hors plateforme\) à Salma Idrissi — Suite de notre échange/);
    // A contact of another organisation is refused.
    const [{ id: otherOrg }] = (await db.sql<{ id: string }>(`insert into public.partner_organizations (name, org_type, status) values ('Autre', 'fondation', 'prospect') returning id`)) as [{ id: string }];
    const [{ id: other }] = (await db.sql<{ id: string }>(`insert into public.partner_contacts (organization_id, full_name) values ($1, 'Autre contact') returning id`, [otherOrg])) as [{ id: string }];
    expect(await db.rpcError(coordinator, "record_partner_communication", [org, other, "email", "Objet", "Texte", null])).toMatch(/invalid_input/);
    expect(await db.rpcError(enterprise, "record_partner_communication", [org, contact, "copy", "Objet", "Texte", null])).toMatch(/forbidden/);
  });
});
