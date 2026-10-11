/**
 * Bibliothèque pédagogique: published resources are visible to active users
 * only, files are readable only through a published resource, and only
 * SANADY administrators manage the library.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, uid } from "./harness";

let db: TestDb;
let admin: string;
let teacher: string;
let published: string;
let draft: string;

beforeAll(async () => {
  db = await TestDb.create();
  admin = await db.createAdmin();
  teacher = await db.createUser(`lib.${uid()}@e.test`);
  const rows = await db.as(admin, (q) =>
    q<{ id: string }>(
      `insert into public.library_resources (title, description, kind, levels, subject, file_path, file_name, status)
       values ('Guide de l’évaluation formative', 'Techniques de vérification rapide en classe.', 'guide', '{primaire,college}', 'Français', 'guides/evaluation.pdf', 'evaluation.pdf', 'published'),
              ('Fiche brouillon', '', 'fiche', '{}', null, 'fiches/brouillon.pdf', 'brouillon.pdf', 'draft')
       returning id`,
    ),
  );
  [published, draft] = [rows[0]!.id, rows[1]!.id];
  await db.sql(
    `insert into storage.objects (bucket_id, name) values ('library', 'guides/evaluation.pdf'), ('library', 'fiches/brouillon.pdf')`,
  );
});
afterAll(async () => db?.close());

describe("library visibility", () => {
  it("shows published resources to active users, never drafts", async () => {
    const rows = await db.as(teacher, (q) => q<{ id: string }>(`select id from public.library_resources`));
    expect(rows.map((r) => r.id)).toEqual([published]);
    expect(draft).toBeTruthy();
  });

  it("hides the library from suspended users and from visitors", async () => {
    const suspended = await db.createUser(`susp.${uid()}@e.test`);
    await db.sql(`update public.profiles set status = 'suspended' where id = $1`, [suspended]);
    expect(await db.as(suspended, (q) => q(`select id from public.library_resources`))).toEqual([]);
    await expect(db.as(null, (q) => q(`select id from public.library_resources`), "anon")).rejects.toThrow(/permission denied/);
  });

  it("lets files be read only through a published resource", async () => {
    const files = await db.as(teacher, (q) => q<{ name: string }>(`select name from storage.objects where bucket_id = 'library'`));
    expect(files.map((f) => f.name)).toEqual(["guides/evaluation.pdf"]);
  });

  it("supports French full-text search, accent and plural insensitive", async () => {
    const rows = await db.as(teacher, (q) =>
      q<{ id: string }>(`select id from public.library_resources where search @@ websearch_to_tsquery('french', 'evaluations')`),
    );
    expect(rows.map((r) => r.id)).toEqual([published]);
  });
});

describe("library management", () => {
  it("is reserved to SANADY administrators", async () => {
    await expect(
      db.as(teacher, (q) => q(`insert into public.library_resources (title, kind, external_url) values ('Lien', 'externe', 'https://sanady.org/')`)),
    ).rejects.toThrow(/row-level security/);
    const updated = await db.as(teacher, (q) => q(`update public.library_resources set title = 'Piraté' where id = $1 returning id`, [published]));
    expect(updated).toEqual([]);
    await expect(
      db.as(teacher, (q) => q(`insert into storage.objects (bucket_id, name) values ('library', 'x.pdf')`)),
    ).rejects.toThrow(/row-level security/);
  });

  it("publishes only resources with a file or an https link (never both)", async () => {
    const insert = (values: string) =>
      db.as(admin, (q) => q(`insert into public.library_resources (title, kind, file_path, external_url, status) values ${values}`));
    await insert(`('Brouillon sans fichier', 'guide', null, null, 'draft')`);
    await expect(insert(`('Publié sans source', 'guide', null, null, 'published')`)).rejects.toThrow(/check/);
    await expect(insert(`('Les deux', 'guide', 'a.pdf', 'https://sanady.org/', 'draft')`)).rejects.toThrow(/check/);
    await expect(insert(`('Non sécurisé', 'externe', null, 'http://sanady.org/', 'draft')`)).rejects.toThrow(/check/);
    await expect(insert(`('Externe avec fichier', 'externe', 'a.pdf', null, 'draft')`)).rejects.toThrow(/check/);
    await insert(`('Mallette pédagogique', 'externe', null, 'https://sanady.org/mallette-pedagogique/', 'published')`);
  });
});
