#!/usr/bin/env node
/**
 * Adds two demonstration accounts for the new roles:
 *   demo.formateur@example.com   trainer of « Numérique éducatif responsable » (draft)
 *   demo.supervision@example.com supervisor (read-only) of Lycée Ibn Khaldoun (démo)
 *
 *   npm run demo:roles
 *
 * Passwords are printed once. Removed with the other demo accounts by
 * `npm run demo:remove`. Safe to re-run (existing accounts are skipped).
 */
import { createClient } from "@supabase/supabase-js";
import { randomInt } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ref = url?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
const token = process.env.SUPABASE_ACCESS_TOKEN;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!ref || !token || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ACCESS_TOKEN are required.");
  process.exit(1);
}

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`SQL failed (HTTP ${res.status}): ${text.slice(0, 1500)}`);
  return text ? JSON.parse(text) : [];
}
const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const password = () => `Demo-${Array.from({ length: 8 }, () => ALPHA[randomInt(ALPHA.length)]).join("")}7`;
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const ACCOUNTS = [
  { email: "demo.formateur@example.com", first: "Rachid", last: "Bennani", job: "Formateur en didactique du numérique" },
  { email: "demo.supervision@example.com", first: "Leila", last: "Chraibi", job: "Inspectrice pédagogique" },
];

const created = [];
for (const a of ACCOUNTS) {
  const [existing] = await sql(`select id from public.profiles where email = ${lit(a.email)}`);
  if (existing) {
    console.log(`• ${a.email}: already present, skipped`);
    a.id = existing.id;
    continue;
  }
  const pwd = password();
  const { data, error } = await admin.auth.admin.createUser({
    email: a.email,
    password: pwd,
    email_confirm: true,
    user_metadata: { first_name: a.first, last_name: a.last },
  });
  if (error) throw new Error(`${a.email}: ${error.message}`);
  a.id = data.user.id;
  await sql(`update public.profiles set job_title = ${lit(a.job)}, onboarded_at = now(), privacy_acknowledged_at = now() where id = ${lit(a.id)}`);
  created.push({ ...a, pwd });
}

const [trainer, supervisor] = ACCOUNTS;
await sql(`insert into public.platform_roles (user_id, role) values (${lit(trainer.id)}, 'trainer') on conflict (user_id) do update set role = 'trainer'`);
await sql(`insert into public.course_trainers (course_id, user_id)
           select c.id, ${lit(trainer.id)} from public.courses c where c.title in ('Numérique éducatif responsable', 'Évaluation formative en classe')
           on conflict (course_id, user_id) do nothing`);
await sql(`insert into public.institution_memberships (institution_id, user_id, role, source)
           select i.id, ${lit(supervisor.id)}, 'supervisor', 'admin' from public.institutions i where i.identifier = 'DEMO-LYC-001'
           on conflict do nothing`);
console.log("✓ trainer of « Numérique éducatif responsable » (draft) and « Évaluation formative en classe » (published)");
console.log("✓ supervisor of Lycée Ibn Khaldoun (démo)");
if (created.length) {
  console.log("\nDemo accounts (password shown once):");
  for (const c of created) console.log(`  ${c.email.padEnd(30)} ${c.pwd}   ${c.first} ${c.last} — ${c.job}`);
}
