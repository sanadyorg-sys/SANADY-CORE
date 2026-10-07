import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/server-env";

/**
 * Privileged client (service role) — bypasses RLS.
 * Use ONLY for operations that cannot run as the user: invitation
 * acceptance, account creation, rate limiting. Never expose to the client.
 */
export function createAdminClient() {
  return createClient(publicEnv.supabaseUrl, serverEnv.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
