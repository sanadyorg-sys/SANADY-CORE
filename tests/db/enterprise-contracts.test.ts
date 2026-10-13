/**
 * SANADY Enterprise, phase E5: commercial contracts, usage and renewals.
 * A contract comes from an accepted proposal; an approver approves it and
 * records the signature with the signed PDF; usage is measured from the
 * records and an overage is flagged for review — never charged.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, uid } from "./harness";

let db: TestDb;
let manager: string;
let production: string;
let approver: string;
let org: string;
let proposal: string;
let tenant: string;
let inst: string;

beforeAll(async () => {
  db = await TestDb.create();
  const admin = await db.createAdmin();
  const other = await db.createAdmin();
  const staff = async (role: string) => {
    const id = await db.createUser(`${role}.${uid()}@sanady.test`);
    await db.rpc(admin, "set_platform_role", [id, role]);
    return id;
  };
  manager = await staff("enterprise_manager");
  production = await staff("production_manager");
  approver = await staff("partnership_manager");
  await db.rpc(other, "set_partnership_signatory", [approver, true]);
  [{ id: org }] = (await db.sql<{ id: string }>(`insert into public.partner_organizations (name, org_type, status, enterprise_status) values ($1, 'entreprise', null, 'active_service') returning id`, [`Client ${uid()}`])) as [{ id: string }];
  [{ id: proposal }] = (await db.sql<{ id: string }>(
    `insert into public.enterprise_proposals (reference, organization_id, title, service, currency, status) values ($1, $2, 'Espace et formation sécurité', 'complete', 'MAD', 'accepted') returning id`,
    [`PROP-T-${uid()}`, org],
  )) as [{ id: string }];
  await db.sql(
    `insert into public.enterprise_proposal_lines (proposal_id, category, label, quantity, unit, unit_price, position)
     values ($1, 'platform_access', 'Accès plateforme', 12, 'mois', 2000, 0), ($1, 'video_production', 'Vidéos', 4, 'vidéo', 4500, 1)`,
    [proposal],
  );
  await db.sql(`select set_config('sanady.tenant_sync', 'on', false)`);
  [{ id: inst }] = (await db.sql<{ id: string }>(`insert into public.institutions (name, identifier, type, contact_email, kind) values ('Client', $1, 'autre', 'c@c.test', 'enterprise') returning id`, [`ENT-C-${uid().toUpperCase()}`])) as [{ id: string }];
  [{ id: tenant }] = (await db.sql<{ id: string }>(
    `insert into public.enterprise_tenants (organization_id, institution_id, slug, display_name, service_plan, max_learners, status, activated_at)
     values ($1, $2, $3, 'Client', 'complete', 10, 'active', now()) returning id`,
    [org, inst, `client-${uid()}`],
  )) as [{ id: string }];
  await db.sql(`select set_config('sanady.tenant_sync', '', false)`);
});
afterAll(async () => db?.close());

const TERMS = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({ title: "Contrat espace et formation", pricing_model: "per_enrolled_learner", currency: "MAD", start_on: "2026-01-01", end_on: "2026-12-31", learner_limit: "2", storage_limit_gb: "1", ...extra });

describe("contracts (brief V3 §16)", () => {
  let contract: string;

  it("come from an accepted proposal, its lines copied", async () => {
    const [{ id: draftProp }] = (await db.sql<{ id: string }>(
      `insert into public.enterprise_proposals (reference, organization_id, title, service, status) values ($1, $2, 'Brouillon', 'sur_mesure', 'draft') returning id`,
      [`PROP-D-${uid()}`, org],
    )) as [{ id: string }];
    expect(await db.rpcError(manager, "create_contract_from_proposal", [draftProp])).toMatch(/proposal_not_accepted/);
    expect(await db.rpcError(production, "create_contract_from_proposal", [proposal])).toMatch(/forbidden/);
    contract = await db.rpc<string>(manager, "create_contract_from_proposal", [proposal]);
    expect(await db.rpcError(manager, "create_contract_from_proposal", [proposal])).toMatch(/already_exists/);
    const lines = await db.sql<{ label: string; total: string }>(`select label, (quantity * unit_price)::text total from public.enterprise_contract_lines where contract_id = $1 order by position`, [contract]);
    expect(lines).toEqual([{ label: "Accès plateforme", total: "24000.0000" }, { label: "Vidéos", total: "18000.0000" }]);
    const [c] = await db.sql<{ reference: string }>(`select reference from public.enterprise_contracts where id = $1`, [contract]);
    expect(c!.reference).toMatch(/^CTR-\d{4}-\d{4}$/);
  });

  it("are approved by an approver and recorded as signed with the signed copy", async () => {
    expect(await db.rpcError(manager, "set_contract_status", [contract, "internal_review", "{}"])).toMatch(/dates_required/);
    await db.rpc(manager, "save_enterprise_contract", [contract, TERMS({ tenant_id: tenant })]);
    await db.rpc(manager, "set_contract_status", [contract, "internal_review", "{}"]);
    expect(await db.rpcError(manager, "save_enterprise_contract", [contract, TERMS()])).toMatch(/contract_locked/);
    expect(await db.rpcError(manager, "set_contract_status", [contract, "approved", "{}"])).toMatch(/forbidden/);
    await db.rpc(approver, "set_contract_status", [contract, "approved", "{}"]);
    expect(await db.rpcError(approver, "set_contract_status", [contract, "signed", JSON.stringify({ signed_on: "2026-01-02" })])).toMatch(/signed_document_required/);
    expect(await db.rpcError(manager, "add_contract_document", [contract, "signed", `contracts/${contract}/s.pdf`, "s.pdf", 10])).toMatch(/forbidden/);
    expect(await db.rpcError(approver, "add_contract_document", [contract, "signed", `requests/${contract}/s.pdf`, "s.pdf", 10])).toMatch(/invalid_input/);
    await db.rpc(approver, "add_contract_document", [contract, "signed", `contracts/${contract}/s.pdf`, "s.pdf", 10]);
    await db.rpc(approver, "set_contract_status", [contract, "signed", JSON.stringify({ signed_on: "2026-01-02" })]);
    await db.rpc(manager, "set_contract_status", [contract, "active", "{}"]);
  });

  it("set the workspace's limits and dates", async () => {
    await db.rpc(manager, "apply_contract_to_tenant", [contract]);
    const [t] = await db.sql<{ max_learners: number; contract_end_on: string }>(`select max_learners, contract_end_on::text from public.enterprise_tenants where id = $1`, [tenant]);
    expect(t).toEqual({ max_learners: 2, contract_end_on: "2026-12-31" });
  });

  it("are renewed with a later end date, and closed with a reason", async () => {
    // Ends on 31/12/2026: with a 90-day notice, the renewal is due from early October.
    await db.sql(`update public.enterprise_contracts set renewal_notice_days = 90 where id = $1`, [contract]);
    const w = await db.rpc<{ renewals: Array<{ id: string }> }>(manager, "enterprise_watchlist", []);
    expect(w.renewals.map((r) => r.id)).toContain(contract);
    await db.rpc(manager, "set_contract_status", [contract, "renewal", "{}"]);
    expect(await db.rpcError(manager, "save_enterprise_contract", [contract, TERMS({ end_on: "2026-06-30" })])).toMatch(/invalid_input/);
    await db.rpc(manager, "save_enterprise_contract", [contract, TERMS({ end_on: "2030-12-31" })]);
    await db.rpc(manager, "set_contract_status", [contract, "active", "{}"]);
    const [c] = await db.sql<{ end_on: string; title: string }>(`select end_on::text, title from public.enterprise_contracts where id = $1`, [contract]);
    expect(c).toEqual({ end_on: "2030-12-31", title: "Contrat espace et formation" });
    expect(await db.rpcError(manager, "set_contract_status", [contract, "closed", "{}"])).toMatch(/comment_required/);
  });
});

describe("usage (brief V3 §17)", () => {
  it("is measured from the records and flags overages for review — never charged", async () => {
    for (let i = 0; i < 3; i++) {
      const u = await db.createUser(`emp.${uid()}@client.test`);
      await db.sql(`insert into public.institution_memberships (institution_id, user_id, role, source, consented_at) values ($1, $2, 'teacher', 'admin', now())`, [inst, u]).catch(async () => {
        // The seat guard (limit 2) refuses the third employee: insert it as the owner bypassing the guard.
        await db.sql(`alter table public.institution_memberships disable trigger memberships_enterprise_guard`);
        await db.sql(`insert into public.institution_memberships (institution_id, user_id, role, source, consented_at) values ($1, $2, 'teacher', 'admin', now())`, [inst, u]);
        await db.sql(`alter table public.institution_memberships enable trigger memberships_enterprise_guard`);
      });
    }
    const [{ id: course }] = (await db.sql<{ id: string }>(`insert into public.courses (title, ownership, owner_institution_id) values ('Formation de l’entreprise', 'company', $1) returning id`, [inst])) as [{ id: string }];
    await db.sql(`insert into storage.buckets (id, name) values ('course-media', 'course-media') on conflict do nothing`);
    await db.sql(`insert into storage.objects (bucket_id, name, metadata) values ('course-media', $1, '{"size": 1572864}'), ('course-media', 'autre-cours/x.mp4', '{"size": 999999999}')`, [`${course}/video.mp4`]);

    expect(await db.rpcError(production, "record_tenant_usage", [tenant, "2026-10-01"])).toMatch(/forbidden/);
    const u = await db.rpc<{ enrolled_learners: number; storage_mb: number; overage: boolean }>(manager, "record_tenant_usage", [tenant, "2026-10-01"]);
    expect(u).toMatchObject({ enrolled_learners: 3, overage: true });
    expect(Number(u.storage_mb)).toBe(1.5);
    const [rec] = await db.sql<{ id: string; overage: boolean }>(`select id, overage from public.enterprise_usage_records where tenant_id = $1`, [tenant]);
    const w = await db.rpc<{ overages: Array<{ id: string }> }>(manager, "enterprise_watchlist", []);
    expect(w.overages.map((o) => o.id)).toContain(rec!.id);
    expect(await db.rpcError(manager, "review_usage_overage", [rec!.id, ""])).toMatch(/comment_required/);
    await db.rpc(manager, "review_usage_overage", [rec!.id, "Avenant en préparation pour 5 places"]);
    const w2 = await db.rpc<{ overages: Array<{ id: string }> }>(manager, "enterprise_watchlist", []);
    expect(w2.overages.map((o) => o.id)).not.toContain(rec!.id);
    expect(await db.rpcError(manager, "record_tenant_usage", [tenant, "2099-01-01"])).toMatch(/invalid_input/);
  });
});
