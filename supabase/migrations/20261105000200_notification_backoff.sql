-- A failed e-mail is retried later, not on the next page view: 15 minutes
-- after the first failure, 30 after the second… 5 attempts at most.
create or replace function public.claim_notifications(p_limit integer default 25)
returns table (id uuid, kind text, payload jsonb, email text, name text)
language sql
security definer
set search_path = ''
as $$
  with picked as (
    select o.id from public.notification_outbox o
     where o.status = 'pending'
        or (o.status = 'failed' and o.attempts < 5 and o.claimed_at < now() - make_interval(mins => 15 * o.attempts))
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
