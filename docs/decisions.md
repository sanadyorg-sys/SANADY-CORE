# Technical decision log

| # | Date | Decision | Why | Consequences |
|---|---|---|---|---|
| 1 | 07/10/2026 | **Next.js (App Router) + Supabase** (PostgreSQL, Auth, Storage) | One codebase for site and app; managed login and storage; strong database security (RLS) | Hosting on Vercel; Supabase project in Europe (Ireland) |
| 2 | 07/10/2026 | **Business rules inside the database** (RLS + `security definer` functions with `search_path = ''`) | Cannot be bypassed by a crafted request; one source of truth for every screen | Every rule is tested on a real PostgreSQL (PGlite) in `tests/db` |
| 3 | 07/10/2026 | **Invitation-only accounts**, hashed single-use tokens, enrolment codes | Requirement of the brief; control over who joins | Public site added later with an access-request form (#12) |
| 4 | 07/10/2026 | Quiz unlocked after the module's mandatory lessons; 70 %, 3 attempts; answers revealed only after passing | Matches « évaluation après chaque module »; keeps later attempts meaningful | Attempts graded and limited on the server |
| 5 | 07/10/2026 | **Archive instead of delete** once learners started content | Never lose teachers' history or certificates | Removal functions archive when learner data exists |
| 6 | 08/10/2026 | Brand orange **#F95A05** exactly; small orange text uses #C94400 | Faithful to the Foundation's identity while meeting WCAG AA contrast | `brand` button only in large size |
| 7 | 08/10/2026 | **Two-step login mandatory for administrators**, enforced by the database (`aal2`) | Administrators see every teacher's data | Lost phone: `npm run mfa:reset` |
| 8 | 08/10/2026 | **Nonce-based Content-Security-Policy**; every page rendered per request | Blocks injected scripts and framing | No static pages; negligible cost at this scale |
| 9 | 08/10/2026 | Server functions in **Dublin** (`vercel.json` regions) | Next to the database (Ireland) and close to Morocco | ~0.6 s server time per page |
| 10 | 09/10/2026 | Only facts published by the Foundation; reference file with sources | Brief: never invent facts, partnerships or figures | `docs/institution/reference-sanady.md`; unconfirmed content hidden |
| 11 | 09/10/2026 | Official documents are **linked** to sanady.org, not copied | No written authorisation to redistribute | Mallette and reports open on sanady.org |
| 12 | 09/10/2026 | **Public catalog** opt-in per course (`public_listing`) | Some courses may be reserved for institutions | Public functions expose program metadata only |
| 13 | 10/10/2026 | Quiz order shuffled **once per attempt** (stored) | Fairness without confusing reloads | Answer order derived from attempt id |
| 14 | 11/10/2026 | **Library** files in a private bucket; download decided per resource | Some documents should be read online only | Signed URLs under the user's own permissions |
| 15 | 11/10/2026 | Reports count **learning activity** only (not assignments or admin actions) | Honest indicators; institutions only see assigned courses | `admin_report`, `institution_report` |
| 16 | 11/10/2026 | **Four roles**: training manager, trainer, supervisor (+ admin) and a **review step** | Brief Phase 4 and 15; separation of authoring and publishing | Permission helpers generated from existing definitions |
| 17 | 11/10/2026 | Partners banner and testimonials **hidden** until confirmed | Government logos and real quotes need written consent | Switches `SHOW_PARTNERS`, `SHOW_TESTIMONIALS` |
| 18 | 11/10/2026 | **Nightly retention job** (pg_cron) | The privacy notice promises limited retention | Learner-account deletion awaits the Foundation's procedure |
| 19 | 11/10/2026 | Tables scroll inside their card on phones (`contain: inline-size`, positioned scroller) | Pages must never zoom out on phones | Audited with `scripts/mobile-audit.mjs` |
