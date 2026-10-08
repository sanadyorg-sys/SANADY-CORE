/**
 * Scenario 16 (responsive interface behaviour) and public access rules.
 * Runs on desktop, tablet and mobile projects (see playwright.config.ts).
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const PUBLIC_PAGES = ["/connexion", "/aide", "/mot-de-passe-oublie", "/rejoindre", "/verifier", "/confidentialite", "/invitation/lien-invalide"];

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe("public pages", () => {
  for (const path of PUBLIC_PAGES) {
    test(`${path} renders in French without horizontal scrolling`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBeLessThan(500);
      await expect(page.locator("html")).toHaveAttribute("lang", "fr");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoHorizontalScroll(page);
    });

    test(`${path} has no detectable WCAG 2.2 A/AA violations`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
    });
  }
});

test.describe("sign-in page", () => {
  test("is invitation-only and exposes labelled fields", async ({ page }) => {
    await page.goto("/connexion");
    await expect(page.getByRole("heading", { name: "Bienvenue sur SANADY" })).toBeVisible();
    await expect(page.getByLabel("Adresse e-mail")).toBeVisible();
    await expect(page.getByLabel("Mot de passe", { exact: true })).toBeVisible();
    await expect(page.getByText("L’accès à la plateforme se fait uniquement sur invitation.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Rejoindre avec un code" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Besoin d’aide/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /inscri/i })).toHaveCount(0);
  });

  test("password visibility can be toggled by keyboard", async ({ page }) => {
    await page.goto("/connexion");
    const password = page.getByLabel("Mot de passe", { exact: true });
    await expect(password).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Afficher le mot de passe" }).focus();
    await page.keyboard.press("Enter");
    await expect(password).toHaveAttribute("type", "text");
  });

  test("validates input before contacting the server", async ({ page }) => {
    await page.goto("/connexion");
    await page.getByLabel("Adresse e-mail").fill("pas-une-adresse");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByText("Adresse e-mail invalide.")).toBeVisible();
  });
});

test.describe("access control", () => {
  for (const path of ["/espace", "/espace/formations", "/admin", "/admin/formations", "/etablissement/00000000-0000-0000-0000-000000000000"]) {
    test(`${path} redirects anonymous visitors to sign-in`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/connexion\?suite=/);
    });
  }

  test("an unknown invitation link is rejected", async ({ page }) => {
    await page.goto("/invitation/lien-invalide");
    await expect(page.getByRole("heading", { name: "Lien d’invitation invalide" })).toBeVisible();
  });

  test("protected API routes refuse anonymous requests", async ({ request }) => {
    const cert = await request.get("/api/certificats/00000000-0000-0000-0000-000000000000");
    expect(cert.status()).toBe(401);
    const report = await request.get("/api/rapports/00000000-0000-0000-0000-000000000000/00000000-0000-0000-0000-000000000000");
    expect(report.status()).toBe(401);
  });
});

test.describe("responsive layout", () => {
  test("brand panel is shown on large screens only", async ({ page }, testInfo) => {
    await page.goto("/connexion");
    const panel = page.getByText("Ensemble, faisons grandir l’éducation.");
    if (testInfo.project.name === "desktop") await expect(panel).toBeVisible();
    else await expect(panel).toBeHidden();
  });

  test("touch targets on the sign-in form are at least 24 px high", async ({ page }) => {
    await page.goto("/connexion");
    for (const name of ["Se connecter", "Afficher le mot de passe"]) {
      const box = await page.getByRole("button", { name }).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(24);
    }
  });

  test("security headers are sent", async ({ request }) => {
    const res = await request.get("/connexion");
    expect(res.headers()["x-frame-options"]).toBe("DENY");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    expect(res.headers()["x-powered-by"]).toBeUndefined();
  });
});
