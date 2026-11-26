-- ============================================================================
-- 1kDaily · Phase 2 · 02 — Identity and profile tables
--
-- The important table here is `identity_documents`. It deliberately has **no
-- column that can hold a BVN or NIN**. It stores:
--   * last4          → the only human-readable fragment ever retained
--   * digest         → HMAC-SHA256(pepper, kind:value), computed in the server
--                      before the value leaves memory, to detect one identity
--                      number being used across multiple accounts
--   * vendor ref     → the verification provider's identifier
--
-- The raw value is sent from the browser to the server action, forwarded to the
-- vendor, and never written to the database, logs or URLs.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table if not exists public.user_profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  first_name            text not null default '' check (char_length(first_name) <= 80),
  last_name             text not null default '' check (char_length(last_name) <= 80),
  phone                 text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  date_of_birth         date check (date_of_birth is null or date_of_birth >= '1900-01-01'),
  state                 text check (state is null or char_length(state) <= 60),
  address_line          text check (address_line is null or char_length(address_line) <= 200),
  onboarding_step       text not null default 'profile'
                          check (onboarding_step in ('profile', 'identity', 'financial', 'complete')),
  onboarding_completed_at timestamptz,
  status                text not null default 'active'
                          check (status in ('active', 'restricted', 'suspended', 'closed')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table public.user_profiles is
  'Customer-visible profile. Never holds identity numbers or vendor payloads.';

create index if not exists user_profiles_status_idx on public.user_profiles (status);

drop trigger if exists user_profiles_touch on public.user_profiles;
create trigger user_profiles_touch
  before update on public.user_profiles
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Verification status per requirement (no sensitive values)
-- ---------------------------------------------------------------------------

create table if not exists public.user_verifications (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  kind             text not null
                     check (kind in ('email', 'phone', 'bvn', 'nin', 'document', 'address')),
  status           text not null default 'unverified'
                     check (status in ('unverified', 'pending', 'verified', 'failed', 'expired')),
  vendor           text,
  vendor_reference text,
  failure_code     text,
  verified_at      timestamptz,
  expires_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, kind)
);

create index if not exists user_verifications_user_idx on public.user_verifications (user_id);
create index if not exists user_verifications_pending_idx
  on public.user_verifications (kind, status) where status = 'pending';

drop trigger if exists user_verifications_touch on public.user_verifications;
create trigger user_verifications_touch
  before update on public.user_verifications
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Identity documents — restricted, masked, non-reversible
-- ---------------------------------------------------------------------------

create table if not exists public.identity_documents (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete restrict,
  kind               text not null check (kind in ('bvn', 'nin')),
  status             text not null default 'pending'
                       check (status in ('pending', 'verified', 'failed', 'needs_review')),
  match_result       text check (match_result in ('exact', 'partial', 'no_match', 'unavailable')),
  last4              text not null check (last4 ~ '^[0-9]{4}$'),
  digest             text not null check (digest ~ '^[a-f0-9]{64}$'),
  digest_key_version smallint not null default 1 check (digest_key_version >= 1),
  vendor             text not null,
  vendor_reference   text,
  attempt_count      smallint not null default 1 check (attempt_count between 1 and 20),
  verified_at        timestamptz,
  reviewed_by        uuid references auth.users(id),
  reviewed_at        timestamptz,
  review_reason      text check (review_reason is null or char_length(review_reason) <= 500),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, kind)
);

comment on table public.identity_documents is
  'Masked identity verification record. Contains no BVN/NIN. Access only through SECURITY DEFINER functions; no client policies exist.';

comment on column public.identity_documents.digest is
  'HMAC-SHA256(server pepper, lower(kind) || '':'' || value). Used only for duplicate detection.';

create index if not exists identity_documents_user_idx on public.identity_documents (user_id);

-- One verified BVN (or NIN) may belong to exactly one account.
create unique index if not exists identity_documents_verified_digest_idx
  on public.identity_documents (kind, digest)
  where status = 'verified';

create index if not exists identity_documents_review_idx
  on public.identity_documents (created_at)
  where status in ('pending', 'needs_review');

drop trigger if exists identity_documents_touch on public.identity_documents;
create trigger identity_documents_touch
  before update on public.identity_documents
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Financial profile (declared, not verified)
-- ---------------------------------------------------------------------------

create table if not exists public.user_financial_profiles (
  user_id                  uuid primary key references auth.users(id) on delete cascade,
  employment_status        text not null
                             check (employment_status in
                               ('salaried', 'self_employed', 'business_owner', 'student',
                                'unemployed', 'retired', 'other')),
  income_source            text check (income_source is null or char_length(income_source) <= 120),
  business_type            text check (business_type is null or char_length(business_type) <= 120),
  monthly_income_kobo      numeric(20, 0) check (monthly_income_kobo >= 0),
  monthly_obligations_kobo numeric(20, 0) check (monthly_obligations_kobo >= 0),
  existing_debt_kobo       numeric(20, 0) check (existing_debt_kobo >= 0),
  declared_at              timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint obligations_within_income check (
    monthly_obligations_kobo is null
    or monthly_income_kobo is null
    or monthly_obligations_kobo <= monthly_income_kobo
  )
);

comment on table public.user_financial_profiles is
  'Self-declared affordability inputs. Verified income is a later, separate concept.';

drop trigger if exists user_financial_profiles_touch on public.user_financial_profiles;
create trigger user_financial_profiles_touch
  before update on public.user_financial_profiles
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Consent records (append-only evidence)
-- ---------------------------------------------------------------------------

create table if not exists public.consent_records (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  purpose          text not null check (purpose in
                     ('terms', 'privacy', 'identity_verification', 'credit_bureau', 'marketing')),
  document_version text not null check (char_length(document_version) between 1 and 40),
  granted          boolean not null,
  granted_at       timestamptz not null default now(),
  revoked_at       timestamptz,
  ip_hash          text check (ip_hash is null or char_length(ip_hash) <= 128),
  user_agent_hash  text check (user_agent_hash is null or char_length(user_agent_hash) <= 128),
  created_at       timestamptz not null default now()
);

create index if not exists consent_records_user_idx on public.consent_records (user_id, purpose, granted_at desc);

drop trigger if exists consent_records_no_update on public.consent_records;
create trigger consent_records_no_update
  before update or delete on public.consent_records
  for each row execute function app.forbid_mutation();

-- ---------------------------------------------------------------------------
-- Profile bootstrap on sign-up
-- ---------------------------------------------------------------------------

create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
begin
  insert into public.user_profiles (id, first_name, last_name, phone)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'first_name', ''), 80),
    left(coalesce(new.raw_user_meta_data ->> 'last_name', ''), 80),
    case
      when new.phone is not null and new.phone ~ '^\+[1-9][0-9]{7,14}$' then new.phone
      else null
    end
  )
  on conflict (id) do nothing;

  -- Record the legal consents captured at registration, if provided.
  if coalesce((new.raw_user_meta_data ->> 'accepted_terms')::boolean, false) then
    insert into public.consent_records (user_id, purpose, document_version, granted)
    values
      (new.id, 'terms',   coalesce(new.raw_user_meta_data ->> 'terms_version', 'v1'), true),
      (new.id, 'privacy', coalesce(new.raw_user_meta_data ->> 'terms_version', 'v1'), true);
  end if;

  return new;
end;
$$;

revoke all on function app.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();
