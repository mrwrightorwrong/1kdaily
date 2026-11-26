-- ============================================================================
-- 1kDaily · Phase 2 · 04 — Client-facing functions
--
-- Every write performed by a customer goes through a SECURITY DEFINER function
-- that resolves the caller from auth.uid(), validates input, and (where
-- relevant) writes an audit entry. No client role has table write privileges.
--
-- Masked identity access is deliberately narrow: last4 only, never the value.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Profile
-- ---------------------------------------------------------------------------

create or replace function public.my_profile()
returns table (
  id uuid,
  email text,
  email_verified boolean,
  first_name text,
  last_name text,
  phone text,
  date_of_birth date,
  state text,
  address_line text,
  onboarding_step text,
  onboarding_completed_at timestamptz,
  status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  select
    p.id,
    u.email::text,
    (u.email_confirmed_at is not null) as email_verified,
    p.first_name,
    p.last_name,
    p.phone,
    p.date_of_birth,
    p.state,
    p.address_line,
    p.onboarding_step,
    p.onboarding_completed_at,
    p.status,
    p.created_at
  from public.user_profiles p
  join auth.users u on u.id = p.id
  where p.id = auth.uid();
$$;

revoke all on function public.my_profile() from public;
grant execute on function public.my_profile() to authenticated;

create or replace function public.update_my_profile(
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_date_of_birth date,
  p_state text,
  p_address_line text
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_first text := btrim(coalesce(p_first_name, ''));
  v_last text := btrim(coalesce(p_last_name, ''));
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_state text := nullif(btrim(coalesce(p_state, '')), '');
  v_address text := nullif(btrim(coalesce(p_address_line, '')), '');
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if char_length(v_first) not between 1 and 80 or char_length(v_last) not between 1 and 80 then
    raise exception 'First and last name are required (maximum 80 characters).'
      using errcode = '22023';
  end if;

  if v_phone is not null and v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'Phone number must be in international format, for example +2348012345678.'
      using errcode = '22023';
  end if;

  if p_date_of_birth is not null and p_date_of_birth > (current_date - interval '18 years') then
    raise exception 'You must be at least 18 years old to use 1kDaily.'
      using errcode = '22023';
  end if;

  if v_state is not null and char_length(v_state) > 60 then
    raise exception 'State is too long.' using errcode = '22023';
  end if;

  if v_address is not null and char_length(v_address) > 200 then
    raise exception 'Address is too long.' using errcode = '22023';
  end if;

  update public.user_profiles
     set first_name = v_first,
         last_name = v_last,
         phone = v_phone,
         date_of_birth = p_date_of_birth,
         state = v_state,
         address_line = v_address
   where id = v_uid;

  if not found then
    raise exception 'Profile not found.' using errcode = 'P0002';
  end if;

  perform app.log_audit(
    v_uid, null, 'profile.update', 'user_profile', v_uid::text,
    null,
    jsonb_build_object('first_name', v_first, 'last_name', v_last, 'phone_set', v_phone is not null),
    null, null, null
  );
end;
$$;

revoke all on function public.update_my_profile(text, text, text, date, text, text) from public;
grant execute on function public.update_my_profile(text, text, text, date, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Financial profile
-- ---------------------------------------------------------------------------

create or replace function public.save_financial_profile(
  p_employment_status text,
  p_income_source text,
  p_business_type text,
  p_monthly_income_kobo numeric,
  p_monthly_obligations_kobo numeric,
  p_existing_debt_kobo numeric
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_income numeric := coalesce(p_monthly_income_kobo, 0);
  v_obligations numeric := coalesce(p_monthly_obligations_kobo, 0);
  v_debt numeric := coalesce(p_existing_debt_kobo, 0);
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_employment_status not in
    ('salaried', 'self_employed', 'business_owner', 'student', 'unemployed', 'retired', 'other')
  then
    raise exception 'Unknown employment status.' using errcode = '22023';
  end if;

  if v_income < 0 or v_obligations < 0 or v_debt < 0 then
    raise exception 'Amounts cannot be negative.' using errcode = '22023';
  end if;

  if v_income >= 1000000000000000 or v_obligations >= 1000000000000000 or v_debt >= 1000000000000000 then
    raise exception 'Amount is out of range.' using errcode = '22023';
  end if;

  if v_obligations > v_income and v_income > 0 then
    raise exception 'Monthly obligations cannot exceed monthly income.' using errcode = '22023';
  end if;

  insert into public.user_financial_profiles (
    user_id, employment_status, income_source, business_type,
    monthly_income_kobo, monthly_obligations_kobo, existing_debt_kobo
  )
  values (
    v_uid, p_employment_status,
    nullif(btrim(coalesce(p_income_source, '')), ''),
    nullif(btrim(coalesce(p_business_type, '')), ''),
    v_income, v_obligations, v_debt
  )
  on conflict (user_id) do update
    set employment_status = excluded.employment_status,
        income_source = excluded.income_source,
        business_type = excluded.business_type,
        monthly_income_kobo = excluded.monthly_income_kobo,
        monthly_obligations_kobo = excluded.monthly_obligations_kobo,
        existing_debt_kobo = excluded.existing_debt_kobo;

  perform app.log_audit(
    v_uid, null, 'financial_profile.save', 'user_financial_profile', v_uid::text,
    null, jsonb_build_object('employment_status', p_employment_status), null, null, null
  );
end;
$$;

revoke all on function public.save_financial_profile(text, text, text, numeric, numeric, numeric) from public;
grant execute on function public.save_financial_profile(text, text, text, numeric, numeric, numeric)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Onboarding progression (forward-only)
-- ---------------------------------------------------------------------------

create or replace function public.advance_onboarding(p_step text)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_current text;
  v_order text[] := array['profile', 'identity', 'financial', 'complete'];
  v_index_new int;
  v_index_old int;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  v_index_new := array_position(v_order, p_step);
  if v_index_new is null then
    raise exception 'Unknown onboarding step.' using errcode = '22023';
  end if;

  select onboarding_step into v_current from public.user_profiles where id = v_uid for update;
  if v_current is null then
    raise exception 'Profile not found.' using errcode = 'P0002';
  end if;

  v_index_old := array_position(v_order, v_current);
  if v_index_new = v_index_old then
    return;
  end if;

  if v_index_new < v_index_old then
    raise exception 'Onboarding cannot move backwards.' using errcode = '22023';
  end if;

  if v_index_new > v_index_old + 1 then
    raise exception 'Complete onboarding steps in order.' using errcode = '22023';
  end if;

  update public.user_profiles
     set onboarding_step = p_step,
         onboarding_completed_at = case when p_step = 'complete' then now() else onboarding_completed_at end
   where id = v_uid;

  perform app.log_audit(
    v_uid, null, 'onboarding.advance', 'user_profile', v_uid::text,
    jsonb_build_object('step', v_current), jsonb_build_object('step', p_step), null, null, null
  );
end;
$$;

revoke all on function public.advance_onboarding(text) from public;
grant execute on function public.advance_onboarding(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Consent
-- ---------------------------------------------------------------------------

create or replace function public.record_consent(
  p_purpose text,
  p_document_version text,
  p_granted boolean
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_purpose not in ('terms', 'privacy', 'identity_verification', 'credit_bureau', 'marketing') then
    raise exception 'Unknown consent purpose.' using errcode = '22023';
  end if;

  insert into public.consent_records (user_id, purpose, document_version, granted)
  values (v_uid, p_purpose, left(coalesce(p_document_version, 'v1'), 40), coalesce(p_granted, false))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_consent(text, text, boolean) from public;
grant execute on function public.record_consent(text, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Verification status (self)
-- ---------------------------------------------------------------------------

create or replace function public.my_verification_status()
returns table (kind text, status text, verified_at timestamptz, vendor text)
language sql
stable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  select
    'email'::text,
    case when u.email_confirmed_at is not null then 'verified' else 'unverified' end,
    u.email_confirmed_at,
    null::text
  from auth.users u
  where u.id = auth.uid()

  union all

  select v.kind, v.status, v.verified_at, v.vendor
  from public.user_verifications v
  where v.user_id = auth.uid()
    and v.kind <> 'email';
$$;

revoke all on function public.my_verification_status() from public;
grant execute on function public.my_verification_status() to authenticated;

create or replace function public.my_identity_summary()
returns table (
  kind text,
  status text,
  last4 text,
  match_result text,
  submitted_at timestamptz,
  verified_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  select d.kind, d.status, d.last4, d.match_result, d.created_at, d.verified_at
  from public.identity_documents d
  where d.user_id = auth.uid();
$$;

revoke all on function public.my_identity_summary() from public;
grant execute on function public.my_identity_summary() to authenticated;

create or replace function public.my_permissions()
returns setof text
language sql
stable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  select p.key
  from public.admin_user_roles ur
  join public.admin_role_permissions rp on rp.role_id = ur.role_id
  join public.admin_permissions p on p.id = rp.permission_id
  where ur.user_id = auth.uid();
$$;

revoke all on function public.my_permissions() from public;
grant execute on function public.my_permissions() to authenticated;

-- ---------------------------------------------------------------------------
-- Staff: masked identity review
-- ---------------------------------------------------------------------------

create or replace function public.admin_identity_queue(p_limit int default 50)
returns table (
  document_id uuid,
  user_id uuid,
  full_name text,
  kind text,
  status text,
  last4 text,
  match_result text,
  submitted_at timestamptz,
  attempt_count smallint
)
language plpgsql
stable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
begin
  if not app.has_permission('kyc:read') then
    raise exception 'Permission denied.' using errcode = '42501';
  end if;

  return query
    select
      d.id,
      d.user_id,
      btrim(concat_ws(' ', p.first_name, p.last_name)),
      d.kind,
      d.status,
      d.last4,
      d.match_result,
      d.created_at,
      d.attempt_count
    from public.identity_documents d
    join public.user_profiles p on p.id = d.user_id
    where d.status in ('pending', 'needs_review')
    order by d.created_at asc
    limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;

revoke all on function public.admin_identity_queue(int) from public;
grant execute on function public.admin_identity_queue(int) to authenticated;

create or replace function public.admin_identity_detail(p_document_id uuid)
returns table (
  document_id uuid,
  user_id uuid,
  full_name text,
  kind text,
  status text,
  last4 text,
  match_result text,
  vendor text,
  submitted_at timestamptz,
  verified_at timestamptz,
  attempt_count smallint,
  review_reason text
)
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
begin
  if not app.has_permission('kyc:read') then
    raise exception 'Permission denied.' using errcode = '42501';
  end if;

  perform app.log_audit(
    auth.uid(), null, 'identity.view_masked', 'identity_document', p_document_id::text,
    null, null, 'Staff viewed masked identity record', null, null
  );

  return query
    select
      d.id, d.user_id,
      btrim(concat_ws(' ', p.first_name, p.last_name)),
      d.kind, d.status, d.last4, d.match_result, d.vendor,
      d.created_at, d.verified_at, d.attempt_count, d.review_reason
    from public.identity_documents d
    join public.user_profiles p on p.id = d.user_id
    where d.id = p_document_id;
end;
$$;

revoke all on function public.admin_identity_detail(uuid) from public;
grant execute on function public.admin_identity_detail(uuid) to authenticated;

create or replace function public.admin_decide_identity(
  p_document_id uuid,
  p_decision text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_doc public.identity_documents;
  v_new_status text;
  v_new_verification text;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if not app.has_permission('kyc:review') then
    raise exception 'Permission denied.' using errcode = '42501';
  end if;

  if p_decision not in ('verify', 'reject', 'request_review') then
    raise exception 'Unknown decision.' using errcode = '22023';
  end if;

  if char_length(v_reason) < 10 then
    raise exception 'A reason of at least 10 characters is required for identity decisions.'
      using errcode = '22023';
  end if;

  select * into v_doc from public.identity_documents where id = p_document_id for update;
  if not found then
    raise exception 'Identity document not found.' using errcode = 'P0002';
  end if;

  v_new_status := case p_decision
    when 'verify' then 'verified'
    when 'reject' then 'failed'
    else 'needs_review'
  end;

  v_new_verification := case p_decision
    when 'verify' then 'verified'
    when 'reject' then 'failed'
    else 'pending'
  end;

  update public.identity_documents
     set status = v_new_status,
         reviewed_by = v_uid,
         reviewed_at = now(),
         review_reason = left(v_reason, 500),
         verified_at = case when p_decision = 'verify' then now() else verified_at end,
         match_result = case
           when p_decision = 'verify' then coalesce(match_result, 'exact')
           else match_result
         end
   where id = p_document_id;

  insert into public.user_verifications (
    user_id, kind, status, vendor, vendor_reference, verified_at, expires_at
  )
  values (
    v_doc.user_id, v_doc.kind, v_new_verification, v_doc.vendor, v_doc.vendor_reference,
    case when p_decision = 'verify' then now() else null end,
    null
  )
  on conflict (user_id, kind) do update
    set status = excluded.status,
        vendor = excluded.vendor,
        vendor_reference = excluded.vendor_reference,
        verified_at = excluded.verified_at,
        failure_code = case when excluded.status = 'failed' then 'review_rejected' else null end;

  perform app.log_audit(
    v_uid, null,
    'identity.' || p_decision,
    'identity_document', p_document_id::text,
    jsonb_build_object('status', v_doc.status),
    jsonb_build_object('status', v_new_status, 'kind', v_doc.kind, 'last4', v_doc.last4),
    v_reason, null, null
  );
end;
$$;

revoke all on function public.admin_decide_identity(uuid, text, text) from public;
grant execute on function public.admin_decide_identity(uuid, text, text) to authenticated;
