-- Phase 6 · 01 — versioned eligibility policy and immutable assessments
create table if not exists public.eligibility_policies (
  version    text primary key,
  config     jsonb not null,
  is_active  boolean not null default false,
  created_at timestamptz not null default now()
);

insert into public.eligibility_policies (version, config, is_active) values
  ('2026-11', jsonb_build_object(
    'maxMultiplier', 3,
    'minSavingsKobo', 10000000,
    'minTenureDays', 30,
    'minConsistencyPercent', 60,
    'maxDtiPercent', 33,
    'maxTenorMonths', 6,
    'maxLoanKobo', 50000000
  ), true)
on conflict (version) do nothing;

create table if not exists public.loan_eligibility_assessments (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete restrict,
  policy_version           text not null references public.eligibility_policies(version),
  engine_version           text not null,
  inputs                   jsonb not null,
  eligible                 boolean not null,
  eligible_savings_kobo    numeric(20,0) not null,
  multiplier_ceiling_kobo  numeric(20,0) not null,
  affordability_ceiling_kobo numeric(20,0) not null,
  risk_ceiling_kobo        numeric(20,0) not null,
  policy_ceiling_kobo      numeric(20,0) not null,
  assessed_limit_kobo      numeric(20,0) not null,
  binding_constraint       text not null,
  reasons                  jsonb not null,
  blockers                 jsonb not null,
  created_at               timestamptz not null default now()
);

create index if not exists assessments_user_idx
  on public.loan_eligibility_assessments (user_id, created_at desc);

comment on table public.loan_eligibility_assessments is
  'Immutable snapshot: inputs, policy version, engine version and result, so any decision is reproducible.';

revoke all on public.eligibility_policies from anon, authenticated;
revoke all on public.loan_eligibility_assessments from anon, authenticated;
grant select on public.eligibility_policies to authenticated;
grant select on public.loan_eligibility_assessments to authenticated;
grant select, insert, update, delete on public.eligibility_policies, public.loan_eligibility_assessments to service_role;

alter table public.eligibility_policies enable row level security;
alter table public.loan_eligibility_assessments enable row level security;

drop policy if exists policies_read on public.eligibility_policies;
create policy policies_read on public.eligibility_policies for select to authenticated using (is_active);

drop policy if exists assessments_own on public.loan_eligibility_assessments;
create policy assessments_own on public.loan_eligibility_assessments for select to authenticated using (user_id = auth.uid());

drop policy if exists assessments_staff on public.loan_eligibility_assessments;
create policy assessments_staff on public.loan_eligibility_assessments for select to authenticated
  using (app.has_permission('loans:read'));
