#!/usr/bin/env node
/**
 * Adds two published demo courses to an existing demo (run demo:seed first).
 *
 *   npm run demo:courses -- --admin <admin e-mail>
 *
 * Creates « Différencier son enseignement » and « La démarche d’investigation
 * en sciences » (content in content-extra.mjs) with PDF lessons and quizzes,
 * opens them to the demo institution, assigns them to its teachers and adds a
 * little learning activity through the same database functions as the app.
 * The course ids are added to .demo-state.json, so `npm run demo:remove`
 * deletes them with the rest. Run `npm run demo:covers` afterwards for covers.
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { EXTRA_CATEGORIES, EXTRA_COURSES } from "./content-extra.mjs";

const { values } = parseArgs({ options: { admin: { type: "string" } } });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ref = url?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
const token = process.env.SUPABASE_ACCESS_TOKEN;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!ref || !token || !serviceKey || !values.admin) {
  console.error("Usage: npm run demo:courses -- --admin <admin e-mail>  (needs URL, service key and access token in .env.local)");
  process.exit(1);
}
const STATE = "scripts/demo/.demo-state.json";
if (!existsSync(STATE)) {
  console.error("No demo found (scripts/demo/.demo-state.json). Run `npm run demo:seed` first.");
  process.exit(1);
}
const state = JSON.parse(readFileSync(STATE, "utf8"));

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

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
const arr = (a) => `array[${a.map(lit).join(",")}]::text[]`;
/** Runs statements as an authenticated, two-factor-verified user (RLS and function checks apply). */
const asUser = (uid, statements) =>
  `set local role authenticated;
   select set_config('request.jwt.claim.sub', ${lit(uid)}, true);
   select set_config('request.jwt.claims', ${lit(JSON.stringify({ sub: uid, role: "authenticated", aal: "aal2" }))}, true);
   ${statements}
   reset role;`;
const tx = (body) => sql(`begin;\n${body}\ncommit;`);

// ─── 0. Preconditions ───────────────────────────────────────────────────────
const [adminRow] = await sql(
  `select p.id from public.profiles p join public.platform_roles r on r.user_id = p.id where p.email = ${lit(values.admin.toLowerCase())}`,
);
if (!adminRow) {
  console.error(`No SANADY administrator found for ${values.admin}.`);
  process.exit(1);
}
const adminId = adminRow.id;
const [inst] = await sql(`select id from public.institutions where identifier = 'DEMO-LYC-001'`);
if (!inst) {
  console.error("The demo institution DEMO-LYC-001 is missing. Run `npm run demo:seed` first.");
  process.exit(1);
}
const instId = inst.id;
const [dup] = await sql(`select title from public.courses where title in (${EXTRA_COURSES.map((c) => lit(c.title)).join(",")}) limit 1`);
if (dup) {
  console.error(`« ${dup.title} » already exists. Nothing was added.`);
  process.exit(1);
}
const people = Object.fromEntries(
  (await sql(`select id, email from public.profiles where email in ('demo.direction@example.com','demo.youssef@example.com','demo.khadija@example.com','demo.omar@example.com')`)).map(
    (r) => [r.email.split("@")[0].slice(5), r.id],
  ),
);
for (const k of ["direction", "youssef", "khadija", "omar"]) {
  if (!people[k]) {
    console.error(`Demo account demo.${k}@example.com is missing. Run \`npm run demo:seed\` first.`);
    process.exit(1);
  }
}

// ─── 1. Courses (as the SANADY administrator) ──────────────────────────────
const catIds = {};
for (const name of [...new Set([...EXTRA_CATEGORIES, ...EXTRA_COURSES.map((c) => c.category)])]) {
  const [row] = await sql(
    `insert into public.course_categories (name) values (${lit(name)})
     on conflict (name) do update set name = excluded.name returning id`,
  );
  catIds[name] = row.id;
}

const ids = {};
let body = "";
const questionRows = [];
for (const course of EXTRA_COURSES) {
  const c = { id: randomUUID(), modules: [] };
  ids[course.key] = c;
  body += `insert into public.courses (id, title, summary, description, objectives, category_id, level, estimated_minutes, target_audience, created_by)
           values (${lit(c.id)}, ${lit(course.title)}, ${lit(course.summary)}, ${lit(course.description)}, ${arr(course.objectives)},
                   ${lit(catIds[course.category])}, ${lit(course.level)}, ${course.minutes}, ${lit(course.audience)}, ${lit(adminId)});\n`;
  course.modules.forEach((m, mi) => {
    const mod = { id: randomUUID(), quizId: randomUUID(), lessons: [], questions: [] };
    c.modules.push(mod);
    body += `insert into public.modules (id, course_id, title, position) values (${lit(mod.id)}, ${lit(c.id)}, ${lit(m.title)}, ${mi});\n`;
    m.lessons.forEach((l, li) => {
      const lesson = { id: randomUUID(), pages: l.pages.length, def: l };
      mod.lessons.push(lesson);
      body += `insert into public.lessons (id, module_id, course_id, title, description, kind, position, estimated_minutes)
               values (${lit(lesson.id)}, ${lit(mod.id)}, ${lit(c.id)}, ${lit(l.title)},
                       ${lit(`Lecture guidée de ${l.pages.length} pages. Prenez le temps de lire chaque page.`)}, 'pdf', ${li}, ${l.pages.length * 5});\n`;
    });
    body += `insert into public.quizzes (id, module_id, course_id, title, instructions)
             values (${lit(mod.quizId)}, ${lit(mod.id)}, ${lit(c.id)}, ${lit(`Évaluation — ${m.title}`)},
                     ${lit("Répondez à toutes les questions. Pour les questions à réponses multiples, sélectionnez toutes les bonnes réponses.")});\n`;
    m.questions.forEach((q, qi) => {
      const question = { id: randomUUID(), options: q.options.map(([label, correct]) => ({ id: randomUUID(), label, correct })) };
      mod.questions.push(question);
      questionRows.push(
        `insert into public.questions (id, quiz_id, kind, prompt, explanation, points, position)
         values (${lit(question.id)}, ${lit(mod.quizId)}, ${lit(q.kind)}, ${lit(q.prompt)}, ${lit(q.explanation)}, 1, ${qi});`,
        ...question.options.map(
          (o, oi) =>
            `insert into public.question_options (id, question_id, label, is_correct, position)
             values (${lit(o.id)}, ${lit(question.id)}, ${lit(o.label)}, ${o.correct}, ${oi});`,
        ),
      );
    });
  });
}
await tx(asUser(adminId, body));
// Questions are inserted directly (the editor uses save_question; same rules are checked by validate_course).
await tx(questionRows.join("\n"));
// Record the ids now, so demo:remove cleans up even if a later step fails.
writeFileSync(STATE, JSON.stringify({ ...state, courseIds: [...state.courseIds, ...Object.values(ids).map((c) => c.id)] }, null, 2));
console.log("✓ 2 courses, modules, lessons and quizzes");

// ─── 2. Lesson PDFs (generated, uploaded to private storage) ───────────────
async function lessonPdf(courseTitle, lessonTitle, pages) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(lessonTitle);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const orange = rgb(0xf9 / 255, 0x5a / 255, 0x05 / 255);
  const ink = rgb(0.16, 0.15, 0.13);
  const muted = rgb(0.43, 0.41, 0.38);
  const wrap = (text, f, size, width) => {
    const words = text.split(/\s+/);
    const lines = [];
    let line = "";
    for (const w of words) {
      const t = line ? `${line} ${w}` : w;
      if (f.widthOfTextAtSize(t, size) > width && line) {
        lines.push(line);
        line = w;
      } else line = t;
    }
    if (line) lines.push(line);
    return lines;
  };
  pages.forEach(([heading, ...paragraphs], i) => {
    const page = pdf.addPage([595.28, 841.89]);
    page.drawRectangle({ x: 0, y: 835, width: 595.28, height: 6.89, color: orange });
    page.drawText("Fondation Sanady · " + courseTitle, { x: 56, y: 800, size: 9, font, color: muted });
    let y = 760;
    for (const l of wrap(lessonTitle, bold, 20, 483)) {
      page.drawText(l, { x: 56, y, size: 20, font: bold, color: ink });
      y -= 26;
    }
    y -= 22;
    page.drawText(heading, { x: 56, y, size: 14, font: bold, color: orange });
    y -= 30;
    for (const p of paragraphs) {
      for (const l of wrap(p, font, 12, 483)) {
        page.drawText(l, { x: 56, y, size: 12, font, color: ink });
        y -= 19;
      }
      y -= 12;
    }
    page.drawText(`Page ${i + 1} / ${pages.length}`, { x: 56, y: 40, size: 9, font, color: muted });
  });
  return pdf.save();
}

const pdfUpdates = [];
for (const course of EXTRA_COURSES) {
  const c = ids[course.key];
  for (const [mi, m] of course.modules.entries()) {
    for (const [li, l] of m.lessons.entries()) {
      const lesson = c.modules[mi].lessons[li];
      const path = `${c.id}/${lesson.id}/lecon.pdf`;
      const bytes = await lessonPdf(course.title, l.title, l.pages);
      const { error } = await admin.storage.from("course-media").upload(path, bytes, { contentType: "application/pdf", upsert: true });
      if (error) throw new Error(`upload ${path}: ${error.message}`);
      pdfUpdates.push(`update public.lessons set pdf_path = ${lit(path)}, pdf_page_count = ${l.pages.length} where id = ${lit(lesson.id)};`);
    }
  }
}
await tx(asUser(adminId, pdfUpdates.join("\n")));
console.log("✓ lesson documents uploaded");

// ─── 3. Publication, authorization, assignments ────────────────────────────
const diff = ids.differenciation;
const inv = ids.investigation;
await tx(
  asUser(
    adminId,
    `update public.courses set status = 'published', public_listing = true where id in (${lit(diff.id)}, ${lit(inv.id)});
     select public.grant_course_to_institution(${lit(diff.id)}, ${lit(instId)});
     select public.grant_course_to_institution(${lit(inv.id)}, ${lit(instId)});`,
  ),
);
await tx(
  asUser(
    people.direction,
    `select public.assign_course(${lit(instId)}, ${lit(diff.id)}, array[${[people.youssef, people.khadija, people.omar].map(lit).join(",")}]::uuid[], (current_date + 60));
     select public.assign_course(${lit(instId)}, ${lit(inv.id)}, array[${[people.youssef, people.omar].map(lit).join(",")}]::uuid[], null);`,
  ),
);
console.log("✓ published, opened to the demo institution, assigned");

// ─── 4. Learning activity (as each teacher, through the real functions) ────
async function readLesson(uid, lesson) {
  await tx(asUser(uid, `select public.start_lesson(${lit(lesson.id)});`));
  await tx(`update public.lesson_progress set started_at = now() - interval '2 hours' where user_id = ${lit(uid)} and lesson_id = ${lit(lesson.id)};`);
  const pages = Array.from({ length: lesson.pages }, (_, i) => i + 1);
  await tx(asUser(uid, `select public.record_document_progress(${lit(lesson.id)}, array[${pages.join(",")}]::int[], ${lesson.pages});`));
}
async function takeQuiz(uid, mod, correctCount) {
  const answers = {};
  mod.questions.forEach((q, i) => {
    answers[q.id] = (i < correctCount ? q.options.filter((o) => o.correct) : q.options.filter((o) => !o.correct).slice(0, 1)).map((o) => o.id);
  });
  await tx(
    asUser(
      uid,
      `do $$ declare a uuid; begin
         a := (public.start_quiz_attempt(${lit(mod.quizId)}) ->> 'attempt_id')::uuid;
         perform public.submit_quiz_attempt(a, ${lit(JSON.stringify(answers))}::jsonb);
       end $$;`,
    ),
  );
}
// Youssef — module 1 of « La démarche d’investigation » done and passed, module 2 started.
for (const l of inv.modules[0].lessons) await readLesson(people.youssef, l);
await takeQuiz(people.youssef, inv.modules[0], 4);
await tx(asUser(people.youssef, `select public.start_lesson(${lit(inv.modules[1].lessons[0].id)});`));
// Khadija — first lesson of « Différencier son enseignement » read.
await readLesson(people.khadija, diff.modules[0].lessons[0]);
console.log("✓ learning activity");
console.log("\nDone. Run `npm run demo:covers` to give the new courses their cover images.");
