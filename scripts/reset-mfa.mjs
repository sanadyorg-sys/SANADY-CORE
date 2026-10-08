#!/usr/bin/env node
/**
 * Removes the two-factor authentication factors of an account (lost phone).
 * The person will be asked to set up 2FA again at their next sign-in.
 *
 *   npm run mfa:reset -- --email someone@example.org
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Verify the
 * person's identity through another channel BEFORE running this.
 */
import { createClient } from "@supabase/supabase-js";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: { email: { type: "string" } } });
const email = values.email?.trim().toLowerCase();
if (!email) {
  console.error("Usage: npm run mfa:reset -- --email <adresse>");
  process.exit(1);
}
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: profile } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
if (!profile) {
  console.error(`Aucun compte pour ${email}.`);
  process.exit(1);
}
const { data, error } = await admin.auth.admin.mfa.listFactors({ userId: profile.id });
if (error) throw error;
for (const factor of data.factors) {
  const { error: delError } = await admin.auth.admin.mfa.deleteFactor({ userId: profile.id, id: factor.id });
  if (delError) throw delError;
}
console.log(`✓ ${data.factors.length} facteur(s) supprimé(s) pour ${email}. La double authentification sera redemandée à la prochaine connexion.`);
