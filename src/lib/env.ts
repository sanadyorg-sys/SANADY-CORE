/**
 * Environment access. Public values are inlined at build time by Next.js;
 * server-only secrets are read lazily so that a missing optional integration
 * never breaks unrelated pages. Never import server secrets in client code.
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`[SANADY] Missing required environment variable ${name}. See .env.example.`);
  }
  return value;
}

export const publicEnv = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get supabaseAnonKey() {
    return required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  },
  get appUrl() {
    return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  },
};
