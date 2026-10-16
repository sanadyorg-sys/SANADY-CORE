-- ════════════════════════════════════════════════════════════════════════════
-- SANADY Enterprise — company logo (brief V3: company branding of the
-- workspace and of its employees' documents)
--
-- The Enterprise team uploads the logo supplied by the company: PNG or JPEG
-- only (no SVG, which can carry scripts), 1 MB at most, checked by decoding
-- it on the server. It is stored in a private bucket, shown in the company
-- workspace, and placed beside the Foundation logo — which stays — on the
-- documents of the company's own courses.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.enterprise_tenants
  add column logo_path        text check (logo_path is null or logo_path ~ '^[0-9a-f-]{36}/logo-[0-9]+\.(png|jpg)$'),
  add column logo_updated_at  timestamptz,
  add column logo_updated_by  uuid references public.profiles (id) on delete set null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('enterprise-logos', 'enterprise-logos', false, 1048576, array['image/png', 'image/jpeg'])
on conflict (id) do nothing;

-- Members of the company space (any active role) and the Enterprise team read it.
create function private.can_read_tenant_logo(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_enterprise_staff()
      or exists (
        select 1 from public.enterprise_tenants t
          join public.institution_memberships m on m.institution_id = t.institution_id
         where t.id::text = split_part(p_name, '/', 1)
           and t.logo_path = p_name
           and m.user_id = auth.uid() and m.status = 'active');
$$;
revoke execute on function private.can_read_tenant_logo(text) from public, anon;
grant execute on function private.can_read_tenant_logo(text) to authenticated;

create policy enterprise_logos_read on storage.objects for select to authenticated
  using (bucket_id = 'enterprise-logos' and private.can_read_tenant_logo(name));
create policy enterprise_logos_write on storage.objects for insert to authenticated
  with check (bucket_id = 'enterprise-logos' and private.is_enterprise_manager()
              and exists (select 1 from public.enterprise_tenants t where t.id::text = split_part(name, '/', 1)));
create policy enterprise_logos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'enterprise-logos' and private.is_enterprise_manager());

-- Records (or removes, with null) the logo uploaded for a company space.
create function public.set_tenant_logo(p_tenant uuid, p_path text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old text;
begin
  perform private.require(private.is_enterprise_manager(), 'forbidden');
  select logo_path into v_old from public.enterprise_tenants where id = p_tenant for update;
  perform private.require(found, 'not_found');
  perform private.require(p_path is null or (split_part(p_path, '/', 1) = p_tenant::text
                          and exists (select 1 from storage.objects where bucket_id = 'enterprise-logos' and name = p_path)), 'invalid_input');
  update public.enterprise_tenants set logo_path = p_path, logo_updated_at = now(), logo_updated_by = auth.uid(), updated_at = now() where id = p_tenant;
  perform private.tenant_log(p_tenant, null, case when p_path is null then 'logo_removed' else 'logo_updated' end, null);
  return v_old;
end;
$$;
revoke execute on function public.set_tenant_logo(uuid, text) from public, anon;
grant execute on function public.set_tenant_logo(uuid, text) to authenticated;

-- Certificates of the company's own courses carry its logo.
create or replace function public.certificate_style(p_certificate uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('kind', t.certificate_kind, 'organization', t.display_name, 'logo_path', t.logo_path)
    from public.certificates ct
    join public.courses c on c.id = ct.course_id
    join public.enterprise_tenants t on t.institution_id = c.owner_institution_id
   where ct.id = p_certificate
     and (ct.user_id = auth.uid() or private.is_sanady_admin()
          or c.owner_institution_id in (select private.supervised_institutions()));
$$;

-- The logo of a company space, for its members and the team (null otherwise).
create function public.tenant_logo(p_institution uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select t.logo_path from public.enterprise_tenants t
   where t.institution_id = p_institution and t.logo_path is not null and private.can_read_tenant_logo(t.logo_path);
$$;
revoke execute on function public.tenant_logo(uuid) from public, anon;
grant execute on function public.tenant_logo(uuid) to authenticated;
