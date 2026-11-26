-- Phase 7 · 03 — approval, disbursement and repayment schedules
alter table public.loan_applications
  add column if not exists disbursed_at timestamptz,
  add column if not exists disbursement_transaction_id uuid references public.ledger_transactions(id);

create table if not exists public.loan_repayment_schedules (
  id                 uuid primary key default gen_random_uuid(),
  application_id     uuid not null references public.loan_applications(id) on delete restrict,
  user_id            uuid not null references auth.users(id) on delete restrict,
  installment_number integer not null,
  due_date           date not null,
  principal_kobo     numeric(20,0) not null check (principal_kobo >= 0),
  interest_kobo      numeric(20,0) not null check (interest_kobo >= 0),
  total_kobo         numeric(20,0) not null check (total_kobo > 0),
  status             text not null default 'upcoming'
                       check (status in ('upcoming','due','partially_paid','paid','overdue','rescheduled','cancelled','reversed')),
  paid_kobo          numeric(20,0) not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (application_id, installment_number)
);

create index if not exists repayment_schedules_user_idx
  on public.loan_repayment_schedules (user_id, due_date);

drop trigger if exists repayment_schedules_touch on public.loan_repayment_schedules;
create trigger repayment_schedules_touch before update on public.loan_repayment_schedules
  for each row execute function app.touch_updated_at();

create or replace function public.decide_loan_application(
  p_application_id uuid,
  p_decision text,
  p_reason text
)
returns void
language plpgsql security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_app public.loan_applications;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_status text;
begin
  if not app.has_permission('loans:approve') then
    raise exception 'Permission denied.' using errcode = '42501';
  end if;
  if p_decision not in ('approve', 'reject') then
    raise exception 'Unknown decision.' using errcode = '22023';
  end if;
  if char_length(v_reason) < 10 then
    raise exception 'A reason of at least 10 characters is required.' using errcode = '22023';
  end if;

  select * into v_app from public.loan_applications where id = p_application_id for update;
  if not found then raise exception 'Application not found.' using errcode = 'P0002'; end if;
  if v_app.status not in ('submitted', 'under_review', 'info_required') then
    raise exception 'This application can no longer be decided.' using errcode = '22023';
  end if;

  v_status := case when p_decision = 'approve' then 'approved' else 'rejected' end;

  update public.loan_applications
     set status = v_status, decided_by = auth.uid(), decided_at = now(), decision_reason = left(v_reason, 500)
   where id = p_application_id;

  perform app.log_audit(auth.uid(), null, 'loan.' || p_decision, 'loan_application', p_application_id::text,
    jsonb_build_object('status', v_app.status), jsonb_build_object('status', v_status), v_reason, null, null);
end;
$$;

revoke all on function public.decide_loan_application(uuid, text, text) from public;
grant execute on function public.decide_loan_application(uuid, text, text) to authenticated;

create or replace function public.disburse_loan(
  p_application_id uuid,
  p_provider_reference text
)
returns uuid
language plpgsql security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_app public.loan_applications;
  v_offer public.loan_offers;
  v_tx uuid;
  v_entry jsonb;
  v_due date;
begin
  if not app.has_permission('loans:disburse') then
    raise exception 'Permission denied.' using errcode = '42501';
  end if;

  select * into v_app from public.loan_applications where id = p_application_id for update;
  if not found then raise exception 'Application not found.' using errcode = 'P0002'; end if;
  if v_app.disbursed_at is not null then return v_app.disbursement_transaction_id; end if;
  if v_app.status <> 'approved' then
    raise exception 'Only an approved application can be disbursed.' using errcode = '22023';
  end if;

  select * into v_offer from public.loan_offers where application_id = p_application_id;
  if not found then raise exception 'Offer not found.' using errcode = 'P0002'; end if;

  v_tx := app.post_transaction(
    p_reference => 'DISB-' || v_app.reference,
    p_kind => 'disbursement',
    p_description => 'Loan disbursement',
    p_entries => jsonb_build_array(
      jsonb_build_object('account_code','1200','direction','debit','amount_kobo', v_offer.principal_kobo),
      jsonb_build_object('account_code','1000','direction','credit','amount_kobo', v_offer.net_disbursed_kobo),
      jsonb_build_object('account_code','4010','direction','credit','amount_kobo', v_offer.processing_fee_kobo),
      jsonb_build_object('account_code','2000','direction','credit','amount_kobo', v_offer.insurance_fee_kobo)
    ),
    p_metadata => jsonb_build_object('application_id', v_app.id, 'offer_id', v_offer.id,
                                     'provider_reference', p_provider_reference)
  );

  for v_entry in select * from jsonb_array_elements(v_offer.schedule)
  loop
    v_due := current_date + (interval '1 month' * ((v_entry ->> 'number')::int));
    insert into public.loan_repayment_schedules
      (application_id, user_id, installment_number, due_date, principal_kobo, interest_kobo, total_kobo)
    values (
      v_app.id, v_app.user_id, (v_entry ->> 'number')::int, v_due,
      (v_entry ->> 'principal')::numeric, (v_entry ->> 'interest')::numeric, (v_entry ->> 'total')::numeric
    );
  end loop;

  update public.loan_applications
     set status = 'disbursed', disbursed_at = now(), disbursement_transaction_id = v_tx
   where id = p_application_id;

  perform app.log_audit(auth.uid(), 'finance', 'loan.disburse', 'loan_application', p_application_id::text,
    jsonb_build_object('status', 'approved'),
    jsonb_build_object('status', 'disbursed', 'ledger_transaction', v_tx,
                       'net_disbursed_kobo', v_offer.net_disbursed_kobo),
    'Disbursement executed', null, null);

  return v_tx;
end;
$$;

revoke all on function public.disburse_loan(uuid, text) from public;
grant execute on function public.disburse_loan(uuid, text) to authenticated;

revoke all on public.loan_repayment_schedules from anon, authenticated;
grant select on public.loan_repayment_schedules to authenticated;
grant select, insert, update, delete on public.loan_repayment_schedules to service_role;
alter table public.loan_repayment_schedules enable row level security;

drop policy if exists schedules_own on public.loan_repayment_schedules;
create policy schedules_own on public.loan_repayment_schedules for select to authenticated
  using (user_id = auth.uid());
drop policy if exists schedules_staff on public.loan_repayment_schedules;
create policy schedules_staff on public.loan_repayment_schedules for select to authenticated
  using (app.has_permission('loans:read'));
