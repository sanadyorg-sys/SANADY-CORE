#!/usr/bin/env node
/**
 * Logical backup of the live database (stopgap while the Supabase project is
 * on the free plan, which has no automatic backups).
 *
 *   npm run db:backup                 → backups/<date-time>/
 *   npm run db:backup -- --out D:\…   → another folder (e.g. an encrypted drive)
 *
 * Exports every table of the public schema as JSON (one file per table) plus
 * the list of stored files (names, sizes — not the files themselves) and a
 * manifest with row counts. The export contains personal data: keep it on an
 * encrypted drive, never in Git (backups/ is git-ignored), delete old copies.
 *
 * Restore: see docs/operations.md.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: { out: { type: "string" } } });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ref = url?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!ref || !token) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_ACCESS_TOKEN are required in .env.local.");
  process.exit(1);
}

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`SQL failed (HTTP ${res.status}): ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : [];
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const dir = values.out ? join(values.out, `sanady-${stamp}`) : join("backups", stamp);
mkdirSync(dir, { recursive: true });

const tables = (await sql(`select tablename from pg_tables where schemaname = 'public' order by tablename`)).map((t) => t.tablename);
const manifest = { project: ref, created_at: new Date().toISOString(), tables: {} };

for (const table of tables) {
  const [{ rows }] = await sql(`select coalesce(json_agg(t), '[]'::json) as rows from public."${table}" t`);
  writeFileSync(join(dir, `${table}.json`), JSON.stringify(rows, null, 1));
  manifest.tables[table] = rows.length;
  console.log(`✓ ${table.padEnd(28)} ${rows.length}`);
}

const [{ rows: objects }] = await sql(
  `select coalesce(json_agg(json_build_object('bucket', bucket_id, 'name', name, 'size', (metadata->>'size')::bigint, 'created_at', created_at)), '[]'::json) as rows from storage.objects`,
);
writeFileSync(join(dir, "storage-objects.json"), JSON.stringify(objects, null, 1));
manifest.storage_objects = objects.length;
manifest.migrations = (await sql(`select version from supabase_migrations.schema_migrations order by version`)).map((m) => m.version);
writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));

console.log(`\nBackup written to ${dir} (${tables.length} tables, ${objects.length} stored files listed).`);
console.log("It contains personal data: keep it on an encrypted drive and delete old copies.");
