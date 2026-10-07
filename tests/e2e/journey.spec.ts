/**
 * Authenticated journeys against a REAL Supabase project.
 * Skipped unless these variables are set (see docs/testing.md):
 *   E2E_BASE_URL, E2E_TEACHER_EMAIL, E2E_TEACHER_PASSWORD,
 *   E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD
 * The teacher account must have at least one assigned, published course.
 */
import { expect, test, type Page } from "@playwright/test";

const env = process.env;
const configured = Boolean(env.E2E_BASE_URL && env.E2E_TEACHER_EMAIL && env.E2E_TEACHER_PASSWORD);

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

test.describe("teacher journey", () => {
  test.skip(!configured, "Requires a real Supabase project (E2E_* variables).");

  test("signs in, resumes a course and opens a lesson", async ({ page }) => {
    await signIn(page, env.E2E_TEACHER_EMAIL!, env.E2E_TEACHER_PASSWORD!);
    await expect(page).toHaveURL(/\/espace/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Bonjour|Bonsoir/);

    await page.goto("/espace/formations?filtre=toutes");
    await page.getByRole("link", { name: /Reprendre|Commencer/ }).first().click();
    await expect(page).toHaveURL(/\/lecons\//);
    await expect(page.getByRole("navigation", { name: "Navigation entre les leçons" })).toBeVisible();
  });

  test("cannot open the administration area", async ({ page }) => {
    await signIn(page, env.E2E_TEACHER_EMAIL!, env.E2E_TEACHER_PASSWORD!);
    await page.goto("/admin");
    await expect(page).not.toHaveURL(/\/admin/);
  });
});

test.describe("administrator journey", () => {
  test.skip(!(configured && env.E2E_ADMIN_EMAIL && env.E2E_ADMIN_PASSWORD), "Requires administrator credentials.");

  test("opens the course catalogue and the audit log", async ({ page }) => {
    await signIn(page, env.E2E_ADMIN_EMAIL!, env.E2E_ADMIN_PASSWORD!);
    await page.goto("/admin/formations");
    await expect(page.getByRole("heading", { name: "Formations" })).toBeVisible();
    await page.goto("/admin/journal");
    await expect(page.getByRole("heading", { name: "Journal d’activité" })).toBeVisible();
  });
});
