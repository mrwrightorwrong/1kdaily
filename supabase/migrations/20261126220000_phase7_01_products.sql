-- Phase 7 · 01 — loan products (administrator-configured, versioned)
create table if not exists public.loan_products (
  id                         uuid primary key default gen_random_uuid(),
  code                       text not null unique check (code ~ '^[a-z][a-z0-9_]{2,30}$'),
  name                       text not null,
  description                text,
  interest_rate_bps          integer not null check (interest_rate_bps between 0 and 10000),
  interest_method            text not null check (interest_method in ('flat', 'declining_balance')),
  processing_fee_bps         integer check (processing_fee_bps between 0 and 2000),
  processing_fee_fixed_kobo  numeric(20,0) check (processing_fee_fixed_kobo >= 0),
  insurance_fee_bps          integer check (insurance_fee_bps between 0 and 2000),
  insurance_fee_fixed_kobo   numeric(20,0) check (insurance_fee_fixed_kobo >= 0),
  min_loan_kobo              numeric(20,0) not null check (min_loan_kobo > 0),
  max_loan_kobo              numeric(20,0) not null check (max_loan_kobo >= min_loan_kobo),
  tenor_months               integer[] not null check (array_length(tenor_months, 1) > 0),
  grace_period_days          integer not null default 0 check (grace_period_days >= 0),
  requires_guarantor         boolean not null default false,
  requires_collateral        boolean not null default false,
  policy_version             text not null default '2026-11',
  is_active                  boolean not null default true,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  constraint one_fee_form check (
    (processing_fee_bps is null or processing_fee_fixed_kobo is null)
    and (insurance_fee_bps is null or insurance_fee_fixed_kobo is null)
  )
);

drop trigger if exists loan_products_touch on public.loan_products;
create trigger loan_products_touch before update on public.loan_products
  for each row execute function app.touch_updated_at();

insert into public.loan_products (
  code, name, description, interest_rate_bps, interest_method,
  processing_fee_bps, insurance_fee_bps, min_loan_kobo, max_loan_kobo,
  tenor_months, grace_period_days, requires_guarantor, requires_collateral
) values (
  'standard', 'Standard Loan',
  'Declining-balance credit for customers with a verified savings record.',
  2400, 'declining_balance', 150, 100,
  5000000, 50000000, array[3, 6, 9, 12], 5, false, false
)
on conflict (code) do nothing;

revoke all on public.loan_products from anon, authenticated;
grant select on public.loan_products to authenticated;
grant select, insert, update, delete on public.loan_products to service_role;

alter table public.loan_products enable row level security;

drop policy if exists loan_products_read on public.loan_products;
create policy loan_products_read on public.loan_products for select to authenticated
  using (is_active or app.has_permission('loans:read'));
