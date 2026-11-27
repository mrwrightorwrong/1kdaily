-- Phase 7 · 04 — repayment capture (server-verified, service role only)
create table if not exists public.loan_repayments (
  id                    uuid primary key default gen_random_uuid(),
  application_id        uuid not null references public.loan_applications(id) on delete restrict,
  user_id               uuid not null references auth.users(id) on delete restrict,
  amount_kobo           numeric(20,0) not null check (amount_kobo > 0),
  provider              text not null default 'paystack',
  provider_reference    text not null,
  ledger_transaction_id uuid references public.ledger_transactions(id),
  paid_at               timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  unique (provider, provider_reference)
);

create index if not exists loan_repayments_application_idx
  on public.loan_repayments (application_id, created_at desc);

create or replace function public.record_repayment(
  p_application_id uuid,
  p_amount_kobo numeric,
  p_provider_reference text
)
returns void
language plpgsql security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_app public.loan_applications;
  v_amount numeric := p_amount_kobo;
  v_remaining numeric := p_amount_kobo;
  v_installment record;
  v_apply numeric;
  v_paid numeric;
  v_principal numeric := 0;
  v_interest numeric := 0;
  v_due numeric;
  v_tx uuid;
  v_open int;
begin
  if v_amount is null or v_amount <= 0 then
    raise exception 'Repayment amount must be positive.' using errcode = '22023';
  end if;

  select * into v_app from public.loan_applications where id = p_application_id for update;
  if not found then raise exception 'Loan not found.' using errcode = 'P0002'; end if;
  if v_app.status not in ('disbursed', 'closed') then
    raise exception 'This loan is not disbursed.' using errcode = '22023';
  end if;

  if exists (select 1 from public.loan_repayments where provider = 'paystack' and provider_reference = p_provider_reference) then
    return; -- idempotent replay
  end if;

  for v_installment in
    select * from public.loan_repayment_schedules
     where application_id = p_application_id and status <> 'paid'
     order by installment_number
     for update
  loop
    exit when v_remaining <= 0;
    v_due := v_installment.total_kobo - v_installment.paid_kobo;
    continue when v_due <= 0;
    v_apply := least(v_remaining, v_due);
    v_paid := v_installment.paid_kobo + v_apply;
    -- split proportionally between principal and interest, exact by complement
    v_principal := v_principal + (v_apply * v_installment.principal_kobo) / v_installment.total_kobo;
    v_interest := v_interest + v_apply
      - (v_apply * v_installment.principal_kobo) / v_installment.total_kobo;

    update public.loan_repayment_schedules
       set paid_kobo = v_paid,
           status = case when v_paid >= v_installment.total_kobo then 'paid' else 'partially_paid' end
     where id = v_installment.id;

    v_remaining := v_remaining - v_apply;
  end loop;

  if v_remaining = v_amount then
    raise exception 'There is nothing left to repay on this loan.' using errcode = '22023';
  end if;

  v_tx := app.post_transaction(
    p_reference => 'REPAY-' || p_provider_reference,
    p_kind => 'repayment',
    p_description => 'Loan repayment',
    p_entries => jsonb_build_array(
      jsonb_build_object('account_code','1000','direction','debit','amount_kobo', v_amount),
      jsonb_build_object('account_code','1200','direction','credit','amount_kobo', v_principal),
      jsonb_build_object('account_code','4000','direction','credit','amount_kobo', v_amount - v_principal)
    ),
    p_metadata => jsonb_build_object('application_id', p_application_id,
                                     'provider_reference', p_provider_reference)
  );

  insert into public.loan_repayments
    (application_id, user_id, amount_kobo, provider_reference, ledger_transaction_id)
  values (p_application_id, v_app.user_id, v_amount, p_provider_reference, v_tx);

  select count(*) into v_open from public.loan_repayment_schedules
   where application_id = p_application_id and status <> 'paid';

  if v_open = 0 then
    update public.loan_applications set status = 'closed' where id = p_application_id;
  end if;

  perform app.log_audit(null, 'payments', 'loan.repayment', 'loan_application', p_application_id::text,
    null, jsonb_build_object('amount_kobo', v_amount, 'principal_kobo', v_principal,
                             'interest_kobo', v_amount - v_principal, 'ledger_transaction', v_tx),
    'Verified repayment', null, null);
end;
$$;

revoke all on function public.record_repayment(uuid, numeric, text) from public;
grant execute on function public.record_repayment(uuid, numeric, text) to service_role;

revoke all on public.loan_repayments from anon, authenticated;
grant select on public.loan_repayments to authenticated;
grant select, insert, update, delete on public.loan_repayments to service_role;
alter table public.loan_repayments enable row level security;

drop policy if exists repayments_own on public.loan_repayments;
create policy repayments_own on public.loan_repayments for select to authenticated
  using (user_id = auth.uid());
drop policy if exists repayments_staff on public.loan_repayments;
create policy repayments_staff on public.loan_repayments for select to authenticated
  using (app.has_permission('loans:read'));
