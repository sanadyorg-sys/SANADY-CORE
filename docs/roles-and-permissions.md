# Roles and permissions

Every rule below is enforced **in the database** (row-level security and checks inside each function), not only by hiding buttons. The tests in `tests/db/` (notably `access.test.ts`, `roles.test.ts`, `mfa.test.ts`, `public-site.test.ts`, `library.test.ts`, `reports.test.ts`) exercise each boundary.

## Roles

| Role | Where it is held | How it is obtained | Two-step login |
|---|---|---|---|
| **Administrateur SANADY** | `platform_roles.role = sanady_admin` | Invitation by an administrator | **Mandatory** (privileges refused without it) |
| **Responsable pédagogique** | `platform_roles.role = training_manager` | Granted by an administrator (Équipe SANADY) on an existing account | **Mandatory** |
| **Formateur** | `platform_roles.role = trainer` + `course_trainers` | Granted by an administrator; courses assigned by an administrator or responsable | Optional |
| **Administrateur d’établissement** | `institution_memberships.role = admin` | Invitation by a SANADY administrator | Optional |
| **Superviseur d’établissement** | `institution_memberships.role = supervisor` | Invitation by the institution or a SANADY administrator | Optional |
| **Enseignant** | Personal account (+ optional `teacher` memberships) | Invitation, enrolment code, or approved access request | Optional |
| **Visiteur** | — | — | — |

One account has at most one platform role. An account can be a member of several institutions, with one role in each.

## Matrix

✅ allowed · 👁 read-only · — not allowed · « own » = only their own data · « assigned » = only courses assigned to them / by their institution

| Action | Admin | Responsable | Formateur | Admin établ. | Superviseur | Enseignant | Visiteur |
|---|---|---|---|---|---|---|---|
| Public site, catalog, course pages, verify a certificate | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Send an access request | — | — | — | — | — | — | ✅ |
| Create a course | ✅ | ✅ | — | — | — | — | — |
| Edit course content | ✅ | ✅ | ✅ assigned, **draft only** | — | — | — | — |
| See quiz answers (authoring) | ✅ | ✅ | ✅ assigned | — | — | after passing, own | — |
| Submit a course for review | ✅ | ✅ | ✅ assigned | — | — | — | — |
| Approve / publish / request changes / archive | ✅ | ✅ | — | — | — | — | — |
| List a course in the public catalog | ✅ | ✅ | — | — | — | — | — |
| Assign trainers to a course | ✅ | ✅ | — | — | — | — | — |
| Authorise a course for an institution or a person | ✅ | — | — | — | — | — | — |
| Create / edit institutions | ✅ | — | — | — | — | — | — |
| Invite institution administrators | ✅ | — | — | — | — | — | — |
| Invite teachers / supervisors of an institution | ✅ | — | — | ✅ own institution | — | — | — |
| Enrolment codes | ✅ | — | — | ✅ own institution | — | — | — |
| Assign authorised courses to teachers | ✅ | — | — | ✅ own institution | — | — | — |
| Remove a teacher from an institution | ✅ | — | — | ✅ own institution | — | leave by themselves | — |
| See a teacher’s progress and results | ✅ all | ✅ all | ✅ learners of assigned courses | ✅ assigned courses, consenting members | 👁 same as admin établ. | ✅ own | — |
| Personal (non-assigned) learning of a teacher | ✅ | ✅ | ✅ only in their courses | **never** | **never** | ✅ own | — |
| Reset quiz attempts | ✅ | ✅ | — | — | — | — | — |
| Revoke a certificate | ✅ | — | — | — | — | — | — |
| Platform reports, statistics, CSV exports | ✅ | ✅ | — | — | — | — | — |
| Institution statistics, reports, CSV exports | ✅ | ✅ | — | ✅ own institution | 👁 own institution | — | — |
| Pedagogical library: read | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Pedagogical library: manage | ✅ | ✅ | — | — | — | — | — |
| Access requests from the website | ✅ | — | — | — | — | — | — |
| Pedagogical team (grant roles) | ✅ | — | — | — | — | — | — |
| Settings, audit log, suspend accounts | ✅ | — | — | — | — | — | — |
| Follow courses, take quizzes, get certificates | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |

## Key rules

- **Privacy boundary:** an institution (administrators and supervisors) sees a teacher's progress only for courses **it assigned**, only while the teacher is an active member who **consented** when joining. Personal learning is never visible to it.
- **Review workflow:** `draft → review → published`, or back to `draft` with the reviewer's comment. Trainers cannot change a course's status or public listing; content is locked for them outside drafts.
- **Two-step login:** for administrators and training managers, the database grants their privileges only to sessions verified with a second factor (`aal2`). A stolen password alone gives no administrative access.
- **Removing a role** removes all its rights immediately (including course assignments for trainers); the person keeps their own teacher account and learning.
