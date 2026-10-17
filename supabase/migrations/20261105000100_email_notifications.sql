-- ════════════════════════════════════════════════════════════════════════════
-- SANADY — e-mail notifications (brief V3 §23 and partnership follow-up)
--
-- Events add a message to an outbox, in the same transaction as the event
-- itself: nothing can be forgotten, nothing is sent for an event that was
-- rolled back. The server sends the outbox (right after the page that made
-- the change, and in the daily job), never twice (claimed rows), and retries
-- failures. Each person can turn off non-essential e-mails in their profile;
-- notices about the deletion of data are always sent. E-mails carry no
-- score, no personal data of others — only a short notice and a link.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.profiles add column email_notifications boolean not null default true;
-- Each person sets their own preference (profiles_update_self policy).
grant update (email_notifications) on public.profiles to authenticated;

create table public.notification_outbox (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  payload     jsonb not null default '{}'::jsonb,
  dedupe_key  text unique,
  status      text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempts    smallint not null default 0,
  last_error  text,
  claimed_at  timestamptz,
  sent_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notification_outbox_pending_idx on public.notification_outbox (created_at) where status in ('pending', 'sending', 'failed');

alter table public.notification_outbox enable row level security;
revoke all on public.notification_outbox from anon, authenticated;
grant select, update on public.notification_outbox to service_role;

-- Queues a message for one person (skipped when they turned e-mails off,
-- except for essential notices). A dedupe key makes reminders idempotent.
create function private.notify(p_kind text, p_user uuid, p_payload jsonb, p_dedupe text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ok boolean;
begin
  if p_user is null then return; end if;
  select status = 'active' and (email_notifications or p_kind like 'deletion_%') into v_ok from public.profiles where id = p_user;
  if not coalesce(v_ok, false) then return; end if;
  insert into public.notification_outbox (kind, user_id, payload, dedupe_key) values (p_kind, p_user, coalesce(p_payload, '{}'::jsonb), p_dedupe)
  on conflict (dedupe_key) do nothing;
end;
$$;

create function private.notify_role(p_kind text, p_roles text[], p_payload jsonb, p_dedupe text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  select private.notify(p_kind, r.user_id, p_payload, case when p_dedupe is null then null else p_dedupe || ':' || r.user_id end)
    from public.platform_roles r join public.profiles p on p.id = r.user_id and p.status = 'active'
   where r.role::text = any (p_roles);
$$;

create function private.notify_signatories(p_kind text, p_payload jsonb, p_dedupe text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  select private.notify(p_kind, s.user_id, p_payload, case when p_dedupe is null then null else p_dedupe || ':' || s.user_id end)
    from public.partnership_signatories s where s.revoked_at is null;
$$;

-- ─── Events ────────────────────────────────────────────────────────────────

-- A course assigned to a teacher or an employee.
create function private.on_course_assigned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.notify('course_assigned', new.user_id, jsonb_build_object(
    'course_id', new.course_id, 'course', (select title from public.courses where id = new.course_id),
    'institution', (select name from public.institutions where id = new.institution_id), 'due_on', new.due_on),
    'assigned:' || new.id);
  return new;
end;
$$;
create trigger course_assignments_notify after insert on public.course_assignments for each row execute function private.on_course_assigned();

-- A certificate (or attestation) issued.
create function private.on_certificate_issued()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.notify('certificate_issued', new.user_id, jsonb_build_object('course', new.course_title, 'certificate_id', new.id), 'certificate:' || new.id);
  return new;
end;
$$;
create trigger certificates_notify after insert on public.certificates for each row execute function private.on_certificate_issued();

-- Support: a new request for the team; replies for the other side (never internal notes).
create function private.on_support_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.notify_role('support_opened', array['enterprise_manager'], jsonb_build_object(
    'request_id', new.id, 'reference', new.reference, 'subject', new.subject, 'priority', new.priority,
    'company', (select display_name from public.enterprise_tenants where id = new.tenant_id)), 'support_opened:' || new.id);
  return new;
end;
$$;
create trigger enterprise_support_requests_notify after insert on public.enterprise_support_requests for each row execute function private.on_support_request();

create function private.on_support_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.enterprise_support_requests;
  v_payload jsonb;
begin
  if new.internal then return new; end if;
  select * into r from public.enterprise_support_requests where id = new.request_id;
  -- The opening message is announced by the request itself.
  if not exists (select 1 from public.enterprise_support_messages m where m.request_id = new.request_id and m.id <> new.id) then return new; end if;
  v_payload := jsonb_build_object('request_id', r.id, 'reference', r.reference, 'subject', r.subject, 'institution_id', r.institution_id,
                                  'company', (select display_name from public.enterprise_tenants where id = r.tenant_id));
  if new.from_team then
    perform private.notify('support_reply', m.user_id, v_payload, 'support_reply:' || new.id || ':' || m.user_id)
       from public.institution_memberships m where m.institution_id = r.institution_id and m.role = 'admin' and m.status = 'active';
  elsif r.assigned_to is not null then
    perform private.notify('support_client_reply', r.assigned_to, v_payload, 'support_client_reply:' || new.id);
  else
    perform private.notify_role('support_client_reply', array['enterprise_manager'], v_payload, 'support_client_reply:' || new.id);
  end if;
  return new;
end;
$$;
create trigger enterprise_support_messages_notify after insert on public.enterprise_support_messages for each row execute function private.on_support_message();

-- Partner portal conversation.
create function private.on_partner_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload jsonb := jsonb_build_object('organization_id', new.organization_id, 'organization', (select name from public.partner_organizations where id = new.organization_id));
begin
  if new.from_partner then
    perform private.notify_role('portal_message_to_team', array['partnership_coordinator', 'partnership_manager'], v_payload, 'portal_msg:' || new.id);
  else
    perform private.notify('portal_message_to_partner', pm.user_id, v_payload, 'portal_msg:' || new.id || ':' || pm.user_id)
       from public.partner_portal_members pm where pm.organization_id = new.organization_id and pm.revoked_at is null;
  end if;
  return new;
end;
$$;
create trigger partner_messages_notify after insert on public.partner_messages for each row execute function private.on_partner_message();

-- A partner report shared; approvals awaited; deletions.
create function private.on_partner_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'shared' and old.status is distinct from 'shared' then
    perform private.notify('report_shared', pm.user_id, jsonb_build_object('report_id', new.id, 'title', new.title), 'report_shared:' || new.id || ':' || pm.user_id)
       from public.partner_portal_members pm where pm.organization_id = new.organization_id and pm.revoked_at is null;
  end if;
  return new;
end;
$$;
create trigger partnership_reports_notify after update of status on public.partnership_reports for each row execute function private.on_partner_report();

create function private.on_enterprise_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status::text = 'internal_review' and old.status::text is distinct from 'internal_review' then
    perform private.notify_signatories('approval_needed', jsonb_build_object(
      'what', tg_argv[0], 'id', new.id, 'reference', new.reference, 'title', new.title), 'approval:' || tg_argv[0] || ':' || new.id || ':' || now()::date);
  end if;
  return new;
end;
$$;
create trigger enterprise_contracts_notify after update of status on public.enterprise_contracts for each row execute function private.on_enterprise_review('contract');
create trigger enterprise_proposals_notify after update of status on public.enterprise_proposals for each row execute function private.on_enterprise_review('proposal');

create function private.on_data_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload jsonb := jsonb_build_object('tenant_id', new.tenant_id, 'space', (select display_name from public.enterprise_tenants where id = new.tenant_id),
                                        'execute_after', new.execute_after);
begin
  if new.status = 'confirmed' and old.status = 'proposed' then
    perform private.notify_role('deletion_confirmed', array['enterprise_manager'], v_payload, 'deletion_confirmed:' || new.id);
  elsif new.status = 'executed' and old.status = 'confirmed' then
    perform private.notify('deletion_executed', new.proposed_by, v_payload, 'deletion_executed:' || new.id || ':p');
    perform private.notify('deletion_executed', new.confirmed_by, v_payload, 'deletion_executed:' || new.id || ':c');
  end if;
  return new;
end;
$$;
create trigger data_deletions_notify after update of status on public.data_deletions for each row execute function private.on_data_deletion();

-- ─── Daily reminders (server only, idempotent) ─────────────────────────────
create function public.queue_daily_notifications()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before integer := (select count(*) from public.notification_outbox);
begin
  -- An assigned course due in 3 days and not finished.
  perform private.notify('assignment_due', ca.user_id, jsonb_build_object('course_id', ca.course_id, 'course', c.title, 'due_on', ca.due_on),
                         'due:' || ca.id || ':' || ca.due_on)
     from public.course_assignments ca join public.courses c on c.id = ca.course_id
    where ca.revoked_at is null and ca.due_on = current_date + 3
      and not exists (select 1 from public.enrollments e where e.user_id = ca.user_id and e.course_id = ca.course_id and e.status = 'completed');
  -- A contract entering its renewal notice period.
  perform private.notify_role('renewal_due', array['enterprise_manager'],
                              jsonb_build_object('contract_id', c.id, 'reference', c.reference, 'title', c.title, 'end_on', c.end_on),
                              'renewal:' || c.id || ':' || c.end_on)
     from public.enterprise_contracts c
    where c.status in ('signed', 'active') and c.end_on is not null and c.end_on - c.renewal_notice_days <= current_date;
  -- A deletion date in 30 days, 7 days, or today (nothing is deleted by this: a person must act).
  perform private.notify_role('deletion_due', array['enterprise_manager'],
                              jsonb_build_object('tenant_id', t.id, 'space', t.display_name, 'due_on', t.deletion_due_on, 'days', t.deletion_due_on - current_date),
                              'deletion_due:' || t.id || ':' || t.deletion_due_on || ':' || (t.deletion_due_on - current_date))
     from public.enterprise_tenants t
    where t.data_deleted_at is null and t.deletion_due_on - current_date in (30, 7, 0);
  return (select count(*) from public.notification_outbox) - v_before;
end;
$$;

-- ─── Sending (server only) ─────────────────────────────────────────────────
-- Claims up to p_limit messages (pending, failed < 5 attempts, or stuck in
-- « sending » for 10 minutes) with the recipient's address and name.
create function public.claim_notifications(p_limit integer default 25)
returns table (id uuid, kind text, payload jsonb, email text, name text)
language sql
security definer
set search_path = ''
as $$
  with picked as (
    select o.id from public.notification_outbox o
     where o.status = 'pending' or (o.status = 'failed' and o.attempts < 5)
        or (o.status = 'sending' and o.claimed_at < now() - interval '10 minutes')
     order by o.created_at
     limit greatest(1, least(p_limit, 100))
     for update skip locked
  )
  update public.notification_outbox o set status = 'sending', claimed_at = now(), attempts = o.attempts + 1
    from picked, public.profiles p
   where o.id = picked.id and p.id = o.user_id
  returning o.id, o.kind, o.payload, p.email, coalesce(nullif(p.full_name, ''), p.email);
$$;

create function public.complete_notification(p_id uuid, p_ok boolean, p_error text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notification_outbox
     set status = case when p_ok then 'sent' else 'failed' end, sent_at = case when p_ok then now() end, last_error = left(p_error, 500)
   where id = p_id;
$$;

revoke execute on function private.notify(text, uuid, jsonb, text), private.notify_role(text, text[], jsonb, text), private.notify_signatories(text, jsonb, text)
  from public, anon, authenticated;
revoke execute on function public.queue_daily_notifications(), public.claim_notifications(integer), public.complete_notification(uuid, boolean, text)
  from public, anon, authenticated;
grant execute on function public.queue_daily_notifications(), public.claim_notifications(integer), public.complete_notification(uuid, boolean, text)
  to service_role;
