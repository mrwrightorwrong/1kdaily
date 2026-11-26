-- ============================================================================
-- 1kDaily · Phase 3 · 02 — Savings plan functions, RLS and grants
--
-- All writes are function-only. A customer can read their own plans and days;
-- no client role can insert, update or delete a plan, a day or an event.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Create a plan and materialise its schedule
-- ---------------------------------------------------------------------------

create or replace function public.create_savings_plan(
  p_product_code text,
  p_daily_kobo numeric,
  p_duration_days integer,
  p_start_date date,
  p_goal text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_product public.savings_products;
  v_plan_id uuid;
  v_end_date date;
  v_active_count int;
  v_goal text := nullif(btrim(coalesce(p_goal, '')), '');
  v_amount numeric := coalesce(p_daily_kobo, 0);
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into v_product
    from public.savings_products
   where code = p_product_code and is_active
   for share;

  if not found then
    raise exception 'That savings plan is not available.' using errcode = '22023';
  end if;

  if p_duration_days is null then
    raise exception 'Choose a duration.' using errcode = '22023';
  end if;

  if not (p_duration_days = any (v_product.durations)) then
    raise exception 'That duration is not available for this plan.' using errcode = '22023';
  end if;

  if v_product.is_custom then
    if v_amount < v_product.min_daily_kobo then
      raise exception 'The daily amount is below the minimum of % kobo.', v_product.min_daily_kobo
        using errcode = '22023';
    end if;
    if v_amount > v_product.max_daily_kobo then
      raise exception 'The daily amount is above the maximum of % kobo.', v_product.max_daily_kobo
        using errcode = '22023';
    end if;
  elsif v_amount <> v_product.daily_amount_kobo then
    raise exception 'This plan requires a daily amount of % kobo.', v_product.daily_amount_kobo
      using errcode = '22023';
  end if;

  if p_start_date is null then
    raise exception 'Choose a start date.' using errcode = '22023';
  end if;

  if p_start_date < current_date then
    raise exception 'A plan cannot start in the past.' using errcode = '22023';
  end if;

  if p_start_date > current_date + 30 then
    raise exception 'A plan can start at most 30 days from today.' using errcode = '22023';
  end if;

  if v_goal is not null and char_length(v_goal) > 160 then
    raise exception 'The goal is too long.' using errcode = '22023';
  end if;

  select count(*) into v_active_count
    from public.savings_plans
   where user_id = v_uid
     and status in ('active', 'paused', 'pending_activation');

  if v_active_count >= 3 then
    raise exception 'You already have three active plans. Complete or cancel one first.'
      using errcode = '22023';
  end if;

  v_end_date := p_start_date + (p_duration_days - 1);

  insert into public.savings_plans (
    user_id, product_id, name, daily_amount_kobo, duration_days, start_date, end_date,
    goal, status, grace_days_total, withdrawal_policy, withdrawal_terms,
    terms_version, activated_at
  )
  values (
    v_uid, v_product.id, v_product.name, v_amount, p_duration_days, p_start_date, v_end_date,
    v_goal, 'active', v_product.grace_days, v_product.withdrawal_policy, v_product.withdrawal_terms,
    '2026-11', now()
  )
  returning id into v_plan_id;

  insert into public.savings_plan_days (plan_id, business_date, expected_kobo)
  select v_plan_id, day::date, v_amount
    from generate_series(
           p_start_date::timestamp,
           (v_end_date)::timestamp,
           interval '1 day'
         ) as day;

  insert into public.savings_plan_events (plan_id, user_id, event_type, metadata)
  values
    (v_plan_id, v_uid, 'created',
     jsonb_build_object('product', v_product.code, 'daily_kobo', v_amount, 'duration_days', p_duration_days)),
    (v_plan_id, v_uid, 'activated',
     jsonb_build_object('start_date', p_start_date, 'end_date', v_end_date, 'days', p_duration_days));

  perform app.log_audit(
    v_uid, null, 'savings_plan.create', 'savings_plan', v_plan_id::text,
    null,
    jsonb_build_object('product', v_product.code, 'daily_kobo', v_amount,
                       'duration_days', p_duration_days, 'start_date', p_start_date),
    null, null, null
  );

  return v_plan_id;
end;
$$;

revoke all on function public.create_savings_plan(text, numeric, integer, date, text) from public;
grant execute on function public.create_savings_plan(text, numeric, integer, date, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Refresh past-due days: scheduled → grace (while allowance remains) → missed
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
          where d.plan_id = p.id
            and d.status = 'scheduled'
            and d.business_date < current_date
       )
     for update
  loop
    v_available := greatest(r.grace_days_total - r.grace_days_used, 0);

    with past as (
      select d.id,
             row_number() over (order by d.business_date) as rn
        from public.savings_plan_days d
       where d.plan_id = r.id
         and d.status = 'scheduled'
         and d.business_date < current_date
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
end;
$$;

revoke all on function public.refresh_my_plan_days() from public;
grant execute on function public.refresh_my_plan_days() to authenticated;

-- ---------------------------------------------------------------------------
-- Pause / resume / cancel
-- ---------------------------------------------------------------------------

create or replace function public.pause_my_plan(p_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_plan public.savings_plans;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into v_plan
    from public.savings_plans
   where id = p_plan_id and user_id = v_uid
   for update;

  if not found then
    raise exception 'Plan not found.' using errcode = 'P0002';
  end if;

  if v_plan.status <> 'active' then
    raise exception 'Only an active plan can be paused.' using errcode = '22023';
  end if;

  update public.savings_plans
     set status = 'paused', paused_at = now()
   where id = p_plan_id;

  insert into public.savings_plan_events (plan_id, user_id, event_type)
  values (p_plan_id, v_uid, 'paused');

  perform app.log_audit(
    v_uid, null, 'savings_plan.pause', 'savings_plan', p_plan_id::text,
    jsonb_build_object('status', 'active'), jsonb_build_object('status', 'paused'), null, null, null
  );
end;
$$;

revoke all on function public.pause_my_plan(uuid) from public;
grant execute on function public.pause_my_plan(uuid) to authenticated;

create or replace function public.resume_my_plan(p_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_plan public.savings_plans;
  v_paused_days int;
  v_pause_start date;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into v_plan
    from public.savings_plans
   where id = p_plan_id and user_id = v_uid
   for update;

  if not found then
    raise exception 'Plan not found.' using errcode = 'P0002';
  end if;

  if v_plan.status <> 'paused' then
    raise exception 'Only a paused plan can be resumed.' using errcode = '22023';
  end if;

  v_pause_start := coalesce(v_plan.paused_at::date, current_date);
  v_paused_days := greatest(current_date - v_pause_start, 0);

  -- Days that fell inside the pause are not missed contributions.
  update public.savings_plan_days
     set status = 'paused', expected_kobo = 0
   where plan_id = p_plan_id
     and status = 'scheduled'
     and business_date < current_date;

  if v_paused_days > 0 then
    set constraints savings_plan_days_unique_day deferred;

    update public.savings_plan_days
       set business_date = business_date + v_paused_days
     where plan_id = p_plan_id
       and status = 'scheduled'
       and business_date >= current_date;

    update public.savings_plans
       set status = 'active',
           paused_at = null,
           end_date = end_date + v_paused_days,
           pause_days_used = pause_days_used + v_paused_days
     where id = p_plan_id;
  else
    update public.savings_plans
       set status = 'active', paused_at = null
     where id = p_plan_id;
  end if;

  insert into public.savings_plan_events (plan_id, user_id, event_type, metadata)
  values (p_plan_id, v_uid, 'resumed', jsonb_build_object('paused_days', v_paused_days));

  perform app.log_audit(
    v_uid, null, 'savings_plan.resume', 'savings_plan', p_plan_id::text,
    jsonb_build_object('status', 'paused'),
    jsonb_build_object('status', 'active', 'paused_days', v_paused_days),
    null, null, null
  );
end;
$$;

revoke all on function public.resume_my_plan(uuid) from public;
grant execute on function public.resume_my_plan(uuid) to authenticated;

create or replace function public.cancel_my_plan(p_plan_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_plan public.savings_plans;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into v_plan
    from public.savings_plans
   where id = p_plan_id and user_id = v_uid
   for update;

  if not found then
    raise exception 'Plan not found.' using errcode = 'P0002';
  end if;

  if v_plan.status not in ('active', 'paused', 'pending_activation') then
    raise exception 'This plan can no longer be cancelled.' using errcode = '22023';
  end if;

  update public.savings_plan_days
     set status = 'skipped'
   where plan_id = p_plan_id
     and status = 'scheduled';

  update public.savings_plans
     set status = 'cancelled', cancelled_at = now()
   where id = p_plan_id;

  insert into public.savings_plan_events (plan_id, user_id, event_type, metadata)
  values (p_plan_id, v_uid, 'cancelled',
          jsonb_build_object('reason', left(coalesce(p_reason, ''), 160)));

  perform app.log_audit(
    v_uid, null, 'savings_plan.cancel', 'savings_plan', p_plan_id::text,
    jsonb_build_object('status', v_plan.status), jsonb_build_object('status', 'cancelled'),
    left(coalesce(p_reason, ''), 160), null, null
  );
end;
$$;

revoke all on function public.cancel_my_plan(uuid, text) from public;
grant execute on function public.cancel_my_plan(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Reminder preferences
-- ---------------------------------------------------------------------------

create or replace function public.set_reminder_preferences(
  p_enabled boolean,
  p_time time,
  p_channels text[]
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_channels text[] := coalesce(p_channels, array['in_app']);
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if not (v_channels <@ array['in_app', 'email', 'sms', 'whatsapp']) then
    raise exception 'Unknown notification channel.' using errcode = '22023';
  end if;

  insert into public.savings_reminder_preferences (user_id, enabled, reminder_time, channels)
  values (v_uid, coalesce(p_enabled, true), coalesce(p_time, '08:00'), v_channels)
  on conflict (user_id) do update
    set enabled = excluded.enabled,
        reminder_time = excluded.reminder_time,
        channels = excluded.channels;
end;
$$;

revoke all on function public.set_reminder_preferences(boolean, time, text[]) from public;
grant execute on function public.set_reminder_preferences(boolean, time, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------

revoke all on public.savings_products            from anon, authenticated;
revoke all on public.savings_plans               from anon, authenticated;
revoke all on public.savings_plan_days           from anon, authenticated;
revoke all on public.savings_plan_events         from anon, authenticated;
revoke all on public.savings_reminder_preferences from anon, authenticated;

grant select on public.savings_products             to authenticated;
grant select on public.savings_plans                to authenticated;
grant select on public.savings_plan_days            to authenticated;
grant select on public.savings_plan_events          to authenticated;
grant select on public.savings_reminder_preferences to authenticated;

grant select, insert, update, delete on
  public.savings_products,
  public.savings_plans,
  public.savings_plan_days,
  public.savings_plan_events,
  public.savings_reminder_preferences
to service_role;

grant usage, select on all sequences in schema public to service_role;

alter table public.savings_products             enable row level security;
alter table public.savings_plans                enable row level security;
alter table public.savings_plan_days            enable row level security;
alter table public.savings_plan_events          enable row level security;
alter table public.savings_reminder_preferences enable row level security;

drop policy if exists savings_products_select on public.savings_products;
create policy savings_products_select
  on public.savings_products for select to authenticated
  using (is_active or app.has_permission('savings:read'));

drop policy if exists savings_plans_select_own on public.savings_plans;
create policy savings_plans_select_own
  on public.savings_plans for select to authenticated
  using (user_id = auth.uid());

drop policy if exists savings_plans_select_staff on public.savings_plans;
create policy savings_plans_select_staff
  on public.savings_plans for select to authenticated
  using (app.has_permission('savings:read'));

drop policy if exists savings_plan_days_select_own on public.savings_plan_days;
create policy savings_plan_days_select_own
  on public.savings_plan_days for select to authenticated
  using (
    exists (
      select 1 from public.savings_plans p
       where p.id = savings_plan_days.plan_id
         and p.user_id = auth.uid()
    )
  );

drop policy if exists savings_plan_days_select_staff on public.savings_plan_days;
create policy savings_plan_days_select_staff
  on public.savings_plan_days for select to authenticated
  using (app.has_permission('savings:read'));

drop policy if exists savings_plan_events_select_own on public.savings_plan_events;
create policy savings_plan_events_select_own
  on public.savings_plan_events for select to authenticated
  using (user_id = auth.uid());

drop policy if exists savings_plan_events_select_staff on public.savings_plan_events;
create policy savings_plan_events_select_staff
  on public.savings_plan_events for select to authenticated
  using (app.has_permission('savings:read'));

drop policy if exists savings_reminder_preferences_select_own on public.savings_reminder_preferences;
create policy savings_reminder_preferences_select_own
  on public.savings_reminder_preferences for select to authenticated
  using (user_id = auth.uid());
