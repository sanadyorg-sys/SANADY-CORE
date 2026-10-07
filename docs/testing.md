# Testing

| Suite | Command | Runs where | Count |
|---|---|---|---|
| Database scenarios | `npm run test:db` | PGlite (in-process PostgreSQL 18) with the real migrations | 58 |
| Unit | `npm run test:unit` | Node | 17 |
| End-to-end, public | `npm run test:e2e` | Production build, Chromium, 3 viewports | 75 |
| End-to-end, journeys | `npm run test:e2e` with `E2E_*` set | Real Supabase project | 3 (skipped otherwise) |

## How the database tests work

`tests/db/harness.ts` boots PGlite, applies `tests/db/supabase-shim.sql` (roles `anon`/`authenticated`/`service_role`, `auth.uid()` from the JWT claim, minimal `auth.users` and `storage` schemas) and then **every migration file unchanged**. Tests act as specific users through the same role and claim mechanism as Supabase, so RLS, column grants, triggers and functions are exercised exactly as in production. The shim grants no default privileges: the migrations must grant everything themselves.

## Required scenarios (brief, part 16)

| # | Scenario | Where |
|---|---|---|
| 1 | Secure invitation acceptance | `tests/db/identity.test.ts` — single use, hash only, e-mail match, not callable by clients, audit |
| 2 | Expired invitation rejection | `identity.test.ts` |
| 3 | Institution creation | `identity.test.ts` — admin only, identifier validation, admin onboarding |
| 4 | Institutional enrollment | `identity.test.ts` — invitation with consent, codes (consent, limit, expiry, revocation), code-bound e-mail verification, leaving |
| 5 | Unauthorized course access prevention | `tests/db/access.test.ts` — no permission, membership without assignment, revocations, unpublishing, answers hidden, no direct writes, storage |
| 6 | Course creation and publication | `access.test.ts` — admin only, validation blocks publication, question rules, archiving, reordering |
| 7 | Video progress persistence | `tests/db/learning.test.ts` — resume across sessions, no double counting, plausibility, 90 % completion, checkpoints once |
| 8 | PDF progress persistence | `learning.test.ts` — opening ≠ completion, resume page, completion |
| 9 | Quiz grading | `learning.test.ts` — server grading, no correctness before submission, partial multi-select, exact 70 %, weighting, foreign options ignored, lock until lessons done |
| 10 | Three-attempt enforcement | `learning.test.ts` — refresh resumes, replay refused, exhaustion, DB-level uniqueness, audited reset |
| 11 | Course completion validation | `learning.test.ts` |
| 12 | Automatic certificate generation | `learning.test.ts` + `tests/unit/pdf.test.ts` (PDF content parsed back) |
| 13 | Duplicate certificate prevention | `learning.test.ts` |
| 14 | Institutional data isolation | `access.test.ts` — cross-institution, personal courses hidden, visibility ends on leaving, teachers isolated |
| 15 | Individual progress report generation | `tests/unit/pdf.test.ts` — content, pagination, empty case |
| 16 | Responsive interface behaviour | `tests/e2e/public.spec.ts` — desktop/tablet/mobile, no horizontal scroll, layout switches, touch targets, axe WCAG 2.2 AA |

A mutation check was performed during development (the 70 % comparison was deliberately broken; the suite failed as expected).

## What is NOT covered automatically

Stated plainly so nobody assumes otherwise:

- Authenticated pages were **not** exercised end-to-end in this environment (no Supabase project was connected). Their data access is covered by the database tests and the code is type-checked, linted and built; `tests/e2e/journey.spec.ts` covers the main journeys once `E2E_*` variables point to a seeded environment.
- Real e-mail delivery (Resend), Mux playback, and large resumable uploads require the external services.
- Screen-reader testing (NVDA, VoiceOver) and manual keyboard audits of the authenticated areas should be done before launch.
- Load testing was not performed.

## Running journeys against a real environment

```bash
E2E_BASE_URL=https://staging.example.org \
E2E_TEACHER_EMAIL=… E2E_TEACHER_PASSWORD=… \
E2E_ADMIN_EMAIL=… E2E_ADMIN_PASSWORD=… \
npm run test:e2e
```
The teacher account must have at least one assigned, published course.
