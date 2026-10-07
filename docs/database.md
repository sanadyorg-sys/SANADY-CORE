# Database

PostgreSQL on Supabase. The migrations in `supabase/migrations` are the single source of truth; they are applied in filename order.

| Migration | Content |
|---|---|
| `…0100_foundation` | Profiles, platform roles, typed settings singleton, append-only audit log, rate limits, identity helpers |
| `…0200_institutions` | Institutions, memberships, invitations (token hashes only), enrollment codes |
| `…0300_courses` | Categories, courses, modules, lessons, resources, quizzes, questions, options, permissions, assignments, enrollments, access helpers |
| `…0400_learning` | Lesson / video / document progress, quiz attempts and answers, certificates, learning events |
| `…0500_functions` | All business functions (RPC) |
| `…0600_security` | RLS policies and explicit grants |
| `…0700_storage` | Buckets and storage policies |

## Entities

```
profiles ─┬─ platform_roles
          ├─ institution_memberships ── institutions ── enrollment_codes
          ├─ invitations (kind, e-mail, token hash, expiry, acceptance, revocation)
          ├─ course_permissions (institution XOR user) ── courses
          ├─ course_assignments (institution → teacher, course)
          ├─ enrollments (one per user and course)
          ├─ lesson_progress / video_progress / document_progress
          ├─ quiz_attempts ── quiz_answers
          ├─ certificates (one per user and course)
          └─ learning_events
courses ── modules ── lessons ── lesson_resources
                  └── quizzes (one per module) ── questions ── question_options
audit_logs (append-only, written by triggers and functions)
```

Key separations:

- **Membership ≠ enrollment.** Joining an institution grants nothing by itself.
- **Permission ≠ assignment.** SANADY authorizes a course for an institution; the institution assigns it to teachers.
- **Lesson completion ≠ assessment ≠ certification.** Three tables, three measures.

## Integrity guarantees (database level)

| Rule | Mechanism |
|---|---|
| One open invitation per person and scope | partial unique index |
| Invitation single use | row lock + `accepted_at` check in `accept_invitation` |
| Enrollment code limit | row lock + `uses_count <= max_uses` check constraint |
| One permission per grantee | partial unique indexes (active rows) |
| One enrollment, one certificate per user and course | `UNIQUE (user_id, course_id)` |
| One open attempt; unique attempt numbers | partial unique indexes on `quiz_attempts` |
| No double submission | `SELECT … FOR UPDATE` + status check |
| Publication only when complete | `BEFORE UPDATE` trigger calling `validate_course` |
| Learner data never silently deleted | `ON DELETE RESTRICT` + `remove_*` functions that archive |
| Lesson/quiz `course_id` consistent with module | `BEFORE INSERT/UPDATE` triggers |

## Business functions

All are `SECURITY DEFINER`, pin `search_path = ''`, and raise stable error codes (`P0001`, e.g. `attempts_exhausted`) mapped to French messages in `src/lib/errors.ts`.

| Group | Functions |
|---|---|
| Accounts | `complete_onboarding`, `set_user_status` |
| Invitations | `create_invitation`, `revoke_invitation`, `mark_invitation_sent`¹, `describe_invitation`¹, `accept_invitation`¹ |
| Codes | `create_enrollment_code`, `revoke_enrollment_code`, `redeem_enrollment_code`, `describe_enrollment_code`¹, `create_code_invitation`¹ |
| Memberships | `revoke_membership`, `leave_institution` |
| Authoring | `validate_course`, `save_question`, `reorder_modules/lessons/questions`, `remove_module/lesson/question` |
| Authorization | `grant/revoke_course_to(_from)_institution`, `grant/revoke_course_to(_from)_user`, `assign_course`, `unassign_course` |
| Learning | `start_lesson`, `record_video_progress`, `record_document_progress`, `refresh_course_completion` |
| Assessment | `quiz_status`, `start_quiz_attempt`, `submit_quiz_attempt`, `get_attempt_result`, `reset_quiz_attempts` |
| Certificates | `verify_certificate`², `revoke_certificate` |
| Reporting | `course_progress`, `learner_courses`, `institution_overview`, `institution_teacher_summaries`, `platform_overview`, `exhausted_attempts` |
| Misc | `consume_rate_limit`¹, `public_platform_info`² |

¹ service role only · ² also callable anonymously

## Row Level Security model

- `anon` has **no table privileges**. Only `verify_certificate` and `public_platform_info` are executable.
- `authenticated` gets explicit `SELECT` on tables, filtered by policies; write privileges exist only for content authoring (SANADY admins, checked by policy), categories, settings, and the user's own personal profile columns (column-level grant).
- `questions` and `question_options` are readable by SANADY administrators only. Learners receive questions through `start_quiz_attempt`, which omits correctness.
- `invitations.token_hash` is excluded by a column-level grant.
- Learner records (`enrollments`, progress tables, attempts, answers, certificates, events) are visible to: the learner; SANADY administrators; and an institution administrator **only** for courses that institution assigned to an active, consenting member (`private.can_view_learner_course`).

Policy helpers live in the `private` schema (not exposed by the Data API).

## Storage

| Bucket | Visibility | Path | Read rule |
|---|---|---|---|
| `course-media` | private | `{course_id}/{lesson_id}/{file}` | admin, or `has_course_access(course_id)` |
| `course-covers` | public | `{course_id}/{file}` | public (non-sensitive) |

Signed URLs are created **with the user's session**, so storage RLS applies even when a path is known.

## Evolving the schema

1. Add a new migration file (`YYYYMMDDHHMMSS_description.sql`); never edit an applied migration.
2. Run `npm test` — the database suite applies all migrations from scratch.
3. Apply with `npx supabase db push` (staging first).
4. Update `src/lib/types.ts` (or run `npm run db:types` against a linked project to cross-check).
