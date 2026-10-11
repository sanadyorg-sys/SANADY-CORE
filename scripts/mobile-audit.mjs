#!/usr/bin/env node
/**
 * Mobile layout audit: signs in as each role, follows the area's internal
 * links, and on every page reports horizontal page overflow, elements that
 * stick out of the viewport (outside intentional scroll areas) and small tap
 * targets. Saves a screenshot per page.
 *
 *   node scripts/mobile-audit.mjs --base http://localhost:3200 --out <folder> [--width 360]
 * Accounts are passed as JSON in AUDIT_ACCOUNTS:
 *   [{ "name": "teacher", "email": "…", "password": "…", "start": "/espace", "scope": "/espace" }]
 * A public pass (no sign-in) always runs first.
 */
import { chromium, devices } from "@playwright/test";
import { createHmac } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: { base: { type: "string" }, out: { type: "string" }, width: { type: "string" }, max: { type: "string" } },
});
const base = values.base ?? "http://localhost:3200";
const out = values.out ?? "mobile-audit";
const width = Number(values.width ?? 390);
const maxPages = Number(values.max ?? 30);
mkdirSync(out, { recursive: true });

const accounts = JSON.parse(process.env.AUDIT_ACCOUNTS ?? "[]");
const PUBLIC = ["/", "/formations", "/programmes", "/ressources", "/a-propos", "/demande-acces", "/connexion", "/rejoindre", "/verifier", "/aide", "/confidentialite", "/mot-de-passe-oublie"];
const SKIP = /\/deconnexion|\/api\/|^mailto:|^tel:|\.pdf$|\/securite\//;

/** RFC 6238 TOTP (SHA-1, 30 s, 6 digits) for accounts with two-factor authentication. */
function totp(secret) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secret.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = createHmac("sha1", key).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

const browser = await chromium.launch();
const report = [];

async function audit(page, path, label) {
  const res = await page.goto(base + path, { waitUntil: "networkidle" }).catch(() => null);
  if (!res) return [];
  await page.waitForTimeout(400);
  const finalPath = new URL(page.url()).pathname + new URL(page.url()).search;
  const issues = await page.evaluate((vw) => {
    const found = [];
    const doc = document.documentElement;
    const overflow = Math.max(doc.scrollWidth - doc.clientWidth, window.innerWidth - vw);
    // On phones the layout viewport widens (page zoomed out) when content is too wide.
    if (overflow > 1) found.push({ type: "page-overflow", detail: `${overflow}px` });
    const inScroller = (el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === "auto" || ox === "scroll" || ox === "hidden" || ox === "clip") return true;
      }
      return false;
    };
    const describe = (el) => {
      const cls = (el.getAttribute("class") || "").split(" ").slice(0, 4).join(".");
      const text = (el.innerText || el.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 40);
      return `<${el.tagName.toLowerCase()}${cls ? "." + cls : ""}> ${text}`;
    };
    const seen = new Set();
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const st = getComputedStyle(el);
      if (st.visibility === "hidden" || st.display === "none" || st.position === "fixed") continue;
      if (r.right > vw + 1 && r.left < vw && !inScroller(el)) {
        // report only the outermost offending element
        let parentOffends = false;
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (seen.has(p)) parentOffends = true;
        seen.add(el);
        if (!parentOffends) found.push({ type: "sticks-out", detail: `${Math.round(r.right - vw)}px ${describe(el)}` });
      }
    }
    for (const el of document.querySelectorAll("a[href], button, input:not([type=hidden]), select, textarea, [role=button]")) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const st = getComputedStyle(el);
      if (st.visibility === "hidden" || st.display === "none") continue;
      const inline = el.tagName === "A" && st.display === "inline" && el.closest("p, li, td, dd, span");
      if (!inline && (r.height < 24 || r.width < 24)) found.push({ type: "small-target", detail: `${Math.round(r.width)}x${Math.round(r.height)} ${describe(el)}` });
    }
    return found;
  }, width);
  const file = `${label}${path.replace(/[^a-z0-9]+/gi, "_").slice(0, 80) || "_home"}.png`;
  await page.screenshot({ path: join(out, file), fullPage: true });
  report.push({ label, path: finalPath, issues, screenshot: file });
  return page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")));
}

async function crawl(page, label, start, scope) {
  const queue = [start];
  const done = new Set();
  const seenPatterns = new Set();
  while (queue.length && done.size < maxPages) {
    const path = queue.shift();
    if (done.has(path)) continue;
    // One page per route pattern (ids collapsed), to keep the audit focused.
    const pattern = path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ":id").split("?")[0];
    if (seenPatterns.has(pattern) && path !== start) continue;
    seenPatterns.add(pattern);
    done.add(path);
    const links = (await audit(page, path, label)) ?? [];
    for (const href of links) {
      if (!href || SKIP.test(href) || href.startsWith("http") || href.startsWith("#")) continue;
      const clean = href.split("#")[0];
      if (scope && !clean.startsWith(scope)) continue;
      if (!done.has(clean)) queue.push(clean);
    }
  }
}

// Public pages
{
  const ctx = await browser.newContext({ ...devices["iPhone 13"], viewport: { width, height: 844 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  for (const p of PUBLIC) await audit(page, p, "public");
  await ctx.close();
}

for (const acc of accounts) {
  const ctx = await browser.newContext({ ...devices["iPhone 13"], viewport: { width, height: 844 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(base + "/connexion");
  await page.getByLabel("Adresse e-mail").fill(acc.email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(acc.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForLoadState("networkidle");
  if (acc.totpSecret) {
    await page.waitForURL(/\/securite\/verification/);
    await page.locator("input[autocomplete=one-time-code]").fill(totp(acc.totpSecret));
    await page.getByRole("button", { name: "Vérifier" }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/securite"));
    await page.waitForLoadState("networkidle");
  }
  const start = acc.start === "landing" ? new URL(page.url()).pathname : acc.start;
  const scope = acc.scope === "landing" ? start : acc.scope;
  await crawl(page, acc.name, start, scope);
  await ctx.close();
}
await browser.close();

writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 2));
const withIssues = report.filter((r) => r.issues.length);
console.log(`${report.length} pages audited at ${width}px — ${withIssues.length} with issues`);
for (const r of withIssues) {
  console.log(`\n[${r.label}] ${r.path}`);
  const byType = {};
  for (const i of r.issues) (byType[i.type] ??= []).push(i.detail);
  for (const [t, list] of Object.entries(byType)) {
    console.log(`  ${t} (${list.length})`);
    for (const d of [...new Set(list)].slice(0, 4)) console.log(`    ${d}`);
  }
}
