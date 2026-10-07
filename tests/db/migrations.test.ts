import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb } from "./harness";

let db: TestDb;
beforeAll(async () => {
  db = await TestDb.create();
});
afterAll(async () => db?.close());

describe("migrations", () => {
  it("apply cleanly and enable RLS on every public table", async () => {
    const rows = await db.sql<{ relname: string; relrowsecurity: boolean }>(
      `select c.relname, c.relrowsecurity
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'`,
    );
    expect(rows.length).toBeGreaterThanOrEqual(25);
    expect(rows.filter((r) => !r.relrowsecurity).map((r) => r.relname)).toEqual([]);
  });

  it("does not let anonymous users read any table", async () => {
    const tables = await db.sql<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'`,
    );
    for (const { relname } of tables) {
      await expect(db.as(null, (q) => q(`select 1 from public.${relname} limit 1`), "anon")).rejects.toThrow(
        /permission denied/,
      );
    }
  });

  it("pins search_path on every SECURITY DEFINER function", async () => {
    const rows = await db.sql<{ proname: string }>(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname in ('public', 'private') and p.prosecdef
          and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`,
    );
    expect(rows).toEqual([]);
  });

  it("exposes only certificate verification and public platform identity to anon", async () => {
    const rows = await db.sql<{ proname: string }>(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')`,
    );
    expect(rows.map((r) => r.proname).sort()).toEqual(["public_platform_info", "verify_certificate"]);
  });
});
