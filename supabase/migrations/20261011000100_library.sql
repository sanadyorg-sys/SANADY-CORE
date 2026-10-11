-- ════════════════════════════════════════════════════════════════════════════
-- SANADY · Bibliothèque pédagogique
--
-- Pedagogical resources for every active user (teachers, institution
-- administrators), managed by SANADY administrators. A resource is either a
-- file in the private « library » bucket or a link to an external official
-- page (e.g. the mallette pédagogique on sanady.org — linked, not copied).
-- Downloading a file is a per-resource decision (allow_download); viewing
-- uses short-lived signed URLs created under the user's RLS context.
-- ════════════════════════════════════════════════════════════════════════════

-- Accent folding for search (immutable, usable in a generated column). The
-- application folds the query the same way (NFD, marks removed).
create function private.fold_accents(p text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select translate(
    replace(replace(replace(replace(lower(coalesce(p, '')), 'œ', 'oe'), 'æ', 'ae'), 'Œ', 'oe'), 'Æ', 'ae'),
    'àâäáãåçéèêëíìîïñóòôöõúùûüýÿ',
    'aaaaaaceeeeiiiinooooouuuuyy'
  );
$$;

create table public.library_resources (
  id              uuid primary key default gen_random_uuid(),
  title           text not null check (char_length(btrim(title)) between 3 and 200),
  description     text not null default '' check (char_length(description) <= 4000),
  -- guide: guide pédagogique · support: support de formation · fiche: fiche
  -- d'activité / worksheet · reference: document de référence · externe:
  -- ressource externe officielle.
  kind            text not null check (kind in ('guide', 'support', 'fiche', 'reference', 'externe')),
  levels          text[] not null default '{}'
                  check (levels <@ array['prescolaire', 'primaire', 'college', 'lycee']::text[]),
  subject         text check (char_length(subject) <= 100),
  category_id     uuid references public.course_categories (id) on delete set null,
  course_id       uuid references public.courses (id) on delete set null,
  -- Either a stored file or an external URL.
  file_path       text check (char_length(file_path) <= 500),
  file_name       text check (char_length(file_name) <= 255),
  file_size       bigint check (file_size >= 0),
  mime_type       text check (char_length(mime_type) <= 150),
  page_count      integer check (page_count between 1 and 5000),
  external_url    text check (external_url ~ '^https://' and char_length(external_url) <= 1000),
  allow_download  boolean not null default true,
  source_label    text not null default 'Fondation Sanady' check (char_length(source_label) <= 200),
  published_year  text check (published_year ~ '^\d{4}(-\d{4})?$'),
  status          text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  search          tsvector generated always as (
                    setweight(to_tsvector('french', private.fold_accents(title)), 'A')
                    || setweight(to_tsvector('french', private.fold_accents(subject)), 'B')
                    || setweight(to_tsvector('french', private.fold_accents(description)), 'C')
                  ) stored,
  -- Never both; a published resource needs one of them (drafts may wait for their file).
  check (file_path is null or external_url is null),
  check (status <> 'published' or file_path is not null or external_url is not null),
  check (kind <> 'externe' or file_path is null)
);

create index library_resources_status_idx on public.library_resources (status, updated_at desc);
create index library_resources_search_idx on public.library_resources using gin (search);
create index library_resources_levels_idx on public.library_resources using gin (levels);

create trigger library_resources_updated_at
  before update on public.library_resources
  for each row execute function private.set_updated_at();

create trigger library_resources_audit
  after insert or update or delete on public.library_resources
  for each row execute function private.audit_row_change('title');

alter table public.library_resources enable row level security;

create policy library_resources_select on public.library_resources
  for select to authenticated
  using (
    private.is_sanady_admin()
    or (status = 'published' and private.is_active_user())
  );

create policy library_resources_admin_insert on public.library_resources
  for insert to authenticated
  with check (private.is_sanady_admin());

create policy library_resources_admin_update on public.library_resources
  for update to authenticated
  using (private.is_sanady_admin())
  with check (private.is_sanady_admin());

create policy library_resources_admin_delete on public.library_resources
  for delete to authenticated
  using (private.is_sanady_admin());

grant select, insert, update, delete on public.library_resources to authenticated;

-- ─── Storage: private bucket ───────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'library', 'library', false, 104857600,
  array['application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/png', 'image/jpeg', 'application/zip']
)
on conflict (id) do nothing;

-- A file is readable only through a published resource that references it.
create policy library_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'library'
    and (
      private.is_sanady_admin()
      or exists (
        select 1 from public.library_resources r
         where r.file_path = storage.objects.name
           and r.status = 'published'
           and private.is_active_user()
      )
    )
  );

create policy library_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'library' and private.is_sanady_admin());

create policy library_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'library' and private.is_sanady_admin())
  with check (bucket_id = 'library' and private.is_sanady_admin());

create policy library_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'library' and private.is_sanady_admin());

-- ─── Lesson PDFs: optional download (administrator decision) ────────────────
alter table public.lessons add column pdf_downloadable boolean not null default false;
comment on column public.lessons.pdf_downloadable is
  'When true, learners see a download button for the lesson PDF. Default: read in the integrated viewer only.';
