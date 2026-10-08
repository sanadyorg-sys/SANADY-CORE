#!/usr/bin/env node
/**
 * Removes the demonstration data created by seed-demo.mjs.
 *
 *   npm run demo:remove
 *
 * Deletes the demo accounts (demo.*@example.com) and everything attached to
 * them, the demo institution (DEMO-LYC-001), the demo courses and their files.
 * Real accounts, institutions and courses are never touched.
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, rmSync } from "node:fs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ref = url?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
const token = process.env.SUPABASE_ACCESS_TOKEN;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!ref || !token || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ACCESS_TOKEN are required.");
  process.exit(1);
}
const STATE = "scripts/demo/.demo-state.json";
const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : { courseIds: [] };

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text.slice(0, 1500));
  return text ? JSON.parse(text) : [];
}
const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

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
  : (await sql(`select id from public.courses where title in ('Évaluation formative en classe','Gestion de classe bienveillante','Numérique éducatif responsable')`)).map((r) => r.id);
for (const id of courseIds) {
  const { data: lessons } = await admin.from("lessons").select("id, pdf_path, video_provider, video_ref").eq("course_id", id);
  const paths = (lessons ?? [])
    .flatMap((l) => [l.pdf_path, l.video_provider === "storage" ? l.video_ref : null])
    .filter(Boolean);
  if (paths.length) await admin.storage.from("course-media").remove(paths);
}
await sql(`begin;
  delete from public.enrollments where course_id in (${courseIds.map(lit).join(",") || "null"});
  delete from public.certificates where course_id in (${courseIds.map(lit).join(",") || "null"});
  delete from public.courses where id in (${courseIds.map(lit).join(",") || "null"});
  delete from public.institutions where identifier = 'DEMO-LYC-001';
commit;`);
console.log(`✓ ${courseIds.length} demo courses and the demo institution removed`);
if (existsSync(STATE)) rmSync(STATE);
console.log("Demo data removed. Categories are kept.");
