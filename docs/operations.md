# Operations

How the platform is run day to day: backups, data retention, monitoring, incidents and costs.

## 1. Backups and restore

### Today (Supabase free plan)

The free plan has **no automatic backup** and **pauses the project after 7 days without activity**. Until the project moves to Supabase Pro:

| What | How | When |
|---|---|---|
| Database export | `npm run db:backup` (or `npm run db:backup -- --out E:\Sauvegardes` for an external/encrypted drive) | Every week, and **before every migration** |
| Files (videos, PDFs, covers, library) | Not exported by the script (it lists them in `storage-objects.json`); originals should be kept by the content team | — |

Each export is a folder `backups/<date>/` with one JSON file per table, the list of stored files and a `manifest.json` (row counts, applied migrations). **It contains personal data**: keep it on an encrypted drive, never in Git (`backups/` is ignored), and delete copies older than 3 months.

### Recommended (before real teachers use the platform)

Move the Supabase project to **Pro**: daily automatic backups kept 7 days, no pausing, point-in-time recovery as an option. Keep `npm run db:backup` before migrations as a second, portable copy.

### Restore

1. Create or reset the Supabase project; apply the schema: `npm run db:apply` (all migrations in `supabase/migrations`).
2. Recreate auth accounts first (profiles reference `auth.users`): with Supabase Pro, restore the platform backup instead (includes auth); with a JSON export only, accounts must be re-invited.
3. Load tables in dependency order (institutions → courses → modules → lessons → quizzes → questions → enrollments → progress → attempts → certificates) with a one-off SQL script built from the JSON files, as the `postgres` role.
4. Re-upload stored files from the content team's originals.
5. Run the test journey (`docs/testing.md`) before reopening.

## 2. Data retention (automatic)

A daily job (`pg_cron`, 03:15 UTC, job `sanady-retention`) runs `private.run_retention()`:

| Data | Kept | Rule in the privacy notice |
|---|---|---|
| Access requests (website form) | 12 months after the decision (or after submission if never handled) | « 12 mois au plus » |
| Administration audit log | 3 years | « Journaux d’administration : 3 ans » |
| Rate-limit counters | 1 day | Technical |

**Not automated (decision needed from the Foundation):** deleting or anonymising learner accounts **3 years after their last activity**, as the notice states. The procedure to validate: notify the person 30 days before, keep certificate verification data (number, name, course, date) so certificates remain verifiable, then delete the account and its progress. Until validated, this is done manually by an administrator.

Check the job: in Supabase SQL editor, `select * from cron.job_run_details order by start_time desc limit 5;`

## 3. Monitoring

| What | Where |
|---|---|
| Application errors (server) | Vercel → project → **Logs** (filter « Error »). Error pages show a reference code: search it in the logs. |
| Deployments | Vercel → **Deployments** (each push to `main` deploys automatically). |
| Database health, slow queries, storage use | Supabase → **Reports** and **Advisors** (run the security and performance advisors monthly). |
| Scheduled jobs | `cron.job_run_details` (see above). |
| Uptime | Recommended: a free external monitor (e.g. UptimeRobot) on `/connexion` every 5 minutes, alerts to the support e-mail. |

## 4. Incidents

1. **Site down**: check Vercel status and the last deployment; roll back with « Promote to production » on the previous deployment.
2. **Database paused (free plan)**: Supabase → project → « Restore project ». Then move to Pro.
3. **Suspected account compromise**: suspend the account (Admin → Enseignants → Suspendre), reset its 2FA (`npm run mfa:reset -- --email …`), review Admin → Journal d’activité.
4. **Personal data breach**: within 72 hours, inform the Foundation's data controller who decides on notification to the CNDP and to the persons concerned (Law 09-08); keep a record (date, data, people, measures).
5. **Lost administrator phone (2FA)**: another administrator runs `npm run mfa:reset -- --email …`.

## 5. Estimated costs (about 5,000 teachers)

Assumptions: 5,000 accounts, about 1,000 active per month, 10 courses with 3 hours of video each, everyone not online at the same time. **Prices are indicative (public price lists known in 2026) — check current pricing before committing.**

| Service | Plan | Indicative monthly cost | Notes |
|---|---|---|---|
| Supabase | Pro | about 25 USD | Database, auth, storage (100 GB included), daily backups. Video egress beyond the included quota is billed per GB. |
| Vercel | Pro (1 member) | about 20 USD | The free Hobby plan is for personal, non-commercial use; a foundation's platform should use Pro. |
| Resend (e-mail) | Free → Pro | 0 to 20 USD | Free: 3,000 e-mails/month (enough for invitations); Pro if notifications are added. |
| Video | Supabase storage (current) | included, then per GB of egress | 3 h of video ≈ 1.5 GB per learner who watches everything; 1,000 learners/month ≈ 1.5 TB of egress → significant: prefer Mux for video at scale. |
| Video | Mux (optional) | about 0.001–0.002 USD per minute watched + storage | 1,000 learners × 3 h ≈ 180,000 minutes ≈ 200–350 USD/month at full use; adaptive quality, protected playback. |
| Domain | sanady.org subdomain | 0 | e.g. `formation.sanady.org`, configured at the Foundation's DNS provider. |

**Order of magnitude:** about **45–65 USD/month** without heavy video use; video delivery becomes the main cost as usage grows: keep videos short, and use Mux when viewing exceeds the storage plan's egress.
