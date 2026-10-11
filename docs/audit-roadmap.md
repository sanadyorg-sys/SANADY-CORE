# Audit and roadmap — against `PLAN/direction-site.md`

Audit date: 9 October 2026 · Platform version 0.7 (live at https://sanady-core.vercel.app)
Institutional facts: see [institution/reference-sanady.md](institution/reference-sanady.md).

Legend: ✅ done and tested · 🟡 partial · ❌ missing

## 1. Phase-by-phase comparison

| Phase | Requirement | Status | What exists / what is missing |
|---|---|---|---|
| 1 | Institutional research, reference file | ✅ | `docs/institution/reference-sanady.md` with source, date, status per fact. The official site is dated 2018 and incomplete (values, partners, team, figures): 6 items to obtain from the Foundation. |
| 2 | Identity and design system | ✅ | Official logo untouched, orange #F95A05 confirmed, tokens (colour, type, spacing, radius, shadow), reusable components, WCAG 2.2 AA checks on public pages. |
| 3.1 | Foundation presentation (verified) | 🟡 | `/a-propos` now uses verified status, mission, vision with source. Missing: values, history milestones, governance block, contact block. |
| 3.2 | Programs in 3 groups (Apprentissage / Avenir / Éveil) | ✅ | `/a-propos#programmes`, verified content from `src/lib/institution.ts`, links to sanady.org. |
| 3.3 | Institutional resources (publications, reports, links) | ✅ | `/ressources`: mallette, annual reports, brochure, official links — linked (not copied), with year and source. |
| 4 | Roles: admin, training manager, trainer, institutional supervisor, teacher | ✅ | SANADY admin and training manager (2FA mandatory), trainer (assigned courses only, draft only, cannot publish), institution admin, institution supervisor (read-only), teacher — enforced in RLS and functions (`tests/db/roles.test.ts`), role-aware menus and guards. |
| 5 | Invitation-only, codes, institutions by admins | ✅ | Invitations (hashed, expiring, single-use), enrollment codes (expiry, limits), duplicate protection, consent; plus public access requests approved by admins. |
| 6 | Catalog: fields per course | 🟡 | Title, description, category, objectives, audience, duration, modules, lessons, resources, assessments, completion rules, certificate — ✅. **Missing: trainer information.** Categories are configurable; the suggested categories (Pédagogie, Didactique, Évaluation, Développement professionnel) are not seeded. |
| 7 | Course structure and player | ✅ | Formation → modules → lessons → quiz → certificate; player with navigation, progress, resume, previous/next, objectives; responsive. |
| 8 | Video and PDF infrastructure | ✅ | Private storage, signed URLs, resume, progress; optional Mux (adaptive, signed). PDF viewer with pages and zoom. Download of lesson PDFs and library files is an administrator choice per document. |
| 9 | Quizzes | ✅ | 70 % / 3 attempts enforced on the server, grading, explanations, attempt history, no answers before submission; single, multiple and true/false questions; optional shuffled questions and answers (fixed per attempt). |
| 10 | Certificates | ✅ | Automatic PDF, logo, unique number, QR verification, revocation with audit. Signatory fields exist in settings — **need the official signatory from the Foundation** (never invented). |
| 11 | Bibliothèque pédagogique | ✅ | `/espace/bibliotheque` for all active users: search (French, accent-insensitive), filters by level, subject, theme, type and course, PDF/image preview, download only when allowed. Admin management in `/admin/bibliotheque`. Mallette pédagogique listed as a link to sanady.org. |
| 12 | Teacher dashboard | ✅ | Answers the three questions: **next step** per course following the course rules (next lesson, quiz unlocked, or blocked after 3 attempts with guidance), institution **due dates** (overdue / within 7 days), overall progress, courses in progress, latest quiz results, certificates, learning history, library highlights (resources linked to the teacher's courses first). |
| 13 | Institutional supervision | ✅ | Teachers, assignments, progress, results, certificates, "needs support" and inactivity, individual PDF report; **Statistiques** page with period filter, weekly charts, per-course table and CSV exports (teachers, courses) — assigned courses only. |
| 14 | Admin analytics and exports | ✅ | `/admin/rapports`: period filter (presets or dates), key indicators, weekly activity and completion charts, reports per course, institution and assessment, CSV exports (courses, institutions, assessments, certificates). Real data only; empty states when there is none. |
| 15 | Authoring and publishing | ✅ | Draft → **in review** (submitted by a trainer, content locked) → **approved and published** by a training manager or admin, or sent back to draft with a comment; completeness checked before submission and publication; history preserved. Trainers shown on public course pages. |
| 16 | Database and security | ✅ | RLS on every table, server-only business rules, audit log, rate limiting, CSP, admin 2FA, 70 database tests. |
| 17 | Performance and scale (≈ 5 000 teachers) | 🟡 | Indexed queries, pagination, lazy media, server in Dublin next to the database. Retention job (pg_cron), `npm run db:backup`, cost estimate in `docs/operations.md`. **Still needed: Supabase Pro (automatic backups), uptime monitor, e-mail sender.** |
| 18 | Accessibility | ✅ | Keyboard, focus, labels, contrast; automated axe checks on desktop, tablet, mobile. Signed-in screens: manual review recommended. |
| 19 | QA | ✅ | 207 automated tests + live end-to-end checks with demo accounts. |
| 20 | Documentation | 🟡 | Architecture, database, security, design system, deployment, testing, project document. **Missing: role-permission matrix, backup and recovery, costs, decision log in docs, presentation for management.** |

## 2. Defects and risks found

1. **Unverified claims on the public pages** (fixed in this audit): invented mission text, "conçus par des spécialistes", "certificat reconnu", review delay promise.
2. **No backups and project pause after 7 days of inactivity** (Supabase free plan) — risk of data loss; Supabase Pro needed before real data.
3. **E-mails not configured** — invitations must be sent by hand; access requests cannot be answered automatically.
4. **Access requests have no automatic purge** although the notice promises 12 months maximum — needs a scheduled job.
5. Public site is set to `noindex` until launch (intentional).

## 3. Roadmap (prioritized)

| Step | Content | Size | Depends on |
|---|---|---|---|
| A | **Institutional content** — À propos completed (programs in 3 groups, governance, contact), « Ressources institutionnelles » page with linked publications (source, year). | S | — |
| B | **Bibliothèque pédagogique** — resources table + RLS, admin management, teacher library with search, filters, preview, controlled download; per-document download permission (also for lesson PDFs). | L | Decision on mallette rights |
| C | **Roles** — training manager, trainer (edits assigned courses only), institutional supervisor (read-only); "in review" status and SANADY approval; trainer shown on course pages. | L | Decision 1 below |
| D | **Assessment options** — true/false questions, random question order per quiz. | S | — |
| E | **Analytics and exports** — trends, course/institution/assessment/certification reports, CSV exports, date filters for supervisors, simple accessible charts. | M | — |
| F | **Teacher dashboard** — "next step", due dates, resources block. | S | B |
| G | **Operations** — e-mail (Resend), backups (Supabase Pro), error monitoring, access-request purge job, cost estimate. | S | Foundation accounts |
| H | **Documentation** — role matrix, backup/recovery, costs, decision log, management presentation (French). | M | C, G |

Recommended order: **A → D → B → E → F → C → G → H** (C after B/E because it changes permissions everywhere; G as soon as accounts are available).

## 4. Decisions needed

1. **Roles:** create the four roles as described (training manager, trainer, supervisor), or start with trainer + supervisor only?
2. **Mallette pédagogique and reports:** link to sanady.org only, or does the Foundation authorize hosting the files in the library?
3. **Official facts:** who at the Foundation validates the reference file (values, figures, partners, signatory)?
