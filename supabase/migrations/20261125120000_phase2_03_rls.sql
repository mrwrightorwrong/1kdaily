-- ============================================================================
-- 1kDaily · Phase 2 · 03 — Row Level Security and privileges
--
-- Posture:
--   * `authenticated` gets SELECT only, and only where a policy allows it.
--   * No client role may INSERT, UPDATE or DELETE any table in this schema.
--     All writes go through SECURITY DEFINER functions or server-side code with
--     an explicit authorisation check.
--   * `identity_documents` has privileges revoked and **no policies at all**.
--     Neither a customer nor an administrator can read it directly; masked
--     access exists only through the RPCs in file 04.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Privileges: strip everything, grant back only what is needed
-- ---------------------------------------------------------------------------

revoke all on public.user_profiles            from anon, authenticated;
revoke all on public.user_verifications       from anon, authenticated;
revoke all on public.identity_documents       from anon, authenticated;
revoke all on public.user_financial_profiles  from anon, authenticated;
revoke all on public.consent_records          from anon, authenticated;
revoke all on public.audit_logs               from anon, authenticated;
revoke all on public.admin_roles              from anon, authenticated;
revoke all on public.admin_permissions        from anon, authenticated;
revoke all on public.admin_role_permissions   from anon, authenticated;
revoke all on public.admin_user_roles         from anon, authenticated;

grant select on public.user_profiles           to authenticated;
grant select on public.user_verifications      to authenticated;
grant select on public.user_financial_profiles to authenticated;
grant select on public.consent_records         to authenticated;
grant select on public.audit_logs              to authenticated;
grant select on public.admin_roles             to authenticated;
grant select on public.admin_permissions       to authenticated;
grant select on public.admin_role_permissions  to authenticated;
grant select on public.admin_user_roles        to authenticated;

-- identity_documents: intentionally no grant to anon/authenticated.

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------

alter table public.user_profiles           enable row level security;
alter table public.user_verifications      enable row level security;
alter table public.identity_documents      enable row level security;
alter table public.user_financial_profiles enable row level security;
alter table public.consent_records         enable row level security;
alter table public.audit_logs              enable row level security;
alter table public.admin_roles             enable row level security;
alter table public.admin_permissions       enable row level security;
alter table public.admin_role_permissions  enable row level security;
alter table public.admin_user_roles        enable row level security;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

drop policy if exists user_profiles_select_own on public.user_profiles;
create policy user_profiles_select_own
  on public.user_profiles for select to authenticated
  using (id = auth.uid());

drop policy if exists user_profiles_select_staff on public.user_profiles;
create policy user_profiles_select_staff
  on public.user_profiles for select to authenticated
  using (app.has_permission('users:read'));

-- No insert/update/delete policies: writes are function-only.

-- ---------------------------------------------------------------------------
-- Verification status
-- ---------------------------------------------------------------------------

drop policy if exists user_verifications_select_own on public.user_verifications;
create policy user_verifications_select_own
  on public.user_verifications for select to authenticated
  using (user_id = auth.uid());

drop policy if exists user_verifications_select_kyc on public.user_verifications;
create policy user_verifications_select_kyc
  on public.user_verifications for select to authenticated
  using (app.has_permission('kyc:read'));

-- ---------------------------------------------------------------------------
-- Identity documents: zero policies (deny by default). Kept explicit so a
-- future reader does not assume this was an oversight.
-- ---------------------------------------------------------------------------

comment on table public.identity_documents is
  'Masked identity verification record. No RLS policies exist by design: direct reads are impossible for anon/authenticated. Use public.my_identity_summary() or the admin RPCs.';

-- ---------------------------------------------------------------------------
-- Financial profile
-- ---------------------------------------------------------------------------

drop policy if exists user_financial_profiles_select_own on public.user_financial_profiles;
create policy user_financial_profiles_select_own
  on public.user_financial_profiles for select to authenticated
  using (user_id = auth.uid());

drop policy if exists user_financial_profiles_select_credit on public.user_financial_profiles;
create policy user_financial_profiles_select_credit
  on public.user_financial_profiles for select to authenticated
  using (app.has_permission('loans:read'));

-- ---------------------------------------------------------------------------
-- Consent records
-- ---------------------------------------------------------------------------

drop policy if exists consent_records_select_own on public.consent_records;
create policy consent_records_select_own
  on public.consent_records for select to authenticated
  using (user_id = auth.uid());

drop policy if exists consent_records_select_audit on public.consent_records;
create policy consent_records_select_audit
  on public.consent_records for select to authenticated
  using (app.has_permission('audit:read'));

-- ---------------------------------------------------------------------------
-- Audit log (read-only, permissioned)
-- ---------------------------------------------------------------------------

drop policy if exists audit_logs_select_authorised on public.audit_logs;
create policy audit_logs_select_authorised
  on public.audit_logs for select to authenticated
  using (app.has_permission('audit:read'));

-- ---------------------------------------------------------------------------
-- RBAC metadata
-- ---------------------------------------------------------------------------

drop policy if exists admin_roles_select on public.admin_roles;
create policy admin_roles_select
  on public.admin_roles for select to authenticated
  using (app.has_permission('admin:read'));

drop policy if exists admin_permissions_select on public.admin_permissions;
create policy admin_permissions_select
  on public.admin_permissions for select to authenticated
  using (app.has_permission('admin:read'));

drop policy if exists admin_role_permissions_select on public.admin_role_permissions;
create policy admin_role_permissions_select
  on public.admin_role_permissions for select to authenticated
  using (app.has_permission('admin:read'));

drop policy if exists admin_user_roles_select_own on public.admin_user_roles;
create policy admin_user_roles_select_own
  on public.admin_user_roles for select to authenticated
  using (user_id = auth.uid());

drop policy if exists admin_user_roles_select_admin on public.admin_user_roles;
create policy admin_user_roles_select_admin
  on public.admin_user_roles for select to authenticated
  using (app.has_permission('admin:read'));
