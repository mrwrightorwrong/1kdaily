-- ============================================================================
-- 1kDaily · Phase 3 · 01 — Savings products, plans and plan days
--
-- The keystone is `savings_plan_days`: one row per expected contribution day,
-- materialised at activation. Streaks, consistency, missed days, grace usage
-- and the calendar are queries over this table rather than date arithmetic
-- against contribution timestamps.
--
-- Contributions themselves arrive in Phase 4. Until then days stay `scheduled`
-- and become `missed`/`grace` as their business date passes — a truthful state,
-- not a placeholder.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Product catalogue (administrator-managed; seeded here, edited in Phase 10)
-- ---------------------------------------------------------------------------

create table if not exists public.savings_products (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique check (code ~ '^[a-z][a-z0-9_]{2,30}$'),
  name              text not null,
  description       text,
  daily_amount_kobo numeric(20, 0) check (daily_amount_kobo is null or daily_amount_kobo > 0),
  min_daily_kobo    numeric(20, 0) not null check (min_daily_kobo > 0),
  max_daily_kobo    numeric(20, 0) not null check (max_daily_kobo >= min_daily_kobo),
  durations         integer[] not null check (array_length(durations, 1) > 0),
  grace_days        smallint not null default 0 check (grace_days between 0 and 30),
  withdrawal_policy text not null default 'completion_only'
                      check (withdrawal_policy in ('completion_only', 'early_allowed')),
  withdrawal_terms  text not null,
  is_custom         boolean not null default false,
  is_active         boolean not null default true,
  display_order     smallint not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint custom_has_no_fixed_amount check (
    (is_custom and daily_amount_kobo is null) or (not is_custom and daily_amount_kobo is not null)
  )
);

drop trigger if exists savings_products_touch on public.savings_products;
create trigger savings_products_touch
  before update on public.savings_products
  for each row execute function app.touch_updated_at();

insert into public.savings_products (
  code, name, description, daily_amount_kobo, min_daily_kobo, max_daily_kobo,
  durations, grace_days, withdrawal_policy, withdrawal_terms, is_custom, display_order
)
values
  (
    'starter', 'Starter', 'A gentle first month. Build the habit before increasing the amount.',
    100000, 100000, 100000, array[30, 60, 90], 2, 'completion_only',
    'Withdrawals are available when the plan completes. Early withdrawal is not permitted on this plan.',
    false, 1
  ),
  (
    'growth', 'Growth', 'A full quarter of consistency — the shortest useful track record.',
    200000, 200000, 200000, array[30, 60, 90, 120, 180], 3, 'completion_only',
    'Withdrawals are available when the plan completes. Early withdrawal is not permitted on this plan.',
    false, 2
  ),
  (
    'builder', 'Builder', 'Half a year of discipline, with a larger verifiable savings base.',
    500000, 500000, 500000, array[90, 120, 180, 365], 5, 'completion_only',
    'Withdrawals are available when the plan completes. Early withdrawal is not permitted on this plan.',
    false, 3
  ),
  (
    'power', 'Power', 'A year-long commitment for users with strong monthly cash flow.',
    1000000, 1000000, 1000000, array[180, 365], 7, 'completion_only',
    'Withdrawals are available when the plan completes. Early withdrawal is not permitted on this plan.',
    false, 4
  ),
  (
    'custom', 'Custom', 'Choose your own daily amount within the limits and pick a duration.',
    null, 50000, 5000000, array[30, 60, 90, 120, 180, 365], 3, 'completion_only',
    'Withdrawals are available when the plan completes. Early withdrawal is not permitted on this plan.',
    true, 5
  )
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Plans
-- ---------------------------------------------------------------------------

create table if not exists public.savings_plans (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  product_id        uuid not null references public.savings_products(id) on delete restrict,
  name              text not null check (char_length(name) between 1 and 80),
  daily_amount_kobo numeric(20, 0) not null check (daily_amount_kobo > 0),
  duration_days     integer not null check (duration_days between 1 and 730),
  start_date        date not null,
  end_date          date not null,
  goal              text check (goal is null or char_length(goal) <= 160),
  status            text not null default 'active'
                      check (status in ('draft', 'pending_activation', 'active', 'paused',
                                        'completed', 'cancelled', 'suspended')),
  grace_days_total  smallint not null default 0 check (grace_days_total between 0 and 30),
  grace_days_used   smallint not null default 0 check (grace_days_used between 0 and 30),
  withdrawal_policy text not null,
  withdrawal_terms  text not null,
  terms_version     text not null default '2026-11',
  activated_at      timestamptz,
  paused_at         timestamptz,
  pause_days_used   integer not null default 0 check (pause_days_used >= 0),
  completed_at      timestamptz,
  cancelled_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint end_after_start check (end_date >= start_date),
  constraint grace_used_within_total check (grace_days_used <= grace_days_total)
);

comment on table public.savings_plans is
  'A daily savings commitment. Rules (grace, withdrawal terms) are snapshotted at creation so later catalogue edits cannot rewrite an existing agreement.';

create index if not exists savings_plans_user_idx on public.savings_plans (user_id, status);
create index if not exists savings_plans_active_idx
  on public.savings_plans (user_id) where status in ('active', 'paused', 'pending_activation');

drop trigger if exists savings_plans_touch on public.savings_plans;
create trigger savings_plans_touch
  before update on public.savings_plans
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Plan days (one row per expected contribution day)
-- ---------------------------------------------------------------------------

create table if not exists public.savings_plan_days (
  id              uuid primary key default gen_random_uuid(),
  plan_id         uuid not null references public.savings_plans(id) on delete cascade,
  business_date   date not null,
  expected_kobo   numeric(20, 0) not null check (expected_kobo >= 0),
  status          text not null default 'scheduled'
                    check (status in ('scheduled', 'paid', 'partially_paid', 'missed',
                                      'grace', 'paused', 'skipped')),
  paid_kobo       numeric(20, 0) not null default 0 check (paid_kobo >= 0),
  contribution_id uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Deferrable so a pause can shift a whole future schedule in one statement
  -- without transient key collisions.
  constraint savings_plan_days_unique_day unique (plan_id, business_date)
    deferrable initially immediate
);

comment on table public.savings_plan_days is
  'Materialised schedule. Phase 4 links contribution_id to the ledger; no contribution is ever inferred from a date.';

create index if not exists savings_plan_days_plan_idx
  on public.savings_plan_days (plan_id, business_date);
create index if not exists savings_plan_days_status_idx
  on public.savings_plan_days (status, business_date);
create index if not exists savings_plan_days_contribution_idx
  on public.savings_plan_days (contribution_id) where contribution_id is not null;

drop trigger if exists savings_plan_days_touch on public.savings_plan_days;
create trigger savings_plan_days_touch
  before update on public.savings_plan_days
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Plan event history (append-only)
-- ---------------------------------------------------------------------------

create table if not exists public.savings_plan_events (
  id         bigint generated always as identity primary key,
  plan_id    uuid not null references public.savings_plans(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in
               ('created', 'activated', 'paused', 'resumed', 'cancelled', 'completed',
                'day_missed', 'grace_applied', 'schedule_extended')),
  metadata   jsonb,
  created_at timestamptz not null default now()
);

create index if not exists savings_plan_events_plan_idx
  on public.savings_plan_events (plan_id, created_at desc);

drop trigger if exists savings_plan_events_no_update on public.savings_plan_events;
create trigger savings_plan_events_no_update
  before update or delete on public.savings_plan_events
  for each row execute function app.forbid_mutation();

-- ---------------------------------------------------------------------------
-- Reminder preferences (delivery arrives with the notification engine)
-- ---------------------------------------------------------------------------

create table if not exists public.savings_reminder_preferences (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  enabled      boolean not null default true,
  reminder_time time not null default '08:00',
  channels     text[] not null default array['in_app']
                 check (channels <@ array['in_app', 'email', 'sms', 'whatsapp']),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists savings_reminder_preferences_touch on public.savings_reminder_preferences;
create trigger savings_reminder_preferences_touch
  before update on public.savings_reminder_preferences
  for each row execute function app.touch_updated_at();
