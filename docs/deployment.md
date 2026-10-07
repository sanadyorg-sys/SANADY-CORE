# Deployment

Recommended: **Supabase** (database, auth, storage) + **Vercel** (Next.js). Any Node.js ≥ 20.9 host works (`npm run build && npm start`).

## 1. Supabase project

1. Create a project (choose the region with your data-protection obligations in mind — see the security doc).
2. **Authentication → Providers → Email**: enable e-mail/password; **disable "Allow new users to sign up"**; enable "Confirm email" is not required (accounts are created confirmed by the server after token validation).
3. **Authentication → Policies**: minimum password length 10, require letters and digits; enable leaked-password protection if available.
4. **Authentication → URL configuration**: Site URL = your production URL; add `https://<domain>/auth/confirm` to redirect URLs.
5. **Authentication → Email templates → Reset password**: use `supabase/templates/recovery.html` (the link must point to `/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/nouveau-mot-de-passe`).
6. **Authentication → SMTP**: configure a custom SMTP sender (the default Supabase sender is rate-limited and not for production).
7. Apply the schema:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
8. **Storage**: the migration creates `course-media` (private, 2 GB limit per file) and `course-covers` (public). Ensure the project's global upload limit allows your largest video.

## 2. Environment variables

| Variable | Where | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | yes |
| `NEXT_PUBLIC_APP_URL` | public | yes — used in e-mails and certificate QR codes |
| `RESEND_API_KEY`, `EMAIL_FROM` | server | recommended (required for join-by-code) |
| `MUX_SIGNING_KEY_ID`, `MUX_SIGNING_PRIVATE_KEY` | server | optional (adaptive video) |

Never prefix the service-role key with `NEXT_PUBLIC_`.

## 3. Vercel

1. Import the repository; framework preset Next.js; Node 22.
2. Add the environment variables (Production and Preview — use a separate Supabase project for Preview).
3. Deploy. `proxy.ts` runs on every navigation to refresh sessions.

## 4. First administrator

```bash
# .env.local must contain the production Supabase URL and service-role key
npm run admin:create -- --email direction@exemple.ma --first Prénom --last Nom
```
Send the printed one-time link to that person only. They set a password, complete their profile and can then invite everyone else.

Then, in **Paramètres**: set the issuer name, signatory, support e-mail; create course categories.

## 5. E-mail (Resend)

Verify your sending domain in Resend (SPF, DKIM), set `RESEND_API_KEY` and `EMAIL_FROM="SANADY <no-reply@votre-domaine>"`. The **Paramètres** page shows whether e-mail is configured.

## 6. Video (Mux, optional)

1. In Mux, create a signing key; base64-encode the private key PEM: `base64 -w0 key.pem`.
2. Set `MUX_SIGNING_KEY_ID` and `MUX_SIGNING_PRIVATE_KEY`.
3. Upload videos in Mux with a **signed** playback policy and paste the playback ID in the lesson editor (tab "Diffusion adaptative").

## 7. Backups and recovery

- Enable **Point-in-Time Recovery** (Supabase Pro add-on) or at least daily backups (included on paid plans).
- Storage objects are not covered by database backups: schedule an export of the `course-media` bucket (e.g. `rclone` with S3-compatible credentials) to separate storage.
- Recovery drill (quarterly): restore the latest backup into a staging project, run `npm test` against migrations, sign in as a test account, open a lesson and verify a certificate.
- Keep migrations in version control; never edit an applied migration.

## 8. Operations

- **Purge job**: schedule (Supabase cron / `pg_cron`) the deletion of `private.rate_limits` rows older than one day and of expired, unaccepted invitations older than 90 days; apply the retention policy of the privacy notice.
- **Monitoring**: Vercel logs for server errors (error digests shown to users match server logs); Supabase dashboard for slow queries.
- **Release checklist**: `npm run typecheck && npm run lint && npm test && npm run build && npm run test:e2e` (CI runs the same).
