-- ════════════════════════════════════════════════════════════════════════════
-- SANADY · 0005 · Business functions (RPC)
--
-- Error contract: functions raise SQLSTATE P0001 with a stable snake_case
-- message (e.g. 'attempts_exhausted'). The application maps these codes to
-- French copy in src/lib/errors.ts. No internal detail is ever returned.
-- ════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- 1. ONBOARDING & ACCOUNTS
-- ════════════════════════════════════════════════════════════════════════════

create function public.complete_onboarding(
  p_first_name    text,
  p_last_name     text,
  p_job_title     text default null,
  p_subject_area  text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  perform private.require(v_uid is not null, 'not_authenticated');
  perform private.require(char_length(btrim(coalesce(p_first_name, ''))) between 1 and 100, 'invalid_first_name');
  perform private.require(char_length(btrim(coalesce(p_last_name, ''))) between 1 and 100, 'invalid_last_name');

  update public.profiles
     set first_name = btrim(p_first_name),
         last_name = btrim(p_last_name),
         job_title = nullif(btrim(coalesce(p_job_title, '')), ''),
         subject_area = nullif(btrim(coalesce(p_subject_area, '')), ''),
         privacy_acknowledged_at = coalesce(privacy_acknowledged_at, now()),
         onboarded_at = coalesce(onboarded_at, now())
   where id = v_uid;
end;
$$;

create function public.set_user_status(p_user uuid, p_status public.account_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require(private.is_sanady_admin(), 'forbidden');
  perform private.require(p_user <> auth.uid(), 'cannot_change_own_status');

  update public.profiles set status = p_status where id = p_user;
  perform private.require(found, 'not_found');

  perform private.log_audit(
    case p_status when 'suspended' then 'user_suspended' else 'user_reactivated' end,
    'profiles', p_user
  );
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. INVITATIONS
-- ════════════════════════════════════════════════════════════════════════════

create function public.create_invitation(
  p_kind         public.invitation_kind,
  p_email        text,
  p_institution  uuid,
  p_token_hash   text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email   text := lower(btrim(p_email));
  v_days    smallint;
  v_id      uuid;
begin
  perform private.require(auth.uid() is not null, 'not_authenticated');

  if p_kind = 'institution_teacher' then
    perform private.require(
      private.is_sanady_admin() or private.is_institution_admin(p_institution),
      'forbidden'
    );
  else
    perform private.require(private.is_sanady_admin(), 'forbidden');
  end if;

  if p_kind in ('institution_admin', 'institution_teacher') then
    perform private.require(p_institution is not null, 'institution_required');
    perform private.require(
      exists (select 1 from public.institutions i where i.id = p_institution and i.status = 'active'),
      'institution_inactive'
    );
    perform private.require(
      not exists (
        select 1
          from public.institution_memberships m
          join public.profiles p on p.id = m.user_id
         where m.institution_id = p_institution
           and p.email = v_email
           and m.status = 'active'
      ),
      'already_member'
    );
  else
    perform private.require(p_institution is null, 'institution_not_allowed');
  end if;

  if p_kind = 'platform_admin' then
    perform private.require(
      not exists (
        select 1 from public.platform_roles r join public.profiles p on p.id = r.user_id
         where p.email = v_email
      ),
      'already_admin'
    );
  end if;

  select invitation_validity_days into v_days from public.platform_settings where id;

  -- Replace any open invitation for the same person and scope.
  update public.invitations
     set revoked_at = now(), revoked_by = auth.uid()
   where kind = p_kind
     and email = v_email
     and coalesce(institution_id, '00000000-0000-0000-0000-000000000000'::uuid)
         = coalesce(p_institution, '00000000-0000-0000-0000-000000000000'::uuid)
     and accepted_at is null
     and revoked_at is null;

  insert into public.invitations (kind, email, institution_id, token_hash, invited_by, expires_at)
  values (p_kind, v_email, p_institution, p_token_hash, auth.uid(), now() + make_interval(days => v_days))
  returning id into v_id;

  return v_id;
end;
$$;

create function public.mark_invitation_sent(p_invitation uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.invitations set email_sent_at = now() where id = p_invitation;
$$;

create function public.revoke_invitation(p_invitation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.invitations;
begin
  select * into v_inv from public.invitations where id = p_invitation for update;
  perform private.require(found, 'not_found');
  perform private.require(
    private.is_sanady_admin()
      or (v_inv.kind = 'institution_teacher' and private.is_institution_admin(v_inv.institution_id)),
    'forbidden'
  );
  perform private.require(v_inv.accepted_at is null, 'invitation_already_accepted');
  perform private.require(v_inv.revoked_at is null, 'invitation_revoked');

  update public.invitations set revoked_at = now(), revoked_by = auth.uid() where id = p_invitation;
end;
$$;

-- Server-side lookup (service role only): describes an invitation without
-- consuming it, so the acceptance page can be rendered.
create function public.describe_invitation(p_token_hash text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
           'id', i.id,
           'kind', i.kind,
           'email', i.email,
           'institution_id', i.institution_id,
           'institution_name', inst.name,
           'expires_at', i.expires_at,
           'state', case
                      when i.revoked_at is not null then 'revoked'
                      when i.accepted_at is not null then 'accepted'
                      when i.expires_at <= now() then 'expired'
                      else 'valid'
                    end,
           'account_exists', exists (select 1 from public.profiles p where p.email = i.email)
         )
    from public.invitations i
    left join public.institutions inst on inst.id = i.institution_id
   where i.token_hash = p_token_hash;
$$;

-- Internal: create (or reactivate) a teacher membership via an enrollment
-- code, enforcing expiry, revocation and the usage limit under a row lock.
create function private.join_with_code(p_code_id uuid, p_user uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code   public.enrollment_codes;
  v_member public.institution_memberships;
begin
  select * into v_code from public.enrollment_codes where id = p_code_id for update;
  perform private.require(found, 'invalid_code');
  perform private.require(v_code.revoked_at is null, 'code_revoked');
  perform private.require(v_code.expires_at > now(), 'code_expired');
  perform private.require(v_code.uses_count < v_code.max_uses, 'code_exhausted');
  perform private.require(
    exists (select 1 from public.institutions i where i.id = v_code.institution_id and i.status = 'active'),
    'institution_inactive'
  );

  select * into v_member from public.institution_memberships
   where institution_id = v_code.institution_id and user_id = p_user;

  if found and v_member.status = 'active' then
    raise exception using errcode = 'P0001', message = 'already_member';
  end if;

  if found then
    update public.institution_memberships
       set status = 'active', role = 'teacher', source = 'code', enrollment_code_id = v_code.id,
           consented_at = now(), revoked_at = null, revoked_by = null, created_at = now()
     where id = v_member.id;
  else
    insert into public.institution_memberships (institution_id, user_id, role, source, enrollment_code_id, consented_at)
    values (v_code.institution_id, p_user, 'teacher', 'code', v_code.id, now());
  end if;

  update public.enrollment_codes set uses_count = uses_count + 1 where id = v_code.id;
  return v_code.institution_id;
end;
$$;

-- Service role only. Consumes an invitation for an authenticated identity
-- whose e-mail has been verified by the server (token received by e-mail,
-- or an existing session for the same address).
create function public.accept_invitation(p_token_hash text, p_user uuid, p_consent boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv     public.invitations;
  v_email   text;
  v_member  public.institution_memberships;
  v_inst    uuid;
begin
  select * into v_inv from public.invitations where token_hash = p_token_hash for update;
  perform private.require(found, 'invitation_not_found');
  perform private.require(v_inv.revoked_at is null, 'invitation_revoked');
  perform private.require(v_inv.accepted_at is null, 'invitation_already_accepted');
  perform private.require(v_inv.expires_at > now(), 'invitation_expired');

  select email into v_email from public.profiles where id = p_user and status = 'active';
  perform private.require(found, 'account_unavailable');
  perform private.require(v_email = v_inv.email, 'invitation_email_mismatch');

  if v_inv.kind = 'platform_admin' then
    insert into public.platform_roles (user_id, role, granted_by)
    values (p_user, 'sanady_admin', v_inv.invited_by)
    on conflict (user_id) do nothing;

  elsif v_inv.kind = 'institution_admin' then
    select * into v_member from public.institution_memberships
     where institution_id = v_inv.institution_id and user_id = p_user;
    if found then
      update public.institution_memberships
         set role = 'admin', status = 'active', source = 'invitation',
             revoked_at = null, revoked_by = null
       where id = v_member.id;
    else
      insert into public.institution_memberships (institution_id, user_id, role, source)
      values (v_inv.institution_id, p_user, 'admin', 'invitation');
    end if;

  elsif v_inv.kind = 'institution_teacher' then
    perform private.require(p_consent is true, 'consent_required');
    if v_inv.enrollment_code_id is not null then
      v_inst := private.join_with_code(v_inv.enrollment_code_id, p_user);
    else
      select * into v_member from public.institution_memberships
       where institution_id = v_inv.institution_id and user_id = p_user;
      if found and v_member.status = 'active' then
        raise exception using errcode = 'P0001', message = 'already_member';
      elsif found then
        update public.institution_memberships
           set role = 'teacher', status = 'active', source = 'invitation', consented_at = now(),
               revoked_at = null, revoked_by = null, created_at = now()
         where id = v_member.id;
      else
        insert into public.institution_memberships (institution_id, user_id, role, source, consented_at)
        values (v_inv.institution_id, p_user, 'teacher', 'invitation', now());
      end if;
    end if;
  end if;
  -- kind = 'teacher': the personal account itself is the outcome.

  update public.invitations set accepted_at = now(), accepted_by = p_user where id = v_inv.id;

  return jsonb_build_object('kind', v_inv.kind, 'institution_id', v_inv.institution_id);
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. ENROLLMENT CODES
-- ════════════════════════════════════════════════════════════════════════════

create function public.create_enrollment_code(
  p_institution  uuid,
  p_code         text,
  p_label        text,
  p_max_uses     integer,
  p_expires_at   timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.require(
    private.is_sanady_admin() or private.is_institution_admin(p_institution),
    'forbidden'
  );
  perform private.require(p_expires_at > now(), 'invalid_expiry');
  perform private.require(p_expires_at <= now() + interval '366 days', 'invalid_expiry');

  insert into public.enrollment_codes (institution_id, code, label, max_uses, expires_at, created_by)
  values (p_institution, upper(p_code), nullif(btrim(coalesce(p_label, '')), ''), p_max_uses, p_expires_at, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

create function public.revoke_enrollment_code(p_code_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inst uuid;
begin
  select institution_id into v_inst from public.enrollment_codes where id = p_code_id for update;
  perform private.require(found, 'not_found');
  perform private.require(private.is_sanady_admin() or private.is_institution_admin(v_inst), 'forbidden');

  update public.enrollment_codes
     set revoked_at = now(), revoked_by = auth.uid()
   where id = p_code_id and revoked_at is null;
end;
$$;

-- Service role only: validates a code before any account is created.
create function public.describe_enrollment_code(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
           'id', c.id,
           'institution_id', i.id,
           'institution_name', i.name,
           'state', case
                      when c.revoked_at is not null then 'revoked'
                      when c.expires_at <= now() then 'expired'
                      when c.uses_count >= c.max_uses then 'exhausted'
                      when i.status <> 'active' then 'institution_inactive'
                      else 'valid'
                    end
         )
    from public.enrollment_codes c
    join public.institutions i on i.id = c.institution_id
   where c.code = upper(btrim(p_code));
$$;

-- Service role only: a person without an account redeems a code. Account
-- ownership is verified by e-mailing them an invitation bound to the code.
create function public.create_code_invitation(p_code text, p_email text, p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code  public.enrollment_codes;
  v_email text := lower(btrim(p_email));
  v_days  smallint;
  v_id    uuid;
begin
  select * into v_code from public.enrollment_codes where code = upper(btrim(p_code));
  perform private.require(found, 'invalid_code');
  perform private.require(v_code.revoked_at is null, 'code_revoked');
  perform private.require(v_code.expires_at > now(), 'code_expired');
  perform private.require(v_code.uses_count < v_code.max_uses, 'code_exhausted');

  select invitation_validity_days into v_days from public.platform_settings where id;

  update public.invitations
     set revoked_at = now()
   where kind = 'institution_teacher' and email = v_email and institution_id = v_code.institution_id
     and accepted_at is null and revoked_at is null;

  insert into public.invitations (kind, email, institution_id, enrollment_code_id, token_hash, expires_at)
  values ('institution_teacher', v_email, v_code.institution_id, v_code.id, p_token_hash,
          least(now() + make_interval(days => v_days), v_code.expires_at))
  returning id into v_id;
  return v_id;
end;
$$;

-- Authenticated teacher with an existing account joins via a code.
create function public.redeem_enrollment_code(p_code text, p_consent boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code_id uuid;
begin
  perform private.require(auth.uid() is not null, 'not_authenticated');
  perform private.require(private.is_active_user(), 'account_unavailable');
  perform private.require(p_consent is true, 'consent_required');

  select id into v_code_id from public.enrollment_codes where code = upper(btrim(p_code));
  perform private.require(found, 'invalid_code');

  return private.join_with_code(v_code_id, auth.uid());
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. MEMBERSHIPS
-- ════════════════════════════════════════════════════════════════════════════

create function private.end_membership(p_membership uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m public.institution_memberships;
begin
  select * into v_m from public.institution_memberships where id = p_membership for update;
  update public.institution_memberships
     set status = 'revoked', revoked_at = now(), revoked_by = auth.uid()
   where id = p_membership and status = 'active';

  -- Access granted through this institution ends; the teacher's own
  -- progress, attempts and certificates are preserved.
  update public.course_assignments
     set revoked_at = now(), revoked_by = auth.uid()
   where institution_id = v_m.institution_id and user_id = v_m.user_id and revoked_at is null;
end;
$$;

create function public.revoke_membership(p_membership uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m public.institution_memberships;
begin
  select * into v_m from public.institution_memberships where id = p_membership;
  perform private.require(found, 'not_found');
  perform private.require(
    private.is_sanady_admin()
      or (v_m.role = 'teacher' and private.is_institution_admin(v_m.institution_id)),
    'forbidden'
  );
  perform private.require(v_m.status = 'active', 'membership_inactive');
  perform private.end_membership(p_membership);
end;
$$;

-- A teacher may leave an institution at any time (withdraws consent).
create function public.leave_institution(p_institution uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.institution_memberships
   where institution_id = p_institution and user_id = auth.uid() and status = 'active' and role = 'teacher';
  perform private.require(found, 'not_found');
  perform private.end_membership(v_id);
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. COURSE AUTHORING (SANADY administrators)
-- ════════════════════════════════════════════════════════════════════════════

-- Returns the list of blocking issues preventing publication.
create function public.validate_course(p_course uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_issues jsonb := '[]'::jsonb;
  v_course public.courses;
begin
  perform private.require(private.is_sanady_admin(), 'forbidden');
  select * into v_course from public.courses where id = p_course;
  perform private.require(found, 'not_found');

  if char_length(btrim(v_course.description)) < 20 then
    v_issues := v_issues || jsonb_build_object('code', 'course_description_missing');
  end if;
  if cardinality(v_course.objectives) = 0 then
    v_issues := v_issues || jsonb_build_object('code', 'course_objectives_missing');
  end if;
  if v_course.category_id is null then
    v_issues := v_issues || jsonb_build_object('code', 'course_category_missing');
  end if;

  if not exists (select 1 from public.modules m where m.course_id = p_course and m.archived_at is null) then
    v_issues := v_issues || jsonb_build_object('code', 'course_no_modules');
  end if;

  select v_issues || coalesce(jsonb_agg(jsonb_build_object('code', 'module_no_lessons', 'module_id', m.id, 'label', m.title)), '[]'::jsonb)
    into v_issues
    from public.modules m
   where m.course_id = p_course and m.archived_at is null
     and not exists (select 1 from public.lessons l where l.module_id = m.id and l.archived_at is null);

  select v_issues || coalesce(jsonb_agg(jsonb_build_object('code', 'module_no_quiz', 'module_id', m.id, 'label', m.title)), '[]'::jsonb)
    into v_issues
    from public.modules m
   where m.course_id = p_course and m.archived_at is null
     and not exists (
       select 1 from public.quizzes q
        where q.module_id = m.id
          and exists (select 1 from public.questions qu where qu.quiz_id = q.id and qu.archived_at is null)
     );

  select v_issues || coalesce(jsonb_agg(jsonb_build_object('code', 'lesson_no_content', 'lesson_id', l.id, 'label', l.title)), '[]'::jsonb)
    into v_issues
    from public.lessons l
    join public.modules m on m.id = l.module_id and m.archived_at is null
   where l.course_id = p_course and l.archived_at is null
     and (
       (l.kind = 'video' and (l.video_provider is null or l.video_ref is null))
       or (l.kind = 'pdf' and (l.pdf_path is null or l.pdf_page_count is null))
     );

  select v_issues || coalesce(jsonb_agg(jsonb_build_object('code', 'question_invalid', 'question_id', qu.id, 'label', left(qu.prompt, 80))), '[]'::jsonb)
    into v_issues
    from public.questions qu
    join public.quizzes q on q.id = qu.quiz_id and q.course_id = p_course
    join public.modules m on m.id = q.module_id and m.archived_at is null
   where qu.archived_at is null
     and (
       (select count(*) from public.question_options o where o.question_id = qu.id) < 2
       or (qu.kind = 'single'   and (select count(*) from public.question_options o where o.question_id = qu.id and o.is_correct) <> 1)
       or (qu.kind = 'multiple' and (select count(*) from public.question_options o where o.question_id = qu.id and o.is_correct) < 1)
     );

  return v_issues;
end;
$$;

-- Publication guard: whatever the path (RPC or direct UPDATE), a course can
-- only become 'published' when it passes validation.
create function private.courses_publication_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_issues jsonb;
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    v_issues := public.validate_course(new.id);
    if jsonb_array_length(v_issues) > 0 then
      raise exception using errcode = 'P0001', message = 'course_not_publishable',
        detail = v_issues::text;
    end if;
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end;
$$;

create trigger courses_publication_guard
  before update of status on public.courses
  for each row execute function private.courses_publication_guard();

-- Reorder helpers: two passes avoid transient unique-position collisions.
create function public.reorder_modules(p_course uuid, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require(private.is_sanady_admin(), 'forbidden');
  perform private.require(
    (select count(*) from public.modules where course_id = p_course and archived_at is null) = cardinality(p_ids)
    and (select count(*) from public.modules where course_id = p_course and archived_at is null and id = any(p_ids)) = cardinality(p_ids),
    'invalid_order'
  );
  update public.modules set position = position + 100000 where course_id = p_course and archived_at is null;
  update public.modules m set position = o.ord - 1
    from unnest(p_ids) with ordinality as o(id, ord)
   where m.id = o.id;
end;
$$;

create function public.reorder_lessons(p_module uuid, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require(private.is_sanady_admin(), 'forbidden');
  perform private.require(
    (select count(*) from public.lessons where module_id = p_module and archived_at is null) = cardinality(p_ids)
    and (select count(*) from public.lessons where module_id = p_module and archived_at is null and id = any(p_ids)) = cardinality(p_ids),
    'invalid_order'
  );
  update public.lessons set position = position + 100000 where module_id = p_module and archived_at is null;
  update public.lessons l set position = o.ord - 1
    from unnest(p_ids) with ordinality as o(id, ord)
   where l.id = o.id;
end;
$$;

create function public.reorder_questions(p_quiz uuid, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require(private.is_sanady_admin(), 'forbidden');
  update public.questions q set position = o.ord - 1
    from unnest(p_ids) with ordinality as o(id, ord)
   where q.id = o.id and q.quiz_id = p_quiz;
end;
$$;

-- Removal never silently destroys learner history: items that already hold
-- learner data are archived (hidden from new learning, kept for records).
create function public.remove_lesson(p_lesson uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require(private.is_sanady_admin(), 'forbidden');
  if exists (select 1 from public.lesson_progress where lesson_id = p_lesson)
     or exists (select 1 from public.video_progress where lesson_id = p_lesson)
     or exists (select 1 from public.document_progress where lesson_id = p_lesson) then
    update public.lessons set archived_at = now() where id = p_lesson and archived_at is null;
    return 'archived';
  end if;
  delete from public.lessons where id = p_lesson;
  return 'deleted';
end;
$$;

create function public.remove_question(p_question uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require(private.is_sanady_admin(), 'forbidden');
  if exists (select 1 from public.quiz_answers where question_id = p_question)
     or exists (select 1 from public.quiz_attempts where p_question = any(question_ids)) then
    update public.questions set archived_at = now() where id = p_question and archived_at is null;
    return 'archived';
  end if;
  delete from public.questions where id = p_question;
  return 'deleted';
end;
$$;

create function public.remove_module(p_module uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_has_data boolean;
begin
  perform private.require(private.is_sanady_admin(), 'forbidden');
  select exists (
           select 1 from public.lesson_progress lp join public.lessons l on l.id = lp.lesson_id where l.module_id = p_module
         )
      or exists (
           select 1 from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id where q.module_id = p_module
         )
    into v_has_data;

  if v_has_data then
    update public.modules set archived_at = now() where id = p_module and archived_at is null;
    update public.lessons set archived_at = now() where module_id = p_module and archived_at is null;
    return 'archived';
  end if;
  delete from public.modules where id = p_module;
  return 'deleted';
end;
$$;

-- Atomic create/update of a question and its options.
-- p_options: [{ "id": uuid|null, "label": text, "is_correct": bool }, …]
create function public.save_question(
  p_quiz         uuid,
  p_question     uuid,
  p_kind         public.question_kind,
  p_prompt       text,
  p_explanation  text,
  p_points       smallint,
  p_options      jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id       uuid := p_question;
  v_correct  integer;
  v_count    integer;
  v_opt      jsonb;
  v_pos      integer := 0;
  v_keep     uuid[] := '{}';
  v_opt_id   uuid;
begin
  perform private.require(private.is_sanady_admin(), 'forbidden');
  perform private.require(jsonb_typeof(p_options) = 'array', 'invalid_options');

  v_count := jsonb_array_length(p_options);
  select count(*) into v_correct from jsonb_array_elements(p_options) e where (e ->> 'is_correct')::boolean;

  perform private.require(v_count between 2 and 10, 'question_options_count');
  perform private.require(
    (p_kind = 'single' and v_correct = 1) or (p_kind = 'multiple' and v_correct >= 1),
    'question_correct_count'
  );

  if v_id is null then
    insert into public.questions (quiz_id, kind, prompt, explanation, points, position)
    values (
      p_quiz, p_kind, btrim(p_prompt), btrim(coalesce(p_explanation, '')), p_points,
      coalesce((select max(position) + 1 from public.questions where quiz_id = p_quiz and archived_at is null), 0)
    )
    returning id into v_id;
  else
    update public.questions
       set kind = p_kind, prompt = btrim(p_prompt), explanation = btrim(coalesce(p_explanation, '')), points = p_points
     where id = v_id and quiz_id = p_quiz;
    perform private.require(found, 'not_found');
  end if;

  for v_opt in select * from jsonb_array_elements(p_options) loop
    v_opt_id := private.try_uuid(v_opt ->> 'id');
    if v_opt_id is not null and exists (select 1 from public.question_options where id = v_opt_id and question_id = v_id) then
      update public.question_options
         set label = btrim(v_opt ->> 'label'), is_correct = coalesce((v_opt ->> 'is_correct')::boolean, false), position = v_pos
       where id = v_opt_id;
    else
      insert into public.question_options (question_id, label, is_correct, position)
      values (v_id, btrim(v_opt ->> 'label'), coalesce((v_opt ->> 'is_correct')::boolean, false), v_pos)
      returning id into v_opt_id;
    end if;
    v_keep := v_keep || v_opt_id;
    v_pos := v_pos + 1;
  end loop;

  delete from public.question_options where question_id = v_id and not (id = any(v_keep));
  return v_id;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. AUTHORIZATION & ASSIGNMENT
-- ════════════════════════════════════════════════════════════════════════════

create function private.ensure_enrollment(p_user uuid, p_course uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.enrollments (user_id, course_id) values (p_user, p_course)
  on conflict (user_id, course_id) do nothing;
  if found then
    perform private.record_event(p_user, p_course, 'enrolled');
  end if;
end;
$$;

create function public.grant_course_to_institution(p_course uuid, p_institution uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require(private.is_sanady_admin(), 'forbidden');
  perform private.require(exists (select 1 from public.courses where id = p_course and status <> 'archived'), 'course_unavailable');
  insert into public.course_permissions (course_id, institution_id, granted_by)
  values (p_course, p_institution, auth.uid())
  on conflict do nothing;
end;
$$;

create function public.revoke_course_from_institution(p_course uuid, p_institution uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require(private.is_sanady_admin(), 'forbidden');
  update public.course_permissions
     set revoked_at = now(), revoked_by = auth.uid()
   where course_id = p_course and institution_id = p_institution and revoked_at is null;
  -- Assignments become inert automatically (access requires the permission);
  -- they are revoked explicitly too so dashboards stay accurate.
  update public.course_assignments
     set revoked_at = now(), revoked_by = auth.uid()
   where course_id = p_course and institution_id = p_institution and revoked_at is null;
end;
$$;

create function public.grant_course_to_user(p_course uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require(private.is_sanady_admin(), 'forbidden');
  perform private.require(exists (select 1 from public.courses where id = p_course and status <> 'archived'), 'course_unavailable');
  perform private.require(exists (select 1 from public.profiles where id = p_user), 'not_found');
  insert into public.course_permissions (course_id, user_id, granted_by)
  values (p_course, p_user, auth.uid())
  on conflict do nothing;
  perform private.ensure_enrollment(p_user, p_course);
end;
$$;

create function public.revoke_course_from_user(p_course uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require(private.is_sanady_admin(), 'forbidden');
  update public.course_permissions
     set revoked_at = now(), revoked_by = auth.uid()
   where course_id = p_course and user_id = p_user and revoked_at is null;
end;
$$;

-- Institution administrators assign authorized courses to their teachers.
create function public.assign_course(p_institution uuid, p_course uuid, p_users uuid[], p_due_on date default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid;
  v_count integer := 0;
begin
  perform private.require(
    private.is_sanady_admin() or private.is_institution_admin(p_institution),
    'forbidden'
  );
  perform private.require(private.institution_has_course(p_institution, p_course), 'course_not_authorized');
  perform private.require(cardinality(p_users) between 1 and 500, 'invalid_selection');

  foreach v_user in array p_users loop
    perform private.require(
      exists (
        select 1 from public.institution_memberships m
         where m.institution_id = p_institution and m.user_id = v_user
           and m.role = 'teacher' and m.status = 'active'
      ),
      'not_a_member'
    );

    insert into public.course_assignments (institution_id, user_id, course_id, assigned_by, due_on)
    values (p_institution, v_user, p_course, auth.uid(), p_due_on)
    on conflict do nothing;
    if found then
      v_count := v_count + 1;
    end if;

    perform private.ensure_enrollment(v_user, p_course);
  end loop;

  return v_count;
end;
$$;

create function public.unassign_course(p_assignment uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inst uuid;
begin
  select institution_id into v_inst from public.course_assignments where id = p_assignment and revoked_at is null;
  perform private.require(found, 'not_found');
  perform private.require(private.is_sanady_admin() or private.is_institution_admin(v_inst), 'forbidden');
  update public.course_assignments set revoked_at = now(), revoked_by = auth.uid() where id = p_assignment;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. LEARNING PROGRESS
-- ════════════════════════════════════════════════════════════════════════════

-- Loads a lesson the learner may access (raises otherwise).
create function private.learner_lesson(p_lesson uuid)
returns public.lessons
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_lesson public.lessons;
begin
  perform private.require(auth.uid() is not null, 'not_authenticated');
  select l.* into v_lesson
    from public.lessons l
    join public.modules m on m.id = l.module_id
   where l.id = p_lesson and l.archived_at is null and m.archived_at is null;
  perform private.require(found, 'not_found');
  perform private.require(private.has_course_access(v_lesson.course_id), 'course_access_denied');
  return v_lesson;
end;
$$;

create function private.touch_enrollment(p_user uuid, p_course uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.enrollments (user_id, course_id, started_at, last_activity_at)
  values (p_user, p_course, now(), now())
  on conflict (user_id, course_id) do update
     set started_at = coalesce(public.enrollments.started_at, now()),
         last_activity_at = now();
$$;

-- Course completion: all mandatory lessons complete AND every module quiz
-- passed. Issues the certificate exactly once. Returns true if newly issued.
create function private.evaluate_course_completion(p_user uuid, p_course uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_complete  boolean;
  v_course    public.courses;
  v_name      text;
  v_minutes   integer;
  v_cert_id   uuid;
  v_tries     integer := 0;
begin
  select * into v_course from public.courses where id = p_course;

  select exists (select 1 from public.modules m where m.course_id = p_course and m.archived_at is null)
     and not exists (
       select 1
         from public.lessons l
         join public.modules m on m.id = l.module_id and m.archived_at is null
        where l.course_id = p_course and l.archived_at is null and l.is_mandatory
          and not exists (
            select 1 from public.lesson_progress lp
             where lp.lesson_id = l.id and lp.user_id = p_user and lp.status = 'completed'
          )
     )
     and not exists (
       select 1
         from public.modules m
        where m.course_id = p_course and m.archived_at is null
          and not exists (
            select 1
              from public.quizzes q
              join public.quiz_attempts a on a.quiz_id = q.id
             where q.module_id = m.id and a.user_id = p_user
               and a.passed and a.voided_at is null
          )
     )
    into v_complete;

  if not v_complete then
    return false;
  end if;

  update public.enrollments
     set status = 'completed', completed_at = coalesce(completed_at, now())
   where user_id = p_user and course_id = p_course and status <> 'completed';
  if found then
    perform private.record_event(p_user, p_course, 'course_completed');
  end if;

  select coalesce(nullif(full_name, ''), email) into v_name from public.profiles where id = p_user;
  v_minutes := coalesce(
    v_course.estimated_minutes,
    (select nullif(sum(coalesce(l.estimated_minutes, ceil(l.video_duration_seconds / 60.0)::integer, 0)), 0)
       from public.lessons l where l.course_id = p_course and l.archived_at is null)
  );

  loop
    begin
      insert into public.certificates (
        user_id, course_id, certificate_number, verification_code,
        recipient_name, course_title, course_duration_minutes, completed_at
      )
      values (
        p_user, p_course,
        'SND-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
        replace(gen_random_uuid()::text, '-', ''),
        v_name, v_course.title, v_minutes,
        coalesce((select completed_at from public.enrollments where user_id = p_user and course_id = p_course), now())
      )
      on conflict (user_id, course_id) do nothing
      returning id into v_cert_id;
      exit;
    exception when unique_violation then
      -- Extremely unlikely random-number collision: retry with new values.
      v_tries := v_tries + 1;
      if v_tries > 5 then raise; end if;
    end;
  end loop;

  if v_cert_id is not null then
    perform private.record_event(p_user, p_course, 'certificate_issued', null, null,
      jsonb_build_object('certificate_id', v_cert_id));
    return true;
  end if;
  return false;
end;
$$;

-- Learner may re-check completion (e.g. after content was restructured).
create function public.refresh_course_completion(p_course uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require(auth.uid() is not null, 'not_authenticated');
  perform private.require(private.has_course_access(p_course), 'course_access_denied');
  return private.evaluate_course_completion(auth.uid(), p_course);
end;
$$;

create function private.ensure_lesson_progress(p_user uuid, p_lesson public.lessons)
returns public.lesson_progress
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_progress public.lesson_progress;
begin
  insert into public.lesson_progress (user_id, lesson_id, course_id)
  values (p_user, p_lesson.id, p_lesson.course_id)
  on conflict (user_id, lesson_id) do nothing
  returning * into v_progress;

  if v_progress.id is not null then
    perform private.record_event(p_user, p_lesson.course_id, 'lesson_started', p_lesson.id);
  else
    select * into v_progress from public.lesson_progress where user_id = p_user and lesson_id = p_lesson.id;
  end if;
  return v_progress;
end;
$$;

create function public.start_lesson(p_lesson uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_lesson   public.lessons;
  v_progress public.lesson_progress;
begin
  v_lesson := private.learner_lesson(p_lesson);
  perform private.touch_enrollment(v_uid, v_lesson.course_id);
  v_progress := private.ensure_lesson_progress(v_uid, v_lesson);

  return jsonb_build_object(
    'status', v_progress.status,
    'progress_ratio', v_progress.progress_ratio,
    'resume_position', v_progress.resume_position,
    'watched_buckets', coalesce((select to_jsonb(watched_buckets) from public.video_progress where user_id = v_uid and lesson_id = p_lesson), '[]'::jsonb),
    'pages_viewed', coalesce((select to_jsonb(pages_viewed) from public.document_progress where user_id = v_uid and lesson_id = p_lesson), '[]'::jsonb)
  );
end;
$$;

create function private.complete_lesson_if_reached(
  p_user      uuid,
  p_lesson    public.lessons,
  p_ratio     numeric,
  p_position  integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_threshold     numeric := private.lesson_threshold(p_lesson.kind, p_lesson.completion_threshold);
  v_newly_done    boolean := false;
  v_cert          boolean := false;
  v_status        public.progress_status;
begin
  update public.lesson_progress
     set progress_ratio = greatest(progress_ratio, least(p_ratio, 1)),
         resume_position = greatest(coalesce(p_position, 0), 0),
         updated_at = now()
   where user_id = p_user and lesson_id = p_lesson.id;

  if p_ratio >= v_threshold then
    update public.lesson_progress
       set status = 'completed', completed_at = now()
     where user_id = p_user and lesson_id = p_lesson.id and status <> 'completed';
    v_newly_done := found;
  end if;

  if v_newly_done then
    perform private.record_event(p_user, p_lesson.course_id, 'lesson_completed', p_lesson.id);
    v_cert := private.evaluate_course_completion(p_user, p_lesson.course_id);
  end if;

  select status into v_status from public.lesson_progress where user_id = p_user and lesson_id = p_lesson.id;

  return jsonb_build_object(
    'status', v_status,
    'progress_ratio', least(p_ratio, 1),
    'lesson_completed_now', v_newly_done,
    'certificate_issued', v_cert
  );
end;
$$;

-- Records watched video buckets (0‥99, each = 1 % of the video).
-- Plausibility guard: the number of NEW buckets accepted per call is bounded
-- by elapsed wall-clock time (max 2× speed + small slack, elapsed capped at
-- 120 s), so progress cannot be forged by replaying a single request.
create function public.record_video_progress(
  p_lesson    uuid,
  p_buckets   integer[],
  p_position  integer,
  p_duration  integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid          uuid := auth.uid();
  v_lesson       public.lessons;
  v_progress     public.lesson_progress;
  v_video        public.video_progress;
  v_duration     integer;
  v_elapsed      numeric;
  v_allowed      integer;
  v_new          smallint[];
  v_merged       smallint[];
  v_ratio        numeric;
  v_milestone    smallint;
  v_result       jsonb;
begin
  v_lesson := private.learner_lesson(p_lesson);
  perform private.require(v_lesson.kind = 'video', 'invalid_lesson_kind');
  perform private.require(cardinality(coalesce(p_buckets, '{}')) <= 100, 'invalid_payload');

  perform private.touch_enrollment(v_uid, v_lesson.course_id);
  v_progress := private.ensure_lesson_progress(v_uid, v_lesson);

  insert into public.video_progress (user_id, lesson_id, duration_seconds, updated_at)
  values (v_uid, p_lesson, coalesce(v_lesson.video_duration_seconds, nullif(p_duration, 0)), v_progress.started_at)
  on conflict (user_id, lesson_id) do nothing;

  select * into v_video from public.video_progress where user_id = v_uid and lesson_id = p_lesson for update;

  v_duration := coalesce(v_lesson.video_duration_seconds, v_video.duration_seconds, nullif(p_duration, 0), 600);
  v_elapsed  := least(extract(epoch from (now() - v_video.updated_at)), 120);
  v_allowed  := greatest(1, ceil((v_elapsed * 2.0 + 20) / greatest(v_duration / 100.0, 0.5))::integer);

  select coalesce(array_agg(b order by b), '{}')
    into v_new
    from (
      select distinct b::smallint as b
        from unnest(coalesce(p_buckets, '{}')) as b
       where b between 0 and 99
         and not (b::smallint = any(v_video.watched_buckets))
       order by 1
       limit v_allowed
    ) s;

  select coalesce(array_agg(b order by b), '{}')
    into v_merged
    from (select unnest(v_video.watched_buckets) as b union select unnest(v_new)) u;

  v_ratio := cardinality(v_merged) / 100.0;

  update public.video_progress
     set watched_buckets = v_merged,
         duration_seconds = coalesce(duration_seconds, nullif(p_duration, 0)),
         updated_at = now()
   where user_id = v_uid and lesson_id = p_lesson;

  -- Checkpoints at 25 / 50 / 75 / 100 %, each recorded at most once.
  foreach v_milestone in array array[25, 50, 75, 100]::smallint[] loop
    if v_ratio * 100 >= v_milestone and not (v_milestone = any(v_video.milestones)) then
      update public.video_progress set milestones = array_append(milestones, v_milestone)
       where user_id = v_uid and lesson_id = p_lesson;
      perform private.record_event(v_uid, v_lesson.course_id, 'video_checkpoint', p_lesson, null,
        jsonb_build_object('milestone', v_milestone));
    end if;
  end loop;

  v_result := private.complete_lesson_if_reached(
    v_uid, v_lesson, v_ratio,
    least(greatest(coalesce(p_position, 0), 0), v_duration)
  );
  return v_result || jsonb_build_object('accepted_buckets', cardinality(v_new));
end;
$$;

-- Records PDF pages the learner has displayed. Opening a document does not
-- complete it: the required share of distinct pages must be viewed.
create function public.record_document_progress(p_lesson uuid, p_pages integer[], p_current_page integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_lesson    public.lessons;
  v_progress  public.lesson_progress;
  v_doc       public.document_progress;
  v_elapsed   numeric;
  v_allowed   integer;
  v_new       integer[];
  v_merged    integer[];
  v_ratio     numeric;
begin
  v_lesson := private.learner_lesson(p_lesson);
  perform private.require(v_lesson.kind = 'pdf', 'invalid_lesson_kind');
  perform private.require(v_lesson.pdf_page_count is not null, 'lesson_not_ready');
  perform private.require(cardinality(coalesce(p_pages, '{}')) <= 500, 'invalid_payload');

  perform private.touch_enrollment(v_uid, v_lesson.course_id);
  v_progress := private.ensure_lesson_progress(v_uid, v_lesson);

  insert into public.document_progress (user_id, lesson_id, page_count, updated_at)
  values (v_uid, p_lesson, v_lesson.pdf_page_count, v_progress.started_at)
  on conflict (user_id, lesson_id) do nothing;

  select * into v_doc from public.document_progress where user_id = v_uid and lesson_id = p_lesson for update;

  -- At most one new page per 2 s of elapsed time (+2), elapsed capped at 10 min.
  v_elapsed := least(extract(epoch from (now() - v_doc.updated_at)), 600);
  v_allowed := floor(v_elapsed / 2)::integer + 2;

  select coalesce(array_agg(p order by p), '{}')
    into v_new
    from (
      select distinct p
        from unnest(coalesce(p_pages, '{}')) as p
       where p between 1 and v_lesson.pdf_page_count
         and not (p = any(v_doc.pages_viewed))
       order by 1
       limit v_allowed
    ) s;

  select coalesce(array_agg(p order by p), '{}')
    into v_merged
    from (select unnest(v_doc.pages_viewed) as p union select unnest(v_new)) u;

  v_ratio := cardinality(v_merged)::numeric / v_lesson.pdf_page_count;

  update public.document_progress
     set pages_viewed = v_merged, page_count = v_lesson.pdf_page_count, updated_at = now()
   where user_id = v_uid and lesson_id = p_lesson;

  return private.complete_lesson_if_reached(
    v_uid, v_lesson, v_ratio,
    least(greatest(coalesce(p_current_page, 1), 1), v_lesson.pdf_page_count)
  ) || jsonb_build_object('accepted_pages', cardinality(v_new), 'pages_viewed', to_jsonb(v_merged));
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 8. ASSESSMENT ENGINE
-- ════════════════════════════════════════════════════════════════════════════

create function private.module_lessons_complete(p_user uuid, p_module uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.lessons l
     where l.module_id = p_module and l.archived_at is null and l.is_mandatory
       and not exists (
         select 1 from public.lesson_progress lp
          where lp.lesson_id = l.id and lp.user_id = p_user and lp.status = 'completed'
       )
  );
$$;

-- Quiz status for a learner (defaults to the caller).
create function public.quiz_status(p_quiz uuid, p_user uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user  uuid := coalesce(p_user, auth.uid());
  v_quiz  public.quizzes;
  v_used  integer;
  v_open  uuid;
  v_pass  boolean;
  v_best  numeric;
begin
  select * into v_quiz from public.quizzes where id = p_quiz;
  perform private.require(found, 'not_found');
  perform private.require(
    v_user = auth.uid()
      or private.is_sanady_admin()
      or private.can_view_learner_course(v_user, v_quiz.course_id),
    'forbidden'
  );

  select count(*),
         bool_or(passed),
         max(score_percent),
         (array_agg(id) filter (where status = 'in_progress'))[1]
    into v_used, v_pass, v_best, v_open
    from public.quiz_attempts
   where quiz_id = p_quiz and user_id = v_user and voided_at is null;

  return jsonb_build_object(
    'quiz_id', p_quiz,
    'attempts_used', v_used,
    'max_attempts', v_quiz.max_attempts,
    'remaining_attempts', greatest(v_quiz.max_attempts - v_used, 0),
    'pass_threshold', v_quiz.pass_threshold,
    'passed', coalesce(v_pass, false),
    'best_score', v_best,
    'open_attempt_id', v_open,
    'unlocked', private.module_lessons_complete(v_user, v_quiz.module_id),
    'exhausted', not coalesce(v_pass, false) and v_open is null and v_used >= v_quiz.max_attempts
  );
end;
$$;

-- Starts (or resumes) an attempt. Refreshing the page or replaying the call
-- returns the same open attempt; it never consumes an extra attempt.
create function public.start_quiz_attempt(p_quiz uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_quiz     public.quizzes;
  v_attempt  public.quiz_attempts;
  v_used     integer;
  v_qids     uuid[];
begin
  perform private.require(v_uid is not null, 'not_authenticated');
  select * into v_quiz from public.quizzes where id = p_quiz;
  perform private.require(found, 'not_found');
  perform private.require(
    exists (select 1 from public.modules m where m.id = v_quiz.module_id and m.archived_at is null),
    'not_found'
  );
  perform private.require(private.has_course_access(v_quiz.course_id), 'course_access_denied');

  -- Serialize concurrent starts for this learner and quiz.
  perform pg_advisory_xact_lock(hashtextextended(p_quiz::text || ':' || v_uid::text, 0));

  perform private.require(
    not exists (select 1 from public.quiz_attempts
                 where quiz_id = p_quiz and user_id = v_uid and passed and voided_at is null),
    'quiz_already_passed'
  );

  select * into v_attempt from public.quiz_attempts
   where quiz_id = p_quiz and user_id = v_uid and status = 'in_progress' and voided_at is null;

  if not found then
    perform private.require(private.module_lessons_complete(v_uid, v_quiz.module_id), 'quiz_locked');

    select count(*) into v_used from public.quiz_attempts
     where quiz_id = p_quiz and user_id = v_uid and voided_at is null;
    perform private.require(v_used < v_quiz.max_attempts, 'attempts_exhausted');

    select coalesce(array_agg(id order by position, created_at), '{}') into v_qids
      from public.questions where quiz_id = p_quiz and archived_at is null;
    perform private.require(cardinality(v_qids) > 0, 'quiz_empty');

    insert into public.quiz_attempts (quiz_id, user_id, course_id, attempt_number, pass_threshold, max_attempts, question_ids)
    values (p_quiz, v_uid, v_quiz.course_id, v_used + 1, v_quiz.pass_threshold, v_quiz.max_attempts, v_qids)
    returning * into v_attempt;

    perform private.touch_enrollment(v_uid, v_quiz.course_id);
    perform private.record_event(v_uid, v_quiz.course_id, 'quiz_started', null, p_quiz,
      jsonb_build_object('attempt_number', v_attempt.attempt_number));
  end if;

  -- Questions and options WITHOUT any correctness information.
  return jsonb_build_object(
    'attempt_id', v_attempt.id,
    'attempt_number', v_attempt.attempt_number,
    'max_attempts', v_attempt.max_attempts,
    'pass_threshold', v_attempt.pass_threshold,
    'started_at', v_attempt.started_at,
    'questions', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', q.id,
                 'kind', q.kind,
                 'prompt', q.prompt,
                 'points', q.points,
                 'options', coalesce((
                   select jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label) order by o.position)
                     from public.question_options o where o.question_id = q.id
                 ), '[]'::jsonb)
               ) order by ord.n)
        from unnest(v_attempt.question_ids) with ordinality as ord(id, n)
        join public.questions q on q.id = ord.id
    ), '[]'::jsonb)
  );
end;
$$;

-- Detailed result. Correct answers are revealed only once the learner has
-- passed (or to administrators); otherwise only per-question correctness
-- and explanatory feedback are shown, so retries remain meaningful.
create function public.get_attempt_result(p_attempt uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_a        public.quiz_attempts;
  v_reveal   boolean;
  v_used     integer;
begin
  select * into v_a from public.quiz_attempts where id = p_attempt;
  perform private.require(found, 'not_found');
  perform private.require(
    v_a.user_id = auth.uid()
      or private.is_sanady_admin()
      or private.can_view_learner_course(v_a.user_id, v_a.course_id),
    'forbidden'
  );
  perform private.require(v_a.status = 'submitted', 'attempt_not_submitted');

  v_reveal := private.is_sanady_admin()
    or exists (select 1 from public.quiz_attempts
                where quiz_id = v_a.quiz_id and user_id = v_a.user_id and passed and voided_at is null);

  select count(*) into v_used from public.quiz_attempts
   where quiz_id = v_a.quiz_id and user_id = v_a.user_id and voided_at is null;

  return jsonb_build_object(
    'attempt_id', v_a.id,
    'quiz_id', v_a.quiz_id,
    'course_id', v_a.course_id,
    'attempt_number', v_a.attempt_number,
    'submitted_at', v_a.submitted_at,
    'earned_points', v_a.earned_points,
    'max_points', v_a.max_points,
    'score_percent', v_a.score_percent,
    'passed', v_a.passed,
    'pass_threshold', v_a.pass_threshold,
    'max_attempts', v_a.max_attempts,
    'attempts_used', v_used,
    'remaining_attempts', case when v_a.voided_at is null then greatest(v_a.max_attempts - v_used, 0) else null end,
    'voided', v_a.voided_at is not null,
    'answers_revealed', v_reveal,
    'questions', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', q.id,
                 'kind', q.kind,
                 'prompt', q.prompt,
                 'points', q.points,
                 'explanation', nullif(q.explanation, ''),
                 'is_correct', coalesce(ans.is_correct, false),
                 'points_awarded', coalesce(ans.points_awarded, 0),
                 'selected_option_ids', coalesce(to_jsonb(ans.selected_option_ids), '[]'::jsonb),
                 'options', coalesce((
                   select jsonb_agg(
                            jsonb_build_object('id', o.id, 'label', o.label)
                              || case when v_reveal then jsonb_build_object('is_correct', o.is_correct) else '{}'::jsonb end
                            order by o.position)
                     from public.question_options o where o.question_id = q.id
                 ), '[]'::jsonb)
               ) order by ord.n)
        from unnest(v_a.question_ids) with ordinality as ord(id, n)
        join public.questions q on q.id = ord.id
        left join public.quiz_answers ans on ans.attempt_id = v_a.id and ans.question_id = q.id
    ), '[]'::jsonb)
  );
end;
$$;

-- Grades an attempt on the server, transactionally. The attempt row is
-- locked, so double submission (refresh, replayed request) is impossible.
-- p_answers: { "<question_id>": ["<option_id>", …], … }
create function public.submit_quiz_attempt(p_attempt uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_a         public.quiz_attempts;
  v_q         record;
  v_raw       jsonb;
  v_selected  uuid[];
  v_correct   uuid[];
  v_ok        boolean;
  v_earned    integer := 0;
  v_max       integer := 0;
  v_percent   numeric(5, 2);
  v_passed    boolean;
  v_cert      boolean := false;
begin
  perform private.require(v_uid is not null, 'not_authenticated');
  perform private.require(p_answers is null or jsonb_typeof(p_answers) = 'object', 'invalid_payload');

  select * into v_a from public.quiz_attempts where id = p_attempt for update;
  perform private.require(found and v_a.user_id = v_uid, 'not_found');
  perform private.require(v_a.voided_at is null, 'attempt_voided');
  perform private.require(v_a.status = 'in_progress', 'attempt_already_submitted');
  perform private.require(private.has_course_access(v_a.course_id), 'course_access_denied');

  for v_q in
    select q.id, q.kind, q.points
      from unnest(v_a.question_ids) as ord(id)
      join public.questions q on q.id = ord.id
  loop
    v_raw := coalesce(p_answers -> (v_q.id::text), '[]'::jsonb);
    if jsonb_typeof(v_raw) <> 'array' then
      v_raw := '[]'::jsonb;
    end if;

    -- Keep only option ids that belong to this question.
    select coalesce(array_agg(o.id order by o.id), '{}')
      into v_selected
      from public.question_options o
     where o.question_id = v_q.id
       and o.id in (
         select private.try_uuid(x) from jsonb_array_elements_text(v_raw) as x
       );

    select coalesce(array_agg(o.id order by o.id), '{}')
      into v_correct
      from public.question_options o
     where o.question_id = v_q.id and o.is_correct;

    v_ok := cardinality(v_correct) > 0
        and v_selected = v_correct
        and (v_q.kind = 'multiple' or cardinality(v_selected) = 1);

    insert into public.quiz_answers (attempt_id, question_id, selected_option_ids, is_correct, points_awarded)
    values (v_a.id, v_q.id, v_selected, v_ok, case when v_ok then v_q.points else 0 end);

    v_max := v_max + v_q.points;
    if v_ok then
      v_earned := v_earned + v_q.points;
    end if;
  end loop;

  perform private.require(v_max > 0, 'quiz_empty');

  v_percent := round(v_earned * 100.0 / v_max, 2);
  v_passed  := v_percent >= v_a.pass_threshold;

  update public.quiz_attempts
     set status = 'submitted', submitted_at = now(),
         earned_points = v_earned, max_points = v_max,
         score_percent = v_percent, passed = v_passed
   where id = v_a.id;

  perform private.touch_enrollment(v_uid, v_a.course_id);
  perform private.record_event(v_uid, v_a.course_id, 'quiz_submitted', null, v_a.quiz_id,
    jsonb_build_object('attempt_number', v_a.attempt_number, 'score_percent', v_percent));
  perform private.record_event(v_uid, v_a.course_id,
    case when v_passed then 'quiz_passed'::public.learning_event_type else 'quiz_failed'::public.learning_event_type end,
    null, v_a.quiz_id, jsonb_build_object('attempt_number', v_a.attempt_number, 'score_percent', v_percent));

  if v_passed then
    v_cert := private.evaluate_course_completion(v_uid, v_a.course_id);
  end if;

  return public.get_attempt_result(v_a.id) || jsonb_build_object('certificate_issued', v_cert);
end;
$$;

-- Audited administrative reset after exhausted attempts.
create function public.reset_quiz_attempts(p_quiz uuid, p_user uuid, p_reason text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course uuid;
  v_count  integer;
begin
  perform private.require(private.is_sanady_admin(), 'forbidden');
  perform private.require(char_length(btrim(coalesce(p_reason, ''))) between 5 and 500, 'reason_required');

  select course_id into v_course from public.quizzes where id = p_quiz;
  perform private.require(found, 'not_found');
  perform private.require(
    not exists (select 1 from public.quiz_attempts where quiz_id = p_quiz and user_id = p_user and passed and voided_at is null),
    'quiz_already_passed'
  );

  update public.quiz_attempts
     set voided_at = now(), voided_by = auth.uid(), void_reason = btrim(p_reason)
   where quiz_id = p_quiz and user_id = p_user and voided_at is null;
  get diagnostics v_count = row_count;

  perform private.record_event(p_user, v_course, 'quiz_attempts_reset', null, p_quiz,
    jsonb_build_object('voided_attempts', v_count));
  perform private.log_audit('quiz_attempts_reset', 'quizzes', p_quiz, null,
    jsonb_build_object('learner_id', p_user, 'voided_attempts', v_count, 'reason', btrim(p_reason)));
  return v_count;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 9. CERTIFICATES
-- ════════════════════════════════════════════════════════════════════════════

-- Public verification: reveals only what is needed to establish authenticity.
create function public.verify_certificate(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
           'certificate_number', c.certificate_number,
           'recipient_name', c.recipient_name,
           'course_title', c.course_title,
           'course_duration_minutes', c.course_duration_minutes,
           'completed_at', c.completed_at,
           'issued_at', c.issued_at,
           'status', case when c.revoked_at is null then 'valid' else 'revoked' end,
           'issuer', (select certificate_issuer_name from public.platform_settings where id)
         )
    from public.certificates c
   where c.verification_code = lower(btrim(p_code))
      or c.certificate_number = upper(btrim(p_code))
   limit 1;
$$;

create function public.revoke_certificate(p_certificate uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require(private.is_sanady_admin(), 'forbidden');
  perform private.require(char_length(btrim(coalesce(p_reason, ''))) between 5 and 500, 'reason_required');
  update public.certificates
     set revoked_at = now(), revoked_by = auth.uid(), revoke_reason = btrim(p_reason)
   where id = p_certificate and revoked_at is null;
  perform private.require(found, 'not_found');
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 10. PROGRESS SUMMARIES & REPORTING
-- ════════════════════════════════════════════════════════════════════════════

-- Per learner and course: lesson completion, assessment results and
-- certification are reported as three separate measures.
create function public.course_progress(p_course uuid, p_user uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := coalesce(p_user, auth.uid());
begin
  perform private.require(
    v_user = auth.uid()
      or private.is_sanady_admin()
      or private.can_view_learner_course(v_user, p_course),
    'forbidden'
  );

  return (
    with ls as (
      select l.id, l.is_mandatory, lp.status
        from public.lessons l
        join public.modules m on m.id = l.module_id and m.archived_at is null
        left join public.lesson_progress lp on lp.lesson_id = l.id and lp.user_id = v_user
       where l.course_id = p_course and l.archived_at is null
    ),
    qz as (
      select q.id,
             bool_or(a.passed) filter (where a.voided_at is null) as passed,
             max(a.score_percent) filter (where a.voided_at is null) as best
        from public.quizzes q
        join public.modules m on m.id = q.module_id and m.archived_at is null
        left join public.quiz_attempts a on a.quiz_id = q.id and a.user_id = v_user and a.status = 'submitted'
       where q.course_id = p_course
       group by q.id
    )
    select jsonb_build_object(
      'course_id', p_course,
      'user_id', v_user,
      'mandatory_lessons', (select count(*) from ls where is_mandatory),
      'completed_mandatory_lessons', (select count(*) from ls where is_mandatory and status = 'completed'),
      'lesson_completion_ratio', coalesce(
         (select round(count(*) filter (where status = 'completed')::numeric / nullif(count(*), 0), 4) from ls where is_mandatory), 0),
      'quizzes_total', (select count(*) from qz),
      'quizzes_passed', (select count(*) from qz where passed),
      'enrollment_status', (select status from public.enrollments where user_id = v_user and course_id = p_course),
      'last_activity_at', (select last_activity_at from public.enrollments where user_id = v_user and course_id = p_course),
      'certificate', (
        select jsonb_build_object('id', c.id, 'certificate_number', c.certificate_number,
                                  'issued_at', c.issued_at, 'revoked', c.revoked_at is not null)
          from public.certificates c where c.user_id = v_user and c.course_id = p_course
      )
    )
  );
end;
$$;

-- Institution overview tiles (institution admins and SANADY admins).
create function public.institution_overview(p_institution uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days smallint;
begin
  perform private.require(
    private.is_sanady_admin() or private.is_institution_admin(p_institution),
    'forbidden'
  );
  select inactivity_threshold_days into v_days from public.platform_settings where id;

  return (
    with teachers as (
      select m.user_id from public.institution_memberships m
       where m.institution_id = p_institution and m.role = 'teacher' and m.status = 'active'
    ),
    asg as (
      select ca.* from public.course_assignments ca
       join teachers t on t.user_id = ca.user_id
      where ca.institution_id = p_institution and ca.revoked_at is null
    ),
    enr as (
      select e.* from public.enrollments e join asg on asg.user_id = e.user_id and asg.course_id = e.course_id
    )
    select jsonb_build_object(
      'registered_teachers', (select count(*) from teachers),
      'active_teachers', (select count(distinct user_id) from enr
                            where last_activity_at >= now() - make_interval(days => v_days)),
      'inactivity_threshold_days', v_days,
      'authorized_courses', (select count(*) from public.course_permissions cp
                               join public.courses c on c.id = cp.course_id and c.status = 'published'
                              where cp.institution_id = p_institution and cp.revoked_at is null),
      'assigned_courses', (select count(distinct course_id) from asg),
      'assignments', (select count(*) from asg),
      'completed_assignments', (select count(*) from enr where status = 'completed'),
      'in_progress_assignments', (select count(*) from enr where status = 'active' and started_at is not null),
      'not_started_assignments', (select count(*) from enr where status = 'active' and started_at is null),
      'pending_invitations', (select count(*) from public.invitations i
                                where i.institution_id = p_institution and i.kind = 'institution_teacher'
                                  and i.accepted_at is null and i.revoked_at is null and i.expires_at > now())
    )
  );
end;
$$;

-- One row per teacher with assignment-scoped indicators. "needs_support"
-- flags inactivity or exhausted attempts — it is NOT a competence measure.
create function public.institution_teacher_summaries(p_institution uuid)
returns table (
  user_id              uuid,
  membership_id        uuid,
  full_name            text,
  email                text,
  joined_at            timestamptz,
  source               public.membership_source,
  assigned_courses     integer,
  completed_courses    integer,
  certificates         integer,
  last_activity_at     timestamptz,
  exhausted_quizzes    integer,
  inactive             boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days smallint;
begin
  perform private.require(
    private.is_sanady_admin() or private.is_institution_admin(p_institution),
    'forbidden'
  );
  select inactivity_threshold_days into v_days from public.platform_settings where id;

  return query
  with t as (
    select m.user_id, m.id as membership_id, m.created_at, m.source
      from public.institution_memberships m
     where m.institution_id = p_institution and m.role = 'teacher' and m.status = 'active'
  ),
  asg as (
    select ca.user_id, ca.course_id, ca.assigned_at
      from public.course_assignments ca
      join t on t.user_id = ca.user_id
     where ca.institution_id = p_institution and ca.revoked_at is null
  )
  select t.user_id,
         t.membership_id,
         p.full_name,
         p.email,
         t.created_at,
         t.source,
         (select count(*)::integer from asg where asg.user_id = t.user_id),
         (select count(*)::integer from asg join public.enrollments e on e.user_id = asg.user_id and e.course_id = asg.course_id
            where asg.user_id = t.user_id and e.status = 'completed'),
         (select count(*)::integer from asg join public.certificates c on c.user_id = asg.user_id and c.course_id = asg.course_id
            where asg.user_id = t.user_id and c.revoked_at is null),
         (select max(e.last_activity_at) from asg join public.enrollments e on e.user_id = asg.user_id and e.course_id = asg.course_id
            where asg.user_id = t.user_id),
         (select count(*)::integer from (
            select a.quiz_id
              from public.quiz_attempts a
              join asg on asg.user_id = a.user_id and asg.course_id = a.course_id
             where a.user_id = t.user_id and a.voided_at is null and a.status = 'submitted'
             group by a.quiz_id
            having count(*) >= min(a.max_attempts) and not bool_or(a.passed)
          ) x),
         -- Inactive: an unfinished assigned course with no activity within
         -- the threshold (counting from assignment when never started).
         exists (
           select 1
             from asg
             join public.enrollments e on e.user_id = asg.user_id and e.course_id = asg.course_id
            where asg.user_id = t.user_id
              and e.status = 'active'
              and coalesce(e.last_activity_at, asg.assigned_at) < now() - make_interval(days => v_days)
         )
    from t
    join public.profiles p on p.id = t.user_id
   order by p.last_name, p.first_name, p.email;
end;
$$;

-- Platform overview for SANADY administrators (real counts only).
create function public.platform_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days smallint;
begin
  perform private.require(private.is_sanady_admin(), 'forbidden');
  select inactivity_threshold_days into v_days from public.platform_settings where id;

  return jsonb_build_object(
    'institutions', (select count(*) from public.institutions where status = 'active'),
    'teachers', (select count(*) from public.profiles p
                  where p.status = 'active'
                    and not exists (select 1 from public.platform_roles r where r.user_id = p.id)),
    'active_learners', (select count(distinct user_id) from public.enrollments
                         where last_activity_at >= now() - make_interval(days => v_days)),
    'inactivity_threshold_days', v_days,
    'published_courses', (select count(*) from public.courses where status = 'published'),
    'draft_courses', (select count(*) from public.courses where status = 'draft'),
    'enrollments', (select count(*) from public.enrollments),
    'completed_enrollments', (select count(*) from public.enrollments where status = 'completed'),
    'certificates', (select count(*) from public.certificates where revoked_at is null),
    'pending_invitations', (select count(*) from public.invitations
                             where accepted_at is null and revoked_at is null and expires_at > now()),
    'exhausted_attempts', (
      select count(*) from (
        select a.quiz_id, a.user_id
          from public.quiz_attempts a
         where a.voided_at is null and a.status = 'submitted'
         group by a.quiz_id, a.user_id
        having count(*) >= min(a.max_attempts) and not bool_or(a.passed)
      ) s
    )
  );
end;
$$;

-- Learners with exhausted attempts awaiting intervention (SANADY admins).
create function public.exhausted_attempts()
returns table (
  quiz_id        uuid,
  quiz_title     text,
  course_id      uuid,
  course_title   text,
  user_id        uuid,
  full_name      text,
  email          text,
  attempts       integer,
  best_score     numeric,
  last_attempt   timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require(private.is_sanady_admin(), 'forbidden');
  return query
    select a.quiz_id, q.title, c.id, c.title, p.id, p.full_name, p.email,
           count(*)::integer, max(a.score_percent), max(a.submitted_at)
      from public.quiz_attempts a
      join public.quizzes q  on q.id = a.quiz_id
      join public.courses c  on c.id = a.course_id
      join public.profiles p on p.id = a.user_id
     where a.voided_at is null and a.status = 'submitted'
     group by a.quiz_id, q.title, c.id, c.title, p.id, p.full_name, p.email
    having count(*) >= min(a.max_attempts) and not bool_or(a.passed)
     order by max(a.submitted_at) desc;
end;
$$;
