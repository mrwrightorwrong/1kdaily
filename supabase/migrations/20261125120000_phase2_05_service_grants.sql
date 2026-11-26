-- ============================================================================
-- 1kDaily · Phase 2 · 05 — Service-role grants
--
-- This project does not grant table privileges to `service_role` by default,
-- which meant server-side writes (identity persistence, audit) failed with
-- SQLSTATE 42501 even though the service key bypasses RLS.
--
-- Ownership of this contract belongs in the migrations, not in dashboard
-- defaults. `service_role` is the trusted server identity; `anon` and
-- `authenticated` remain SELECT-only where policies allow.
-- ============================================================================

grant usage on schema public to service_role;

grant select, insert, update, delete on
  public.user_profiles,
  public.user_verifications,
  public.identity_documents,
  public.user_financial_profiles,
  public.consent_records,
  public.audit_logs,
  public.admin_roles,
  public.admin_permissions,
  public.admin_role_permissions,
  public.admin_user_roles
to service_role;

grant usage, select on all sequences in schema public to service_role;

-- Future objects created by migrations inherit the same contract.
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to service_role;

-- Record the intent for future readers.
comment on table public.identity_documents is
  'Masked identity verification record. No RLS policies exist by design: anon and authenticated cannot read it. service_role has explicit DML grants for the verification pipeline; admins access masked data only through RPCs.';
