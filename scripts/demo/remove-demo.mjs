#!/usr/bin/env node
/**
 * Removes the demonstration data created by seed-demo.mjs.
 *
 *   npm run demo:remove
 *
 * Deletes the demo accounts (demo.*@example.com) and everything attached to
 * them, the partnership and enterprise demo (add-demo-organizations.mjs), the
 * demo institution (DEMO-LYC-001), the demo courses and their files.
 * `npm run demo:remove -- --organizations-only` removes just the partnership
 * and enterprise part and keeps the rest of the demo.
 * Real accounts, institutions and courses are never touched.
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ref = url?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
const token = process.env.SUPABASE_ACCESS_TOKEN;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!ref || !token || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ACCESS_TOKEN are required.");
  process.exit(1);
}
const STATE = "scripts/demo/.demo-state.json";
const ORG_ACCOUNTS = ["partenariats", "signataire", "entreprises", "production", "partenaire", "rh", "employe1", "employe2"].map((k) => `demo.${k}@example.com`);
const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : { courseIds: [] };

async function sql(query, attempt = 0) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  // The management API limits the request rate: wait and retry.
  if (res.status === 429 && attempt < 8) {
    await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
    return sql(query, attempt + 1);
  }
  const text = await res.text();
  if (!res.ok) throw new Error(text.slice(0, 1500));
  return text ? JSON.parse(text) : [];
}
const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

// 0) Partnership and enterprise demo data (add-demo-organizations.mjs), before the accounts that recorded it.
//    Matched by the recorded ids and by the « (démo) » suffix, so a run stopped halfway is cleaned too.
{
  const x = state.extended ?? {};
  const ids = (a) => (a?.filter(Boolean).length ? a.filter(Boolean).map(lit).join(",") : "null");
  const orgs = `select id from public.partner_organizations where id in (${ids(x.organizationIds)}) or name like '%(démo)'`;
  const [{ n }] = await sql(`select count(*)::int as n from public.partner_organizations where id in (${ids(x.organizationIds)}) or name like '%(démo)'`);
  await sql(extendedRemovalSql(x, ids, orgs));
  for (const [bucket, paths] of Object.entries(x.storage ?? {})) if (paths.length) await admin.storage.from(bucket).remove(paths);
  console.log(`✓ partnership and enterprise demo data removed (${n} organisations)`);
}
// `--organizations-only`: remove just that part and its accounts, keep the rest of the demo.
if (process.argv.includes("--organizations-only")) {
  const extra = await sql(`select id, email from auth.users where email in (${ORG_ACCOUNTS.map(lit).join(",")})`);
  for (const u of extra) {
    const { error } = await admin.auth.admin.deleteUser(u.id);
    if (error) throw new Error(`deleteUser ${u.email}: ${error.message}`);
  }
  delete state.extended;
  const ACC = "scripts/demo/.demo-accounts.txt";
  if (existsSync(ACC)) {
    const kept = readFileSync(ACC, "utf8").split("\n").filter((l) => !ORG_ACCOUNTS.some((e) => l.startsWith(`${e} `)));
    writeFileSync(ACC, kept.join("\n"));
  }
  writeFileSync(STATE, JSON.stringify(state, null, 2));
  console.log(`✓ ${extra.length} partnership and enterprise demo accounts removed; the rest of the demo is kept.`);
  process.exit(0);
}

// 1) Demo accounts (cascade: profiles, memberships, enrollments, progress, attempts, certificates).
const demoUsers = await sql(`select id, email from auth.users where email like 'demo.%@example.com'`);
for (const u of demoUsers) {
  const { error } = await admin.auth.admin.deleteUser(u.id);
  if (error) throw new Error(`deleteUser ${u.email}: ${error.message}`);
}
console.log(`✓ ${demoUsers.length} demo accounts removed`);

// 2) Demo courses (files first), institution.
const courseIds = state.courseIds.length
  ? state.courseIds
  : (await sql(`select id from public.courses where title in ('Évaluation formative en classe','Gestion de classe bienveillante','Numérique éducatif responsable','Différencier son enseignement','La démarche d’investigation en sciences')`)).map((r) => r.id);
for (const id of courseIds) {
  const { data: lessons } = await admin.from("lessons").select("id, pdf_path, video_provider, video_ref").eq("course_id", id);
  const paths = (lessons ?? [])
    .flatMap((l) => [l.pdf_path, l.video_provider === "storage" ? l.video_ref : null])
    .filter(Boolean);
  if (paths.length) await admin.storage.from("course-media").remove(paths);
  const { data: covers } = await admin.storage.from("course-covers").list(id);
  if (covers?.length) await admin.storage.from("course-covers").remove(covers.map((f) => `${id}/${f.name}`));
}
await sql(`begin;
  delete from public.enrollments where course_id in (${courseIds.map(lit).join(",") || "null"});
  delete from public.certificates where course_id in (${courseIds.map(lit).join(",") || "null"});
  delete from public.courses where id in (${courseIds.map(lit).join(",") || "null"});
  delete from public.institutions where identifier = 'DEMO-LYC-001';
commit;`);
console.log(`✓ ${courseIds.length} demo courses and the demo institution removed`);
// 3) Demonstration documents of the library (official linked resources are kept).
const demoDocs = await sql(`select id, file_path from public.library_resources where source_label = 'Démonstration SANADY'`);
const docPaths = demoDocs.map((d) => d.file_path).filter(Boolean);
if (docPaths.length) await admin.storage.from("library").remove(docPaths);
await sql(`delete from public.library_resources where source_label = 'Démonstration SANADY'`);
console.log(`✓ ${demoDocs.length} demonstration library documents removed`);
if (existsSync(STATE)) rmSync(STATE);
console.log("Demo data removed. Categories are kept.");

/** Deletes what add-demo-organizations.mjs created, most dependent rows first. */
function extendedRemovalSql(x, ids, orgs, finish = "commit") {
  const insts = `select id from public.institutions where id in (${ids(x.institutionIds)}) or (kind = 'enterprise' and name like '%(démo)')`;
  const courses = `select id from public.courses where id in (${ids(x.courseIds)}) or owner_institution_id in (${insts})`;
  const tenants = `select id from public.enterprise_tenants where organization_id in (${orgs})`;
  const contracts = `select id from public.enterprise_contracts where organization_id in (${orgs})`;
  const emails = [...(x.invitationEmails ?? []), ...(x.accessRequestEmails ?? []), "demo.nouvelle.recrue@example.com", "demo.nouveau.prof@example.com", "demo.acces1@example.com", "demo.acces2@example.com"];
  const emailList = emails.map(lit).join(",");
  return `begin;
  delete from public.training_projects where organization_id in (${orgs});
  delete from public.enrollments where course_id in (${courses});
  delete from public.certificates where course_id in (${courses});
  delete from public.quiz_attempts where course_id in (${courses});
  delete from public.lesson_progress where course_id in (${courses});
  delete from public.enterprise_support_requests where institution_id in (${insts}) or tenant_id in (${tenants});
  delete from public.courses where id in (${courses});
  delete from public.enterprise_payments where invoice_id in (select id from public.enterprise_invoices where contract_id in (${contracts}));
  delete from public.enterprise_invoices where contract_id in (${contracts});
  delete from public.enterprise_costs where id in (${ids(x.costIds)}) or contract_id in (${contracts}) or description like '%(démo)';
  delete from public.enterprise_contracts where organization_id in (${orgs});
  delete from public.data_deletions where tenant_id in (${tenants});
  delete from public.enterprise_tenants where organization_id in (${orgs});
  delete from public.institutions where id in (${insts});
  delete from public.enterprise_requests where id in (${ids(x.enterpriseRequestIds)}) or org_name like '%(démo)';
  delete from public.enterprise_proposals where organization_id in (${orgs});
  delete from public.enterprise_service_plans where id in (${ids(x.planIds)}) or name like '%(démo)';
  delete from public.partnership_impact_metrics where organization_id in (${orgs});
  delete from public.partnership_reports where organization_id in (${orgs});
  delete from public.partnership_contributions where organization_id in (${orgs});
  delete from public.partnership_agreements where organization_id in (${orgs});
  delete from public.partnership_applications where id in (${ids(x.applicationIds)}) or org_name like '%(démo)';
  delete from public.partner_organizations where id in (${orgs});
  delete from public.partnership_opportunities where id in (${ids(x.opportunityIds)}) or title like '%(démo)';
  delete from public.educational_needs where id in (${ids(x.needIds)}) or title like '%(démo)';
  delete from public.partnership_signatories where user_id in (select id from public.profiles where email like 'demo.%@example.com');
  delete from public.enrollment_codes where id in (${ids(x.enrollmentCodeIds)}) or label like '%(démo)';
  delete from public.invitations where email in (${emailList}) and accepted_at is null;
  delete from public.access_requests where email in (${emailList});
  ${x.portalWasEnabled === false ? "update public.platform_settings set partner_portal_enabled = false where id;" : ""}
${finish};`;
}
