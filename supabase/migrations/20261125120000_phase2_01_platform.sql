-- ============================================================================
-- 1kDaily · Phase 2 · 01 — Platform foundations
--
-- Helper schema, immutable audit log, role-based access control and the
-- permission function used by every RLS policy.
--
-- Conventions:
--   * `app` schema holds helpers and is not exposed by PostgREST.
--   * Money is numeric(20,0) kobo.
--   * Enumerations are CHECK constraints (easy to extend, validated in the app
--     with Zod as well).
-- ============================================================================

create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to anon, authenticated, service_role;

comment on schema app is
  'Internal helpers. Not exposed by the API. SECURITY DEFINER functions here must pin search_path.';

-- ---------------------------------------------------------------------------
-- Shared trigger functions
-- ---------------------------------------------------------------------------

create or replace function app.touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function app.forbid_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
begin
  raise exception 'This record is append-only and cannot be modified or deleted.'
    using errcode = 'restrict_violation';
end;
$$;

revoke all on function app.touch_updated_at() from public;
revoke all on function app.forbid_mutation() from public;

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------

create table if not exists public.audit_logs (
  id            bigint generated always as identity primary key,
  actor_id      uuid,
  actor_role    text,
  action        text not null check (char_length(action) between 3 and 80),
  entity_type   text not null check (char_length(entity_type) between 2 and 60),
  entity_id     text,
  before_state  jsonb,
  after_state   jsonb,
  reason        text,
  request_id    text,
  ip_hash       text,
  created_at    timestamptz not null default now()
);

comment on table public.audit_logs is
  'Append-only record of security-relevant actions. Never contains raw BVN/NIN.';

create index if not exists audit_logs_entity_idx
  on public.audit_logs (entity_type, entity_id, created_at desc);
create index if not exists audit_logs_actor_idx
  on public.audit_logs (actor_id, created_at desc);
create index if not exists audit_logs_created_idx
  on public.audit_logs (created_at desc);

drop trigger if exists audit_logs_no_update on public.audit_logs;
create trigger audit_logs_no_update
  before update or delete on public.audit_logs
  for each row execute function app.forbid_mutation();

-- ---------------------------------------------------------------------------
-- Role-based access control
-- ---------------------------------------------------------------------------

create table if not exists public.admin_roles (
  id          smallint generated always as identity primary key,
  key         text not null unique check (key ~ '^[a-z][a-z0-9_]{2,40}$'),
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);

create table if not exists public.admin_permissions (
  id          smallint generated always as identity primary key,
  key         text not null unique check (key ~ '^[a-z][a-z0-9_]*:[a-z][a-z0-9_]*$'),
  description text,
  created_at  timestamptz not null default now()
);

create table if not exists public.admin_role_permissions (
  role_id       smallint not null references public.admin_roles(id) on delete cascade,
  permission_id smallint not null references public.admin_permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table if not exists public.admin_user_roles (
  user_id    uuid not null references auth.users(id) on delete cascade,
  role_id    smallint not null references public.admin_roles(id) on delete restrict,
  granted_by uuid references auth.users(id),
  granted_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create index if not exists admin_user_roles_user_idx on public.admin_user_roles (user_id);

-- Permission catalogue. Keys are `domain:action`.
insert into public.admin_permissions (key, description) values
  ('admin:read',        'View the operations console'),
  ('users:read',        'View customer accounts and profiles'),
  ('users:manage',      'Suspend, restrict or reinstate accounts'),
  ('kyc:read',          'View verification status and masked identity details'),
  ('kyc:review',        'Approve or reject identity verifications'),
  ('savings:read',      'View savings plans and contributions'),
  ('finance:read',      'View ledger, settlements and reconciliation'),
  ('finance:reverse',   'Post a reversal through the controlled process'),
  ('loans:read',        'View loan applications and loans'),
  ('loans:review',      'Review applications and record assessments'),
  ('loans:approve',     'Approve, reject or conditionally approve loans'),
  ('loans:disburse',    'Authorise disbursement (separate from approval)'),
  ('collateral:verify', 'Verify collateral documents and valuations'),
  ('audit:read',        'Read the audit trail'),
  ('reports:export',    'Export reports'),
  ('config:write',      'Change financial or product configuration')
on conflict (key) do nothing;

insert into public.admin_roles (key, name, description) values
  ('super_admin',           'Platform Super Administrator', 'Full control, including configuration and access grants'),
  ('operations_admin',      'Platform Operations Administrator', 'Customer operations and account status'),
  ('finance_admin',         'Finance Administrator', 'Ledger, settlements, reversals and disbursement'),
  ('loan_officer',          'Loan Officer', 'Credit review and approval'),
  ('risk_officer',          'Credit/Risk Officer', 'Risk policy, assessments and approvals'),
  ('verification_officer',  'Verification Officer', 'Identity and document verification'),
  ('support_officer',       'Customer Support Officer', 'Customer support with limited financial visibility'),
  ('auditor',               'Auditor', 'Read-only oversight including the audit trail'),
  ('analyst',               'Read-only Analyst', 'Read-only analytics and reporting')
on conflict (key) do nothing;

-- Role → permission matrix (Phase 0 §14).
with matrix(role_key, permission_key) as (
  values
    -- super_admin: everything
    ('super_admin','admin:read'),('super_admin','users:read'),('super_admin','users:manage'),
    ('super_admin','kyc:read'),('super_admin','kyc:review'),('super_admin','savings:read'),
    ('super_admin','finance:read'),('super_admin','finance:reverse'),('super_admin','loans:read'),
    ('super_admin','loans:review'),('super_admin','loans:approve'),('super_admin','loans:disburse'),
    ('super_admin','collateral:verify'),('super_admin','audit:read'),('super_admin','reports:export'),
    ('super_admin','config:write'),
    -- operations
    ('operations_admin','admin:read'),('operations_admin','users:read'),('operations_admin','users:manage'),
    ('operations_admin','savings:read'),('operations_admin','loans:read'),
    -- finance
    ('finance_admin','admin:read'),('finance_admin','users:read'),('finance_admin','savings:read'),
    ('finance_admin','finance:read'),('finance_admin','finance:reverse'),('finance_admin','loans:disburse'),
    ('finance_admin','reports:export'),
    -- lending
    ('loan_officer','admin:read'),('loan_officer','users:read'),('loan_officer','loans:read'),
    ('loan_officer','loans:review'),('loan_officer','loans:approve'),
    -- risk
    ('risk_officer','admin:read'),('risk_officer','users:read'),('risk_officer','kyc:read'),
    ('risk_officer','loans:read'),('risk_officer','loans:review'),('risk_officer','loans:approve'),
    ('risk_officer','audit:read'),('risk_officer','reports:export'),
    -- verification
    ('verification_officer','admin:read'),('verification_officer','users:read'),
    ('verification_officer','kyc:read'),('verification_officer','kyc:review'),
    -- support
    ('support_officer','admin:read'),('support_officer','users:read'),('support_officer','savings:read'),
    -- audit
    ('auditor','admin:read'),('auditor','users:read'),('auditor','kyc:read'),('auditor','savings:read'),
    ('auditor','loans:read'),('auditor','finance:read'),('auditor','audit:read'),('auditor','reports:export'),
    -- analyst
    ('analyst','admin:read'),('analyst','users:read'),('analyst','savings:read'),('analyst','loans:read'),
    ('analyst','finance:read'),('analyst','reports:export')
)
insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
from matrix m
join public.admin_roles r on r.key = m.role_key
join public.admin_permissions p on p.key = m.permission_key
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Permission check — the single source of truth for staff authorisation.
-- ---------------------------------------------------------------------------

create or replace function app.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  select exists (
    select 1
    from public.admin_user_roles ur
    join public.admin_role_permissions rp on rp.role_id = ur.role_id
    join public.admin_permissions p on p.id = rp.permission_id
    where ur.user_id = auth.uid()
      and p.key = p_permission
  );
$$;

comment on function app.has_permission(text) is
  'True when the current JWT subject holds the permission through any assigned role.';

revoke all on function app.has_permission(text) from public;
grant execute on function app.has_permission(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Audit writer (service role and SECURITY DEFINER functions only)
-- ---------------------------------------------------------------------------

create or replace function app.log_audit(
  p_actor uuid,
  p_actor_role text,
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_before jsonb default null,
  p_after jsonb default null,
  p_reason text default null,
  p_request_id text default null,
  p_ip_hash text default null
)
returns void
language sql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  insert into public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id,
    before_state, after_state, reason, request_id, ip_hash
  )
  values (
    p_actor, p_actor_role, p_action, p_entity_type, p_entity_id,
    p_before, p_after, p_reason, p_request_id, p_ip_hash
  );
$$;

revoke all on function app.log_audit(uuid, text, text, text, text, jsonb, jsonb, text, text, text) from public;
grant execute on function app.log_audit(uuid, text, text, text, text, jsonb, jsonb, text, text, text)
  to service_role;
