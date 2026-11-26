-- Phase 7 · 02 — applications and frozen offers
create table if not exists public.loan_applications (
  id                 uuid primary key default gen_random_uuid(),
  reference          text not null unique,
  user_id            uuid not null references auth.users(id) on delete restrict,
  product_id         uuid not null references public.loan_products(id) on delete restrict,
  assessment_id      uuid references public.loan_eligibility_assessments(id),
  requested_amount_kobo numeric(20,0) not null check (requested_amount_kobo > 0),
  tenor_months       integer not null check (tenor_months between 1 and 24),
  purpose            text check (purpose is null or char_length(purpose) <= 300),
  status             text not null default 'draft'
                       check (status in ('draft', 'submitted', 'under_review', 'info_required',
                                         'approved', 'approved_with_conditions', 'rejected',
                                         'cancelled', 'awaiting_disbursement', 'disbursed', 'closed')),
  decided_by         uuid references auth.users(id),
  decided_at         timestamptz,
  decision_reason    text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists loan_applications_user_idx
  on public.loan_applications (user_id, created_at desc);
create index if not exists loan_applications_status_idx
  on public.loan_applications (status, created_at);

drop trigger if exists loan_applications_touch on public.loan_applications;
create trigger loan_applications_touch before update on public.loan_applications
  for each row execute function app.touch_updated_at();

create table if not exists public.loan_offers (
  id                 uuid primary key default gen_random_uuid(),
  application_id     uuid not null unique references public.loan_applications(id) on delete restrict,
  user_id            uuid not null references auth.users(id) on delete restrict,
  product_snapshot   jsonb not null,
  policy_version     text not null,
  principal_kobo     numeric(20,0) not null check (principal_kobo > 0),
  tenor_months       integer not null,
  interest_rate_bps  integer not null,
  interest_method    text not null check (interest_method in ('flat', 'declining_balance')),
  processing_fee_kobo numeric(20,0) not null check (processing_fee_kobo >= 0),
  insurance_fee_kobo  numeric(20,0) not null check (insurance_fee_kobo >= 0),
  net_disbursed_kobo  numeric(20,0) not null check (net_disbursed_kobo > 0),
  interest_kobo       numeric(20,0) not null check (interest_kobo >= 0),
  total_payable_kobo  numeric(20,0) not null,
  installment_kobo    numeric(20,0) not null,
  schedule            jsonb not null,
  expires_at          timestamptz not null,
  accepted_at         timestamptz,
  created_at          timestamptz not null default now(),
  constraint offer_adds_up check (
    net_disbursed_kobo + processing_fee_kobo + insurance_fee_kobo = principal_kobo
    and total_payable_kobo = principal_kobo + interest_kobo
  )
);

create index if not exists loan_offers_user_idx on public.loan_offers (user_id, created_at desc);

-- An accepted offer is a contract term: no further edits.
create or replace function app.forbid_accepted_offer_change()
returns trigger language plpgsql
set search_path = public, pg_catalog, pg_temp as $$
begin
  if old.accepted_at is not null then
    raise exception 'An accepted offer cannot be modified.' using errcode = '23001';
  end if;
  return new;
end; $$;

drop trigger if exists loan_offers_frozen on public.loan_offers;
create trigger loan_offers_frozen before update on public.loan_offers
  for each row execute function app.forbid_accepted_offer_change();

revoke all on public.loan_applications from anon, authenticated;
revoke all on public.loan_offers from anon, authenticated;
grant select on public.loan_applications to authenticated;
grant select on public.loan_offers to authenticated;
grant select, insert, update, delete on public.loan_applications, public.loan_offers to service_role;

alter table public.loan_applications enable row level security;
alter table public.loan_offers enable row level security;

drop policy if exists applications_own on public.loan_applications;
create policy applications_own on public.loan_applications for select to authenticated
  using (user_id = auth.uid());
drop policy if exists applications_staff on public.loan_applications;
create policy applications_staff on public.loan_applications for select to authenticated
  using (app.has_permission('loans:read'));

drop policy if exists offers_own on public.loan_offers;
create policy offers_own on public.loan_offers for select to authenticated
  using (user_id = auth.uid());
drop policy if exists offers_staff on public.loan_offers;
create policy offers_staff on public.loan_offers for select to authenticated
  using (app.has_permission('loans:read'));
