-- ============================================================================
-- 1kDaily · Phase 4 · 02 — Contributions, provider events, reconciliation
--
-- Flow: initiate (customer) → Paystack → webhook or callback → server-side
-- verify → confirm_contribution (service role) → balanced ledger entries →
-- FIFO allocation to plan days.
--
-- A contribution is never credited from a browser response or from a webhook
-- body alone: the webhook only triggers a verify call, and confirmation is
-- idempotent by contribution id and by provider reference.
-- ============================================================================

create table if not exists public.savings_contributions (
  id                    uuid primary key default gen_random_uuid(),
  reference             text not null unique,
  user_id               uuid not null references auth.users(id) on delete restrict,
  plan_id               uuid not null references public.savings_plans(id) on delete restrict,
  amount_kobo           numeric(20, 0) not null check (amount_kobo > 0),
  status                text not null default 'initiated'
                          check (status in ('initiated', 'pending', 'confirmed', 'failed', 'reversed', 'refunded')),
  provider              text not null default 'paystack',
  provider_reference    text,
  channel               text,
  idempotency_key       text check (idempotency_key is null or char_length(idempotency_key) <= 100),
  ledger_transaction_id uuid references public.ledger_transactions(id),
  failure_code          text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  confirmed_at          timestamptz
);

comment on table public.savings_contributions is
  'One row per payment attempt. Confirmation requires server-side verification and produces balanced ledger entries.';

create unique index if not exists savings_contributions_provider_ref_idx
  on public.savings_contributions (provider, provider_reference)
  where provider_reference is not null;

create unique index if not exists savings_contributions_idempotency_idx
  on public.savings_contributions (user_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists savings_contributions_user_idx
  on public.savings_contributions (user_id, created_at desc);
create index if not exists savings_contributions_plan_idx
  on public.savings_contributions (plan_id, created_at desc);

drop trigger if exists savings_contributions_touch on public.savings_contributions;
create trigger savings_contributions_touch
  before update on public.savings_contributions
  for each row execute function app.touch_updated_at();

create table if not exists public.payment_provider_events (
  id                 bigint generated always as identity primary key,
  provider           text not null,
  event_id           text not null,
  event_type         text,
  provider_reference text,
  payload            jsonb not null,
  signature_valid    boolean not null default false,
  status             text not null default 'received'
                       check (status in ('received', 'processed', 'ignored', 'failed')),
  received_at        timestamptz not null default now(),
  processed_at       timestamptz,
  unique (provider, event_id)
);

comment on table public.payment_provider_events is
  'Raw webhook envelope, stored before processing. The unique key makes replays harmless.';

create index if not exists payment_provider_events_ref_idx
  on public.payment_provider_events (provider, provider_reference);

create table if not exists public.reconciliation_runs (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null default 'ledger' check (kind in ('ledger', 'provider')),
  status      text not null default 'running' check (status in ('running', 'completed', 'failed')),
  checked     integer not null default 0,
  exceptions  integer not null default 0,
  notes       text,
  started_at  timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.reconciliation_exceptions (
  id           uuid primary key default gen_random_uuid(),
  run_id       uuid not null references public.reconciliation_runs(id) on delete cascade,
  kind         text not null,
  entity_type  text not null,
  entity_id    text,
  expected     numeric(20, 0),
  actual       numeric(20, 0),
  severity     text not null default 'high' check (severity in ('low', 'medium', 'high')),
  detail       text,
  resolved_at  timestamptz,
  resolved_by  uuid references auth.users(id),
  resolution   text,
  created_at   timestamptz not null default now()
);

create index if not exists reconciliation_exceptions_run_idx
  on public.reconciliation_exceptions (run_id, severity);

-- ---------------------------------------------------------------------------
-- Initiate a contribution (customer)
-- ---------------------------------------------------------------------------

create or replace function public.initiate_contribution(
  p_plan_id uuid,
  p_amount_kobo numeric,
  p_idempotency_key text default null
)
returns table (contribution_id uuid, reference text)
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_plan public.savings_plans;
  v_id uuid;
  v_reference text;
  v_existing public.savings_contributions;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_amount_kobo is null or p_amount_kobo <= 0 then
    raise exception 'Enter an amount greater than zero.' using errcode = '22023';
  end if;

  if p_amount_kobo > 100000000 then
    raise exception 'A single contribution cannot exceed 1,000,000 naira.' using errcode = '22023';
  end if;

  if p_idempotency_key is not null then
    select * into v_existing
      from public.savings_contributions
     where user_id = v_uid and idempotency_key = p_idempotency_key;
    if found then
      return query select v_existing.id, v_existing.reference;
    end if;
  end if;

  select * into v_plan from public.savings_plans where id = p_plan_id and user_id = v_uid;
  if not found then
    raise exception 'Plan not found.' using errcode = 'P0002';
  end if;
  if v_plan.status <> 'active' then
    raise exception 'Contributions are only accepted on an active plan.' using errcode = '22023';
  end if;

  v_reference := 'KD-CON-' || replace(gen_random_uuid()::text, '-', '');

  insert into public.savings_contributions (
    reference, user_id, plan_id, amount_kobo, status, provider, idempotency_key
  )
  values (v_reference, v_uid, p_plan_id, p_amount_kobo, 'initiated', 'paystack', p_idempotency_key)
  returning id into v_id;

  perform app.log_audit(
    v_uid, null, 'contribution.initiated', 'savings_contribution', v_id::text,
    null, jsonb_build_object('plan_id', p_plan_id, 'amount_kobo', p_amount_kobo), null, null, null
  );

  return query select v_id, v_reference;
end;
$$;

revoke all on function public.initiate_contribution(uuid, numeric, text) from public;
grant execute on function public.initiate_contribution(uuid, numeric, text) to authenticated;

-- ---------------------------------------------------------------------------
-- FIFO allocation to plan days
-- ---------------------------------------------------------------------------

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

    v_remaining := v_remaining - v_apply;
  end loop;

  return v_remaining;
end;
$$;

revoke all on function app.allocate_contribution(uuid, uuid, numeric) from public;
grant execute on function app.allocate_contribution(uuid, uuid, numeric) to service_role;

-- ---------------------------------------------------------------------------
-- Confirm a contribution (service role only, after server-side verification)
-- ---------------------------------------------------------------------------

create or replace function public.confirm_contribution(
  p_contribution_id uuid,
  p_provider_reference text,
  p_paid_kobo numeric,
  p_channel text default null,
  p_paid_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_contribution public.savings_contributions;
  v_account uuid;
  v_tx uuid;
  v_unallocated numeric;
begin
  select * into v_contribution
    from public.savings_contributions
   where id = p_contribution_id
   for update;

  if not found then
    raise exception 'Contribution not found.' using errcode = 'P0002';
  end if;

  if v_contribution.status = 'confirmed' then
    return; -- idempotent replay
  end if;

  if v_contribution.status not in ('initiated', 'pending') then
    raise exception 'Contribution cannot be confirmed from status %.', v_contribution.status
      using errcode = '22023';
  end if;

  if p_paid_kobo is null or p_paid_kobo <> v_contribution.amount_kobo then
    raise exception 'Paid amount (%) does not match the initiated amount (%).',
      p_paid_kobo, v_contribution.amount_kobo
      using errcode = '22023';
  end if;

  v_account := app.ensure_user_savings_account(v_contribution.user_id);

  v_tx := app.post_transaction(
    p_reference => v_contribution.reference,
    p_kind => 'contribution',
    p_description => 'Savings contribution',
    p_entries => jsonb_build_array(
      jsonb_build_object('account_code', '1000', 'direction', 'debit', 'amount_kobo', v_contribution.amount_kobo),
      jsonb_build_object('account_code', '2200-' || v_contribution.user_id::text, 'direction', 'credit', 'amount_kobo', v_contribution.amount_kobo)
    ),
    p_metadata => jsonb_build_object(
      'contribution_id', v_contribution.id,
      'plan_id', v_contribution.plan_id,
      'provider', v_contribution.provider,
      'provider_reference', p_provider_reference
    )
  );

  v_unallocated := app.allocate_contribution(
    v_contribution.id, v_contribution.plan_id, v_contribution.amount_kobo
  );

  update public.savings_contributions
     set status = 'confirmed',
         provider_reference = p_provider_reference,
         channel = p_channel,
         confirmed_at = p_paid_at,
         ledger_transaction_id = v_tx
   where id = p_contribution_id;

  perform app.log_audit(
    null, 'payments', 'contribution.confirmed', 'savings_contribution', p_contribution_id::text,
    jsonb_build_object('status', v_contribution.status),
    jsonb_build_object(
      'status', 'confirmed',
      'amount_kobo', v_contribution.amount_kobo,
      'ledger_transaction', v_tx,
      'unallocated_kobo', v_unallocated,
      'provider_reference', p_provider_reference
    ),
    'Server-verified payment', null, null
  );
end;
$$;

revoke all on function public.confirm_contribution(uuid, text, numeric, text, timestamptz) from public;
grant execute on function public.confirm_contribution(uuid, text, numeric, text, timestamptz) to service_role;

create or replace function public.fail_contribution(
  p_contribution_id uuid,
  p_failure_code text
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
begin
  update public.savings_contributions
     set status = 'failed', failure_code = left(coalesce(p_failure_code, 'unknown'), 80)
   where id = p_contribution_id
     and status in ('initiated', 'pending');
end;
$$;

revoke all on function public.fail_contribution(uuid, text) from public;
grant execute on function public.fail_contribution(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Ledger reconciliation (no provider API required)
-- ---------------------------------------------------------------------------

create or replace function app.run_ledger_reconciliation(p_notes text default null)
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
  values ('ledger', 'running', p_notes)
  returning id into v_run;

  select count(*) into v_checked from public.savings_contributions where status = 'confirmed';

  -- Confirmed contribution with no ledger transaction
  insert into public.reconciliation_exceptions
    (run_id, kind, entity_type, entity_id, expected, actual, detail)
  select v_run, 'contribution_without_ledger', 'savings_contribution', c.id::text,
         c.amount_kobo, null, 'Confirmed contribution has no ledger transaction'
    from public.savings_contributions c
   where c.status = 'confirmed' and c.ledger_transaction_id is null;

  -- Ledger credit to the user's savings account does not equal the contribution
  insert into public.reconciliation_exceptions
    (run_id, kind, entity_type, entity_id, expected, actual, detail)
  select v_run, 'contribution_ledger_mismatch', 'savings_contribution', c.id::text,
         c.amount_kobo,
         coalesce(sum(e.amount_kobo) filter (
           where a.owner_kind = 'user' and a.owner_id = c.user_id and e.direction = 'credit'
         ), 0),
         'Savings credit does not match the confirmed amount'
    from public.savings_contributions c
    join public.ledger_transactions t on t.id = c.ledger_transaction_id
    join public.ledger_entries e on e.transaction_id = t.id
    join public.financial_accounts a on a.id = e.account_id
   where c.status = 'confirmed'
   group by c.id, c.amount_kobo
  having coalesce(sum(e.amount_kobo) filter (
           where a.owner_kind = 'user' and a.owner_id = c.user_id and e.direction = 'credit'
         ), 0) <> c.amount_kobo;

  -- Cached balances that no longer match the entries
  insert into public.reconciliation_exceptions
    (run_id, kind, entity_type, entity_id, expected, actual, detail)
  select v_run, 'balance_drift', 'financial_account', d.account_code,
         d.rebuilt_kobo, d.cached_kobo, 'Cached balance differs from rebuilt balance'
    from app.account_balance_drift() d;

  select count(*) into v_exceptions from public.reconciliation_exceptions where run_id = v_run;

  update public.reconciliation_runs
     set status = 'completed', checked = v_checked, exceptions = v_exceptions, finished_at = now()
   where id = v_run;

  return v_run;
end;
$$;

revoke all on function app.run_ledger_reconciliation(text) from public;
grant execute on function app.run_ledger_reconciliation(text) to service_role;

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------

revoke all on public.savings_contributions     from anon, authenticated;
revoke all on public.payment_provider_events   from anon, authenticated;
revoke all on public.reconciliation_runs       from anon, authenticated;
revoke all on public.reconciliation_exceptions from anon, authenticated;

grant select on public.savings_contributions     to authenticated;
grant select on public.reconciliation_runs       to authenticated;
grant select on public.reconciliation_exceptions to authenticated;

grant select, insert, update, delete on
  public.savings_contributions,
  public.payment_provider_events,
  public.reconciliation_runs,
  public.reconciliation_exceptions
to service_role;

alter table public.savings_contributions     enable row level security;
alter table public.payment_provider_events   enable row level security;
alter table public.reconciliation_runs       enable row level security;
alter table public.reconciliation_exceptions enable row level security;

drop policy if exists savings_contributions_select_own on public.savings_contributions;
create policy savings_contributions_select_own
  on public.savings_contributions for select to authenticated
  using (user_id = auth.uid());

drop policy if exists savings_contributions_select_staff on public.savings_contributions;
create policy savings_contributions_select_staff
  on public.savings_contributions for select to authenticated
  using (app.has_permission('savings:read'));

drop policy if exists reconciliation_runs_select_finance on public.reconciliation_runs;
create policy reconciliation_runs_select_finance
  on public.reconciliation_runs for select to authenticated
  using (app.has_permission('finance:read'));

drop policy if exists reconciliation_exceptions_select_finance on public.reconciliation_exceptions;
create policy reconciliation_exceptions_select_finance
  on public.reconciliation_exceptions for select to authenticated
  using (app.has_permission('finance:read'));

-- payment_provider_events: no policies, no client privileges.
