-- ============================================================================
-- Phase 2 security fixtures (idempotent, non-destructive).
--
-- Creates four real auth users (profile creation runs through the sign-up
-- trigger), assigns staff roles and seeds masked identity records.
--
-- Applied to the development project before tools/db/rls-tests.mjs runs.
--
-- Notes:
--   * auth.users is never deleted: consent_records and audit_logs are
--     append-only by design, so a cascade delete is intentionally impossible.
--   * No BVN or NIN appears here. Digests are synthetic 64-hex values.
-- ============================================================================

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated', 'authenticated', 'alice.tests@1kdaily.test',
    crypt('CorrectHorseBattery1!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Alice","last_name":"Adeyemi","accepted_terms":true,"terms_version":"2026-11"}',
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated', 'authenticated', 'bola.tests@1kdaily.test',
    crypt('CorrectHorseBattery1!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Bola","last_name":"Okafor","accepted_terms":true,"terms_version":"2026-11"}',
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-3333-3333-333333333333',
    'authenticated', 'authenticated', 'verifier.tests@1kdaily.test',
    crypt('CorrectHorseBattery1!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Vera","last_name":"Fields","accepted_terms":true,"terms_version":"2026-11"}',
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '44444444-4444-4444-4444-444444444444',
    'authenticated', 'authenticated', 'auditor.tests@1kdaily.test',
    crypt('CorrectHorseBattery1!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Ade","last_name":"Audit","accepted_terms":true,"terms_version":"2026-11"}',
    now(), now(), '', '', '', ''
  )
on conflict (id) do nothing;

-- Deterministic profile state for the run.
update public.user_profiles
   set first_name = 'Alice',
       last_name = 'Adeyemi',
       phone = null,
       date_of_birth = null,
       state = null,
       address_line = null,
       onboarding_step = 'profile',
       onboarding_completed_at = null,
       status = 'active'
 where id = '11111111-1111-1111-1111-111111111111';

update public.user_profiles
   set first_name = 'Bola',
       last_name = 'Okafor',
       onboarding_step = 'complete',
       onboarding_completed_at = now(),
       status = 'active'
 where id = '22222222-2222-2222-2222-222222222222';

insert into public.admin_user_roles (user_id, role_id)
select '33333333-3333-3333-3333-333333333333', id
  from public.admin_roles where key = 'verification_officer'
on conflict do nothing;

insert into public.admin_user_roles (user_id, role_id)
select '44444444-4444-4444-4444-444444444444', id
  from public.admin_roles where key = 'auditor'
on conflict do nothing;

-- Identity records are replaced each run so statuses start from a known state.
delete from public.identity_documents
 where user_id in (
   '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222',
   '33333333-3333-3333-3333-333333333333',
   '44444444-4444-4444-4444-444444444444'
 );

insert into public.identity_documents (
  user_id, kind, status, match_result, last4, digest, vendor, vendor_reference
)
values
  (
    '11111111-1111-1111-1111-111111111111', 'bvn', 'pending', 'exact',
    '1234', repeat('a', 64), 'mock', 'mock_ref_alice'
  ),
  (
    '22222222-2222-2222-2222-222222222222', 'nin', 'verified', 'exact',
    '9876', repeat('b', 64), 'mock', 'mock_ref_bola'
  )
on conflict (user_id, kind) do nothing;

insert into public.user_verifications (user_id, kind, status, vendor, vendor_reference, verified_at)
values
  ('22222222-2222-2222-2222-222222222222', 'nin', 'verified', 'mock', 'mock_ref_bola', now())
on conflict (user_id, kind) do update
  set status = excluded.status,
      vendor = excluded.vendor,
      vendor_reference = excluded.vendor_reference,
      verified_at = excluded.verified_at;

insert into public.user_financial_profiles (
  user_id, employment_status, monthly_income_kobo, monthly_obligations_kobo, existing_debt_kobo
)
values
  ('11111111-1111-1111-1111-111111111111', 'salaried', 45000000, 12000000, 0),
  ('22222222-2222-2222-2222-222222222222', 'business_owner', 90000000, 20000000, 5000000)
on conflict (user_id) do update
  set employment_status = excluded.employment_status,
      monthly_income_kobo = excluded.monthly_income_kobo,
      monthly_obligations_kobo = excluded.monthly_obligations_kobo,
      existing_debt_kobo = excluded.existing_debt_kobo;

insert into public.consent_records (user_id, purpose, document_version, granted)
select '11111111-1111-1111-1111-111111111111', 'identity_verification', '2026-11', true
where not exists (
  select 1 from public.consent_records
   where user_id = '11111111-1111-1111-1111-111111111111'
     and purpose = 'identity_verification'
);

-- One committed audit row so the auditor read path has data to return.
-- audit_logs is append-only, so this is guarded rather than replaced.
insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, reason)
select null, 'system', 'fixture.security_probe', 'system', 'phase2-fixtures',
       'Fixture row used by the audit read test'
where not exists (
  select 1 from public.audit_logs where action = 'fixture.security_probe'
);
