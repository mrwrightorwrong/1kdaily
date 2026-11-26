-- ============================================================================
-- 1kDaily · Phase 4 · 03 — Allocation tracking, reversals, provider reconciliation
--
-- 1. `savings_contribution_allocations` records exactly which plan days a
--    contribution paid, so a reversal can unwind precisely.
-- 2. `reverse_contribution` posts a balanced mirror transaction, requires the
--    `finance:reverse` permission and a written reason, and resets the days to
--    unpaid (the next refresh re-applies grace/missed rules).
-- 3. `provider_transactions` stages what the PSP reports; reconciliation
--    compares it to the ledger and records exceptions. Nothing auto-resolves.
-- ============================================================================

create table if not exists public.savings_contribution_allocations (
  id              uuid primary key default gen_random_uuid(),
  contribution_id uuid not null references public.savings_contributions(id) on delete restrict,
  plan_day_id     uuid not null references public.savings_plan_days(id) on delete restrict,
  amount_kobo     numeric(20, 0) not null check (amount_kobo > 0),
  created_at      timestamptz not null default now(),
  unique (contribution_id, plan_day_id)
);

create index if not exists allocations_contribution_idx
  on public.savings_contribution_allocations (contribution_id);

comment on table public.savings_contribution_allocations is
  'Which plan days a contribution paid. Immutable: reversals add the reversal transaction and reset the days.';

create or replace function app.allocate_contribution(
  p_contribution uuid,
  p_plan uuid,
  p_amount numeric
)
returns numeric
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_remaining numeric := p_amount;
  v_day record;
  v_due numeric;
  v_apply numeric;
  v_paid numeric;
begin
  for v_day in
    select id, expected_kobo, paid_kobo, status
      from public.savings_plan_days
     where plan_id = p_plan
       and status in ('scheduled', 'missed', 'grace', 'partially_paid')
     order by business_date
     for update
  loop
    exit when v_remaining <= 0;

    v_paid := coalesce(v_day.paid_kobo, 0);
    v_due := v_day.expected_kobo - v_paid;
    continue when v_due <= 0;

    v_apply := least(v_remaining, v_due);

    update public.savings_plan_days
       set paid_kobo = v_paid + v_apply,
           status = case
                      when v_paid + v_apply >= v_day.expected_kobo then 'paid'
                      else 'partially_paid'
                    end,
           contribution_id = p_contribution
     where id = v_day.id;

    insert into public.savings_contribution_allocations (contribution_id, plan_day_id, amount_kobo)
    values (p_contribution, v_day.id, v_apply);

    v_remaining := v_remaining - v_apply;
  end loop;

  return v_remaining;
end;
$$;

revoke all on function app.allocate_contribution(uuid, uuid, numeric) from public;
grant execute on function app.allocate_contribution(uuid, uuid, numeric) to service_role;

alter table public.savings_contributions
  add column if not exists reversed_at timestamptz,
  add column if not exists reversal_transaction_id uuid references public.ledger_transactions(id),
  add column if not exists reversal_reason text;

-- ---------------------------------------------------------------------------
-- Reverse a confirmed contribution
-- ---------------------------------------------------------------------------

create or replace function public.reverse_contribution(
  p_contribution_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_contribution public.savings_contributions;
  v_transaction uuid;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if not app.has_permission('finance:reverse') then
    raise exception 'Permission denied.' using errcode = '42501';
  end if;

  if char_length(v_reason) < 10 then
    raise exception 'A reversal reason of at least 10 characters is required.' using errcode = '22023';
  end if;

  select * into v_contribution
    from public.savings_contributions
   where id = p_contribution_id
   for update;

  if not found then
    raise exception 'Contribution not found.' using errcode = 'P0002';
  end if;

  if v_contribution.status <> 'confirmed' then
    raise exception 'Only a confirmed contribution can be reversed.' using errcode = '22023';
  end if;

  v_transaction := app.post_transaction(
    p_reference => 'REV-' || v_contribution.reference,
    p_kind => 'reversal',
    p_description => 'Contribution reversal',
    p_entries => jsonb_build_array(
      jsonb_build_object('account_code', '2200-' || v_contribution.user_id::text,
                         'direction', 'debit', 'amount_kobo', v_contribution.amount_kobo),
      jsonb_build_object('account_code', '1000',
                         'direction', 'credit', 'amount_kobo', v_contribution.amount_kobo)
    ),
    p_metadata => jsonb_build_object(
      'contribution_id', v_contribution.id,
      'reversal_reason', v_reason
    ),
    p_reverses => v_contribution.ledger_transaction_id
  );

  -- Unwind precisely what this contribution paid.
  update public.savings_plan_days d
     set paid_kobo = greatest(d.paid_kobo - a.amount_kobo, 0),
         status = 'scheduled',
         contribution_id = null
    from public.savings_contribution_allocations a
   where a.contribution_id = v_contribution.id
     and d.id = a.plan_day_id;

  update public.savings_contributions
     set status = 'reversed',
         reversed_at = now(),
         reversal_transaction_id = v_transaction,
         reversal_reason = left(v_reason, 500)
   where id = v_contribution.id;

  perform app.log_audit(
    auth.uid(), null, 'contribution.reverse', 'savings_contribution', v_contribution.id::text,
    jsonb_build_object('status', 'confirmed'),
    jsonb_build_object('status', 'reversed', 'reversal_transaction', v_transaction),
    v_reason, null, null
  );
end;
$$;

revoke all on function public.reverse_contribution(uuid, text) from public;
grant execute on function public.reverse_contribution(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Provider transaction staging + reconciliation
-- ---------------------------------------------------------------------------

create table if not exists public.provider_transactions (
  id                     uuid primary key default gen_random_uuid(),
  provider               text not null,
  provider_transaction_id text not null,
  reference              text,
  amount_kobo            numeric(20, 0) not null,
  currency               char(3) not null,
  status                 text not null,
  channel                text,
  paid_at                timestamptz,
  fees_kobo              numeric(20, 0),
  payload                jsonb,
  fetched_at             timestamptz not null default now(),
  unique (provider, provider_transaction_id)
);

create index if not exists provider_transactions_reference_idx
  on public.provider_transactions (provider, reference);

create or replace function app.run_provider_reconciliation(p_provider text default 'paystack')
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_run uuid;
  v_checked int;
  v_exceptions int;
begin
  insert into public.reconciliation_runs (kind, status, notes)
  values ('provider', 'running', 'Provider statement vs ledger')
  returning id into v_run;

  select count(*) into v_checked
    from public.provider_transactions where provider = p_provider;

  -- Provider recorded a success the platform never confirmed
  insert into public.reconciliation_exceptions
    (run_id, kind, entity_type, entity_id, expected, actual, detail)
  select v_run, 'provider_unmatched', 'provider_transaction', pt.provider_transaction_id,
         pt.amount_kobo, null,
         'Provider shows a successful charge with no confirmed contribution'
    from public.provider_transactions pt
   where pt.provider = p_provider
     and pt.status = 'success'
     and not exists (
       select 1 from public.savings_contributions c
        where c.provider = p_provider
          and c.provider_reference = pt.reference
          and c.status = 'confirmed'
     );

  -- Confirmed contribution with no matching provider record
  insert into public.reconciliation_exceptions
    (run_id, kind, entity_type, entity_id, expected, actual, detail)
  select v_run, 'contribution_provider_missing', 'savings_contribution', c.id::text,
         c.amount_kobo, null,
         'Contribution is confirmed but the provider statement has no matching charge'
    from public.savings_contributions c
   where c.provider = p_provider
     and c.status = 'confirmed'
     and not exists (
       select 1 from public.provider_transactions pt
        where pt.provider = p_provider and pt.reference = c.provider_reference
     );

  -- Amount mismatch between provider and ledger
  insert into public.reconciliation_exceptions
    (run_id, kind, entity_type, entity_id, expected, actual, detail)
  select v_run, 'provider_amount_mismatch', 'savings_contribution', c.id::text,
         c.amount_kobo, pt.amount_kobo,
         'Provider amount differs from the confirmed contribution'
    from public.savings_contributions c
    join public.provider_transactions pt
      on pt.provider = c.provider and pt.reference = c.provider_reference
   where c.provider = p_provider
     and c.status = 'confirmed'
     and pt.amount_kobo <> c.amount_kobo;

  select count(*) into v_exceptions
    from public.reconciliation_exceptions where run_id = v_run;

  update public.reconciliation_runs
     set status = 'completed', checked = v_checked, exceptions = v_exceptions, finished_at = now()
   where id = v_run;

  return v_run;
end;
$$;

revoke all on function app.run_provider_reconciliation(text) from public;
grant execute on function app.run_provider_reconciliation(text) to service_role;

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------

revoke all on public.savings_contribution_allocations from anon, authenticated;
revoke all on public.provider_transactions             from anon, authenticated;

grant select on public.savings_contribution_allocations to authenticated;
grant select, insert, update, delete on
  public.savings_contribution_allocations,
  public.provider_transactions
to service_role;

alter table public.savings_contribution_allocations enable row level security;
alter table public.provider_transactions             enable row level security;

drop policy if exists allocations_select_own on public.savings_contribution_allocations;
create policy allocations_select_own
  on public.savings_contribution_allocations for select to authenticated
  using (
    exists (
      select 1 from public.savings_contributions c
       where c.id = savings_contribution_allocations.contribution_id
         and c.user_id = auth.uid()
    )
  );

drop policy if exists allocations_select_finance on public.savings_contribution_allocations;
create policy allocations_select_finance
  on public.savings_contribution_allocations for select to authenticated
  using (app.has_permission('finance:read'));

-- provider_transactions: no client privileges, no policies.
