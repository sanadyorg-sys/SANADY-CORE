#!/usr/bin/env node
/**
 * Applies pending migrations to a hosted Supabase project through the
 * Management API (no database password needed — uses a personal access token).
 * Each migration runs in its own transaction and is recorded in
 * supabase_migrations.schema_migrations, exactly like `supabase db push`.
 *
 *   node --env-file=.env.local scripts/db-apply-remote.mjs [--dry-run]
 *
 * Requires SUPABASE_ACCESS_TOKEN and NEXT_PUBLIC_SUPABASE_URL.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const token = process.env.SUPABASE_ACCESS_TOKEN;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ref = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
const dryRun = process.argv.includes("--dry-run");
if (!token || !ref) {
  console.error("SUPABASE_ACCESS_TOKEN and NEXT_PUBLIC_SUPABASE_URL are required.");
  process.exit(1);
}

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 2000)}`);
  return text ? JSON.parse(text) : null;
}

await query(`
  create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (
    version text primary key, statements text[], name text
  );`);

const applied = new Set(
  (await query("select version from supabase_migrations.schema_migrations")).map((r) => r.version),
);
const dir = join("supabase", "migrations");
const files = readdirSync(dir).filter((f) => /^\d{14}_.+\.sql$/.test(f)).sort();

for (const file of files) {
  const version = file.slice(0, 14);
  const name = file.slice(15, -4);
  if (applied.has(version)) {
    console.log(`• ${file} (already applied)`);
    continue;
  }
  if (dryRun) {
    console.log(`○ ${file} (pending)`);
    continue;
  }
  const sql = readFileSync(join(dir, file), "utf8");
  const record = `insert into supabase_migrations.schema_migrations (version, name) values ('${version}', '${name.replace(/'/g, "''")}');`;
  try {
    await query(`begin;\n${sql}\n;\n${record}\ncommit;`);
    console.log(`✓ ${file}`);
  } catch (err) {
    console.error(`✗ ${file}\n${err.message}`);
    process.exit(1);
  }
}
console.log(dryRun ? "Dry run complete." : "Database is up to date.");
