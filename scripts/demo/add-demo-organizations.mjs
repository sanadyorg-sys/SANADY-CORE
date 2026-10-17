#!/usr/bin/env node
/**
 * Fills the partnership and enterprise parts of the demo (run demo:seed first).
 *
 *   npm run demo:organizations -- --admin <admin e-mail>
 *
 * Everything goes through the same database functions as the application,
 * called as the demo staff member whose role allows the step (approvals by
 * the demo approver, never by the person who prepared them). Names end with
 * « (démo) ». Creates:
 *   · demo staff: partnership coordinator, partnership manager + approver,
 *     enterprise manager, production manager (MFA is asked at first sign-in)
 *   · Partenariats: 2 public applications, 2 educational needs, 1 published
 *     project seeking partners, 3 partner organisations at different stages,
 *     one with a signed agreement, milestones, contributions, impact
 *     measures, a shared report and a partner-portal account
 *   · Entreprises: 3 incoming requests, 2 service plans, 2 clients, a signed
 *     contract with invoices, payment and costs, an active company workspace
 *     with its administrator, departments and 2 employees, a launched custom
 *     training and one in production, support requests, an assessment policy
 *   · Lycée Ibn Khaldoun (démo): an enrollment code, a pending invitation and
 *     2 access requests
 * Created ids go to .demo-state.json (`extended`), so `npm run demo:remove`
 * deletes all of it. Demo accounts get no e-mail notifications.
 */
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const { values } = parseArgs({ options: { admin: { type: "string" } } });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ref = url?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
const token = process.env.SUPABASE_ACCESS_TOKEN;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!ref || !token || !serviceKey || !values.admin) {
  console.error("Usage: npm run demo:organizations -- --admin <admin e-mail>  (needs URL, service key and access token in .env.local)");
  process.exit(1);
}
const STATE = "scripts/demo/.demo-state.json";
if (!existsSync(STATE)) {
  console.error("No demo found (scripts/demo/.demo-state.json). Run `npm run demo:seed` first.");
  process.exit(1);
}
const state = JSON.parse(readFileSync(STATE, "utf8"));
if (state.extended) {
  console.error("Partnership and enterprise demo data already loaded. Run `npm run demo:remove` first to reload it.");
  process.exit(1);
}

const supa = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const startedAt = new Date().toISOString();

async function sql(query, attempt = 0) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  // The management API limits the request rate: wait and retry.
  if (res.status === 429 && attempt < 8) {
    await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
    return sql(query, attempt + 1);
  }
  const text = await res.text();
  if (!res.ok) throw new Error(`SQL failed (HTTP ${res.status}): ${text.slice(0, 1500)}`);
  return text ? JSON.parse(text) : [];
}
const lit = (v) => (v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const json = (o) => `${lit(JSON.stringify(o))}::jsonb`;
const uuids = (a) => `array[${a.map(lit).join(",")}]::uuid[]`;

/** Calls public.<fn>(args) as a user (two-factor session), as the server (service role) or as a visitor. */
async function call(who, fn, args = []) {
  const head =
    who === "service"
      ? `set local role service_role; select set_config('request.jwt.claims', ${lit(JSON.stringify({ role: "service_role" }))}, true);`
      : `set local role authenticated;
         select set_config('request.jwt.claim.sub', ${lit(who)}, true);
         select set_config('request.jwt.claims', ${lit(JSON.stringify({ sub: who, role: "authenticated", aal: "aal2" }))}, true);`;
  try {
    const rows = await sql(`begin; ${head} select public.${fn}(${args.join(", ")}) as v; reset role; commit;`);
    if (typeof save === "function" && created) save();
    return rows[0]?.v;
  } catch (e) {
    throw new Error(`${fn}: ${e.message}`);
  }
}

const created = {
  organizationIds: [],
  enterpriseRequestIds: [],
  applicationIds: [],
  needIds: [],
  opportunityIds: [],
  planIds: [],
  costIds: [],
  institutionIds: [],
  courseIds: [],
  enrollmentCodeIds: [],
  invitationEmails: [],
  accessRequestEmails: [],
  storage: { partnerships: [], enterprise: [] },
};
const save = () => writeFileSync(STATE, JSON.stringify({ ...state, extended: created }, null, 2));

// ─── 0. Preconditions ───────────────────────────────────────────────────────
const [adminRow] = await sql(
  `select p.id from public.profiles p join public.platform_roles r on r.user_id = p.id where p.email = ${lit(values.admin.toLowerCase())} and r.role = 'sanady_admin'`,
);
if (!adminRow) {
  console.error(`No SANADY administrator found for ${values.admin}.`);
  process.exit(1);
}
const admin = adminRow.id;
const [lycee] = await sql(`select id from public.institutions where identifier = 'DEMO-LYC-001'`);
if (!lycee) {
  console.error("The demo institution DEMO-LYC-001 is missing. Run `npm run demo:seed` first.");
  process.exit(1);
}
const byEmail = async (email) => (await sql(`select id from public.profiles where email = ${lit(email)}`))[0]?.id;
const director = await byEmail("demo.direction@example.com");
const trainer = await byEmail("demo.formateur@example.com");
const courseId = async (title) => (await sql(`select id from public.courses where title = ${lit(title)} and status = 'published'`))[0]?.id;
const courseDiff = await courseId("Différencier son enseignement");
const courseGestion = await courseId("Gestion de classe bienveillante");
if (!director || !courseDiff || !courseGestion) {
  console.error("Run `npm run demo:seed` and `npm run demo:courses` first.");
  process.exit(1);
}

// ─── 1. Demo accounts ──────────────────────────────────────────────────────
const ALPHA = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const password = () => `Demo-${Array.from({ length: 8 }, () => ALPHA[randomInt(ALPHA.length)]).join("")}7`;
const PEOPLE = [
  { key: "coord", email: "demo.partenariats@example.com", first: "Hind", last: "Lahlou", job: "Chargée de partenariats", role: "partnership_coordinator" },
  { key: "approver", email: "demo.signataire@example.com", first: "Mehdi", last: "Benjelloun", job: "Directeur des partenariats", role: "partnership_manager" },
  { key: "ent", email: "demo.entreprises@example.com", first: "Sofia", last: "Amrani", job: "Responsable des offres entreprises", role: "enterprise_manager" },
  { key: "prod", email: "demo.production@example.com", first: "Youness", last: "Kettani", job: "Chef de projet production", role: "production_manager" },
  { key: "partner", email: "demo.partenaire@example.com", first: "Amina", last: "Sefrioui", job: "Responsable des programmes, Fondation Horizon Éducation (démo)" },
  { key: "rh", email: "demo.rh@example.com", first: "Samir", last: "Lamrani", job: "Responsable formation, Groupe scolaire Les Orangers (démo)" },
  { key: "emp1", email: "demo.employe1@example.com", first: "Ilham", last: "Ouazzani", job: "Professeure de sciences" },
  { key: "emp2", email: "demo.employe2@example.com", first: "Anas", last: "Chafik", job: "Professeur des écoles" },
];
const u = {};
const passwords = [];
for (const p of PEOPLE) {
  if (await byEmail(p.email)) throw new Error(`${p.email} already exists. Run \`npm run demo:remove\` first.`);
  const pwd = password();
  const { data, error } = await supa.auth.admin.createUser({
    email: p.email,
    password: pwd,
    email_confirm: true,
    user_metadata: { first_name: p.first, last_name: p.last, demo: true },
  });
  if (error) throw new Error(`createUser ${p.email}: ${error.message}`);
  u[p.key] = data.user.id;
  passwords.push({ ...p, pwd });
}
await sql(
  PEOPLE.map(
    (p) =>
      `update public.profiles set first_name = ${lit(p.first)}, last_name = ${lit(p.last)}, job_title = ${lit(p.job)},
         privacy_acknowledged_at = now(), onboarded_at = now(), email_notifications = false where id = ${lit(u[p.key])};`,
  ).join("\n"),
);
for (const p of PEOPLE.filter((x) => x.role)) await call(admin, "set_platform_role", [lit(u[p.key]), lit(p.role)]);
await call(admin, "set_partnership_signatory", [lit(u.approver), "true"]);
save();
writeFileSync(
  "scripts/demo/.demo-accounts.txt",
  (existsSync("scripts/demo/.demo-accounts.txt") ? readFileSync("scripts/demo/.demo-accounts.txt", "utf8") : "") +
    passwords.map((p) => `${p.email.padEnd(32)} ${p.pwd}   ${p.first} ${p.last} — ${p.job}`).join("\n") +
    "\n",
);
console.log(`✓ ${PEOPLE.length} demo accounts (roles, approver grant for ${PEOPLE[1].first} ${PEOPLE[1].last})`);

// ─── Helpers: demo PDF documents and invitations ───────────────────────────
async function demoPdf(title, lines) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([595.28, 841.89]);
  page.drawRectangle({ x: 0, y: 835, width: 595.28, height: 6.89, color: rgb(0xf9 / 255, 0x5a / 255, 0x05 / 255) });
  page.drawText("DOCUMENT DE DÉMONSTRATION · SANS VALEUR", { x: 56, y: 800, size: 9, font: bold, color: rgb(0.7, 0.14, 0.09) });
  page.drawText(title, { x: 56, y: 760, size: 18, font: bold, color: rgb(0.11, 0.1, 0.09) });
  let y = 720;
  for (const l of lines) {
    page.drawText(l, { x: 56, y, size: 11, font, color: rgb(0.16, 0.15, 0.13) });
    y -= 20;
  }
  page.drawText("Prototype SANADY · données fictives", { x: 56, y: 40, size: 9, font, color: rgb(0.43, 0.41, 0.38) });
  return pdf.save();
}
async function upload(bucket, path, title, lines) {
  const bytes = await demoPdf(title, lines);
  const { error } = await supa.storage.from(bucket).upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (error) throw new Error(`upload ${bucket}/${path}: ${error.message}`);
  created.storage[bucket].push(path);
  return bytes.length;
}
const tokenHash = () => createHash("sha256").update(randomBytes(32)).digest("hex");
/** Invites with the given function, then accepts as the server would after sign-up. */
async function inviteAndAccept(fn, args, hash, user, consent) {
  await call(fn.who, fn.name, args);
  await call("service", "accept_invitation", [lit(hash), lit(user), consent ? "true" : "false"]);
}

// ─── 2. Partenariats ───────────────────────────────────────────────────────
// 2a. Educational needs → a project seeking partners, published on the site.
const needBase = {
  intervention_field: "soutien-scolaire",
  priority: "high",
  currency: "MAD",
};
const needBooks = await call(u.coord, "save_educational_need", [
  "null",
  json({
    ...needBase,
    title: "Bibliothèques de classe pour six écoles rurales (démo)",
    institution_id: lycee.id,
    description: "Six écoles rurales partenaires n’ont pas de livres adaptés aux élèves de 6 à 11 ans dans les classes.",
    justification: "La lecture quotidienne en classe est un levier reconnu pour les apprentissages ; les enseignants le demandent.",
    required_resources: "300 livres jeunesse par école, six meubles de rangement, une demi-journée de formation des enseignants.",
    estimated_cost: "180000",
    timeline: "Année scolaire 2026-2027",
  }),
]);
await call(u.coord, "set_need_status", [lit(needBooks), lit("internal_review"), lit("À présenter au comité")]);
await call(u.approver, "set_need_status", [lit(needBooks), lit("approved"), lit("Besoin prioritaire pour l’année")]);
const needLabs = await call(u.coord, "save_educational_need", [
  "null",
  json({
    title: "Matériel de sciences pour les collèges partenaires (démo)",
    intervention_field: "formation-continue",
    priority: "medium",
    description: "Les collèges partenaires manquent de matériel simple pour les expériences de sciences en classe.",
    justification: "Les enseignants formés à la démarche d’investigation ne peuvent pas la mettre en œuvre sans matériel.",
    estimated_cost: "60000",
  }),
]);
created.needIds.push(needBooks, needLabs);
const opp = await call(u.coord, "create_opportunity_from_need", [lit(needBooks)]);
await call(u.coord, "save_partnership_opportunity", [
  lit(opp),
  json({
    title: "Bibliothèques de classe pour six écoles rurales (démo)",
    intervention_field: "soutien-scolaire",
    summary: "Équiper six écoles rurales de bibliothèques de classe et former leurs enseignants à la lecture quotidienne.",
    description:
      "La Fondation recherche un ou plusieurs partenaires pour équiper six écoles rurales de bibliothèques de classe : livres jeunesse adaptés, meubles de rangement et une courte formation des enseignants à l’animation de la lecture.",
    objectives: "Offrir à 900 élèves un accès quotidien à des livres adaptés à leur âge, dans leur classe.",
    beneficiaries: "900 élèves du primaire et 36 enseignants",
    geographic_scope: "Province fictive de démonstration",
    contribution_types: ["financier", "equipement"],
    expected_contribution: "Financement des livres et des meubles, ou fourniture directe de livres jeunesse.",
    funding_target: "180000",
    currency: "MAD",
    timeline: "Année scolaire 2026-2027",
    deadline: "2026-12-31",
  }),
]);
await call(u.coord, "set_opportunity_status", [lit(opp), lit("internal_review"), "null"]);
await call(u.approver, "set_opportunity_status", [lit(opp), lit("approved"), "null"]);
await call(u.coord, "set_opportunity_status", [lit(opp), lit("published"), "null"]);
created.opportunityIds.push(opp);
await call(u.coord, "add_partnership_target_note", ["null", lit(opp), lit("Deux fondations ont demandé le budget détaillé.")]);
const [{ reference: oppRef }] = await sql(`select reference from public.partnership_opportunities where id = ${lit(opp)}`);
console.log("✓ 2 educational needs, 1 project seeking partners published on the site");

// 2b. Public applications (one answers the published project).
const APP = {
  country: "Maroc",
  contact_title: "Responsable des partenariats",
  consent: true,
};
const applications = [
  {
    ...APP,
    org_name: "Association Lire Ensemble (démo)",
    org_type: "association",
    city: "Fès",
    org_description: "Association de démonstration qui anime des ateliers de lecture dans les écoles.",
    contact_name: "Nora Idrissi",
    contact_email: "contact.lire-ensemble@example.com",
    intervention_field: "soutien-scolaire",
    contribution_type: "equipement",
    contribution: "Don de 600 livres jeunesse et animation d’ateliers.",
    cooperation: "Fournir des livres et animer un atelier de lecture par mois dans deux des écoles du projet.",
    opportunity: oppRef,
  },
  {
    ...APP,
    org_name: "TechEdu Maroc (démo)",
    org_type: "entreprise",
    city: "Casablanca",
    sector: "Numérique éducatif",
    org_description: "Entreprise de démonstration qui développe des outils numériques pour les écoles.",
    contact_name: "Yassine Berrada",
    contact_email: "partenariats.techedu@example.com",
    intervention_field: "formation-continue",
    contribution_type: "expertise",
    contribution: "Mentorat d’enseignants par nos formateurs numériques.",
    cooperation: "Mettre à disposition 40 heures de mentorat pour accompagner les enseignants dans l’usage du numérique en classe.",
  },
];
const appIds = [];
for (const a of applications) {
  const id = randomUUID();
  await call("service", "submit_partnership_application", [lit(id), json(a), json([])]);
  appIds.push(id);
}
created.applicationIds.push(...appIds);
await call(u.coord, "set_partnership_application_status", [lit(appIds[0]), lit("under_review"), lit("Proposition pertinente pour le projet de bibliothèques")]);
await call(u.coord, "add_partnership_note", [lit(appIds[0]), "null", lit("Appel prévu la semaine prochaine pour préciser la liste des livres.")]);
await call(u.coord, "set_partnership_application_status", [lit(appIds[1]), lit("under_review"), "null"]);
const orgTech = await call(u.approver, "create_partner_from_application", [lit(appIds[1])]);
created.organizationIds.push(orgTech);
console.log("✓ 2 partnership applications (one became a partner organisation)");

// 2c. A partner organisation through the whole cycle.
const orgHorizon = await call(u.coord, "save_partner_organization", [
  "null",
  json({
    name: "Fondation Horizon Éducation (démo)",
    org_type: "fondation",
    country: "Maroc",
    city: "Rabat",
    website: "https://horizon-education.example.com",
    sector: "Mécénat éducatif",
    description: "Fondation de démonstration qui finance des programmes de soutien scolaire et de formation des enseignants.",
    fields: ["soutien-scolaire", "formation-continue"],
    contributions: ["financier", "equipement"],
  }),
]);
created.organizationIds.push(orgHorizon);
const contactAmina = await call(u.coord, "save_partner_contact", [
  "null",
  lit(orgHorizon),
  json({ full_name: "Amina Sefrioui", job_title: "Responsable des programmes", email: "demo.partenaire@example.com", phone: "+212 600 000 001", is_primary: true }),
]);
await call(u.coord, "save_partner_contact", ["null", lit(orgHorizon), json({ full_name: "Rachid Tazi", job_title: "Directeur financier", email: "finance.horizon@example.com" })]);
for (const s of ["first_contact", "interest_confirmed", "proposal_received", "evaluation", "negotiation"]) {
  await call(u.coord, "set_partner_status", [lit(orgHorizon), lit(s), "null"]);
}
await call(u.approver, "set_partner_status", [lit(orgHorizon), lit("institutional_validation"), lit("Recommandée par la direction des partenariats")]);
await call(u.approver, "set_partner_status", [lit(orgHorizon), lit("agreement_signed"), lit("Convention validée")]);
await call(u.coord, "set_partner_status", [lit(orgHorizon), lit("implementation"), "null"]);
await call(u.coord, "add_partnership_note", ["null", lit(orgHorizon), lit("Point d’étape trimestriel fixé au premier lundi de chaque trimestre.")]);
await call(u.coord, "save_partnership_task", ["null", lit(orgHorizon), lit("Envoyer le rapport du premier trimestre"), lit("2026-11-15"), lit(u.coord)]);
const taskDone = await call(u.coord, "save_partnership_task", ["null", lit(orgHorizon), lit("Collecter les listes de présence d’octobre"), lit("2026-10-10"), lit(u.coord)]);
await call(u.coord, "set_partnership_task_done", [lit(taskDone), "true"]);
await call(u.coord, "record_partner_communication", [
  lit(orgHorizon),
  lit(contactAmina),
  lit("copy"),
  lit("Lancement du programme de soutien scolaire"),
  lit("Bonjour Madame Sefrioui,\n\nNous vous confirmons le lancement du programme le 1er octobre. Vous trouverez le calendrier des séances dans votre espace partenaire.\n\nBien cordialement,\nHind Lahlou"),
  "null",
]);

// Agreement: draft → review → approved → signed (document) → active.
const agreement = await call(u.coord, "save_partnership_agreement", [
  "null",
  lit(orgHorizon),
  json({
    title: "Convention de soutien scolaire 2026-2027 (démo)",
    intervention_field: "soutien-scolaire",
    objectives: "Accompagner 200 élèves de collège en mathématiques et en français, et former 20 enseignants au soutien en petits groupes.",
    responsibilities: "La Fondation organise les séances et le suivi. Le partenaire finance les encadrants et fournit les manuels.",
    contributions_summary: "Financement de 150 000 MAD, 200 manuels, 40 heures d’expertise pédagogique.",
    start_on: "2026-09-01",
    end_on: "2027-06-30",
    renewal_terms: "Reconduction possible après bilan annuel.",
    renewal_notice_days: "60",
    opportunity_id: null,
  }),
]);
await call(u.coord, "set_agreement_status", [lit(agreement), lit("internal_review"), json({})]);
await call(u.approver, "set_agreement_status", [lit(agreement), lit("approved"), json({})]);
const signedPath = `agreements/${agreement}/convention-signee-demo.pdf`;
const signedSize = await upload("partnerships", signedPath, "Convention de soutien scolaire 2026-2027", [
  "Entre la Fondation Sanady et la Fondation Horizon Éducation (démo).",
  "Signée le 15 septembre 2026 (date fictive).",
  "Ce document de démonstration n’engage aucune des parties.",
]);
await call(u.approver, "add_partnership_document", [lit(agreement), "null", lit("signed"), lit(signedPath), lit("convention-signee-demo.pdf"), String(signedSize)]);
await call(u.approver, "set_agreement_status", [lit(agreement), lit("signed"), json({ signed_on: "2026-09-15" })]);
await call(u.coord, "set_agreement_status", [lit(agreement), lit("active"), json({})]);
const m1 = await call(u.coord, "save_partnership_milestone", ["null", lit(agreement), lit("Lancement des séances de soutien"), lit("2026-10-01"), "null"]);
await call(u.coord, "set_partnership_milestone_done", [lit(m1), "true"]);
await call(u.coord, "save_partnership_milestone", ["null", lit(agreement), lit("Bilan du premier trimestre"), lit("2026-12-20"), lit("Avec les listes de présence")]);
await call(u.coord, "save_partnership_milestone", ["null", lit(agreement), lit("Bilan de fin d’année"), lit("2027-06-30"), "null"]);

// Contributions: financial (verified with evidence), material (committed), expertise (pledged).
const cFin = await call(u.coord, "save_partnership_contribution", [
  "null",
  lit(orgHorizon),
  json({ agreement_id: agreement, kind: "financial", description: "Financement des encadrants de soutien scolaire", amount_pledged: "150000", currency: "MAD", expected_on: "2026-09-30", restricted_purpose: "Rémunération des encadrants" }),
]);
await call(u.coord, "set_contribution_stage", [lit(cFin), lit("committed"), json({})]);
await call(u.coord, "set_contribution_stage", [lit(cFin), lit("delivered"), json({ amount_received: "75000", received_on: "2026-09-25", note: "Premier versement" })]);
const evPath = `contributions/${cFin}/avis-de-virement-demo.pdf`;
const evSize = await upload("partnerships", evPath, "Avis de virement", ["Premier versement de 75 000 MAD reçu le 25 septembre 2026 (fictif)."]);
await call(u.coord, "add_partnership_document", ["null", lit(cFin), lit("evidence"), lit(evPath), lit("avis-de-virement-demo.pdf"), String(evSize)]);
await call(u.approver, "set_contribution_stage", [lit(cFin), lit("verified"), json({})]);
const cMat = await call(u.coord, "save_partnership_contribution", [
  "null",
  lit(orgHorizon),
  json({ agreement_id: agreement, kind: "material", description: "Manuels de mathématiques et de français", item: "Manuels scolaires", quantity: "200", estimated_value: "24000", recipient: "Collèges du programme", expected_on: "2026-11-15" }),
]);
await call(u.coord, "set_contribution_stage", [lit(cMat), lit("committed"), json({})]);
await call(u.coord, "save_partnership_contribution", [
  "null",
  lit(orgHorizon),
  json({ agreement_id: agreement, kind: "expertise", description: "Ateliers pour les enseignants du programme", expertise_category: "Pédagogie du soutien en petits groupes", hours_pledged: "40", supported_activities: "Quatre ateliers de dix heures" }),
]);

// Impact: a manual measure (verified), one to review, one computed from the platform.
const metric = await call(u.coord, "save_impact_metric", [
  "null",
  lit(orgHorizon),
  json({ agreement_id: agreement, intervention_field: "soutien-scolaire", dimension: "students_supported", metric_type: "output", value: "184", unit: "élèves", period_start: "2026-10-01", period_end: "2026-10-15", method: "Listes de présence des séances, tenues par les encadrants.", attribution: "direct" }),
]);
await call(u.approver, "set_metric_status", [lit(metric), lit("verified"), "null"]);
await call(u.coord, "save_impact_metric", [
  "null",
  lit(orgHorizon),
  json({ agreement_id: agreement, intervention_field: "soutien-scolaire", dimension: "activities_delivered", metric_type: "output", value: "36", unit: "séances", period_start: "2026-10-01", period_end: "2026-10-15", method: "Cahier de bord des séances signé par les encadrants.", attribution: "direct" }),
]);
await call(u.coord, "record_platform_metric", [
  "null",
  lit(orgHorizon),
  json({ agreement_id: agreement, measure: "teachers_trained", institution_ids: [lycee.id], course_ids: [], period_start: "2026-09-01", period_end: "2026-10-17", intervention_field: "formation-continue", attribution: "shared", note: "Enseignants du lycée de démonstration." }),
]);

// Report: approved by the approver, then shared with the partner.
const report = await call(u.coord, "save_partner_report", [
  "null",
  lit(orgHorizon),
  json({
    agreement_id: agreement,
    title: "Rapport de lancement · septembre-octobre 2026 (démo)",
    period_start: "2026-09-01",
    period_end: "2026-10-15",
    activities: "Recrutement de 12 encadrants, lancement de 36 séances de soutien, première réunion avec les directeurs des collèges.",
    challenges: "Deux collèges ont commencé avec une semaine de retard à cause des emplois du temps.",
    future_opportunities: "Étendre le programme à deux collèges supplémentaires en 2027.",
  }),
]);
await call(u.approver, "set_report_status", [lit(report), lit("approved")]);
await call(u.coord, "set_report_status", [lit(report), lit("shared")]);

// Partner portal: an account for Amina, a message exchange and a deliverable.
created.portalWasEnabled = (await sql(`select partner_portal_enabled as v from public.platform_settings where id`))[0]?.v === true;
if (!created.portalWasEnabled) await call(admin, "set_partner_portal", ["true"]);
const hPartner = tokenHash();
await inviteAndAccept({ who: u.approver, name: "invite_partner_member" }, [lit(orgHorizon), lit("demo.partenaire@example.com"), lit(hPartner)], hPartner, u.partner, false);
await call(u.partner, "post_partner_message", [lit(orgHorizon), lit("Bonjour, pouvez-vous nous envoyer le calendrier des séances du mois de novembre ?")]);
await call(u.coord, "post_partner_message", [lit(orgHorizon), lit("Bonjour Madame Sefrioui, le calendrier est en ligne dans le rapport partagé. Bonne journée.")]);
const deliv = randomUUID();
const delPath = `deliverables/${deliv}/listes-de-presence-octobre-demo.pdf`;
const delSize = await upload("partnerships", delPath, "Listes de présence · octobre 2026", ["36 séances, 184 élèves (données fictives)."]);
await call(u.partner, "submit_partner_deliverable", [
  lit(deliv),
  json({ title: "Listes de présence d’octobre (démo)", description: "Listes signées par les encadrants.", agreement_id: agreement }),
  json([{ path: delPath, name: "listes-de-presence-octobre-demo.pdf", size: delSize }]),
]);
await call(u.coord, "review_partner_deliverable", [lit(deliv), lit("accepted"), "null"]);

// A third organisation, still in discussion.
const orgInst = await call(u.coord, "save_partner_organization", [
  "null",
  json({ name: "Institut Al Maarifa (démo)", org_type: "universite", country: "Maroc", city: "Marrakech", description: "Établissement d’enseignement supérieur de démonstration.", fields: ["orientation", "bourses"], contributions: ["expertise"] }),
]);
created.organizationIds.push(orgInst);
await call(u.coord, "set_partner_status", [lit(orgInst), lit("first_contact"), lit("Rencontre au salon de l’orientation")]);
await call(u.coord, "set_partner_status", [lit(orgInst), lit("negotiation"), "null"]);
await call(u.coord, "save_partnership_task", ["null", lit(orgInst), lit("Préparer une proposition d’ateliers d’orientation"), lit("2026-11-05"), lit(u.approver)]);
save();
console.log("✓ 3 partner organisations: signed agreement, contributions, impact, shared report, partner portal");

// ─── 3. Entreprises ────────────────────────────────────────────────────────
// 3a. Service plans (prepared by the manager, activated by the approver).
const planPro = await call(u.ent, "save_service_plan", [
  "null",
  json({ name: "Établissement Plus (démo)", service: "complete", currency: "MAD", pricing_model: "annual_subscription", learner_limit: "80", storage_limit_gb: "20", video_minutes_limit: "1000", support_level: "Réponse sous 1 jour ouvré", support_commitments: "Assistance par l’espace Assistance du lundi au vendredi, un point mensuel." }),
]);
await call(u.ent, "save_plan_line", [lit(planPro), json({ category: "platform_access", label: "Accès à la plateforme", quantity: "12", unit: "mois", unit_price: "2500" })]);
await call(u.ent, "save_plan_line", [lit(planPro), json({ category: "setup_fee", label: "Mise en place de l’espace", quantity: "1", unit_price: "5000" })]);
await call(u.ent, "save_plan_line", [lit(planPro), json({ category: "technical_support", label: "Assistance", quantity: "12", unit: "mois", unit_price: "500" })]);
await call(u.approver, "set_plan_status", [lit(planPro), lit("active")]);
const planEss = await call(u.ent, "save_service_plan", [
  "null",
  json({ name: "Essentiel (démo)", service: "plateforme", currency: "MAD", pricing_model: "annual_subscription", learner_limit: "30", storage_limit_gb: "5", support_level: "Réponse sous 2 jours ouvrés", support_commitments: "Assistance par l’espace Assistance." }),
]);
await call(u.ent, "save_plan_line", [lit(planEss), json({ category: "platform_access", label: "Accès à la plateforme", quantity: "12", unit: "mois", unit_price: "1200" })]);
await call(u.approver, "set_plan_status", [lit(planEss), lit("active")]);
created.planIds.push(planPro, planEss);

// 3b. Incoming requests from the website.
const REQ = { country: "Maroc", org_type: "entreprise", existing_content: "partial", language: "fr", consent: true };
const requests = [
  { ...REQ, org_name: "Groupe scolaire Les Orangers (démo)", city: "Kénitra", sector: "Enseignement privé", employee_count: "50-249", contact_name: "Samir Lamrani", contact_title: "Responsable formation", contact_email: "formation.orangers@example.com", service: "complete", topic: "Formation continue des enseignants", target_population: "Enseignants du primaire et du collège", learner_count: "60", outcomes: "Former nos 60 enseignants à l’évaluation formative et accueillir les nouveaux enseignants avec un parcours dédié.", timeline: "Rentrée 2026" },
  { ...REQ, org_name: "Centre de formation Atlas (démo)", city: "Agadir", sector: "Formation professionnelle", employee_count: "1-49", contact_name: "Laila Bennis", contact_title: "Directrice pédagogique", contact_email: "direction.atlas@example.com", service: "plateforme", topic: "Plateforme pour nos formateurs", target_population: "Formateurs vacataires", learner_count: "25", outcomes: "Donner à nos formateurs un accès simple aux formations pédagogiques et suivre leur progression." },
  { ...REQ, org_name: "Collège privé Ibn Battouta (démo)", city: "Tanger", employee_count: "1-49", contact_name: "Omar Fassi", contact_title: "Directeur", contact_email: "direction.ibnbattouta@example.com", service: "sur_mesure", topic: "Gestion de classe", target_population: "Nouveaux enseignants", learner_count: "12", outcomes: "Aider nos nouveaux enseignants à installer un climat de classe serein dès la rentrée.", existing_content: "none" },
];
const reqIds = [];
for (const r of requests) {
  const id = randomUUID();
  await call("service", "submit_enterprise_request", [lit(id), json(r), json([])]);
  reqIds.push(id);
}
created.enterpriseRequestIds.push(...reqIds);
for (const id of reqIds.slice(0, 2)) await call(u.ent, "set_enterprise_request_status", [lit(id), lit("qualified"), lit("Besoin clair, budget à confirmer")]);
const orgOrangers = await call(u.ent, "create_enterprise_client", [lit(reqIds[0]), "null"]);
const orgAtlas = await call(u.ent, "create_enterprise_client", [lit(reqIds[1]), "null"]);
created.organizationIds.push(orgOrangers, orgAtlas);
console.log("✓ 2 service plans, 3 incoming requests, 2 clients");

// 3c. Client « Les Orangers »: pipeline, proposal, contract.
for (const s of ["discovery", "needs_assessment", "proposal"]) await call(u.ent, "set_enterprise_status", [lit(orgOrangers), lit(s), "null"]);
const propOr = await call(u.ent, "save_enterprise_proposal", [
  "null",
  lit(orgOrangers),
  json({ request_id: reqIds[0], title: "Plateforme et parcours d’accueil des nouveaux enseignants (démo)", service: "complete", summary: "Espace dédié pour 60 enseignants, accès au catalogue SANADY et création d’un parcours sur mesure.", currency: "MAD", valid_until: "2026-11-30" }),
]);
await call(u.ent, "apply_plan_to_proposal", [lit(propOr), lit(planPro)]);
await call(u.ent, "save_proposal_line", ["null", lit(propOr), json({ category: "instructional_design", label: "Conception du parcours d’accueil", quantity: "3", unit: "jours", unit_price: "5500" })]);
await call(u.ent, "add_enterprise_note", ["null", "null", lit(propOr), lit("Le client souhaite démarrer avant les vacances d’automne.")]);
await call(u.ent, "set_proposal_status", [lit(propOr), lit("internal_review"), "null"]);
await call(u.approver, "set_proposal_status", [lit(propOr), lit("approved"), "null"]);
await call(u.ent, "set_proposal_status", [lit(propOr), lit("sent"), "null"]);
await call(u.ent, "set_proposal_status", [lit(propOr), lit("accepted"), lit("Bon de commande reçu")]);
for (const s of ["negotiation", "institutional_approval"]) await call(u.ent, "set_enterprise_status", [lit(orgOrangers), lit(s), "null"]);
await call(u.approver, "set_enterprise_status", [lit(orgOrangers), lit("contract_signed"), lit("Contrat validé")]);
await call(u.ent, "set_enterprise_status", [lit(orgOrangers), lit("onboarding"), "null"]);

const contract = await call(u.ent, "create_contract_from_proposal", [lit(propOr)]);
const TERMS = {
  title: "Contrat plateforme et parcours sur mesure 2026-2027 (démo)",
  pricing_model: "annual_subscription",
  currency: "MAD",
  start_on: "2026-09-01",
  end_on: "2027-08-31",
  renewal_terms: "Renouvellement par avenant, après bilan annuel.",
  renewal_notice_days: "60",
  learner_limit: "80",
  storage_limit_gb: "20",
  video_minutes_limit: "1000",
  support_commitments: "Réponse sous un jour ouvré, du lundi au vendredi.",
  data_ownership: "Les données des enseignants appartiennent au client ; export complet à la fin du contrat.",
  content_ownership: "Le parcours sur mesure appartient au client ; le catalogue SANADY reste propriété de la Fondation.",
  termination_provisions: "Préavis de deux mois ; remise des données ; suppression après confirmation écrite.",
};
await call(u.ent, "save_enterprise_contract", [lit(contract), json(TERMS)]);
await call(u.ent, "set_contract_status", [lit(contract), lit("internal_review"), json({})]);
await call(u.approver, "set_contract_status", [lit(contract), lit("approved"), json({})]);
const cPath = `contracts/${contract}/contrat-signe-demo.pdf`;
const cSize = await upload("enterprise", cPath, "Contrat plateforme et parcours sur mesure", ["Fondation Sanady et Groupe scolaire Les Orangers (démo).", "Signé le 28 août 2026 (date fictive).", "Document de démonstration sans valeur."]);
await call(u.approver, "add_contract_document", [lit(contract), lit("signed"), lit(cPath), lit("contrat-signe-demo.pdf"), String(cSize)]);
await call(u.approver, "set_contract_status", [lit(contract), lit("signed"), json({ signed_on: "2026-08-28" })]);
await call(u.ent, "set_contract_status", [lit(contract), lit("active"), json({})]);

// 3d. The company workspace: authorised, generated, administrator, catalogue, security, active.
const tenant = await call(u.ent, "save_enterprise_tenant", [
  "null",
  lit(orgOrangers),
  json({ display_name: "Groupe scolaire Les Orangers (démo)", slug: "les-orangers-demo", service_plan: "complete", max_learners: "80", storage_allowance_gb: "20", video_minutes_allowance: "1000", support_level: "Réponse sous 1 jour ouvré", support_email: "formation.orangers@example.com", contract_start_on: "2026-09-01", contract_end_on: "2027-08-31", certificate_kind: "attestation" }),
]);
await call(u.approver, "authorize_enterprise_tenant", [lit(tenant), "true", lit("Contrat signé vérifié")]);
const entInst = await call(u.ent, "generate_enterprise_workspace", [lit(tenant)]);
created.institutionIds.push(entInst);
save();
const hRh = tokenHash();
await inviteAndAccept({ who: u.ent, name: "invite_tenant_admin" }, [lit(tenant), lit("demo.rh@example.com"), lit(hRh)], hRh, u.rh, false);
for (const c of [courseDiff, courseGestion]) await call(admin, "grant_course_to_institution", [lit(c), lit(entInst)]);
await call(admin, "confirm_tenant_security", [lit(tenant)]);
await call(u.ent, "set_tenant_status", [lit(tenant), lit("active"), json({})]);
await call(u.ent, "save_enterprise_contract", [lit(contract), json({ tenant_id: tenant })]);
await call(u.ent, "apply_contract_to_tenant", [lit(contract)]);
await call(u.ent, "set_enterprise_status", [lit(orgOrangers), lit("active_service"), "null"]);

// Departments and two employees (invited by the company administrator).
const depPrim = await call(u.rh, "save_department", ["null", lit(entInst), lit("Primaire")]);
const depCol = await call(u.rh, "save_department", ["null", lit(entInst), lit("Collège")]);
for (const [key, email, dep] of [["emp1", "demo.employe1@example.com", depCol], ["emp2", "demo.employe2@example.com", depPrim]]) {
  const h = tokenHash();
  const inv = await call(u.rh, "create_invitation", [lit("institution_teacher"), lit(email), lit(entInst), lit(h)]);
  await call(u.rh, "set_invitation_department", [lit(inv), lit(dep)]);
  await call("service", "accept_invitation", [lit(h), lit(u[key]), "true"]);
}
const hPending = tokenHash();
await call(u.rh, "create_invitation", [lit("institution_teacher"), lit("demo.nouvelle.recrue@example.com"), lit(entInst), lit(hPending)]);
created.invitationEmails.push("demo.nouvelle.recrue@example.com");
await call(u.rh, "assign_course", [lit(entInst), lit(courseDiff), uuids([u.emp1, u.emp2]), lit("2026-12-15")]);

// Assessment policy for the company (prepared, then approved).
await call(u.ent, "save_assessment_policy", [lit(tenant), json({ pass_threshold: 80, max_attempts: 2, feedback: "after_each_attempt", certificates: true, enforce_due_dates: false, note: "Seuil relevé à la demande du client (démo)." })]);
await call(u.approver, "approve_assessment_policy", [lit(tenant)]);
console.log("✓ signed contract, active company workspace with administrator, 2 departments, 2 employees, assessment policy");

// 3e. Custom training A: from the brief to the launch in the client's workspace.
const projA = await call(u.prod, "save_training_project", [
  "null",
  lit(orgOrangers),
  json({ tenant_id: tenant, title: "Accueillir les nouveaux enseignants (démo)", target_audience: "Enseignants nouvellement recrutés du groupe scolaire", objectives: "Connaître le projet pédagogique du groupe, ses règles de vie et les premiers gestes pour réussir sa rentrée.", constraints: "Moins d’une heure au total, lisible sur téléphone.", language: "fr", target_minutes: "45", ownership: "company", client_review_required: true, due_on: "2026-10-31" }),
]);
await call(u.prod, "set_training_status", [lit(projA), lit("design"), "null"]);
await call(u.prod, "save_outline_item", ["null", lit(projA), lit("Le projet du groupe scolaire"), lit("Valeurs, organisation, interlocuteurs")]);
await call(u.prod, "save_outline_item", ["null", lit(projA), lit("Réussir ses premières semaines"), lit("Règles de vie, premiers cours, liens avec les familles")]);
const courseA = await call(u.prod, "create_project_course", [lit(projA)]);
created.courseIds.push(courseA);
save();
await fillCourse(courseA, "Accueillir les nouveaux enseignants (démo)", [
  {
    lesson: "Notre projet pédagogique",
    pages: [
      ["Bienvenue", "Ce parcours de démonstration présente le projet d’un groupe scolaire fictif à ses nouveaux enseignants.", "Il montre comment une entreprise ou un établissement peut avoir son propre parcours, à côté du catalogue SANADY."],
      ["Vos interlocuteurs", "Chaque nouvel enseignant est accompagné par un tuteur de sa discipline pendant le premier trimestre.", "La direction pédagogique reçoit chaque nouvel enseignant au bout d’un mois."],
    ],
    questions: [
      { kind: "single", prompt: "Qui accompagne un nouvel enseignant pendant le premier trimestre ?", options: [["Un tuteur de sa discipline", true], ["Personne", false], ["Les familles", false]] },
      { kind: "single", prompt: "Quand la direction pédagogique reçoit-elle le nouvel enseignant ?", options: [["Au bout d’un mois", true], ["À la fin de l’année", false], ["Jamais", false]] },
    ],
  },
  {
    lesson: "Les premières semaines",
    pages: [
      ["Installer les règles", "Les règles de vie de la classe sont présentées dès le premier jour, puis rappelées chaque semaine.", "Elles sont communes à tout l’établissement : les élèves retrouvent les mêmes repères dans chaque classe."],
      ["Le lien avec les familles", "Une réunion avec les familles a lieu avant la fin du premier mois.", "Le carnet de liaison est le moyen de contact habituel."],
    ],
    questions: [
      { kind: "single", prompt: "Quand les règles de vie sont-elles présentées aux élèves ?", options: [["Dès le premier jour", true], ["Au deuxième trimestre", false], ["Seulement en cas de problème", false]] },
      { kind: "multiple", prompt: "Quels sont les moyens de lien avec les familles cités ?", options: [["Une réunion avant la fin du premier mois", true], ["Le carnet de liaison", true], ["Les réseaux sociaux personnels", false]] },
    ],
  },
]);
await call(u.prod, "set_training_status", [lit(projA), lit("production"), "null"]);
await call(u.prod, "assign_project_trainer", [lit(projA), lit(trainer), "true"]);
for (const [kind, title, who] of [["pdf", "Rédiger les deux fiches", trainer], ["quiz", "Écrire les questions d’évaluation", trainer], ["review", "Relire avec la direction du groupe", u.prod]]) {
  const t = await call(u.prod, "save_training_task", ["null", lit(projA), json({ kind, title, assigned_to: who, due_on: "2026-10-20" })]);
  await call(who, "set_training_task_status", [lit(t), lit("done")]);
}
await call(u.prod, "set_training_status", [lit(projA), lit("internal_review"), "null"]);
await call(admin, "record_training_review", [lit(projA), lit("internal"), lit("approved"), lit("Conforme aux objectifs")]);
await call(u.rh, "record_training_review", [lit(projA), lit("client"), lit("changes_requested"), lit("Ajouter le nom du tuteur dans la première fiche")]);
await call(u.prod, "set_training_status", [lit(projA), lit("internal_review"), "null"]);
await call(admin, "record_training_review", [lit(projA), lit("internal"), lit("approved"), "null"]);
await call(u.rh, "record_training_review", [lit(projA), lit("client"), lit("approved"), lit("Validé par la direction du groupe")]);
await call(u.approver, "set_training_status", [lit(projA), lit("approved"), lit("Conforme au contrat")]);
await call(admin, "approve_course", [lit(courseA)]);
const [{ status: stA }] = await sql(`select status from public.training_projects where id = ${lit(projA)}`);
if (stA === "approved") await call(u.prod, "set_training_status", [lit(projA), lit("published"), "null"]);
await call(u.prod, "set_training_status", [lit(projA), lit("launched"), "null"]);
await call(u.rh, "assign_course", [lit(entInst), lit(courseA), uuids([u.emp1, u.emp2]), lit("2026-11-15")]);

// Custom training B: still in production, with open tasks.
const projB = await call(u.prod, "save_training_project", [
  "null",
  lit(orgOrangers),
  json({ tenant_id: tenant, title: "Communiquer avec les familles (démo)", target_audience: "Tous les enseignants du groupe scolaire", objectives: "Préparer une réunion de parents, écrire un message clair et gérer un échange difficile avec bienveillance.", language: "fr", target_minutes: "60", ownership: "company", client_review_required: true, due_on: "2027-01-15" }),
]);
await call(u.prod, "set_training_status", [lit(projB), lit("design"), "null"]);
for (const t of ["Préparer la réunion de parents", "Écrire aux familles", "Les échanges difficiles"]) await call(u.prod, "save_outline_item", ["null", lit(projB), lit(t), "null"]);
const courseB = await call(u.prod, "create_project_course", [lit(projB)]);
created.courseIds.push(courseB);
save();
await call(u.prod, "set_training_status", [lit(projB), lit("production"), "null"]);
const tB1 = await call(u.prod, "save_training_task", ["null", lit(projB), json({ kind: "video", title: "Tourner la vidéo d’introduction", assigned_to: trainer, due_on: "2026-11-20" })]);
await call(trainer, "set_training_task_status", [lit(tB1), lit("in_progress")]);
await call(u.prod, "save_training_task", ["null", lit(projB), json({ kind: "pdf", title: "Rédiger la fiche « Écrire aux familles »", assigned_to: trainer, due_on: "2026-11-30" })]);
await call(u.prod, "save_training_task", ["null", lit(projB), json({ kind: "quiz", title: "Écrire l’évaluation finale", due_on: "2026-12-10" })]);
console.log("✓ custom training launched in the workspace, a second one in production");

// 3f. Learning in the company workspace (through the real functions).
async function readLesson(uid, lessonId, pages) {
  await sqlAs(uid, `select public.start_lesson(${lit(lessonId)});`);
  await sql(`update public.lesson_progress set started_at = now() - interval '2 hours' where user_id = ${lit(uid)} and lesson_id = ${lit(lessonId)};`);
  await sqlAs(uid, `select public.record_document_progress(${lit(lessonId)}, array[${Array.from({ length: pages }, (_, i) => i + 1).join(",")}]::int[], ${pages});`);
}
async function sqlAs(uid, statements) {
  return sql(`begin; set local role authenticated;
    select set_config('request.jwt.claim.sub', ${lit(uid)}, true);
    select set_config('request.jwt.claims', ${lit(JSON.stringify({ sub: uid, role: "authenticated", aal: "aal2" }))}, true);
    ${statements} reset role; commit;`);
}
async function takeQuiz(uid, quizId, allRight) {
  const qs = await sql(`select q.id, array_agg(o.id order by o.position) filter (where o.is_correct) as good, array_agg(o.id order by o.position) filter (where not o.is_correct) as bad
                        from public.questions q join public.question_options o on o.question_id = q.id where q.quiz_id = ${lit(quizId)} group by q.id`);
  const answers = Object.fromEntries(qs.map((q, i) => [q.id, allRight || i > 0 ? q.good : [q.bad[0]]]));
  await sqlAs(uid, `do $$ declare a uuid; begin
      a := (public.start_quiz_attempt(${lit(quizId)}) ->> 'attempt_id')::uuid;
      perform public.submit_quiz_attempt(a, ${lit(JSON.stringify(answers))}::jsonb);
    end $$;`);
}
const lessonsA = await sql(`select l.id, l.pdf_page_count as pages, q.id as quiz from public.lessons l join public.modules m on m.id = l.module_id
                            left join public.quizzes q on q.module_id = m.id where l.course_id = ${lit(courseA)} order by m.position, l.position`);
for (const l of lessonsA) {
  await readLesson(u.emp1, l.id, l.pages);
  await takeQuiz(u.emp1, l.quiz, true);
}
await readLesson(u.emp2, lessonsA[0].id, lessonsA[0].pages);
await takeQuiz(u.emp2, lessonsA[0].quiz, false);
const [firstDiff] = await sql(`select l.id, l.pdf_page_count as pages from public.lessons l join public.modules m on m.id = l.module_id where l.course_id = ${lit(courseDiff)} order by m.position, l.position limit 1`);
await readLesson(u.emp1, firstDiff.id, firstDiff.pages);
console.log("✓ learning activity in the company workspace");

// 3g. Support requests (opened by the client, answered by the team).
const sup1 = await call(u.rh, "open_support_request", [
  lit(entInst),
  json({ category: "access", priority: "normal", subject: "Une enseignante n’a pas reçu son invitation", body: "Bonjour, Mme Ouazzani n’a pas reçu l’e-mail d’invitation envoyé lundi. Pouvez-vous vérifier ?" }),
]);
await call(u.ent, "assign_support_request", [lit(sup1), lit(u.ent)]);
await call(u.ent, "post_support_message", [lit(sup1), lit("Note interne : l’adresse avait une faute de frappe."), "true"]);
await call(u.ent, "post_support_message", [lit(sup1), lit("Bonjour, l’adresse contenait une erreur. Nous avons renvoyé l’invitation : pouvez-vous confirmer sa réception ?"), "false"]);
await call(u.ent, "set_support_status", [lit(sup1), lit("waiting_client")]);
await call(u.rh, "post_support_message", [lit(sup1), lit("C’est bon, elle a pu se connecter. Merci !"), "false"]);
await call(u.ent, "set_support_status", [lit(sup1), lit("resolved")]);
await call(u.rh, "set_support_status", [lit(sup1), lit("closed")]);
const sup2 = await call(u.rh, "open_support_request", [
  lit(entInst),
  json({ category: "training_request", priority: "normal", subject: "Demande d’une formation sur l’évaluation par compétences", body: "Nos enseignants du collège souhaiteraient une formation courte sur l’évaluation par compétences. Est-ce possible au deuxième trimestre ?" }),
]);
await call(u.ent, "assign_support_request", [lit(sup2), lit(u.prod)]);
await call(u.prod, "post_support_message", [lit(sup2), lit("Bonjour, c’est possible. Nous vous proposons un échange de 30 minutes pour préciser le besoin."), "false"]);
console.log("✓ 2 support requests");

// 3h. Finance: invoices, a confirmed payment, costs, usage readings.
const inv1 = await call(u.ent, "record_invoice", [lit(contract), json({ external_reference: "DEMO-FA-2026-001", category: "setup", description: "Mise en place de l’espace et conception du parcours", amount: "21500", issued_on: "2026-09-01", due_on: "2026-09-30" })]);
const pay1 = await call(u.ent, "record_payment", [lit(inv1), json({ amount: "21500", received_on: "2026-09-22", method: "transfer", bank_reference: "VIR-DEMO-0922" })]);
await call(u.approver, "confirm_payment", [lit(pay1)]);
const inv2 = await call(u.ent, "record_invoice", [lit(contract), json({ external_reference: "DEMO-FA-2026-002", category: "platform_subscription", description: "Abonnement, premier trimestre", amount: "9000", issued_on: "2026-10-01", due_on: "2026-10-31" })]);
await call(u.ent, "record_payment", [lit(inv2), json({ amount: "4500", received_on: "2026-10-12", method: "cheque", bank_reference: "CHQ-DEMO-1012" })]);
for (const c of [
  { category: "content_production", description: "Rédaction des fiches du parcours d’accueil (démo)", amount: "6000", currency: "MAD", incurred_on: "2026-10-05", contract_id: contract },
  { category: "cloud_infrastructure", description: "Hébergement, part estimée du client (démo)", amount: "400", currency: "MAD", incurred_on: "2026-10-01", contract_id: contract, is_estimate: true },
  { category: "trainer_compensation", description: "Formateur du parcours d’accueil (démo)", amount: "3500", currency: "MAD", incurred_on: "2026-10-15", contract_id: contract },
]) {
  created.costIds.push(await call(u.ent, "record_cost", [json(c)]));
}
for (const period of ["2026-09-01", "2026-10-01"]) await call(u.ent, "record_tenant_usage", [lit(tenant), lit(period)]);

// Notes and tasks on the clients.
await call(u.ent, "add_enterprise_note", [lit(orgOrangers), "null", "null", lit("Très satisfaits du lancement ; envisagent un deuxième parcours.")]);
await call(u.ent, "save_enterprise_task", [lit(orgOrangers), lit("Préparer le bilan du premier trimestre"), lit("2026-12-15"), lit(u.ent)]);

// 3i. Client « Centre de formation Atlas »: a proposal sent, awaiting an answer.
for (const s of ["discovery", "proposal"]) await call(u.ent, "set_enterprise_status", [lit(orgAtlas), lit(s), "null"]);
const propAt = await call(u.ent, "save_enterprise_proposal", [
  "null",
  lit(orgAtlas),
  json({ request_id: reqIds[1], title: "Accès plateforme pour 25 formateurs (démo)", service: "plateforme", summary: "Accès au catalogue SANADY et suivi de la progression des formateurs.", currency: "MAD", valid_until: "2026-12-15" }),
]);
await call(u.ent, "apply_plan_to_proposal", [lit(propAt), lit(planEss)]);
await call(u.ent, "set_proposal_status", [lit(propAt), lit("internal_review"), "null"]);
await call(u.approver, "set_proposal_status", [lit(propAt), lit("approved"), "null"]);
await call(u.ent, "set_proposal_status", [lit(propAt), lit("sent"), "null"]);
await call(u.ent, "save_enterprise_task", [lit(orgAtlas), lit("Relancer pour la réponse à la proposition"), lit("2026-11-02"), lit(u.ent)]);
save();
console.log("✓ invoices, payment, costs, usage readings; second client with a proposal sent");

// ─── 4. Lycée Ibn Khaldoun (démo): enrollment code, invitation, access requests ──
const CODE_ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const code = Array.from({ length: 3 }, () => Array.from({ length: 4 }, () => CODE_ALPHA[randomInt(CODE_ALPHA.length)]).join("")).join("-");
const codeId = await call(director, "create_enrollment_code", [lit(lycee.id), lit(code), lit("Rentrée des professeurs de sciences (démo)"), "30", lit(new Date(Date.now() + 60 * 86400000).toISOString())]);
created.enrollmentCodeIds.push(codeId);
const hLy = tokenHash();
await call(director, "create_invitation", [lit("institution_teacher"), lit("demo.nouveau.prof@example.com"), lit(lycee.id), lit(hLy)]);
created.invitationEmails.push("demo.nouveau.prof@example.com");
for (const r of [
  ["Hajar", "Mansouri", "demo.acces1@example.com", "Professeure d’anglais", "Anglais", "Collège fictif Al Amal", "Salé", "Je souhaite suivre la formation sur la différenciation.", courseDiff, "teacher"],
  ["Driss", "Alami", "demo.acces2@example.com", "Directeur", null, "École fictive Ennour", "Meknès", "Notre école aimerait proposer SANADY à ses 15 enseignants.", null, "institution"],
]) {
  await call("service", "request_access", r.map((x) => lit(x)));
  created.accessRequestEmails.push(r[2]);
}
save();
console.log(`✓ enrollment code ${code}, a pending invitation, 2 access requests`);

// ─── 5. No e-mails for demo data ───────────────────────────────────────────
const [{ n }] = await sql(`with d as (delete from public.notification_outbox o where o.status = 'pending' and (o.created_at >= ${lit(startedAt)}
  or o.user_id in (select id from public.profiles where email like 'demo.%@example.com')) returning 1) select count(*)::int as n from d`);
console.log(`✓ ${n} pending demo notifications removed (no e-mail is sent for demo data)`);
console.log("\nDemo accounts (password shown once, also added to scripts/demo/.demo-accounts.txt):");
for (const p of passwords) console.log(`  ${p.email.padEnd(32)} ${p.pwd}   ${p.first} ${p.last} — ${p.job}`);

/** Adds a PDF lesson and a quiz to each module of a project course (as the administrator). */
async function fillCourse(course, title, modules) {
  const mods = await sql(`select id, position from public.modules where course_id = ${lit(course)} order by position`);
  // The course is reviewed like any other: it needs objectives and a category.
  let body = `update public.courses set objectives = array[${modules.map((m) => lit(m.lesson)).join(",")}]::text[],
                category_id = (select id from public.course_categories where name = 'Pédagogie et didactique'), level = 'debutant'
              where id = ${lit(course)};\n`;
  const qRows = [];
  const pdfs = [];
  modules.forEach((m, i) => {
    const modId = mods[i].id;
    const lessonId = randomUUID();
    const quizId = randomUUID();
    pdfs.push({ lessonId, title: m.lesson, pages: m.pages });
    body += `insert into public.lessons (id, module_id, course_id, title, description, kind, position, estimated_minutes)
             values (${lit(lessonId)}, ${lit(modId)}, ${lit(course)}, ${lit(m.lesson)}, ${lit(`Lecture guidée de ${m.pages.length} pages.`)}, 'pdf', 0, ${m.pages.length * 5});
             insert into public.quizzes (id, module_id, course_id, title, instructions)
             values (${lit(quizId)}, ${lit(modId)}, ${lit(course)}, ${lit(`Évaluation · ${m.lesson}`)}, 'Répondez à toutes les questions.');\n`;
    m.questions.forEach((q, qi) => {
      const qid = randomUUID();
      qRows.push(`insert into public.questions (id, quiz_id, kind, prompt, explanation, points, position) values (${lit(qid)}, ${lit(quizId)}, ${lit(q.kind)}, ${lit(q.prompt)}, ${lit(q.explanation ?? "")}, 1, ${qi});`);
      q.options.forEach(([label, ok], oi) => qRows.push(`insert into public.question_options (question_id, label, is_correct, position) values (${lit(qid)}, ${lit(label)}, ${ok}, ${oi});`));
    });
  });
  await sqlAs(admin, body);
  await sql(`begin; ${qRows.join("\n")} commit;`);
  const updates = [];
  for (const p of pdfs) {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    p.pages.forEach(([heading, ...paras], i) => {
      const page = doc.addPage([595.28, 841.89]);
      page.drawRectangle({ x: 0, y: 835, width: 595.28, height: 6.89, color: rgb(0xf9 / 255, 0x5a / 255, 0x05 / 255) });
      page.drawText(title, { x: 56, y: 800, size: 9, font, color: rgb(0.43, 0.41, 0.38) });
      page.drawText(p.title, { x: 56, y: 760, size: 20, font: bold, color: rgb(0.11, 0.1, 0.09) });
      page.drawText(heading, { x: 56, y: 712, size: 14, font: bold, color: rgb(0xf9 / 255, 0x5a / 255, 0x05 / 255) });
      let y = 682;
      for (const para of paras) {
        const words = para.split(" ");
        let line = "";
        for (const w of words) {
          const t = line ? `${line} ${w}` : w;
          if (font.widthOfTextAtSize(t, 12) > 483 && line) {
            page.drawText(line, { x: 56, y, size: 12, font });
            y -= 19;
            line = w;
          } else line = t;
        }
        if (line) page.drawText(line, { x: 56, y, size: 12, font });
        y -= 31;
      }
      page.drawText(`Page ${i + 1} / ${p.pages.length} · contenu de démonstration`, { x: 56, y: 40, size: 9, font, color: rgb(0.43, 0.41, 0.38) });
    });
    const path = `${course}/${p.lessonId}/lecon.pdf`;
    const { error } = await supa.storage.from("course-media").upload(path, await doc.save(), { contentType: "application/pdf", upsert: true });
    if (error) throw new Error(`upload ${path}: ${error.message}`);
    updates.push(`update public.lessons set pdf_path = ${lit(path)}, pdf_page_count = ${p.pages.length} where id = ${lit(p.lessonId)};`);
  }
  await sqlAs(admin, updates.join("\n"));
}
