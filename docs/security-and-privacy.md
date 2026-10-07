# Security and privacy

## Controls

| Area | Control |
|---|---|
| Authentication | Supabase Auth, e-mail + password. Public sign-up disabled. Identity on the server comes from a verified JWT (`getClaims`). Sessions refreshed in `proxy.ts`. |
| Registration | Invitation-only. Tokens: 256-bit random, SHA-256 hashed at rest, single use, expiring (setting, default 7 days), revocable, audited. Enrollment codes: 12 characters from an unambiguous alphabet, expiry, usage limit, revocation, usage counter. |
| Passwords | Minimum 10 characters with letters and digits (app + Supabase policy). Re-authentication before change. Neutral responses on reset (no account enumeration). |
| Authorization | Role guards in layouts **and** RLS on every table **and** checks inside every function. A direct URL or API call cannot bypass access. |
| Assessment integrity | Correct answers never sent before submission; grading on the server; attempt limits in the function and in unique indexes; row lock against double submission. |
| Progress integrity | No client write access; server merges coverage as sets; plausibility bound on new coverage per elapsed time. |
| Media | Private bucket; short-lived signed URLs created under the user's RLS context; optional Mux signed playback (RS256 tokens). |
| Rate limiting | PostgreSQL-backed fixed windows (sign-in per IP and per e-mail, password reset, invitation viewing/acceptance, code redemption, verification, reports). Fails closed. |
| Input validation | zod on every server action; database check constraints as a second line. |
| Errors | Stable codes mapped to French copy; internal details never shown; error boundaries show a reference digest only. |
| Audit | Triggers record create/update/delete on institutions, memberships, invitations, codes, courses, modules, lessons, quizzes, questions, permissions, assignments, roles, settings, certificates — field names only, no personal data. Explicit entries for attempt resets and account suspension. Append-only (no update/delete privilege). |
| Secrets | Service-role key server-only (`server-only` guard, never `NEXT_PUBLIC_`). |
| Headers | `X-Frame-Options: DENY`, `nosniff`, strict referrer policy, HSTS, restrictive permissions policy; `X-Powered-By` removed. Invitation and verification pages send `no-referrer`. |
| Suspension | Profile status blocks access in RLS and guards; Auth ban blocks sign-in and token refresh. |

## Privacy by design

- One personal account per teacher; membership is a separate, revocable, consented link.
- An institution sees a teacher's progress **only** for courses it assigned, and only while the teacher is an active, consenting member. Personal learning is never visible to it. This is enforced in RLS and tested (`tests/db/access.test.ts`, scenario 14).
- Teachers can leave an institution at any time from their profile.
- Consent text is shown at the moment of joining, stating exactly what the institution will see.
- Activity tracking is described honestly: it measures activity, not attention or competence. "Needs support" indicators are inactivity and exhausted attempts only, and are labelled as not being a competence assessment.
- Public certificate verification returns only name, course, completion date, duration, number, status and issuer.

## Before production — checklist (Morocco, Law 09-08)

These items depend on the operator and cannot be completed in code:

- [ ] Identify the data controller (legal entity) and replace the default issuer name in **Paramètres**.
- [ ] Complete the CNDP formalities (declaration or authorization) for the processing described in `/confidentialite`; add references to the notice.
- [ ] Confirm retention periods stated in the notice (3 years after last activity; audit logs 3 years) and schedule the purge job accordingly.
- [ ] Choose a Supabase region and document any cross-border transfer in the notice (CNDP authorization may be required for transfers outside Morocco).
- [ ] Sign a data processing agreement with Supabase, Vercel, Resend and Mux as applicable.
- [ ] Have the notice reviewed by counsel; set the support e-mail in **Paramètres**.
- [ ] Define the breach notification procedure and the person responsible for access requests.

## Known limitations

- PDF certificates and reports use standard PDF fonts (WinAnsi). French is fully supported; names in non-Latin scripts (e.g. Arabic) are transliterated where possible, otherwise replaced. Supporting Arabic requires embedding a font with shaping support.
- Video coverage tracking is activity-based and can be influenced by a determined user with direct API access within the plausibility bounds; it is not an attention measure and is never presented as one.
- Without Mux, videos are progressive MP4 via signed URLs: a learner with access can download the file during the URL's validity. Use Mux signed playback when this matters.
