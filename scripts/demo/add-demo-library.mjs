#!/usr/bin/env node
/**
 * Fills the Bibliothèque pédagogique.
 *
 *   npm run demo:library
 *
 * 1. Official resource (kept by demo:remove): the Fondation Sanady
 *    « mallette pédagogique », as a LINK to sanady.org (not copied).
 * 2. Demonstration documents (source « Démonstration SANADY », removed by
 *    demo:remove): short pedagogical PDFs generated here.
 * Safe to re-run: resources that already exist (same title) are skipped.
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

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
const lit = (v) => (v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const arr = (a) => `array[${a.map(lit).join(",")}]::text[]`;

export const DEMO_SOURCE = "Démonstration SANADY";

async function documentPdf(title, kindLabel, pages) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const orange = rgb(0xf9 / 255, 0x5a / 255, 0x05 / 255);
  const ink = rgb(0.16, 0.15, 0.13);
  const muted = rgb(0.43, 0.41, 0.38);
  const wrap = (text, f, size, width) => {
    const lines = [];
    let line = "";
    for (const w of text.split(/\s+/)) {
      const t = line ? `${line} ${w}` : w;
      if (f.widthOfTextAtSize(t, size) > width && line) {
        lines.push(line);
        line = w;
      } else line = t;
    }
    if (line) lines.push(line);
    return lines;
  };
  pages.forEach(([heading, ...items], i) => {
    const page = pdf.addPage([595.28, 841.89]);
    page.drawRectangle({ x: 0, y: 835, width: 595.28, height: 6.89, color: orange });
    page.drawText(`Bibliothèque pédagogique · ${kindLabel} · document de démonstration`, { x: 56, y: 800, size: 9, font, color: muted });
    page.drawText(title, { x: 56, y: 760, size: 19, font: bold, color: ink });
    let y = 712;
    page.drawText(heading, { x: 56, y, size: 14, font: bold, color: orange });
    y -= 30;
    for (const item of items) {
      const bullet = item.startsWith("• ");
      for (const [li, l] of wrap(bullet ? item.slice(2) : item, font, 12, bullet ? 465 : 483).entries()) {
        if (bullet && li === 0) page.drawText("•", { x: 58, y, size: 12, font: bold, color: orange });
        page.drawText(l, { x: bullet ? 74 : 56, y, size: 12, font, color: ink });
        y -= 19;
      }
      y -= bullet ? 6 : 12;
    }
    page.drawText(`Page ${i + 1} / ${pages.length}`, { x: 56, y: 40, size: 9, font, color: muted });
  });
  return pdf.save();
}

const DOCUMENTS = [
  {
    title: "Grille d’observation d’une séance",
    kind: "fiche",
    kindLabel: "Fiche d’activité",
    description: "Une grille simple pour observer une séance (la sienne ou celle d’un pair) : clarté des objectifs, participation des élèves, vérifications de la compréhension, rétroaction.",
    levels: ["primaire", "college", "lycee"],
    subject: "Toutes matières",
    category: "Pédagogie et didactique",
    course: null,
    allowDownload: true,
    pages: [
      ["Avant la séance", "Notez l’objectif annoncé et les critères de réussite affichés. Choisissez deux ou trois points d’observation seulement : une grille trop longue empêche de bien observer.", "• L’objectif est-il formulé en termes de ce que l’élève saura faire ?", "• Les critères de réussite sont-ils visibles et compréhensibles par les élèves ?"],
      ["Pendant la séance", "• Combien d’élèves différents prennent la parole ? Relevez-le toutes les dix minutes.", "• Quelles techniques permettent de recueillir la réponse de tous (ardoises, cartes, billet de sortie) ?", "• Comment l’enseignant réagit-il aux erreurs : correction immédiate, question de relance, retour vers les critères ?", "• Quelle part du temps les élèves passent-ils réellement en activité ?"],
      ["Après la séance", "Échangez à partir des faits observés, sans jugement. Terminez par une seule piste d’amélioration concrète, à essayer lors de la prochaine séance.", "• Ce qui a bien fonctionné, et pourquoi.", "• Une piste à essayer, et comment saura-t-on qu’elle a fonctionné."],
    ],
  },
  {
    title: "Le billet de sortie : mode d’emploi",
    kind: "guide",
    kindLabel: "Guide pédagogique",
    description: "Comment utiliser le billet de sortie pour vérifier en trois minutes ce que chaque élève a retenu, et ajuster la séance suivante.",
    levels: ["primaire", "college", "lycee"],
    subject: "Toutes matières",
    category: "Pédagogie et didactique",
    course: "Évaluation formative en classe",
    allowDownload: true,
    pages: [
      ["Le principe", "À la fin de la séance, chaque élève répond par écrit, en quelques lignes, à une ou deux questions liées à l’objectif du jour. L’enseignant lit les réponses avant la séance suivante.", "Le billet n’est pas noté : il sert à décider de ce qu’il faut reprendre, avec qui et comment."],
      ["Exemples de questions", "• Explique avec tes mots ce que tu as appris aujourd’hui.", "• Résous cet exercice court (même type que l’objectif du jour).", "• Qu’est-ce qui est encore difficile pour toi ?", "Triez ensuite les billets en trois tas : acquis, presque acquis, à reprendre. Cela suffit pour organiser des groupes de besoin."],
    ],
  },
  {
    title: "Support de formation : donner une rétroaction efficace",
    kind: "support",
    kindLabel: "Support de formation",
    description: "Support de présentation à utiliser en atelier : les caractéristiques d’une rétroaction utile et des exemples à analyser. Consultation en ligne uniquement.",
    levels: ["primaire", "college", "lycee"],
    subject: "Toutes matières",
    category: "Pédagogie et didactique",
    course: "Évaluation formative en classe",
    allowDownload: false,
    pages: [
      ["Une rétroaction utile est…", "• Précise : elle porte sur la tâche et les critères, pas sur la personne.", "• Rapide : elle arrive pendant que l’élève peut encore agir.", "• Orientée vers l’action : elle dit ce qu’il faut faire maintenant.", "• Suivie d’un nouvel essai : sans occasion de réessayer, elle reste sans effet."],
      ["Exemples à analyser en atelier", "« Bien ! » — encourageant, mais ne dit pas ce qui est réussi.", "« Ta conclusion répond à la question ; ajoute un exemple tiré du texte pour la justifier. » — précise et orientée vers l’action.", "Consigne d’atelier : réécrivez trois commentaires issus de vos propres copies selon ces critères."],
    ],
  },
  {
    title: "Règles et routines : construire l’affiche de classe",
    kind: "fiche",
    kindLabel: "Fiche d’activité",
    description: "Une activité de début d’année pour construire avec les élèves trois à cinq règles positives et les routines qui les accompagnent.",
    levels: ["primaire", "college"],
    subject: "Vie de classe",
    category: "Gestion de classe",
    course: "Gestion de classe bienveillante",
    allowDownload: true,
    pages: [
      ["Déroulement (45 minutes)", "• Les élèves décrivent, par petits groupes, une classe où il fait bon apprendre.", "• Mise en commun : on regroupe les idées en trois à cinq règles, formulées positivement (« Nous levons la main pour parler »).", "• Pour chaque règle, on décide d’une routine concrète et on l’entraîne une première fois.", "• L’affiche est signée par tous et revue après un mois."],
    ],
  },
];

const storage = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }).storage;
const existing = new Set((await sql(`select title from public.library_resources`)).map((r) => r.title));
const [admin] = await sql(`select user_id from public.platform_roles order by granted_at limit 1`);

// 1. Official resource: linked, never copied.
const MALLETTE = "Mallette pédagogique de la Fondation Sanady";
if (!existing.has(MALLETTE)) {
  await sql(`insert into public.library_resources (title, description, kind, levels, subject, external_url, source_label, status, created_by)
    values (${lit(MALLETTE)},
            ${lit("Boîte à outils pédagogiques et didactiques conçue par une équipe pluridisciplinaire de la Fondation : ressources, outils et supports pour le primaire (français, mathématiques) et le collège (français, mathématiques, physique-chimie). Mise en libre accès par la Fondation ; consultez sa fiche descriptive avant utilisation.")},
            'externe', ${arr(["primaire", "college"])}, 'Français, mathématiques, physique-chimie',
            'https://sanady.org/mallette-pedagogique/', 'Fondation Sanady — sanady.org', 'published', ${lit(admin?.user_id)})`);
  console.log(`✓ ${MALLETTE} (lien vers sanady.org)`);
}

// 2. Demonstration documents.
for (const doc of DOCUMENTS) {
  if (existing.has(doc.title)) {
    console.log(`• ${doc.title}: already present, skipped`);
    continue;
  }
  const id = randomUUID();
  const fileName = `${doc.title.normalize("NFD").replace(/\p{M}/gu, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase()}.pdf`;
  const path = `${id}/${fileName}`;
  const bytes = await documentPdf(doc.title, doc.kindLabel, doc.pages);
  const { error } = await storage.from("library").upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (error) throw new Error(`upload ${path}: ${error.message}`);
  await sql(`insert into public.library_resources
      (id, title, description, kind, levels, subject, category_id, course_id, file_path, file_name, file_size, mime_type, page_count,
       allow_download, source_label, published_year, status, created_by)
    values (${lit(id)}, ${lit(doc.title)}, ${lit(doc.description)}, ${lit(doc.kind)}, ${arr(doc.levels)}, ${lit(doc.subject)},
            (select id from public.course_categories where name = ${lit(doc.category)}),
            ${doc.course ? `(select id from public.courses where title = ${lit(doc.course)} limit 1)` : "null"},
            ${lit(path)}, ${lit(fileName)}, ${bytes.length}, 'application/pdf', ${doc.pages.length},
            ${doc.allowDownload}, ${lit(DEMO_SOURCE)}, '2026', 'published', ${lit(admin?.user_id)})`);
  console.log(`✓ ${doc.title}${doc.allowDownload ? "" : " (lecture seule)"}`);
}
