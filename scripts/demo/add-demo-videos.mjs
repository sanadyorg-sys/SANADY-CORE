#!/usr/bin/env node
/**
 * Adds a narrated introduction video to each demo course (optional lesson at
 * the start of module 1, so existing progress and certificates are unchanged).
 *
 *   FFMPEG=<path to ffmpeg> npm run demo:videos -- --admin <admin e-mail>
 *
 * Videos are generated locally from scripts/demo/videos.mjs: branded slides
 * (sharp) + French narration (Windows « Microsoft Hortense » voice), encoded
 * as H.264/AAC MP4 with ffmpeg, then uploaded to the private course-media
 * bucket. Windows only (speech synthesis). Safe to re-run: courses that
 * already have the video are skipped. Removed by `npm run demo:remove`.
 */
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import sharp from "sharp";
import { VIDEOS } from "./videos.mjs";

const { values } = parseArgs({ options: { admin: { type: "string" }, "render-only": { type: "boolean" } } });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ref = url?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
const token = process.env.SUPABASE_ACCESS_TOKEN;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ffmpeg = process.env.FFMPEG || "ffmpeg";
const renderOnly = Boolean(values["render-only"]);
if (!renderOnly && (!ref || !token || !serviceKey || !values.admin)) {
  console.error("Usage: FFMPEG=<ffmpeg> npm run demo:videos -- --admin <admin e-mail>  (needs URL, service key and access token in .env.local)");
  process.exit(1);
}

const W = 1280;
const H = 720;
const INK = "#1C1917";
const ORANGE = "#F95A05";
const FONT = "Segoe UI, Arial, sans-serif";
const work = join(tmpdir(), "sanady-demo-videos");
mkdirSync(work, { recursive: true });

// ─── Slides ─────────────────────────────────────────────────────────────────
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function wrap(text, max) {
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && (line + " " + word).length > max) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

const logo = await sharp("public/brand/sanady-logo.png").resize({ height: 56 }).png().toBuffer();
const smile = await sharp("public/brand/sanady-smile.png").resize({ height: 220 }).png().toBuffer();
const photo = await sharp("public/brand/sanady-classroom.jpg").resize(W, H, { fit: "cover" }).toBuffer();
const logoMeta = await sharp(logo).metadata();

async function renderSlide(video, slide, index, total, file) {
  const footer = `<text x="80" y="${H - 40}" font-family="${FONT}" font-size="18" fill="#78716C">${esc(video.course)}</text>
    <text x="${W - 80}" y="${H - 40}" text-anchor="end" font-family="${FONT}" font-size="18" fill="#78716C">${index + 1} / ${total}</text>`;

  if (slide.kind === "title") {
    const heading = wrap(slide.heading, 26);
    const top = H - 150 - heading.length * 66;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#000" stop-opacity="0.15"/><stop offset="1" stop-color="#000" stop-opacity="0.82"/></linearGradient></defs>
      <rect width="${W}" height="${H}" fill="url(#g)"/>
      <rect x="56" y="48" width="${logoMeta.width + 40}" height="${logoMeta.height + 28}" rx="14" fill="#fff"/>
      <rect x="80" y="${top - 44}" width="72" height="8" rx="4" fill="${ORANGE}"/>
      ${heading.map((l, i) => `<text x="80" y="${top + i * 66 + 40}" font-family="${FONT}" font-size="58" font-weight="700" fill="#fff">${esc(l)}</text>`).join("")}
      <text x="80" y="${top + heading.length * 66 + 34}" font-family="${FONT}" font-size="26" fill="#F5F5F4">${esc(slide.sub)}</text>
    </svg>`;
    await sharp(photo)
      .composite([{ input: Buffer.from(svg) }, { input: logo, left: 76, top: 62 }])
      .png()
      .toFile(file);
    return;
  }

  if (slide.kind === "end") {
    const sub = wrap(slide.sub, 52);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <rect width="${W}" height="${H}" fill="#FFF7F2"/>
      <rect width="${W}" height="10" fill="${ORANGE}"/>
      <text x="${W / 2}" y="440" text-anchor="middle" font-family="${FONT}" font-size="60" font-weight="700" fill="${INK}">${esc(slide.heading)}</text>
      ${sub.map((l, i) => `<text x="${W / 2}" y="${500 + i * 40}" text-anchor="middle" font-family="${FONT}" font-size="28" fill="#57534E">${esc(l)}</text>`).join("")}
      ${footer}
    </svg>`;
    const smileMeta = await sharp(smile).metadata();
    await sharp({ create: { width: W, height: H, channels: 3, background: "#FFF7F2" } })
      .composite([{ input: Buffer.from(svg) }, { input: smile, left: Math.round((W - smileMeta.width) / 2), top: 110 }])
      .png()
      .toFile(file);
    return;
  }

  const heading = wrap(slide.heading, 34);
  let y = 170 + heading.length * 64 + 50;
  const bullets = slide.bullets
    .map((b) => {
      const lines = wrap(b, 60);
      const out = `<circle cx="104" cy="${y - 11}" r="9" fill="${ORANGE}"/>
        ${lines.map((l, i) => `<text x="134" y="${y + i * 44}" font-family="${FONT}" font-size="34" fill="#292524">${esc(l)}</text>`).join("")}`;
      y += lines.length * 44 + 34;
      return out;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="#FFFFFF"/>
    <rect x="0" y="0" width="14" height="${H}" fill="${ORANGE}"/>
    <rect x="80" y="${H - 80}" width="${W - 160}" height="1" fill="#E7E5E4"/>
    ${heading.map((l, i) => `<text x="80" y="${200 + i * 64}" font-family="${FONT}" font-size="52" font-weight="700" fill="${INK}">${esc(l)}</text>`).join("")}
    ${bullets}
    ${footer}
  </svg>`;
  await sharp({ create: { width: W, height: H, channels: 3, background: "#FFFFFF" } })
    .composite([{ input: Buffer.from(svg) }, { input: logo, left: W - 80 - logoMeta.width, top: 50 }])
    .png()
    .toFile(file);
}

// ─── Narration (Windows speech synthesis, French voice) ────────────────────
function speak(text, file) {
  const textFile = `${file}.txt`;
  writeFileSync(textFile, text, "utf8");
  const ps = `Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$v = $s.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -like 'fr-*' } | Select-Object -First 1
if (-not $v) { throw 'No French voice installed' }
$s.SelectVoice($v.VoiceInfo.Name)
$s.Rate = -1
$s.SetOutputToWaveFile('${file.replace(/'/g, "''")}')
$s.Speak([IO.File]::ReadAllText('${textFile.replace(/'/g, "''")}', [Text.Encoding]::UTF8))
$s.Dispose()`;
  const psFile = `${file}.ps1`;
  writeFileSync(psFile, "﻿" + ps, "utf8");
  execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", psFile], { stdio: "pipe" });
}

function wavSeconds(file) {
  const b = readFileSync(file);
  const byteRate = b.readUInt32LE(28);
  let offset = 12;
  while (offset < b.length - 8) {
    const id = b.toString("ascii", offset, offset + 4);
    const size = b.readUInt32LE(offset + 4);
    if (id === "data") return size / byteRate;
    offset += 8 + size;
  }
  throw new Error(`No audio data in ${file}`);
}

// ─── Encoding ───────────────────────────────────────────────────────────────
const LEAD = 0.5;
const TAIL = 0.9;
async function buildVideo(video, slug) {
  const segments = [];
  for (const [i, slide] of video.slides.entries()) {
    const base = join(work, `${slug}-${i}`);
    await renderSlide(video, slide, i, video.slides.length, `${base}.png`);
    speak(slide.say, `${base}.wav`);
    const d = (LEAD + wavSeconds(`${base}.wav`) + TAIL).toFixed(2);
    const fadeOut = (Number(d) - 0.35).toFixed(2);
    execFileSync(ffmpeg, [
      "-y", "-loglevel", "error",
      "-loop", "1", "-framerate", "25", "-t", d, "-i", `${base}.png`,
      "-i", `${base}.wav`,
      "-filter_complex",
      `[0:v]format=yuv420p,fade=t=in:st=0:d=0.35,fade=t=out:st=${fadeOut}:d=0.35[v];` +
        `[1:a]aresample=44100,adelay=${LEAD * 1000}|${LEAD * 1000},apad=whole_dur=${d}[a]`,
      "-map", "[v]", "-map", "[a]", "-t", d,
      "-c:v", "libx264", "-preset", "medium", "-tune", "stillimage", "-crf", "22", "-r", "25",
      "-c:a", "aac", "-b:a", "128k", "-ac", "1",
      `${base}.mp4`,
    ]);
    segments.push(`${base}.mp4`);
  }
  const list = join(work, `${slug}.txt`);
  writeFileSync(list, segments.map((s) => `file '${s.replace(/\\/g, "/")}'`).join("\n"));
  const out = join(work, `${slug}.mp4`);
  execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", out]);
  const seconds = video.slides.reduce((sum, _, i) => sum + LEAD + wavSeconds(join(work, `${slug}-${i}.wav`)) + TAIL, 0);
  return { file: out, seconds: Math.round(seconds) };
}

// ─── Database ───────────────────────────────────────────────────────────────
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
const lit = (v) => (v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const asUser = (uid, statements) =>
  `set local role authenticated;
   select set_config('request.jwt.claim.sub', ${lit(uid)}, true);
   select set_config('request.jwt.claims', ${lit(JSON.stringify({ sub: uid, role: "authenticated", aal: "aal2" }))}, true);
   ${statements}
   reset role;`;

let adminId = null;
let storage = null;
if (!renderOnly) {
  const [row] = await sql(
    `select p.id from public.profiles p join public.platform_roles r on r.user_id = p.id where p.email = ${lit(values.admin.toLowerCase())}`,
  );
  if (!row) throw new Error(`No SANADY administrator found for ${values.admin}.`);
  adminId = row.id;
  storage = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }).storage;
}

for (const [vi, video] of VIDEOS.entries()) {
  const slug = `video-${vi + 1}`;
  let target = null;
  if (!renderOnly) {
    const [found] = await sql(
      `select c.id as course_id, m.id as module_id,
              exists (select 1 from public.lessons l where l.course_id = c.id and l.title = ${lit(video.title)} and l.archived_at is null) as has_video
         from public.courses c
         join public.modules m on m.course_id = c.id and m.archived_at is null
        where c.title = ${lit(video.course)}
        order by m.position limit 1`,
    );
    if (!found) {
      console.log(`• ${video.course}: course not found, skipped`);
      continue;
    }
    if (found.has_video) {
      console.log(`• ${video.course}: video already present, skipped`);
      continue;
    }
    target = found;
  }

  const { file, seconds } = await buildVideo(video, slug);
  const mb = (statSync(file).size / 1024 / 1024).toFixed(1);
  console.log(`✓ ${video.title} — ${seconds} s, ${mb} Mo`);
  if (renderOnly) continue;

  const lessonId = randomUUID();
  const path = `${target.course_id}/${lessonId}/video.mp4`;
  const { error } = await storage.from("course-media").upload(path, readFileSync(file), { contentType: "video/mp4", upsert: true });
  if (error) throw new Error(`upload ${path}: ${error.message}`);

  // Make room at position 0 (two steps: the position index is unique).
  const m = lit(target.module_id);
  await sql(`begin;
    ${asUser(
      adminId,
      `update public.lessons set position = position + 1000 where module_id = ${m} and archived_at is null;
       update public.lessons set position = position - 999 where module_id = ${m} and archived_at is null;
       insert into public.lessons (id, module_id, course_id, title, description, kind, position, is_mandatory, estimated_minutes,
                                   video_provider, video_ref, video_duration_seconds)
       values (${lit(lessonId)}, ${m}, ${lit(target.course_id)}, ${lit(video.title)}, ${lit(video.description)}, 'video', 0, false,
               ${Math.max(1, Math.round(seconds / 60))}, 'storage', ${lit(path)}, ${seconds});`,
    )}
  commit;`);
  console.log(`  → added to « ${video.course} » (module 1, optional lesson)`);
}
console.log(`Files kept in ${work}`);
