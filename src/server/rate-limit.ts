import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

/** Best-effort client IP (behind Vercel / a reverse proxy). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

/**
 * Fixed-window rate limit stored in PostgreSQL (shared by all server
 * instances). Returns true when the request is allowed.
 * Fails CLOSED for sensitive endpoints if the limiter is unreachable.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("consume_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) throw error;
    return data === true;
  } catch (err) {
    console.error("[rate-limit] unavailable", err);
    return false;
  }
}
