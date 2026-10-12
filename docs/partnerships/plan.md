# SANADY Partenariats & Coopération — audit and implementation plan

Source brief: `PLAN/partnership.md` — **V2.0** (12/10/2026, replaces V1). This
document answers its Phase 0 (audit, roles, migration plan) before the
codebase is modified, as the brief requires.

**Decisions (12/10/2026):** build V2 **phases 1 and 2** now; `/partenariats`
stays **hidden until the Foundation approves** (no menu link, `noindex`).

## 0. What V2 changed

- Organised around the Foundation’s **six fields of intervention** (sanady.org):
  Soutien scolaire, Formation continue des enseignants, Orientation scolaire
  et professionnelle, Assistance aux bourses d’études supérieures, Activités
  parascolaires, Réhabilitation des écoles — stored in a configurable table
  `intervention_fields`; public descriptions reuse the verified texts of
  `src/lib/institution.ts`. Six public field pages `/partenariats/domaines/<field>`.
- **Contribution types**: financier, équipement, expertise, technologie,
  services éducatifs, coopération institutionnelle.
- **Pipeline (11 stages)**: prospect identifié → premier contact → intérêt
  confirmé → proposition reçue → évaluation → négociation → validation
  institutionnelle → convention signée → mise en œuvre → suivi et évaluation
  → renouvellement ou clôture (+ rejeté, retiré).
- Form step 3: field, contribution type, proposed contribution, expected
  cooperation, preferred timeline, additional information. Documents: **PDF only**.
- Phase 2 adds **follow-up tasks**.
- Hero: « Ensemble, construisons un avenir éducatif meilleur. »

## Phase mapping (V2 §21)

| V2 phase | Status |
|---|---|
| 0 — Audit & validation | This document |
| 1 — Public portal (landing, six fields, form, confirmation, storage, inbox) | Built now |
| 2 — CRM (organisations, contacts, pipeline, tasks, status, permissions) | Built now |
| 3 — Needs registry, opportunities directory, approval of opportunities | **Built** (migration `20261017000100`) — waiting for the Foundation’s first validated needs |
| 4 — Agreements, contributions, milestones, renewals | Later |
| 5 — Impact dashboard, verified PDF partner reports | Later |
| 6 — Partner portal, advanced relationship management | Later, only with SANADY authorisation |

> Sections 2–6 below were written for V1 and are kept for the audit; where
> they differ, §0 above and the migration prevail.

## 1. Audit of the existing platform

| Area | What exists | Reuse for partnerships |
|---|---|---|
| Stack | Next.js 16 App Router, React 19, Tailwind v4, zod; Supabase (Postgres + RLS + Storage), Vercel (dub1) | Same stack, no new service |
| Auth & roles | `platform_role` enum: `sanady_admin`, `training_manager`, `trainer`; institution roles `admin`/`teacher`/`supervisor`. `private.is_training_manager` requires aal2 (2FA). Guards in `src/server/auth.ts` (`requireStaff`) | Add two partnership roles + an explicit signatory grant (see §3) |
| Public site | `(site)` layout, header/footer, `SmileUnderline`, `Reveal`, brand tokens | New page `/partenariats` in the same layout |
| Public form pattern | `request_access` RPC called by the service role **after** `rateLimit()` (PostgreSQL fixed window), honeypot `site_web`, zod validation, consent, silent outcome for bots | Same pattern for applications |
| Admin inbox pattern | `/admin/demandes` (access requests: list, filters, approve/reject) | Same pattern for the application inbox |
| Private files | Buckets `course-media`, `library` (private, signed URLs, size + MIME limits) | New private bucket `partnerships` |
| Audit trail | `public.audit_logs` (insert only through `private.log_audit`, read-only to staff, no UPDATE/DELETE grant) — shown in `/admin/journal` | All partnership mutations logged there |
| E-mail | `src/server/email.ts` (Resend) — **not configured yet**: sends nothing and reports `notConfigured` | Notifications go through it; in-app counters meanwhile |
| PDF | `src/lib/pdf/report.ts`, `certificate.ts` (pdf-lib, brand logo) | Partner impact reports (Phase C) |
| Retention | `private.run_retention()` daily (pg_cron) | Add partnership application retention |
| Tests | PGlite DB tests (`tests/db`), Playwright + axe | New DB + e2e tests |

**Naming conflict to avoid.** « Établissement partenaire » already means a
*school* that uses the platform (access request `kind = institution`, home
page « Devenir partenaire »). The new module concerns *organisations that
support the Foundation*. Public wording: « Partenaires de la Fondation » /
« Partenariats & Coopération »; school wording unchanged. The home page
« Devenir partenaire » button (schools) is renamed « Inscrire mon
établissement » to remove the ambiguity.

## 2. Architecture (Phase A)

```
Public  /partenariats ──► 5-step form ──► server action submitPartnership()
                                            │ honeypot · zod · rate limit (IP + e-mail)
                                            │ file checks (size, MIME, magic bytes)
                                            ▼
                          RPC submit_partnership_application (service role)
                                            │ reference PART-2026-0001
                                            ▼
        partnership_applications ── partnership_documents (bucket "partnerships", private)
                 │
Admin   /admin/partenariats (inbox) ──► review, notes, status ──► partnership_status_history
                 │ « Créer la fiche organisation »
                 ▼
        partner_organizations ── partner_contacts ── pipeline status (11 steps + declined/withdrawn)
```

All writes go through `security definer` RPCs with `private.require(...)`
checks (same convention as the rest of the platform); tables are read under
RLS by partnership staff only. Nothing is readable anonymously.

## 3. Roles and permissions

New `platform_role` values: `partnership_coordinator`, `partnership_manager`.
Signing authority is **not a role**: it is an explicit, audited grant
(`partnership_signatories`) that a SANADY admin records for a named person
and **cannot grant to themself**. Approving requires the grant **and** 2FA
(aal2). A technical admin without the grant cannot approve.

| Action | Coordinator | Manager | Signatory (grant) | SANADY admin |
|---|---|---|---|---|
| Read applications, organisations, contacts | ✓ | ✓ | ✓ | ✓ |
| Change application status, add notes, upload documents | ✓ | ✓ | — | ✓ |
| Create / edit organisations and contacts, move pipeline | ✓ | ✓ | — | ✓ |
| Move to « En attente de validation » | — | ✓ | — | — |
| « Partenariat approuvé » / « Convention signée » | — | — | ✓ (2FA) | — |
| Grant / revoke roles and signatory grants | — | — | — | ✓ (not to self) |
| Read audit trail | ✓ | ✓ | ✓ | ✓ |

## 4. Database migration (Phase A) — `20261016000100_partnerships.sql`

Incremental and reversible (new tables, new enum values, new bucket only;
no change to existing tables except enum additions).

- **Enums**: `partnership_type` (mecenat, academique, technologique, expertise, equipement, associatif), `organization_type` (entreprise, fondation, universite, association, administration, organisation_internationale, autre), `application_status` (received, under_review, accepted, declined, withdrawn, spam), `pipeline_status` (11 brief steps + declined, withdrawn).
- **`partnership_applications`**: reference (unique, `PART-YYYY-NNNN`), organisation fields (name, type, country, city, website, sector, description), contact (full name, job title, e-mail, phone), proposal (type, domain, description, objectives, contribution, beneficiaries, duration, extra), consent_at, status, organization_id (nullable), timestamps.
- **`partner_organizations`**: name, type, country, city, website, sector, description, interests (`partnership_type[]`), pipeline status, assigned_to (staff), timestamps.
- **`partner_contacts`**: organization_id, full name, job title, e-mail, phone, is_primary.
- **`partnership_documents`**: application_id or organization_id, storage path, file name, MIME, size, uploaded_by.
- **`partnership_notes`**: internal notes (never public), author, entity.
- **`partnership_status_history`**: append-only (from, to, by, note, at) for applications and organisations.
- **`partnership_signatories`**: user_id, granted_by, granted_at, revoked_at (check granted_by ≠ user_id).
- **Storage**: private bucket `partnerships`, 10 MB, PDF / DOCX / PNG / JPEG.
- **Retention**: declined / spam / withdrawn applications and their files deleted after 24 months (added to `private.run_retention`), stated in the privacy notice.
- Phase B adds `partnership_opportunities`, `partnership_agreements`, `partnership_approvals`, `partnership_contributions`, `partnership_tasks`; Phase C `partnership_activities`, `partnership_impact_metrics`, `partnership_reports`.

## 5. UX specification (Phase A)

**Public `/partenariats`** (French, existing design system, no invented facts):
A. Hero « Ensemble, donnons plus de force à l’éducation. » + the brief subtitle; CTAs « Proposer un partenariat » (to the form) and « Découvrir nos domaines de coopération ». Image: an authentic, non-duplicated photo (to provide) or brand background.
B. « Pourquoi s’associer à la Fondation Sanady ? » — only verified facts from `src/lib/institution.ts` (since 2009, mission, programmes) mapped to the five support areas of the brief.
C. Six category cards (the brief’s list).
D. Opportunities — **hidden** until Phase B and until an opportunity is approved.
E. Partner showcase — **hidden** (same rule as the home page: written authorisation first).
F. 5-step form: Organisation → Contact → Proposition → Documents → Récapitulatif + consent. Draft autosaved in the browser only (no server draft, no personal data stored before consent). Confirmation page with the reference.
G. FAQ (types, submission, review delay wording to validate, contact contact@sanady.org).

**Admin `/admin/partenariats`**: inbox table (filters: status, type, date; search), application detail (all fields, documents via short-lived signed URL, notes, status change with history), « Créer la fiche organisation », organisations directory with pipeline column view and detail page (contacts, history, notes). Counter of new applications in the admin navigation.

Not in Phase A: opportunities, agreements, contributions, tasks, dashboard KPIs, PDF reports, partner portal.

## 6. Roadmap

| Phase | Content | Depends on |
|---|---|---|
| **A — Essential** | Migration above, public page + 5-step form, secure storage, admin inbox, basic CRM (organisations, contacts, pipeline, history, notes), roles + signatory grant, in-app notifications, tests | Nothing — buildable now |
| B — Institutional management | Opportunities (draft → review → approved → published → closed → archived), approval workflow with signatory, agreement repository (versions), contributions (financial / in-kind / expertise, pledged ≠ received), tasks, filters | Foundation names coordinators, manager, signatory |
| C — Strategic impact | Dashboard KPIs from real queries, impact linking to courses (aggregated only), PDF partner reports, renewals, optional partner portal (disabled) | Signed agreements exist |

## 7. Decisions needed from the Foundation

1. **Public launch** of `/partenariats`: the brief requires SANADY authorisation. Proposed: build it, keep it out of the menus and search engines (`noindex`) until the Foundation validates the texts.
2. **People**: who are the coordinator(s), manager and signatory?
3. **Review delay** shown on the form (e.g. « sous 15 jours ouvrés »).
4. **Photo** for the hero (authentic, not already used on the site).
5. **E-mail** (Resend + domain) for confirmations and alerts — until then, alerts are in-app only.
6. **Legal review** (Law 09-08 / CNDP) of the privacy notice for partner contacts.
