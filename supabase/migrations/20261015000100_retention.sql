-- ════════════════════════════════════════════════════════════════════════════
-- SANADY · Data retention (privacy notice, Law 09-08)
--
-- Runs daily (pg_cron, when available):
--   · access requests: deleted 12 months after their decision, or 12 months
--     after submission if never handled (notice: « 12 mois au plus »);
--   · audit log entries older than 3 years (notice: « Journaux
--     d’administration : 3 ans »);
--   · expired rate-limit counters (technical data, kept 1 day).
-- Learner accounts are NOT deleted automatically: the « 3 years after last
-- activity » rule needs the Foundation's validation of the procedure
-- (warning e-mail, certificate retention) — see docs/operations.md.
-- ════════════════════════════════════════════════════════════════════════════

create function private.run_retention()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requests integer;
  v_audit    integer;
  v_limits   integer;
begin
  delete from public.access_requests
   where (status <> 'pending' and handled_at < now() - interval '12 months')
      or (status = 'pending' and created_at < now() - interval '12 months');
  get diagnostics v_requests = row_count;

  delete from public.audit_logs where created_at < now() - interval '3 years';
  get diagnostics v_audit = row_count;

  delete from private.rate_limits where window_started_at < now() - interval '1 day';
  get diagnostics v_limits = row_count;

  return jsonb_build_object('access_requests', v_requests, 'audit_logs', v_audit, 'rate_limits', v_limits, 'ran_at', now());
end;
$$;

revoke execute on function private.run_retention() from public, anon, authenticated;
grant execute on function private.run_retention() to service_role;

-- Daily schedule at 03:15 (UTC) where pg_cron exists (Supabase). The test
-- database has no pg_cron, so everything is dynamic and conditional.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
    execute $cron$select cron.schedule('sanady-retention', '15 3 * * *', 'select private.run_retention()')$cron$;
  end if;
end;
$$;
