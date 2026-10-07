# SANADY

**Plateforme de formation et de développement professionnel des enseignants.**

SANADY is an invitation-only, French-language learning platform for teachers and educational institutions. Teachers follow self-paced courses (video and PDF lessons), pass a mandatory quiz after each module (70 % minimum, 3 attempts), and receive a verifiable certificate on completion. Institutions follow the progress of their teachers in the courses they assign.

| | |
|---|---|
| Stack | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (PostgreSQL, Auth, Storage) |
| Security model | Row Level Security on every table · business rules in transactional SQL functions · no client-side authorization |
| Tests | 58 database scenario tests on the real migrations · 17 unit tests · 75 end-to-end checks (3 viewports, WCAG 2.2 AA scans) |

## Quick start

Prerequisites: Node.js ≥ 20.9, a Supabase project (or the Supabase CLI with Docker for a local stack).

```bash
npm install
cp .env.example .env.local          # fill in the Supabase URL and keys
npx supabase link --project-ref <ref>
npx supabase db push                # applies supabase/migrations
npm run admin:create -- --email vous@exemple.ma --first Prénom --last Nom
npm run dev
```

The `admin:create` command prints a one-time link for the first administrator to choose a password. From there, everything else (institutions, teachers, courses) is done in the application.

Full production setup: [docs/deployment.md](docs/deployment.md).

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run typecheck` | Route type generation + TypeScript |
| `npm run lint` | ESLint (Next.js + React hooks rules) |
| `npm test` | Unit tests and database tests (real migrations in PGlite, no Docker needed) |
| `npm run test:e2e` | Playwright: public pages, access control, responsive layout, accessibility |
| `npm run admin:create` | Bootstrap a SANADY administrator |
| `npm run db:types` | Generate Supabase types for a linked project |

## Project structure

```
supabase/
  migrations/        Schema, RLS policies, business functions, storage (source of truth)
  templates/         Auth e-mail templates (French)
  config.toml        Local Supabase configuration (sign-up disabled)
src/
  app/
    (public)/        Sign-in, password recovery, invitation, enrollment code, certificate verification
    espace/          Teacher area: dashboard, courses, player, assessments, certificates, profile
    etablissement/   Institution area: dashboard, teachers, codes, assignments, tracking, reports
    admin/           SANADY administration: courses editor, institutions, people, supervision, audit
    api/             PDF routes (certificates, individual reports)
  components/
    ui/              Design system primitives (buttons, fields, tables, dialogs, feedback…)
    learning/        Course player, video player, PDF reader, quiz runner, curriculum
    admin/ institution/ tracking/ common/ layout/ auth/ profile/
  lib/               Formatting, validation, error mapping, PDF rendering, Supabase clients
  server/            Server-only code: auth guards, queries, server actions, e-mail, media signing
tests/
  db/                Scenario tests against the real migrations (PGlite + Supabase shim)
  unit/              Helpers and PDF output (parsed back with pdf.js)
  e2e/               Playwright suites
docs/                Architecture, database, security, design system, deployment, testing
```

## Documentation

- [Architecture](docs/architecture.md) — layers, request flow, key decisions
- [Database](docs/database.md) — entities, rules, functions, RLS model
- [Security and privacy](docs/security-and-privacy.md) — threat model, controls, Law 09-08 checklist
- [Design system](docs/design-system.md) — tokens, components, placeholder brand
- [Deployment](docs/deployment.md) — Supabase, Vercel, e-mail, video, backups
- [Testing](docs/testing.md) — what is tested, how, and what is not

## External dependencies and open items

These are **not** fabricated or simulated in the code; each is explicitly handled:

| Item | Status |
|---|---|
| Official SANADY logo | **Not supplied.** A typographic placeholder and placeholder colours (#123653, #287F78) are used and flagged in `globals.css`, `wordmark.tsx` and `lib/pdf/common.ts`. |
| E-mail delivery (Resend) | Optional. Without `RESEND_API_KEY`, invitations are created and the link is shown to the administrator, clearly labelled; self-service join by code is disabled. |
| Adaptive video (Mux) | Optional. Without Mux keys, videos are served from private Supabase Storage via short-lived signed URLs (progressive MP4). |
| Legal review | The privacy notice must be validated by the data controller (identity, CNDP formalities, retention) before production. |
