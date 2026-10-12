# SANADY Enterprise — audit, feasibility and integration plan

Source brief: `PLAN/new-feature.md` — **V3.0** (12/10/2026). This document is
its Phase 0 (« audit the existing project, identify reusable LMS components,
assess multi-tenant security risks, and present a phased integration plan
before making major code or database changes »).

**Build status (12/10/2026):** phases **E1, E2 and E3 are built** (migrations
`20261018000100_enterprise.sql`, `20261018000200_staff_profiles.sql`,
`20261019000100_enterprise_tenants.sql`), with the public page hidden and
worded as a proposal. E3 was built ahead of G1–G5 at the owner's request: the
safeguard is in the database instead — a company workspace can only be
requested for a client whose contract an approver signed, and only exists
after an approver authorises it. Nothing is billed. See §8.
Team guide: [guide.md](guide.md).

## 1. Status of the proposal (read first)

Corporate training is **a proposed complementary activity, not an official
SANADY programme** (brief §2). The Fondation Sanady is an *association
reconnue d’utilité publique*. Before any commercial activation, the
Foundation must obtain:

| # | Validation | Who |
|---|---|---|
| G1 | Decision of the governing body to explore / launch the activity | Conseil d’administration |
| G2 | Review of the statutes: is paid training within the object of the association? | Legal adviser |
| G3 | Tax treatment of commercial income (IS, TVA, possible impact on the public-utility status and on the tax treatment of donations) | Tax adviser / accountant |
| G4 | Accounting: separate analytic accounts for commercial services vs donations and grants | Accountant |
| G5 | Contractual capacity and signatories for commercial contracts | Conseil / président |
| G6 | Law 09-08 / CNDP: the Foundation as processor for employee data (data-processing clauses in each contract) | Legal / DPO |
| G7 | Pricing policy and who approves exceptions | Direction |

Until G1–G5 are obtained, every enterprise page stays **hidden** (no menu
link, `noindex`) and is worded as a **proposal** (« Services en projet »),
never as an existing offer. No billing, no payment, no automatic tenant
creation.

## 2. Audit — what already exists and can be reused

| Need of the brief | Already in SANADY | Gap |
|---|---|---|
| Company workspace (tenant) | **Institutions**: `institutions`, `institution_memberships` (admin / supervisor / teacher), RLS by membership, institution area `/etablissement/[id]` | An *enterprise* kind of institution, service plan, limits, contract status, branding |
| Employee accounts | Invitations (single-use, expiring), enrolment codes, consent screen, account deactivation (`account_status`) | Bulk CSV invitations, departments |
| Tenant-specific courses | `course_permissions` per institution (grant/revoke), `public_listing` off by default: a course is reachable only by those granted | Ownership metadata (SANADY / company / joint / licensed), « company-private » flag that forbids granting to another tenant |
| Assignments, deadlines | `course_assignments` with `due_on`, notifications in-app | Deadline reminders (needs e-mail) |
| Progress, quizzes, certificates | Lessons, progress, quizzes with **per-quiz** `pass_threshold` (50–100) and `max_attempts` (1–10), server-side grading, certificates with QR verification | Certificate wording « attestation de suivi » for enterprise tenants |
| Company dashboard and reports | `institution_report`, CSV exports (formula-safe), learner follow-up pages | Department breakdown |
| Production of custom training | Course authoring, **review workflow** (draft → review → published), trainers assigned per course, training managers | Training projects (brief, client review, tasks, versions) |
| CRM | **Partenariats** (V2): `partner_organizations`, contacts, notes, tasks, history, approvers (explicit grant, 2FA) | An *enterprise* pipeline next to the partnership one, on the same organisation record |
| Public request form | Partnership 5-step form, PDF upload by signed link, rate limits, honeypot, references | Enterprise-specific steps (service, learners, language, accessibility) |
| Media | Supabase Storage (private, signed URLs) and **Mux** (signed playback) already supported | Usage tracking per tenant (storage, minutes watched) |
| Governance | Approvers separate from administrators; audit log; 2FA for staff | Approval of commercial proposals and contracts |
| Retention / offboarding | Nightly retention job; account deactivation | Tenant offboarding procedure (export, retention, deletion) |

**Conclusion:** the brief’s instruction « reuse the existing LMS, do not
build a second engine » is achievable: an enterprise tenant is an
institution of a new *kind*, with an extension table for the commercial
attributes. Courses, progress, quizzes, certificates, reports and
invitations are reused as they are.

## 3. Multi-tenant security — risks and mitigations

| Risk | Mitigation |
|---|---|
| R1 A company sees SANADY teachers (or another company’s employees) | Already enforced: institution staff see only their own members, and only for courses **assigned by that institution** (personal training stays private). Add DB tests across two enterprise tenants. |
| R2 A company’s private course is granted to another tenant or listed publicly | New `courses.owner_institution_id` + `private_to_owner`: a DB trigger refuses any grant to another institution and `public_listing = true`. |
| R3 Corporate employees appear in SANADY reports and statistics | Reports filter by institution *kind*; the foundation-wide teacher indicators exclude enterprise tenants. |
| R4 A teacher who is also an employee mixes both | Allowed (one account), but each membership sees only its own assigned courses — existing rule. The employee area is labelled by tenant. |
| R5 URL or form tampering (`/enterprise/[slug]`) | All checks in RLS / `security definer` functions on verified membership; the slug only selects, never authorises (same pattern as `/etablissement/[id]`). |
| R6 Over-quota usage (learners, storage) | Limits checked in the invitation and enrolment functions; storage and video usage recorded daily. |
| R7 Commercial and charitable records mixed | Separate tables and pipelines; an organisation links both, but contributions (donations) and contracts (sales) never share a table or a total. |
| R8 Staff with technical rights sign contracts | Reuse the approver grant (never self-granted, 2FA); administrators do not approve commercial commitments by default. |
| R9 Data kept after a contract ends | Offboarding: disable enrolment → authorised export → retention period → scheduled deletion → audit entry. |

## 4. Architecture decisions (proposed)

1. **Tenant = institution of kind `enterprise`** + table `enterprise_tenants`
   (1-1): slug, plan, max learners, storage allowance, contract id, status
   (provisioning → active → suspended → offboarding → closed), branding.
   School institutions are unchanged.
2. **One organisation record** for partnerships and enterprise:
   `partner_organizations` gets an *enterprise pipeline* status next to
   the partnership one (brief §7: one organisation can be partner, client or both).
3. **Enterprise requests** reuse the partnership application machinery
   (storage, references `ENT-YYYY-NNNN`, rate limits) in their own table.
4. **Commercial records** (proposals, contracts, line items, service plans,
   usage, invoices-to-be) in their own tables, readable by enterprise staff
   only; amounts never mixed with donations.
5. **New roles**: `enterprise_manager`, `production_manager` (platform
   roles, 2FA); commercial approval reuses the **approver** grant.
6. **No new paid service** until usage justifies it: Supabase + Mux (already
   integrated) cover the first tenants (see §6).

## 5. Roadmap (brief §26 and its recommended order)

| Phase | Content | Depends on |
|---|---|---|
| **E1 — Public portal & requests** | `/partenariats/entreprises` (hidden, worded as proposals): the four kinds of relationship (solidaire, sur mesure, plateforme, hybride), service workflow, FAQ, 6-step request form, reference `ENT-…`, inbox | Nothing — validates demand before investing |
| **E2 — Enterprise CRM** | Enterprise pipeline (Lead → … → Renouvellement) on the organisation record, proposals with configurable line items (no fixed prices), approval by an approver, tasks | E1 |
| **E3 — Multi-tenant LMS** ✅ | Enterprise tenants on institutions, provisioning checklist (10 steps), company admin dashboard, employees (CSV), departments, private courses, offboarding, cross-tenant tests | Built 12/10/2026; first real use needs G1–G5 + a signed pilot contract |
| E4 — Training studio | Training projects, curriculum brief, production tasks, client review, versioned publication on the existing authoring and review workflow | E3 |
| E5 — Contracts & operations | Contracts (Draft → … → Closed), service plans, usage tracking, renewals, offboarding | E3 |
| E6 — Finance & impact | Contracted / invoiced / received / outstanding (no billing), costs, margin estimates (labelled as estimates), link to partnership impact | E5 + accountant |

Partnership phase 4 (agreements, contributions) is merged into E5/E6 so
that donations and commercial contracts share one repository design while
staying separate.

## 6. Media and cost scenarios (indicative, to confirm)

Figures from `docs/operations.md` (2026 public prices):

| Scenario | Storage | Video delivery | Order of magnitude / month |
|---|---|---|---|
| Teachers only (5,000 accounts, ~1,000 active) | Supabase Pro (100 GB) | Mux ≈ 180,000 min watched | 45–65 USD + 200–350 USD video at full use |
| + 1 company, 300 employees, 2 h of video each | +~2 GB | +36,000 min | +40–70 USD video |
| + 5 companies, 1,500 employees | +~10 GB | +180,000 min | +200–350 USD video |

Video is the main variable cost: enterprise prices should cover minutes
watched (usage line item) before activation.

## 7. Decisions needed

1. **Scope now**: build E1 (+ E2) while the Foundation reviews G1–G7?
2. **Visibility**: keep `/partenariats/entreprises` hidden and worded as
   « Services en projet » until G1–G5?
3. **People**: who would be enterprise manager and production manager?
4. **Pilot**: is there a first company interested (to size E3)?

## 8. Phase E3 as built (12/10/2026)

| Brief | Implementation |
|---|---|
| §8 tenant model | `institutions.kind = 'enterprise'` + `enterprise_tenants` (one open workspace per client). Courses, assignments, progress, quizzes, certificates, reports and invitations are the existing ones. Address `/entreprise/<slug>` (the slug only selects; access = verified membership). |
| §8 isolation | Existing institution RLS (verified membership) + new guards: a company-private course (`courses.tenant_private`) is never granted to another institution or person and never listed publicly; `institutions.kind` never changes; a workspace's status only changes through `set_tenant_status`. Cross-tenant tests in `tests/db/enterprise-tenants.test.ts`. |
| §8 separation from teachers | Employees who belong only to company workspaces are excluded from `admin_report` / `platform_overview` and from the teachers' library (RLS + page guard); company-owned courses are excluded from SANADY statistics. |
| §9 provisioning | 10 steps computed from the data by `tenant_checklist` (only the security check is a person's statement, by a SANADY administrator). Request (enterprise manager, contract signed) → authorisation (approver) → workspace generated → company administrator invited → limits and dates → catalogue (≥ 1 published course) → storage allowance → security checks → welcome invitation sent or accepted → activation (refused until all steps are met). |
| §10 employees | Single and bulk (pasted list or CSV, 200 lines) invitations; seat limit enforced by the database (active employees + open invitations); no employee before activation; departments (« Services ») chosen at invitation or later; directory and reports filter by service. |
| §11 courses | Ownership `sanady / company / joint / licensed`, owner workspace, « reserved to this company » flag — set on the course's « Autorisations » page by a SANADY administrator. |
| §12 assessments | Per-quiz pass mark and attempts already exist (50–100 %, 1–10); SANADY teacher courses keep 70 % / 3. |
| §14 company dashboard | The institution area, worded for companies (« collaborateurs », « entreprise »), without the teachers' library; « Services » page. |
| §15 SANADY view | « Espaces de formation »: list, checklist, configuration, usage counts (never employee names). |
| §20 offboarding | End of contract recorded (note required) → open invitations and codes withdrawn → export authorised by an approver → deletion date set (future) → closure: access revoked, records kept until the date. Nothing is deleted immediately; the deletion itself is a manual, audited operation for now. |
| Certificates | Workspace setting « Attestation de formation » or « Certificat »; the PDF title and footer follow it for company-owned courses. |

Not in E3: storage and video **measurement** per workspace (allowances are recorded, usage is not yet metered), company logo, automatic deletion job, e-mail reminders. Fix shipped alongside: `20261019000200` lets the server read document paths so the retention purge also deletes the stored PDFs (decision 36).
