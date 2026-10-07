import "server-only";

function optional(value: string | undefined) {
  return value && value.trim() !== "" ? value : undefined;
}

export const serverEnv = {
  get serviceRoleKey() {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error("[SANADY] Missing SUPABASE_SERVICE_ROLE_KEY (server only). See .env.example.");
    return key;
  },
  get resendApiKey() {
    return optional(process.env.RESEND_API_KEY);
  },
  get emailFrom() {
    return optional(process.env.EMAIL_FROM) ?? "SANADY <no-reply@example.org>";
  },
  get mux() {
    const keyId = optional(process.env.MUX_SIGNING_KEY_ID);
    const privateKey = optional(process.env.MUX_SIGNING_PRIVATE_KEY);
    return keyId && privateKey ? { keyId, privateKey } : undefined;
  },
};
