import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests.
 *
 * - tests/e2e/public.spec.ts runs against a production build with
 *   placeholder Supabase settings: it covers public pages, access
 *   redirection, responsive behaviour and automated accessibility checks.
 * - tests/e2e/journey.spec.ts needs a real Supabase project with seeded
 *   accounts (see docs/testing.md) and is skipped otherwise.
 */
const PORT = 3100;
const externalBaseUrl = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  timeout: 30_000,
  use: {
    baseURL: externalBaseUrl ?? `http://localhost:${PORT}`,
    locale: "fr-FR",
    timezoneId: "Africa/Casablanca",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "tablet", use: { ...devices["Desktop Chrome"], viewport: { width: 834, height: 1112 }, hasTouch: true } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: `npx next start -p ${PORT}`,
        url: `http://localhost:${PORT}/connexion`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key",
          NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`,
        },
      },
});
