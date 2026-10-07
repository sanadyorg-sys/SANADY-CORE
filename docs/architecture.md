# Architecture

## Overview

```
Browser ──► Next.js (Vercel or Node) ──► Supabase
             │  proxy.ts: session refresh, redirect anonymous users
             │  Server Components: read data with the user's session (RLS applies)
             │  Server Actions: validate input (zod) → call RLS-protected tables or SQL functions
             │  Route handlers: PDF generation (certificates, reports)
             └─ service role used ONLY for: invitation acceptance, account creation,
                rate limiting, PDF page counting, bans on suspension
```

Three principles drive the design:

1. **The database is the authority.** Every table has Row Level Security. Every rule that matters (who can see what, attempt limits, grading, completion, certificate issuance, invitation validity) is enforced in PostgreSQL. The UI only reflects these rules; bypassing the UI (direct API calls, crafted URLs) changes nothing.
2. **Learners never write learning records directly.** Progress, attempts, answers and certificates have no INSERT/UPDATE privilege for clients. All writes go through `SECURITY DEFINER` functions that check access, validate plausibility and run transactionally.
3. **Three separate measures.** Lesson completion, assessment results and certification are stored and displayed separately, never merged into a single misleading score.

## Layers

| Layer | Location | Responsibility |
|---|---|---|
| Schema & rules | `supabase/migrations` | Tables, constraints, RLS, business functions, audit triggers, storage policies |
| Server access | `src/lib/supabase/*` | `server.ts` (user session, RLS), `admin.ts` (service role, server-only), `browser.ts` |
| Identity | `src/server/auth.ts` | `getViewer()` from a verified JWT (`getClaims`), role guards per area |
| Queries | `src/server/queries/*` | Typed read models for pages |
| Mutations | `src/server/actions/*` | Server Actions: zod validation → RPC or table write → revalidation |
| UI | `src/components/*`, `src/app/*` | Design system and pages |

## Areas and roles

| Area | Route | Guard | Who |
|---|---|---|---|
| Public | `/connexion`, `/invitation/[token]`, `/rejoindre`, `/verifier`, `/confidentialite` | none | everyone |
| Teacher | `/espace/*` | `requireViewer()` + onboarding | any active account |
| Institution | `/etablissement/[id]/*` | `requireInstitutionAdmin(id)` | institution administrators |
| Administration | `/admin/*` | `requireSanadyAdmin()` | SANADY administrators |

A person has **one personal account**. Roles are additive: an institution administrator can also learn in `/espace`; the shell's workspace switcher lists every context available to the viewer.

## Key flows

**Invitation.** An administrator creates an invitation; the server generates a 256-bit token and stores only its SHA-256 hash. The e-mail contains the raw token. On acceptance the server re-validates the invitation, creates the account (e-mail ownership is proven by possession of the token), calls `accept_invitation` (single-use, row-locked), and signs the user in. If any step fails, the created account is deleted.

**Enrollment code.** A signed-in teacher redeems a code directly (`redeem_enrollment_code`, with explicit consent). A person without an account receives an e-mail invitation bound to the code, so ownership of the address is verified before any account exists. Codes only create membership; they never grant course access.

**Course access.** `private.has_course_access(course, user)` is true when the course is published, the account is active and the user has either an individual permission, or an active assignment from an active institution that is itself authorized for the course. Revoking any link in this chain removes access immediately.

**Learning progress.** The video player records 1 % buckets crossed during continuous playback; the server merges them as a set (replays add nothing) and bounds the number of new buckets accepted per call by elapsed time. The PDF reader records pages displayed for 3 seconds; opening a document completes nothing.

**Assessment.** `start_quiz_attempt` returns the questions without correctness data and resumes the open attempt on refresh. `submit_quiz_attempt` locks the attempt row, grades on the server, and records answers. The 3-attempt limit is enforced by the function and by partial unique indexes. Administrators can reset attempts with a mandatory, audited reason.

**Certification.** `evaluate_course_completion` runs after each lesson completion and each passed quiz. When all mandatory lessons are complete and every module quiz is passed, it marks the enrollment complete and issues one certificate (`UNIQUE (user_id, course_id)`), snapshotting the name, title and duration. PDFs are generated on demand; public verification reveals only what authenticity requires.

## Decisions

| Decision | Rationale |
|---|---|
| Next.js App Router + Server Actions | One deployable unit; server-side data access with the user's session; no public REST layer to secure separately. |
| Business rules in SQL functions | Transactional consistency (attempts, certificates), one enforcement point for every client, testable without the UI. |
| PGlite for database tests | Runs the real migrations and RLS in-process, without Docker; tests are fast and run in CI. |
| Hand-written domain types | The Supabase CLI type generator needs a running database; `npm run db:types` is provided for linked projects. |
| Up/down reordering instead of drag-and-drop | Fully keyboard- and screen-reader-accessible; no extra dependency. |
| pdf-lib with standard fonts | Small, dependency-light, deterministic output. WinAnsi encoding covers French; other scripts are transliterated (see security doc). |
| Single-page PDF reader | Makes "page consulted" unambiguous and keeps memory low on mobile devices. |
| Correct answers revealed only after passing | Keeps later attempts meaningful; explanations are shown after every submission. |
| Quiz unlocked after the module's mandatory lessons | Matches "quiz after each module" and the pedagogical sequence. |

## Changing published courses

- Adding content is immediate.
- Removing a lesson, module or question that already holds learner data **archives** it (hidden, history preserved) instead of deleting it.
- Certificates snapshot the course title and duration, so later edits never alter an issued certificate.
- Unpublishing suspends learner access without losing progress.
