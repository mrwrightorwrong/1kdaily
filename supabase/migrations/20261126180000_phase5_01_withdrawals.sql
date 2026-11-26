-- ============================================================================
-- 1kDaily · Phase 5 · 01 — Withdrawals
--
-- Rules:
--   * a withdrawal is only eligible on a completed or cancelled plan
--   * available = ledger savings balance − withdrawals already in flight
--   * the balance row is locked while a request is created, so two concurrent
--     requests cannot both spend the same money
--   * approval requires `withdrawals.approve` (finance, not support)
--   * paying out posts Dr user savings / Cr cash at provider; the ledger is the
--     only record of the outflow
-- ============================================================================

insert into public.admin_permissions (key, description)
values ('withdrawals:approve', 'Approve or reject withdrawal requests')
on conflict (key) do nothing;

insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
  from public.admin_roles r, public.admin_permissions p
 where r.key in ('super_admin', 'finance_admin')
   and p.key = 'withdrawals:approve'
on conflict do nothing;

create table if not exists public.user_bank_accounts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  bank_code      text not null,
  bank_name      text not null,
  account_name   text not null,
  account_last4  text not null check (account_last4 ~ '^[0-9]{4}$'),
  recipient_code text not null,
  status         text not null default 'active' check (status in ('active', 'disabled')),
  created_at     timestamptz not null default now(),
  unique (user_id, recipient_code)
);

comment on table public.user_bank_accounts is
  'Payout destinations. The account number is sent once to the provider to create a recipient; only last4 and the recipient code are stored.';

create index if not exists user_bank_accounts_user_idx on public.user_bank_accounts (user_id);

create table if not exists public.withdrawal_requests (
  id                    uuid primary key default gen_random_uuid(),
  reference             text not null unique,
  user_id               uuid not null references auth.users(id) on delete restrict,
  plan_id               uuid not null references public.savings_plans(id) on delete restrict,
  bank_account_id       uuid not null references public.user_bank_accounts(id) on delete restrict,
  amount_kobo           numeric(20, 0) not null check (amount_kobo > 0),
  status                text not null default 'requested'
                          check (status in ('requested', 'under_review', 'approved', 'processing',
                                            'paid', 'rejected', 'cancelled', 'failed')),
  idempotency_key       text check (idempotency_key is null or char_length(idempotency_key) <= 100),
  requested_at          timestamptz not null default now(),
  decided_by            uuid references auth.users(id),
  decided_at            timestamptz,
  decision_reason       text,
  provider_reference    text,
  ledger_transaction_id uuid references public.ledger_transactions(id),
  paid_at               timestamptz,
  failure_code          text,
  updated_at            timestamptz not null default now()
);

create unique index if not exists withdrawal_requests_idempotency_idx
  on public.withdrawal_requests (user_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists withdrawal_requests_user_idx
  on public.withdrawal_requests (user_id, requested_at desc);
create index if not exists withdrawal_requests_status_idx
  on public.withdrawal_requests (status, requested_at);

drop trigger if exists withdrawal_requests_touch on public.withdrawal_requests;
create trigger withdrawal_requests_touch
  before update on public.withdrawal_requests
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Completion: a plan ends when its schedule is settled or its end date passes
-- ---------------------------------------------------------------------------

create or replace function public.refresh_my_plan_days()
returns void
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  r record;
  v_available int;
  v_changed int;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  for r in
    select p.id, p.grace_days_total, p.grace_days_used
      from public.savings_plans p
     where p.user_id = v_uid
       and p.status = 'active'
       and exists (
         select 1 from public.savings_plan_days d
          where d.plan_id = p.id and d.status = 'scheduled' and d.business_date < current_date
       )
     for update
  loop
    v_available := greatest(r.grace_days_total - r.grace_days_used, 0);

    with past as (
      select d.id, row_number() over (order by d.business_date) as rn
        from public.savings_plan_days d
       where d.plan_id = r.id and d.status = 'scheduled' and d.business_date < current_date
    )
    update public.savings_plan_days d
       set status = case when past.rn <= v_available then 'grace' else 'missed' end
      from past
     where d.id = past.id;

    get diagnostics v_changed = row_count;

    if v_changed > 0 then
      update public.savings_plans
         set grace_days_used = grace_days_used + least(v_available, v_changed)
       where id = r.id;

      insert into public.savings_plan_events (plan_id, user_id, event_type, metadata)
      values (
        r.id, v_uid,
        case when least(v_available, v_changed) > 0 then 'grace_applied' else 'day_missed' end,
        jsonb_build_object('days', v_changed, 'grace_applied', least(v_available, v_changed))
      );
    end if;
  end loop;

  update public.savings_plans p
     set status = 'completed', completed_at = now()
   where p.user_id = v_uid
     and p.status = 'active'
     and (
       p.end_date < current_date
       or not exists (
         select 1 from public.savings_plan_days d
          where d.plan_id = p.id
            and d.status in ('scheduled', 'missed', 'grace', 'partially_paid')
       )
     );

  insert into public.savings_plan_events (plan_id, user_id, event_type)
  select p.id, v_uid, 'completed'
    from public.savings_plans p
   where p.user_id = v_uid
     and p.status = 'completed'
     and p.completed_at > now() - interval '5 seconds';
end;
$$;

-- ---------------------------------------------------------------------------
-- Eligibility and request
-- ---------------------------------------------------------------------------

create or replace function public.my_withdrawal_eligibility(p_plan_id uuid)
returns table (eligible boolean, available_kobo numeric, reason text)
language plpgsql
stable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_plan public.savings_plans;
  v_balance numeric;
  v_reserved numeric;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into v_plan from public.savings_plans where id = p_plan_id and user_id = v_uid;
  if not found then
    return query select false, 0::numeric, 'Plan not found'::text;
    return;
  end if;

  if v_plan.status not in ('completed', 'cancelled') then
    return query select false, 0::numeric,
      'Withdrawals open when the plan completes or is cancelled'::text;
    return;
  end if;

  select coalesce(b.balance_kobo, 0) into v_balance
    from public.account_balances b
    join public.financial_accounts a on a.id = b.account_id
   where a.code = '2200-' || v_uid::text;

  select coalesce(sum(w.amount_kobo), 0) into v_reserved
    from public.withdrawal_requests w
   where w.user_id = v_uid
     and w.status in ('requested', 'under_review', 'approved', 'processing');

  if v_balance - v_reserved <= 0 then
    return query select false, 0::numeric, 'No available balance'::text;
    return;
  end if;

  return query select true, v_balance - v_reserved, null::text;
end;
$$;

revoke all on function public.my_withdrawal_eligibility(uuid) from public;
grant execute on function public.my_withdrawal_eligibility(uuid) to authenticated;

create or replace function public.request_withdrawal(
  p_plan_id uuid,
  p_bank_account_id uuid,
  p_amount_kobo numeric,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_plan public.savings_plans;
  v_bank public.user_bank_accounts;
  v_balance numeric;
  v_reserved numeric;
  v_id uuid;
  v_reference text;
  v_existing public.withdrawal_requests;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_amount_kobo is null or p_amount_kobo < 10000 then
    raise exception 'The minimum withdrawal is 100 naira.' using errcode = '22023';
  end if;

  if p_idempotency_key is not null then
    select * into v_existing
      from public.withdrawal_requests
     where user_id = v_uid and idempotency_key = p_idempotency_key;
    if found then
      return v_existing.id;
    end if;
  end if;

  select * into v_plan from public.savings_plans where id = p_plan_id and user_id = v_uid;
  if not found then
    raise exception 'Plan not found.' using errcode = 'P0002';
  end if;
  if v_plan.status not in ('completed', 'cancelled') then
    raise exception 'Withdrawals open when the plan completes or is cancelled.' using errcode = '22023';
  end if;

  select * into v_bank from public.user_bank_accounts
   where id = p_bank_account_id and user_id = v_uid and status = 'active';
  if not found then
    raise exception 'Choose a valid payout account.' using errcode = '22023';
  end if;

  -- Lock the balance row so concurrent requests cannot double-spend.
  perform 1
    from public.account_balances b
    join public.financial_accounts a on a.id = b.account_id
   where a.code = '2200-' || v_uid::text
     for update;

  select coalesce(b.balance_kobo, 0) into v_balance
    from public.account_balances b
    join public.financial_accounts a on a.id = b.account_id
   where a.code = '2200-' || v_uid::text;

  select coalesce(sum(w.amount_kobo), 0) into v_reserved
    from public.withdrawal_requests w
   where w.user_id = v_uid
     and w.status in ('requested', 'under_review', 'approved', 'processing');

  if p_amount_kobo > v_balance - v_reserved then
    raise exception 'That amount exceeds your available balance.' using errcode = '22023';
  end if;

  v_reference := 'KD-WDR-' || replace(gen_random_uuid()::text, '-', '');

  insert into public.withdrawal_requests (
    reference, user_id, plan_id, bank_account_id, amount_kobo, status, idempotency_key
  )
  values (v_reference, v_uid, p_plan_id, p_bank_account_id, p_amount_kobo, 'under_review', p_idempotency_key)
  returning id into v_id;

  perform app.log_audit(
    v_uid, null, 'withdrawal.requested', 'withdrawal_request', v_id::text,
    null,
    jsonb_build_object('plan_id', p_plan_id, 'amount_kobo', p_amount_kobo, 'bank_account_id', p_bank_account_id),
    null, null, null
  );

  return v_id;
end;
$$;

revoke all on function public.request_withdrawal(uuid, uuid, numeric, text) from public;
grant execute on function public.request_withdrawal(uuid, uuid, numeric, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Decision (finance) and payout (operations)
-- ---------------------------------------------------------------------------

create or replace function public.decide_withdrawal(
  p_withdrawal_id uuid,
  p_decision text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_request public.withdrawal_requests;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if not app.has_permission('withdrawals:approve') then
    raise exception 'Permission denied.' using errcode = '42501';
  end if;

  if p_decision not in ('approve', 'reject') then
    raise exception 'Unknown decision.' using errcode = '22023';
  end if;

  if char_length(v_reason) < 10 then
    raise exception 'A reason of at least 10 characters is required.' using errcode = '22023';
  end if;

  select * into v_request from public.withdrawal_requests where id = p_withdrawal_id for update;
  if not found then
    raise exception 'Withdrawal not found.' using errcode = 'P0002';
  end if;

  if v_request.status not in ('requested', 'under_review') then
    raise exception 'This request can no longer be decided.' using errcode = '22023';
  end if;

  update public.withdrawal_requests
     set status = case when p_decision = 'approve' then 'approved' else 'rejected' end,
         decided_by = auth.uid(),
         decided_at = now(),
         decision_reason = left(v_reason, 500)
   where id = p_withdrawal_id;

  perform app.log_audit(
    auth.uid(), null, 'withdrawal.' || p_decision, 'withdrawal_request', p_withdrawal_id::text,
    jsonb_build_object('status', v_request.status),
    jsonb_build_object('status', case when p_decision = 'approve' then 'approved' else 'rejected' end),
    v_reason, null, null
  );
end;
$$;

revoke all on function public.decide_withdrawal(uuid, text, text) from public;
grant execute on function public.decide_withdrawal(uuid, text, text) to authenticated;

create or replace function public.mark_withdrawal_paid(
  p_withdrawal_id uuid,
  p_provider_reference text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_request public.withdrawal_requests;
  v_tx uuid;
begin
  select * into v_request from public.withdrawal_requests where id = p_withdrawal_id for update;
  if not found then
    raise exception 'Withdrawal not found.' using errcode = 'P0002';
  end if;
  if v_request.status = 'paid' then
    return v_request.ledger_transaction_id;
  end if;
  if v_request.status <> 'approved' then
    raise exception 'Only an approved withdrawal can be paid.' using errcode = '22023';
  end if;

  v_tx := app.post_transaction(
    p_reference => v_request.reference,
    p_kind => 'withdrawal',
    p_description => 'Savings withdrawal payout',
    p_entries => jsonb_build_array(
      jsonb_build_object('account_code', '2200-' || v_request.user_id::text,
                         'direction', 'debit', 'amount_kobo', v_request.amount_kobo),
      jsonb_build_object('account_code', '1000',
                         'direction', 'credit', 'amount_kobo', v_request.amount_kobo)
    ),
    p_metadata => jsonb_build_object('withdrawal_id', v_request.id, 'plan_id', v_request.plan_id)
  );

  update public.withdrawal_requests
     set status = 'paid', paid_at = now(), provider_reference = p_provider_reference,
         ledger_transaction_id = v_tx
   where id = p_withdrawal_id;

  perform app.log_audit(
    auth.uid(), 'operations', 'withdrawal.paid', 'withdrawal_request', p_withdrawal_id::text,
    jsonb_build_object('status', 'approved'),
    jsonb_build_object('status', 'paid', 'ledger_transaction', v_tx, 'provider_reference', p_provider_reference),
    'Payout recorded', null, null
  );

  return v_tx;
end;
$$;

revoke all on function public.mark_withdrawal_paid(uuid, text) from public;
grant execute on function public.mark_withdrawal_paid(uuid, text) to service_role;

create or replace function public.fail_withdrawal(p_withdrawal_id uuid, p_code text)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
begin
  update public.withdrawal_requests
     set status = 'failed', failure_code = left(coalesce(p_code, 'unknown'), 80)
   where id = p_withdrawal_id and status in ('approved', 'processing');
end;
$$;

revoke all on function public.fail_withdrawal(uuid, text) from public;
grant execute on function public.fail_withdrawal(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------

revoke all on public.user_bank_accounts from anon, authenticated;
revoke all on public.withdrawal_requests from anon, authenticated;

grant select on public.user_bank_accounts to authenticated;
grant select on public.withdrawal_requests to authenticated;

grant select, insert, update, delete on
  public.user_bank_accounts,
  public.withdrawal_requests
to service_role;

alter table public.user_bank_accounts enable row level security;
alter table public.withdrawal_requests enable row level security;

drop policy if exists user_bank_accounts_select_own on public.user_bank_accounts;
create policy user_bank_accounts_select_own
  on public.user_bank_accounts for select to authenticated
  using (user_id = auth.uid());

drop policy if exists withdrawal_requests_select_own on public.withdrawal_requests;
create policy withdrawal_requests_select_own
  on public.withdrawal_requests for select to authenticated
  using (user_id = auth.uid());

drop policy if exists withdrawal_requests_select_finance on public.withdrawal_requests;
create policy withdrawal_requests_select_finance
  on public.withdrawal_requests for select to authenticated
  using (app.has_permission('finance:read'));
