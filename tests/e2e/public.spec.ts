/**
 * Scenario 16 (responsive interface behaviour) and public access rules.
 * Runs on desktop, tablet and mobile projects (see playwright.config.ts).
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const PUBLIC_PAGES = ["/", "/formations", "/a-propos", "/ressources", "/demande-acces", "/connexion", "/aide", "/mot-de-passe-oublie", "/rejoindre", "/verifier", "/confidentialite", "/invitation/lien-invalide", "/partenariats", "/partenariats/domaines/rehabilitation"];

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
      // Checked as reduced-motion users see it: scroll-reveal content fully shown.
      await page.emulateMedia({ reducedMotion: "reduce" });
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
  for (const path of ["/mon-espace", "/espace", "/espace/formations", "/espace/bibliotheque", "/admin/bibliotheque", "/admin/rapports", "/admin", "/admin/formations", "/etablissement/00000000-0000-0000-0000-000000000000"]) {
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
    const adminCsv = await request.get("/api/exports/admin/formations");
    expect(adminCsv.status()).toBe(401);
    const institutionCsv = await request.get("/api/exports/etablissement/00000000-0000-0000-0000-000000000000/enseignants");
    expect(institutionCsv.status()).toBe(401);
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

test.describe("content security policy", () => {
  test("sends a per-request nonce policy and blocks nothing the app needs", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (msg) => {
      if (/Content Security Policy|Refused to/i.test(msg.text())) violations.push(msg.text());
    });
    const first = await page.goto("/connexion");
    const csp = first?.headers()["content-security-policy"] ?? "";
    expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");

    // Interactive hydration works (Next.js scripts carry the nonce).
    await page.getByLabel("Mot de passe", { exact: true }).fill("x");
    await page.getByRole("link", { name: "Rejoindre avec un code" }).click();
    await expect(page).toHaveURL(/\/rejoindre/);

    const second = await page.request.get("/connexion");
    expect(second.headers()["content-security-policy"]).not.toEqual(csp);
    expect(violations).toEqual([]);
  });
});

test.describe("public website", () => {
  test("home page leads to the catalog and the access request", async ({ page }, testInfo) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Développez vos pratiques");
    await page.getByRole("searchbox", { name: "Que souhaitez-vous apprendre ?" }).fill("évaluation");
    await page.getByRole("button", { name: "Rechercher" }).click();
    await expect(page).toHaveURL(/\/formations\?q=%C3%A9valuation/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Catalogue des formations");
    if (testInfo.project.name === "mobile") {
      await expect(page.getByRole("banner").getByRole("link", { name: "Demander un accès" })).toBeHidden();
      await page.getByRole("button", { name: "Ouvrir le menu" }).click();
      await page.getByRole("dialog").getByRole("link", { name: "Demander un accès" }).click();
    } else {
      await page.getByRole("banner").getByRole("link", { name: "Demander un accès" }).click();
    }
    await expect(page).toHaveURL(/\/demande-acces/);
  });

  test("an unknown course page returns 404", async ({ page }) => {
    const res = await page.goto("/formations/00000000-0000-0000-0000-000000000000");
    expect(res?.status()).toBe(404);
    const bad = await page.goto("/formations/pas-un-identifiant");
    expect(bad?.status()).toBe(404);
  });

  test("the access request form validates before sending", async ({ page }) => {
    await page.goto("/demande-acces");
    await page.getByRole("button", { name: "Envoyer ma demande" }).click();
    await expect(page.getByText("Veuillez saisir votre prénom.")).toBeVisible();
    await expect(page.getByText("Veuillez accepter le traitement de vos données pour envoyer la demande.")).toBeVisible();
  });
});

test.describe("partnerships portal (hidden until approved)", () => {
  test("is not indexed and not linked from the menu", async ({ page }) => {
    await page.goto("/partenariats");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Ensemble, construisons un avenir éducatif meilleur.");
    await page.goto("/");
    await expect(page.locator('a[href="/partenariats"]')).toHaveCount(0);
  });

  test("validates each step before moving on", async ({ page }) => {
    await page.goto("/partenariats#candidature");
    await page.getByRole("button", { name: "Continuer" }).click();
    await expect(page.getByText("Veuillez renseigner le nom de l’organisation.")).toBeVisible();
    await expect(page.getByLabel("Nom de l’organisation")).toBeFocused();
    await page.getByLabel("Nom de l’organisation").fill("Fondation Exemple");
    await page.getByLabel("Type d’organisation").selectOption("fondation");
    await page.getByLabel("Présentation de l’organisation").fill("Une fondation engagée pour l’éducation au Maroc.");
    await page.getByRole("button", { name: "Continuer" }).click();
    await expect(page.getByRole("heading", { name: /Étape 2 sur 5/ })).toBeVisible();
    await page.getByRole("button", { name: "Continuer" }).click();
    await expect(page.getByText("Adresse e-mail invalide.").or(page.getByText("Veuillez saisir une adresse e-mail."))).toBeVisible();
  });

  test("has one page per field of intervention and 404 for unknown ones", async ({ page }) => {
    await page.goto("/partenariats/domaines/formation-continue");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Formation continue des enseignants");
    await page.getByRole("link", { name: "Proposer un partenariat dans ce domaine" }).click();
    await expect(page).toHaveURL(/domaine=formation-continue/);
    const res = await page.goto("/partenariats/domaines/marketing");
    expect(res?.status()).toBe(404);
  });

  test("the team area refuses anonymous visitors", async ({ page }) => {
    await page.goto("/admin/partenariats");
    await expect(page).toHaveURL(/\/connexion/);
    const doc = await page.request.get("/api/partenariats/documents/00000000-0000-0000-0000-000000000000");
    expect(doc.status()).toBe(401);
  });
});
