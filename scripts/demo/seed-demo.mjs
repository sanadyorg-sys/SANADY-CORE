#!/usr/bin/env node
/**
 * Loads demonstration data into a SANADY Supabase project.
 *
 *   npm run demo:seed -- --admin <admin e-mail>
 *
 * Creates (all clearly identifiable, removable with `npm run demo:remove`):
 *   · 3 categories, 3 courses (2 published, 1 draft) with real PDF lessons and quizzes
 *   · the institution « Lycée Ibn Khaldoun (démo) » (identifier DEMO-LYC-001)
 *   · 5 demo accounts on example.com (institution admin, 3 teachers, 1 independent teacher)
 *   · realistic learning activity, produced by calling the SAME database
 *     functions as the application, as each user (RLS and rules apply).
 *
 * Requires in .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * SUPABASE_ACCESS_TOKEN.
 */
import { createClient } from "@supabase/supabase-js";
import { randomInt, randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { COURSES, CATEGORIES } from "./content.mjs";

const { values } = parseArgs({ options: { admin: { type: "string" } } });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ref = url?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
const token = process.env.SUPABASE_ACCESS_TOKEN;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!ref || !token || !serviceKey || !values.admin) {
  console.error("Usage: npm run demo:seed -- --admin <admin e-mail>  (needs URL, service key and access token in .env.local)");
  process.exit(1);
}

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
  console.error(`No SANADY administrator found for ${values.admin}. Run npm run admin:create first.`);
  process.exit(1);
}
const adminId = adminRow.id;
const [exists] = await sql(`select 1 as x from public.institutions where identifier = 'DEMO-LYC-001'`);
if (exists) {
  console.error("Demo data already present. Run `npm run demo:remove` first to reload it.");
  process.exit(1);
}

// ─── 1. Demo accounts ──────────────────────────────────────────────────────
const PEOPLE = [
  { key: "director", email: "demo.direction@example.com", first: "Nadia", last: "Berrada", job: "Directrice pédagogique" },
  { key: "youssef", email: "demo.youssef@example.com", first: "Youssef", last: "Alaoui", job: "Professeur de physique-chimie" },
  { key: "khadija", email: "demo.khadija@example.com", first: "Khadija", last: "El Amrani", job: "Professeure de français" },
  { key: "omar", email: "demo.omar@example.com", first: "Omar", last: "Tazi", job: "Professeur de mathématiques" },
  { key: "salma", email: "demo.salma@example.com", first: "Salma", last: "Idrissi", job: "Professeure des écoles" },
];
const ALPHA = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const password = () => `Demo-${Array.from({ length: 8 }, () => ALPHA[randomInt(ALPHA.length)]).join("")}7`;

const users = {};
for (const p of PEOPLE) {
  const pwd = password();
  const { data, error } = await admin.auth.admin.createUser({
    email: p.email,
    password: pwd,
    email_confirm: true,
    user_metadata: { first_name: p.first, last_name: p.last, demo: true },
  });
  if (error) throw new Error(`createUser ${p.email}: ${error.message}`);
  users[p.key] = { ...p, id: data.user.id, password: pwd };
}
await sql(
  PEOPLE.map(
    (p) =>
      `update public.profiles set first_name = ${lit(p.first)}, last_name = ${lit(p.last)}, job_title = ${lit(p.job)},
         privacy_acknowledged_at = now(), onboarded_at = now() where id = ${lit(users[p.key].id)};`,
  ).join("\n"),
);
console.log("✓ 5 demo accounts");

// ─── 2. Courses (as the SANADY administrator) ──────────────────────────────
const catIds = {};
for (const name of CATEGORIES) {
  const [row] = await sql(
    `insert into public.course_categories (name) values (${lit(name)})
     on conflict (name) do update set name = excluded.name returning id`,
  );
  catIds[name] = row.id;
}

const ids = { courses: {} };
let body = "";
const questionRows = [];
for (const course of COURSES) {
  const c = { id: randomUUID(), modules: [] };
  ids.courses[course.key] = c;
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
    if (m.questions.length) {
      body += `insert into public.quizzes (id, module_id, course_id, title, instructions)
               values (${lit(mod.quizId)}, ${lit(mod.id)}, ${lit(c.id)}, ${lit(`Évaluation — ${m.title}`)},
                       ${lit("Répondez à toutes les questions. Pour les questions à réponses multiples, sélectionnez toutes les bonnes réponses.")});\n`;
    } else {
      mod.quizId = null;
    }
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
console.log("✓ 3 courses, modules, lessons and quizzes");

// ─── 3. Lesson PDFs (generated, uploaded to private storage) ───────────────
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
    page.drawText(lessonTitle, { x: 56, y: 760, size: 20, font: bold, color: ink });
    let y = 712;
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
for (const course of COURSES) {
  const c = ids.courses[course.key];
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

// ─── 4. Publication, institution, memberships, authorizations ──────────────
const evalC = ids.courses.evaluation;
const gestC = ids.courses.gestion;
const instId = randomUUID();
await tx(
  asUser(
    adminId,
    `update public.courses set status = 'published' where id in (${lit(evalC.id)}, ${lit(gestC.id)});
     insert into public.institutions (id, name, identifier, type, city, contact_email, created_by)
     values (${lit(instId)}, 'Lycée Ibn Khaldoun (démo)', 'DEMO-LYC-001', 'lycee', 'Casablanca', 'contact.demo@example.com', ${lit(adminId)});`,
  ),
);
// Memberships as the invitation flow would create them (admin + consenting teachers).
await tx(`
  insert into public.institution_memberships (institution_id, user_id, role, source, consented_at, created_at) values
    (${lit(instId)}, ${lit(users.director.id)}, 'admin', 'invitation', null, now() - interval '30 days'),
    (${lit(instId)}, ${lit(users.youssef.id)}, 'teacher', 'invitation', now() - interval '28 days', now() - interval '28 days'),
    (${lit(instId)}, ${lit(users.khadija.id)}, 'teacher', 'code', now() - interval '27 days', now() - interval '27 days'),
    (${lit(instId)}, ${lit(users.omar.id)}, 'teacher', 'code', now() - interval '27 days', now() - interval '27 days');`);
await tx(
  asUser(
    adminId,
    `select public.grant_course_to_institution(${lit(evalC.id)}, ${lit(instId)});
     select public.grant_course_to_institution(${lit(gestC.id)}, ${lit(instId)});
     select public.grant_course_to_user(${lit(evalC.id)}, ${lit(users.salma.id)});`,
  ),
);
await tx(
  asUser(
    users.director.id,
    `select public.assign_course(${lit(instId)}, ${lit(evalC.id)}, array[${[users.youssef.id, users.khadija.id, users.omar.id].map(lit).join(",")}]::uuid[], (current_date + 45));
     select public.assign_course(${lit(instId)}, ${lit(gestC.id)}, array[${lit(users.youssef.id)}]::uuid[], null);`,
  ),
);
console.log("✓ institution, memberships, authorizations, assignments");

// ─── 5. Learning activity (as each teacher, through the real functions) ────
/** Reads and completes a PDF lesson (backdating the start so the plausibility guard allows it). */
async function readLesson(uid, lesson) {
  await tx(asUser(uid, `select public.start_lesson(${lit(lesson.id)});`));
  await tx(`update public.lesson_progress set started_at = now() - interval '2 hours' where user_id = ${lit(uid)} and lesson_id = ${lit(lesson.id)};`);
  const pages = Array.from({ length: lesson.pages }, (_, i) => i + 1);
  await tx(asUser(uid, `select public.record_document_progress(${lit(lesson.id)}, array[${pages.join(",")}]::int[], ${lesson.pages});`));
}
/** Takes a module quiz with `correctCount` correct answers. */
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

const [m1, m2] = evalC.modules;
// Youssef — completes « Évaluation formative » (certificate), starts « Gestion de classe ».
for (const l of m1.lessons) await readLesson(users.youssef.id, l);
await takeQuiz(users.youssef.id, m1, 4);
for (const l of m2.lessons) await readLesson(users.youssef.id, l);
await takeQuiz(users.youssef.id, m2, 2); // 50 %: not passed
await takeQuiz(users.youssef.id, m2, 4); // passed → certificate issued
await readLesson(users.youssef.id, gestC.modules[0].lessons[0]);
// Khadija — module 1 done, quiz failed once, module 2 started.
for (const l of m1.lessons) await readLesson(users.khadija.id, l);
await takeQuiz(users.khadija.id, m1, 2);
await tx(asUser(users.khadija.id, `select public.start_lesson(${lit(m2.lessons[0].id)});`));
// Omar — module 1 done, three failed attempts (intervention needed), inactive since.
for (const l of m1.lessons) await readLesson(users.omar.id, l);
await takeQuiz(users.omar.id, m1, 1);
await takeQuiz(users.omar.id, m1, 2);
await takeQuiz(users.omar.id, m1, 2);
// Salma (individual) — module 1 passed.
for (const l of m1.lessons) await readLesson(users.salma.id, l);
await takeQuiz(users.salma.id, m1, 3);
console.log("✓ learning activity");

// ─── 6. Realistic dates (activity spread over the past weeks) ──────────────
const shift = { youssef: "2 days", khadija: "1 day", omar: "21 days", salma: "3 hours" };
await tx(
  Object.entries(shift)
    .map(([k, iv]) => {
      const u = lit(users[k].id);
      return `
      update public.learning_events set occurred_at = occurred_at - interval '${iv}' where user_id = ${u};
      update public.lesson_progress set started_at = started_at - interval '${iv}', completed_at = completed_at - interval '${iv}', updated_at = updated_at - interval '${iv}' where user_id = ${u};
      update public.document_progress set updated_at = updated_at - interval '${iv}' where user_id = ${u};
      update public.quiz_attempts set started_at = started_at - interval '${iv}', submitted_at = submitted_at - interval '${iv}' where user_id = ${u};
      update public.enrollments set enrolled_at = least(enrolled_at - interval '${iv}', now() - interval '25 days'), started_at = started_at - interval '${iv}',
             completed_at = completed_at - interval '${iv}', last_activity_at = last_activity_at - interval '${iv}' where user_id = ${u};
      update public.certificates set completed_at = completed_at - interval '${iv}', issued_at = issued_at - interval '${iv}' where user_id = ${u};`;
    })
    .join("\n") +
    `\nupdate public.course_assignments set assigned_at = now() - interval '25 days' where institution_id = ${lit(instId)};`,
);
console.log("✓ dates spread over the past weeks");

// ─── 7. Record what was created (for demo:remove) and print credentials ────
writeFileSync(
  "scripts/demo/.demo-state.json",
  JSON.stringify(
    { institutionId: instId, courseIds: Object.values(ids.courses).map((c) => c.id), userIds: Object.values(users).map((u) => u.id) },
    null,
    2,
  ),
);
console.log("\nDemo accounts (password shown once):");
for (const u of Object.values(users)) console.log(`  ${u.email.padEnd(30)} ${u.password}   ${u.first} ${u.last} — ${u.job}`);
