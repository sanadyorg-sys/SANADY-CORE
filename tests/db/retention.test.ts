/**
 * Retention: access requests (12 months), audit log (3 years), rate-limit
 * counters (1 day) are purged; recent data is kept.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, uid } from "./harness";

let db: TestDb;
beforeAll(async () => {
  db = await TestDb.create();
});
afterAll(async () => db?.close());

describe("retention", () => {
  it("purges only data past its retention period", async () => {
    const insert = (email: string, status: string, created: string, handled: string | null) =>
      db.sql(
        `insert into public.access_requests (first_name, last_name, email, status, created_at, handled_at)
         values ('A', 'B', $1, $2, now() - $3::interval, now() - $4::interval)`,
        [email, status, created, handled ?? "0 days"],
      );
    const old = `old.${uid()}@e.test`;
    const recent = `recent.${uid()}@e.test`;
    const stale = `stale.${uid()}@e.test`;
    const fresh = `fresh.${uid()}@e.test`;
    await insert(old, "rejected", "14 months", "13 months");
    await insert(recent, "approved", "14 months", "2 months");
    await insert(stale, "pending", "13 months", null);
    await insert(fresh, "pending", "1 month", null);
    await db.sql(`update public.access_requests set handled_at = null where status = 'pending'`);

    await db.sql(`insert into private.rate_limits (key, window_started_at, hits) values ('old', now() - interval '3 days', 1), ('new', now(), 1)`);
    await db.sql(`insert into public.audit_logs (action, entity_type, created_at) values ('test_old', 'test', now() - interval '4 years'), ('test_new', 'test', now())`);

    const [res] = await db.sql<{ r: Record<string, number> }>(`select private.run_retention() as r`);
    expect(res!.r).toMatchObject({ access_requests: 2, audit_logs: 1, rate_limits: 1 });

    const left = await db.sql<{ email: string }>(`select email from public.access_requests where email = any($1)`, [[old, recent, stale, fresh]]);
    expect(left.map((r) => r.email).sort()).toEqual([fresh, recent].sort());
    expect(await db.sql(`select key from private.rate_limits where key in ('old', 'new')`)).toEqual([{ key: "new" }]);
    expect(await db.sql(`select action from public.audit_logs where action like 'test_%'`)).toEqual([{ action: "test_new" }]);
  });

  it("cannot be run by users", async () => {
    const user = await db.createUser(`u.${uid()}@e.test`);
    await expect(db.as(user, (q) => q(`select private.run_retention()`))).rejects.toThrow(/permission denied/);
  });
});
