-- ============================================================================
-- Phase 3 security fixtures.
--
-- A deterministic active plan for the Alice fixture account, started five days
-- ago so that schedule maintenance (grace then missed) can be asserted.
--
-- Idempotent: the plan row is reset rather than deleted, because plan events
-- are append-only by design.
-- ============================================================================

delete from public.savings_plan_days
 where plan_id = 'aaaaaaaa-0000-4000-8000-000000000001';

insert into public.savings_plans (
  id, user_id, product_id, name, daily_amount_kobo, duration_days,
  start_date, end_date, goal, status, grace_days_total, grace_days_used,
  withdrawal_policy, withdrawal_terms, terms_version, activated_at, paused_at
)
select
  'aaaaaaaa-0000-4000-8000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  p.id,
  'Starter',
  100000,
  30,
  current_date - 5,
  current_date - 5 + 29,
  'Fixture plan',
  'active',
  p.grace_days,
  0,
  p.withdrawal_policy,
  p.withdrawal_terms,
  '2026-11',
  now() - interval '5 days',
  null
from public.savings_products p
where p.code = 'starter'
on conflict (id) do update
  set user_id = excluded.user_id,
      product_id = excluded.product_id,
      name = excluded.name,
      daily_amount_kobo = excluded.daily_amount_kobo,
      duration_days = excluded.duration_days,
      start_date = excluded.start_date,
      end_date = excluded.end_date,
      goal = excluded.goal,
      status = 'active',
      grace_days_total = excluded.grace_days_total,
      grace_days_used = 0,
      withdrawal_policy = excluded.withdrawal_policy,
      withdrawal_terms = excluded.withdrawal_terms,
      activated_at = excluded.activated_at,
      paused_at = null,
      cancelled_at = null,
      completed_at = null,
      pause_days_used = 0;

insert into public.savings_plan_days (plan_id, business_date, expected_kobo, status, paid_kobo)
select
  'aaaaaaaa-0000-4000-8000-000000000001',
  day::date,
  100000,
  'scheduled',
  0
from generate_series(
  (current_date - 5)::timestamp,
  (current_date - 5 + 29)::timestamp,
  interval '1 day'
) as day;
