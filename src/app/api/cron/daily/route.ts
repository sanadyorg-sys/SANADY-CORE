import { timingSafeEqual } from "node:crypto";
import { runHousekeeping } from "@/server/housekeeping";

/**
 * Daily scheduled job (vercel.json). Vercel sends « Authorization: Bearer
 * <CRON_SECRET> »; without the secret configured, the job refuses to run.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret ?? ""}`;
  if (!secret || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return new Response("Accès refusé.", { status: 401 });
  }
  const result = await runHousekeeping();
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
