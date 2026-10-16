-- ════════════════════════════════════════════════════════════════════════════
-- SANADY Enterprise — end-of-contract export of a company space (brief V3:
-- data handed back to the client before any deletion)
--
-- Once an approver has authorised the export, the bundle (ZIP of CSV/JSON
-- files) can be downloaded by the Enterprise team, approvers and SANADY
-- administrators, and by the company's own administrator while the space is
-- still open (offboarding). Every download is written in the history.
-- Internal notes of the team are never part of it.
-- ════════════════════════════════════════════════════════════════════════════

create function public.can_export_tenant(p_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.enterprise_tenants t
     where t.id = p_tenant and t.export_authorized_at is not null and t.data_deleted_at is null and t.institution_id is not null
       and (private.is_enterprise_manager() or private.is_partnership_signatory() or private.is_sanady_admin()
            or (t.status = 'offboarding' and private.is_institution_admin(t.institution_id))));
$$;

create function public.record_tenant_export(p_tenant uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require(public.can_export_tenant(p_tenant), 'forbidden');
  perform private.tenant_log(p_tenant, null, 'export_downloaded', null);
  perform private.log_audit('tenant_export_downloaded', 'enterprise_tenants', p_tenant, null, '{}'::jsonb);
end;
$$;

revoke execute on function public.can_export_tenant(uuid), public.record_tenant_export(uuid) from public, anon;
grant execute on function public.can_export_tenant(uuid), public.record_tenant_export(uuid) to authenticated;
