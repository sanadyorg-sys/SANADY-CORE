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
| **Chargé(e) des partenariats** | `platform_roles.role = partnership_coordinator` | Granted by an administrator (Équipe SANADY) | **Mandatory** |
| **Responsable des partenariats** | `platform_roles.role = partnership_manager` | Granted by an administrator | **Mandatory** |
| **Approbateur habilité** (partenariats, Enterprise) | `partnership_signatories` (explicit grant, not a role) | Appointed by an administrator — **never by themself**; holder must be an admin or have a partnership role | **Mandatory** to use it |
| **Responsable entreprises** (Enterprise) | `platform_roles.role = enterprise_manager` | Granted by an administrator | **Mandatory** |
| **Responsable de production** (Enterprise) | `platform_roles.role = production_manager` | Granted by an administrator; reads the CRM, runs training projects in the Studio (E4) | **Mandatory** |
| **Administrateur d’entreprise** | `institution_memberships.role = admin` in an institution of kind `enterprise` | Invited by the enterprise manager during provisioning | Optional |
| **Collaborateur** (employee) | `institution_memberships.role = teacher` in a company workspace | Invited by the company administrator (single or bulk), within the learner limit | Optional |
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


## Partenariats & Coopération

Functions in `supabase/migrations/20261016000100_partnerships.sql`; tests in `tests/db/partnerships.test.ts`. All staff actions require a two-factor session.

| Action | Admin | Chargé(e) | Responsable partenariats | Approbateur (grant) | Other staff / users | Visiteur |
|---|---|---|---|---|---|---|
| Send a partnership application (`/partenariats`, hidden until approved) | — | — | — | — | — | ✅ |
| Read applications, organisations, contacts, notes, tasks, documents | ✅ | ✅ | ✅ | if also staff | — | — |
| Change an application status, create the organisation record | ✅ | ✅ | ✅ | — | — | — |
| Edit organisations and contacts, add notes and tasks | ✅ | ✅ | ✅ | — | — | — |
| Pipeline: prospect → négociation, retiré, rejeté (before validation) | ✅ | ✅ | ✅ | — | — | — |
| Submit for **validation institutionnelle** | — | — | ✅ | — | — | — |
| **Convention signée** or **rejeté** from validation | — | — | — | ✅ | — | — |
| Mise en œuvre → suivi → renouvellement ou clôture | ✅ | ✅ | ✅ | — | — | — |
| Record an educational need, submit it for review | ✅ | ✅ | ✅ | — | — | — |
| **Validate or reject a need** | — | — | — | ✅ | — | — |
| Draft a project (from a validated need or new), edit it while draft/review | ✅ | ✅ | ✅ | — | — | — |
| **Approve a project for publication** (and reopen a closed one) | — | — | — | ✅ | — | — |
| Publish an approved project, close, archive | ✅ | ✅ | ✅ | ✅ (publish) | — | — |
| See published projects (`/partenariats/opportunites`) and apply to one | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Prepare an agreement, attach drafts, submit it for review; milestones; implementation and closure | ✅ | ✅ | ✅ | — | — | — |
| **Approve an agreement**; attach the signed copy and **record the signature** (date) | — | — | — | ✅ | — | — |
| Record a contribution (pledge), mark it committed and delivered (what was really received), attach evidence | ✅ | ✅ | ✅ | — | — | — |
| **Verify a contribution** (evidence required) | — | — | — | ✅ | — | — |
| Export verified indicators and contributions received (CSV) | ✅ | ✅ | ✅ | ✅ | — | — |
| Compute an indicator from platform data (totals only, consenting teachers of schools) | ✅ | ✅ | ✅ | — | — | — |
| Record or correct an impact indicator; prepare a partner report; record that it was shared | ✅ | ✅ | ✅ | — | — | — |
| **Verify an impact indicator**; **approve a partner report** | — | — | — | ✅ | — | — |
| Switch the partner portal on or off | ✅ | — | — | — | — | — |
| Invite or remove a partner contact (signed partners only) | ✅ | — | ✅ | — | — | — |
| Review partner deliverables; reply in the partner conversation | ✅ | ✅ | ✅ | — | — | — |
| **Partner contact**: see their organisation's signed agreements, milestones, supported projects and shared reports; submit deliverables; write to the team | — | — | — | — | own organisation only | — |
| Write, edit and archive message templates; prepare and send a message to a partner (recorded in the notes) | ✅ | ✅ | ✅ | — | — | — |
| Grant partnership roles, appoint or revoke approvers | ✅ (never for themself) | — | — | — | — | — |

The administrator role does **not** carry signing authority (brief V2 §10). Needs are internal and never public; a project’s content is frozen once approved (back to draft means a new approval). Visitors read projects only through `public_partnership_opportunities()`, which returns no internal field (no need, no internal cost, no author). Every decision is written to `audit_logs` and to the append-only `partnership_status_history`.

## SANADY Enterprise (phases E1–E2, proposed activity)

Functions in `supabase/migrations/20261018000100_enterprise.sql`; tests in `tests/db/enterprise.test.ts`. All staff actions require a two-factor session. The approvers are the same explicit grants as for partnerships.

| Action | Admin | Responsable entreprises | Responsable de production | Approbateur (grant) | Partnership staff | Visiteur |
|---|---|---|---|---|---|---|
| Send an enterprise request (`/partenariats/entreprises`, hidden) | — | — | — | — | — | ✅ |
| Read requests, clients, proposals, notes, tasks, documents | ✅ | ✅ | ✅ | if also staff | — | — |
| Qualify / decline a request, create or link the client record | ✅ | ✅ | — | — | — | — |
| Enterprise pipeline up to **validation institutionnelle**, lost, withdrawn | ✅ | ✅ | — | — | — | — |
| **Contrat signé** (from validation) | — | — | — | ✅ | — | — |
| Mise en place → service actif → renouvellement | ✅ | ✅ | — | — | — | — |
| Draft a proposal and its lines, submit it for internal review | ✅ | ✅ | — | — | — | — |
| **Approve a proposal** (needs at least one line; lines then locked) | — | — | — | ✅ | — | — |
| Send an approved proposal, record accepted / declined / expired | ✅ | ✅ | — | — | — | — |
| Add notes; tasks (assigned to enterprise staff or admins) | ✅ | ✅ | ✅ (notes) | — | — | — |
| Grant enterprise roles, appoint approvers | ✅ (never for themself) | — | — | — | — | — |

### Company workspaces (E3)

| Action | Admin SANADY | Responsable entreprises | Approbateur | Administrateur d’entreprise | Collaborateur |
|---|---|---|---|---|---|
| Request a workspace (client contract signed) and configure limits | — | ✅ | — | — | — |
| **Authorise** (or refuse) the creation | — | — | ✅ | — | — |
| Generate the workspace, invite the company administrator, activate, suspend, record the end of contract, close | — | ✅ | — | — | — |
| Confirm the security checks | ✅ | — | — | — | — |
| Open a course to the workspace; set ownership and « reserved to this company » | ✅ | — | — | — | — |
| **Authorise the data export** at the end of the contract | — | — | ✅ | — | — |
| Invite employees (single, bulk), manage services, assign courses, view reports — **own workspace only** | — | — | — | ✅ | — |
| Follow assigned courses, quizzes, attestations | — | — | — | — | ✅ |
| See another company's employees, courses, results or reports | — | — | — | ❌ | ❌ |

### Training production studio (E4)

| Action | Resp. entreprises / production | Responsable pédagogique | Formateur | Approbateur | Administrateur d’entreprise |
|---|---|---|---|---|---|
| Create a project, write the brief and the programme, create the course, assign trainers and tasks, move to review, launch, new version | ✅ | — | — | — | — |
| Write the course content (draft) | — | ✅ | ✅ (assigned) | — | — |
| Close own production tasks | ✅ | ✅ | ✅ | — | — |
| **Pedagogical review** | — | ✅ | — | — | — |
| **Client review** of the programme | ✅ (records the client's answer) | — | — | — | ✅ (own workspace) |
| **Final institutional approval** (frozen version) | — | — | — | ✅ | — |
| Publish the course (only after the approval) | — | ✅ | — | — | — |

### Contracts and usage (E5)

| Action | Resp. entreprises | Responsable de production | Approbateur |
|---|---|---|---|
| Create a contract from an accepted proposal, edit terms and lines (draft), submit for review, start, renew, close | ✅ | — | — |
| **Approve** a contract; attach the signed copy and **record the signature** | — | — | ✅ |
| Apply the contract's limits to the workspace; record monthly usage; review an overage | ✅ | — | — |
| Read contracts and usage | ✅ | ✅ | ✅ (contracts) |
| Record invoices, payments and costs; cancel an unpaid invoice (E6) | ✅ | — | — |
| **Confirm a payment** (not one they recorded) | admin ✅ | — | ✅ |
| Read finances | ✅ | — | ✅ |
| Upload, replace or remove a company's logo (PNG/JPEG, 1 MB) | ✅ | — | — |
| Create and edit service plans and their lines; apply an approved plan to a draft proposal; archive a plan | ✅ | — | — |
| **Approve a service plan** (it carries prices) | — | — | ✅ |
| **Support**: read every request, reply, write internal notes, assign, change status, read workload | ✅ | ✅ | — |
| **Company administrator**: open a support request for their company, read its replies (never internal notes), answer, reopen a resolved request, close it | — | — | — |

Enterprise staff see workspace counts (`tenant_usage`), never employee names. Employees of companies only do not see the teachers' library and are not counted in SANADY's teacher statistics.

An organisation can be both a partner and an enterprise client (one record, two relationships). Enterprise staff see only the organisations with an enterprise relationship; linking a request to an existing partner uses `find_organizations_for_enterprise` (names only). Partnership and enterprise staff can see the names of other staff accounts (so histories show who decided), never teachers' profiles.
