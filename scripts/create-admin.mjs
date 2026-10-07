#!/usr/bin/env node
/**
 * Bootstraps a SANADY administrator (registration is invitation-only, so the
 * very first administrator must be created from the server).
 *
 *   npm run admin:create -- --email direction@sanady.ma --first Nadia --last Berrada
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and
 * NEXT_PUBLIC_APP_URL (read from .env.local by the npm script).
 * The account is created WITHOUT a password: a one-time link is printed so
 * the administrator chooses their own password. Idempotent: running it for
 * an existing account only grants the administrator role.
 */
import { createClient } from "@supabase/supabase-js";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    first: { type: "string", default: "" },
    last: { type: "string", default: "" },
  },
});

const email = values.email?.trim().toLowerCase();
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error("Usage: npm run admin:create -- --email <adresse> [--first <prénom>] [--last <nom>]");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis (voir .env.example).");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function findUserId() {
  const { data, error } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

let userId = await findUserId();
if (!userId) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { first_name: values.first, last_name: values.last },
  });
  if (error) {
    console.error("Création du compte impossible :", error.message);
    process.exit(1);
  }
  userId = data.user.id;
  console.log(`✓ Compte créé : ${email}`);
} else {
  console.log(`• Compte existant : ${email}`);
}

const { error: roleError } = await admin.from("platform_roles").upsert({ user_id: userId, role: "sanady_admin" }, { onConflict: "user_id" });
if (roleError) {
  console.error("Attribution du rôle impossible :", roleError.message);
  process.exit(1);
}
console.log("✓ Rôle d’administrateur SANADY attribué.");

const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "recovery", email });
if (linkError) {
  console.error("Lien de définition du mot de passe impossible :", linkError.message);
  process.exit(1);
}
const setPassword = `${appUrl}/auth/confirm?token_hash=${encodeURIComponent(link.properties.hashed_token)}&type=recovery&next=/nouveau-mot-de-passe`;
console.log("\nLien à usage unique pour définir le mot de passe (valable 1 heure) :\n");
console.log(`  ${setPassword}\n`);
console.log("Transmettez-le uniquement à la personne concernée. Elle complétera ensuite son profil à la première connexion.");
