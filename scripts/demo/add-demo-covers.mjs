#!/usr/bin/env node
/**
 * Gives the demo courses branded cover images and lists the published ones
 * in the public catalog.
 *
 *   npm run demo:covers
 *
 * Covers are generated locally (sharp), uploaded to the public course-covers
 * bucket under <courseId>/couverture-demo.jpg. Safe to re-run.
 * Removed with the demo courses by `npm run demo:remove`.
 */
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ref = url?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
const token = process.env.SUPABASE_ACCESS_TOKEN;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!ref || !token || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ACCESS_TOKEN are required.");
  process.exit(1);
}

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`SQL failed (HTTP ${res.status}): ${text.slice(0, 1500)}`);
  return text ? JSON.parse(text) : [];
}
const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;

const COVERS = [
  { title: "Évaluation formative en classe", bg: "#F95A05", fg: "#FFFFFF", accent: "#1C1917", shape: "checks" },
  { title: "Gestion de classe bienveillante", bg: "#1C1917", fg: "#FFFFFF", accent: "#F95A05", shape: "circles" },
  { title: "Numérique éducatif responsable", bg: "#7A2E05", fg: "#FFFFFF", accent: "#FDBA8C", shape: "grid" },
];

const W = 1280;
const H = 720;
const FONT = "Segoe UI, Arial, sans-serif";
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function wrap(text, max) {
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && `${line} ${word}`.length > max) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

function decoration(shape, accent) {
  if (shape === "checks") {
    return [0, 1, 2]
      .map((i) => {
        const y = 150 + i * 150;
        return `<rect x="880" y="${y}" width="300" height="100" rx="22" fill="#fff" fill-opacity="${0.16 - i * 0.03}"/>
          <circle cx="935" cy="${y + 50}" r="24" fill="${accent}" fill-opacity="${0.9 - i * 0.25}"/>
          <path d="M923 ${y + 50} l9 9 l17 -19" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          <rect x="980" y="${y + 38}" width="${160 - i * 30}" height="24" rx="12" fill="#fff" fill-opacity="0.55"/>`;
      })
      .join("");
  }
  if (shape === "circles") {
    return `<circle cx="1090" cy="250" r="230" fill="none" stroke="${accent}" stroke-width="44" stroke-opacity="0.9"/>
      <circle cx="1090" cy="250" r="120" fill="${accent}" fill-opacity="0.18"/>
      <circle cx="930" cy="560" r="70" fill="#fff" fill-opacity="0.08"/>`;
  }
  const cells = [];
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++)
      cells.push(`<rect x="${860 + c * 92}" y="${120 + r * 92}" width="72" height="72" rx="14" fill="${(r + c) % 3 === 0 ? accent : "#fff"}" fill-opacity="${(r + c) % 3 === 0 ? 0.85 : 0.1}"/>`);
  return cells.join("");
}

async function render({ title, bg, fg, accent, shape }, category) {
  const lines = wrap(title, 20);
  const top = 360 - (lines.length * 78) / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="${bg}"/>
    ${decoration(shape, accent)}
    <rect x="88" y="${top - 70}" width="64" height="8" rx="4" fill="${accent}"/>
    <text x="88" y="${top - 26}" font-family="${FONT}" font-size="26" font-weight="600" letter-spacing="3" fill="${fg}" fill-opacity="0.85">${esc((category ?? "Formation").toUpperCase())}</text>
    ${lines.map((l, i) => `<text x="88" y="${top + 50 + i * 78}" font-family="${FONT}" font-size="68" font-weight="800" fill="${fg}">${esc(l)}</text>`).join("")}
    <text x="88" y="${H - 64}" font-family="${FONT}" font-size="24" font-weight="600" fill="${fg}" fill-opacity="0.8">Fondation Sanady · SANADY</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
}

const storage = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }).storage;
for (const cover of COVERS) {
  const [course] = await sql(
    `select c.id, c.status, cat.name as category from public.courses c
       left join public.course_categories cat on cat.id = c.category_id
      where c.title = ${lit(cover.title)} limit 1`,
  );
  if (!course) {
    console.log(`• ${cover.title}: not found, skipped`);
    continue;
  }
  const path = `${course.id}/couverture-demo.jpg`;
  const { error } = await storage.from("course-covers").upload(path, await render(cover, course.category), { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(`upload ${path}: ${error.message}`);
  await sql(`update public.courses set cover_path = ${lit(path)}, public_listing = true where id = ${lit(course.id)}`);
  console.log(`✓ ${cover.title} — cover uploaded, listed in the public catalog${course.status === "published" ? "" : " once published"}`);
}
