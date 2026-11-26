-- ============================================================================
-- 1kDaily · Phase 4 · 01 — Double-entry ledger
--
-- Invariants enforced in the database, not in application code:
--   * every transaction balances (deferred constraint trigger at commit)
--   * entries and transactions are append-only (triggers raise on mutation)
--   * account balances are derived, cached and rebuildable
--   * money is integer kobo (numeric(20,0)), never floating point
--
-- Reversals are new transactions linked by `reverses_transaction_id`; history is
-- never edited.
-- ============================================================================

create table if not exists public.financial_accounts (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique check (char_length(code) between 3 and 64),
  name         text not null,
  account_type text not null check (account_type in ('asset', 'liability', 'equity', 'income', 'expense')),
  normal_side  text not null check (normal_side in ('debit', 'credit')),
  owner_kind   text not null default 'platform' check (owner_kind in ('platform', 'user', 'partner')),
  owner_id     uuid,
  currency     char(3) not null default 'NGN',
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  constraint user_account_has_owner check ((owner_kind = 'user') = (owner_id is not null))
);

comment on table public.financial_accounts is
  'Chart of accounts. Per-user savings liabilities are created on first contribution with code 2200-<uuid>.';

create index if not exists financial_accounts_owner_idx
  on public.financial_accounts (owner_kind, owner_id);

create table if not exists public.ledger_transactions (
  id                     uuid primary key default gen_random_uuid(),
  reference              text not null unique,
  kind                   text not null check (kind in
                           ('contribution', 'withdrawal', 'disbursement', 'repayment',
                            'interest', 'fee', 'refund', 'reversal', 'adjustment', 'settlement')),
  description            text,
  reverses_transaction_id uuid references public.ledger_transactions(id),
  occurred_at            timestamptz not null default now(),
  metadata               jsonb,
  created_at             timestamptz not null default now()
);

create index if not exists ledger_transactions_kind_idx on public.ledger_transactions (kind, occurred_at desc);
create index if not exists ledger_transactions_created_idx on public.ledger_transactions (created_at desc);

create table if not exists public.ledger_entries (
  id             uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.ledger_transactions(id) on delete restrict,
  account_id     uuid not null references public.financial_accounts(id) on delete restrict,
  direction      text not null check (direction in ('debit', 'credit')),
  amount_kobo    numeric(20, 0) not null check (amount_kobo > 0),
  created_at     timestamptz not null default now()
);

create index if not exists ledger_entries_transaction_idx on public.ledger_entries (transaction_id);
create index if not exists ledger_entries_account_idx on public.ledger_entries (account_id, created_at desc);

create table if not exists public.account_balances (
  account_id   uuid primary key references public.financial_accounts(id) on delete restrict,
  balance_kobo numeric(20, 0) not null default 0,
  updated_at   timestamptz not null default now()
);

comment on table public.account_balances is
  'Rebuildable cache of ledger entries, signed relative to the account normal side. Rebuild function verifies it.';

-- ---------------------------------------------------------------------------
-- Append-only enforcement
-- ---------------------------------------------------------------------------

drop trigger if exists ledger_transactions_no_update on public.ledger_transactions;
create trigger ledger_transactions_no_update
  before update or delete on public.ledger_transactions
  for each row execute function app.forbid_mutation();

drop trigger if exists ledger_entries_no_update on public.ledger_entries;
create trigger ledger_entries_no_update
  before update or delete on public.ledger_entries
  for each row execute function app.forbid_mutation();

-- ---------------------------------------------------------------------------
-- Balance invariant: every transaction must balance at commit time
-- ---------------------------------------------------------------------------

create or replace function app.assert_transaction_balanced()
returns trigger
language plpgsql
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_debits numeric;
  v_credits numeric;
  v_entries int;
begin
  select
    coalesce(sum(case when direction = 'debit' then amount_kobo else 0 end), 0),
    coalesce(sum(case when direction = 'credit' then amount_kobo else 0 end), 0),
    count(*)
  into v_debits, v_credits, v_entries
  from public.ledger_entries
  where transaction_id = new.id;

  if v_entries < 2 then
    raise exception 'Ledger transaction % has fewer than two entries', new.id
      using errcode = '23514';
  end if;

  if v_debits <> v_credits then
    raise exception 'Ledger transaction % is unbalanced: debits % <> credits %',
      new.id, v_debits, v_credits
      using errcode = '23514';
  end if;

  return null;
end;
$$;

drop trigger if exists ledger_transaction_balanced on public.ledger_transactions;
create constraint trigger ledger_transaction_balanced
  after insert on public.ledger_transactions
  deferrable initially deferred
  for each row execute function app.assert_transaction_balanced();

-- ---------------------------------------------------------------------------
-- Balance maintenance
-- ---------------------------------------------------------------------------

create or replace function app.apply_entry_to_balance()
returns trigger
language plpgsql
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_normal_side text;
  v_delta numeric;
begin
  select normal_side into v_normal_side
    from public.financial_accounts
   where id = new.account_id;

  v_delta := case when new.direction = v_normal_side then new.amount_kobo else -new.amount_kobo end;

  insert into public.account_balances (account_id, balance_kobo, updated_at)
  values (new.account_id, v_delta, now())
  on conflict (account_id) do update
    set balance_kobo = public.account_balances.balance_kobo + v_delta,
        updated_at = now();

  return null;
end;
$$;

drop trigger if exists ledger_entries_apply_balance on public.ledger_entries;
create trigger ledger_entries_apply_balance
  after insert on public.ledger_entries
  for each row execute function app.apply_entry_to_balance();

-- ---------------------------------------------------------------------------
-- Chart of accounts
-- ---------------------------------------------------------------------------

insert into public.financial_accounts (code, name, account_type, normal_side, owner_kind) values
  ('1000', 'Cash at payment provider', 'asset',     'debit',  'platform'),
  ('1010', 'Cash at bank',             'asset',     'debit',  'platform'),
  ('1200', 'Loan receivable',          'asset',     'debit',  'platform'),
  ('2000', 'Partner payable',          'liability', 'credit', 'platform'),
  ('2100', 'Platform equity',          'equity',    'credit', 'platform'),
  ('3000', 'Partner capital',          'liability', 'credit', 'platform'),
  ('4000', 'Interest income',          'income',    'credit', 'platform'),
  ('4010', 'Fee income',               'income',    'credit', 'platform'),
  ('5000', 'Provider fees',            'expense',   'debit',  'platform'),
  ('5900', 'Losses',                   'expense',   'debit',  'platform')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Per-user savings liability account
-- ---------------------------------------------------------------------------

create or replace function app.ensure_user_savings_account(p_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_code text := '2200-' || p_user::text;
  v_id uuid;
begin
  insert into public.financial_accounts (code, name, account_type, normal_side, owner_kind, owner_id)
  values (v_code, 'User savings liability', 'liability', 'credit', 'user', p_user)
  on conflict (code) do nothing;

  select id into v_id from public.financial_accounts where code = v_code;
  return v_id;
end;
$$;

revoke all on function app.ensure_user_savings_account(uuid) from public;
grant execute on function app.ensure_user_savings_account(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Posting primitive (service role and SECURITY DEFINER functions only)
-- ---------------------------------------------------------------------------

create or replace function app.post_transaction(
  p_reference text,
  p_kind text,
  p_description text,
  p_entries jsonb,
  p_metadata jsonb default null,
  p_reverses uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_id uuid;
  v_entry jsonb;
  v_account uuid;
  v_direction text;
  v_amount numeric;
begin
  if p_entries is null or jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) < 2 then
    raise exception 'A ledger transaction needs at least two entries' using errcode = '22023';
  end if;

  insert into public.ledger_transactions (reference, kind, description, metadata, reverses_transaction_id)
  values (p_reference, p_kind, p_description, p_metadata, p_reverses)
  returning id into v_id;

  for v_entry in select * from jsonb_array_elements(p_entries)
  loop
    v_direction := v_entry ->> 'direction';
    v_amount := (v_entry ->> 'amount_kobo')::numeric;

    if v_direction not in ('debit', 'credit') then
      raise exception 'Invalid entry direction %', v_direction using errcode = '22023';
    end if;
    if v_amount is null or v_amount <= 0 then
      raise exception 'Entry amount must be positive' using errcode = '22023';
    end if;

    select id into v_account
      from public.financial_accounts
     where code = (v_entry ->> 'account_code');

    if v_account is null then
      raise exception 'Unknown account code %', v_entry ->> 'account_code' using errcode = '22023';
    end if;

    insert into public.ledger_entries (transaction_id, account_id, direction, amount_kobo)
    values (v_id, v_account, v_direction, v_amount);
  end loop;

  return v_id;
end;
$$;

revoke all on function app.post_transaction(text, text, text, jsonb, jsonb, uuid) from public;
grant execute on function app.post_transaction(text, text, text, jsonb, jsonb, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Balance rebuild and verification (audit / reconciliation)
-- ---------------------------------------------------------------------------

create or replace function app.rebuild_account_balance(p_account uuid)
returns numeric
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_normal_side text;
  v_balance numeric;
begin
  select normal_side into v_normal_side from public.financial_accounts where id = p_account;
  if v_normal_side is null then
    raise exception 'Unknown account %', p_account using errcode = 'P0002';
  end if;

  select coalesce(sum(case when e.direction = v_normal_side then e.amount_kobo else -e.amount_kobo end), 0)
    into v_balance
    from public.ledger_entries e
   where e.account_id = p_account;

  insert into public.account_balances (account_id, balance_kobo, updated_at)
  values (p_account, v_balance, now())
  on conflict (account_id) do update
    set balance_kobo = excluded.balance_kobo, updated_at = excluded.updated_at;

  return v_balance;
end;
$$;

revoke all on function app.rebuild_account_balance(uuid) from public;
grant execute on function app.rebuild_account_balance(uuid) to service_role;

create or replace function app.account_balance_drift()
returns table (account_code text, cached_kobo numeric, rebuilt_kobo numeric)
language sql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  select a.code,
         coalesce(b.balance_kobo, 0),
         coalesce(sum(case when e.direction = a.normal_side then e.amount_kobo else -e.amount_kobo end), 0)
    from public.financial_accounts a
    left join public.account_balances b on b.account_id = a.id
    left join public.ledger_entries e on e.account_id = a.id
   group by a.code, a.normal_side, b.balance_kobo
  having coalesce(b.balance_kobo, 0)
         <> coalesce(sum(case when e.direction = a.normal_side then e.amount_kobo else -e.amount_kobo end), 0);
$$;

revoke all on function app.account_balance_drift() from public;
grant execute on function app.account_balance_drift() to service_role;

-- ---------------------------------------------------------------------------
-- Privileges and RLS: the ledger is not browsable by clients
-- ---------------------------------------------------------------------------

revoke all on public.financial_accounts    from anon, authenticated;
revoke all on public.ledger_transactions   from anon, authenticated;
revoke all on public.ledger_entries        from anon, authenticated;
revoke all on public.account_balances      from anon, authenticated;

grant select on public.financial_accounts to authenticated;
grant select on public.ledger_transactions to authenticated;
grant select on public.ledger_entries to authenticated;
grant select on public.account_balances to authenticated;

grant select, insert, update, delete on
  public.financial_accounts,
  public.ledger_transactions,
  public.ledger_entries,
  public.account_balances
to service_role;

alter table public.financial_accounts  enable row level security;
alter table public.ledger_transactions enable row level security;
alter table public.ledger_entries      enable row level security;
alter table public.account_balances    enable row level security;

-- A customer may see only their own savings liability account.
drop policy if exists financial_accounts_select_own on public.financial_accounts;
create policy financial_accounts_select_own
  on public.financial_accounts for select to authenticated
  using (owner_kind = 'user' and owner_id = auth.uid());

drop policy if exists financial_accounts_select_finance on public.financial_accounts;
create policy financial_accounts_select_finance
  on public.financial_accounts for select to authenticated
  using (app.has_permission('finance:read'));

drop policy if exists ledger_transactions_select_finance on public.ledger_transactions;
create policy ledger_transactions_select_finance
  on public.ledger_transactions for select to authenticated
  using (app.has_permission('finance:read'));

drop policy if exists ledger_entries_select_finance on public.ledger_entries;
create policy ledger_entries_select_finance
  on public.ledger_entries for select to authenticated
  using (app.has_permission('finance:read'));

drop policy if exists account_balances_select_finance on public.account_balances;
create policy account_balances_select_finance
  on public.account_balances for select to authenticated
  using (app.has_permission('finance:read'));
