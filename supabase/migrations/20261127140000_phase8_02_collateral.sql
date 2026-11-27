-- Phase 8 · 02 — collateral
create table if not exists public.collateral_records (
  id                     uuid primary key default gen_random_uuid(),
  application_id         uuid not null references public.loan_applications(id) on delete cascade,
  user_id                uuid not null references auth.users(id) on delete cascade,
  category               text not null
                           check (category in ('vehicle','equipment','property','business_asset','other')),
  description            text not null check (char_length(description) between 3 and 400),
  estimated_value_kobo   numeric(20,0) check (estimated_value_kobo is null or estimated_value_kobo > 0),
  valuation_method       text check (valuation_method is null or char_length(valuation_method) <= 120),
  valuation_date         date,
  ownership_evidence     text check (ownership_evidence is null or char_length(ownership_evidence) <= 300),
  security_agreement_ref text,
  status                 text not null default 'submitted'
                           check (status in ('submitted','pending_verification','verified','rejected',
                                             'under_review','released','disputed')),
  release_status         text not null default 'held' check (release_status in ('held','released')),
  reviewed_by            uuid references auth.users(id),
  reviewed_at            timestamptz,
  review_notes           text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists collateral_records_app_idx on public.collateral_records (application_id);
create index if not exists collateral_records_user_idx on public.collateral_records (user_id);

drop trigger if exists collateral_records_touch on public.collateral_records;
create trigger collateral_records_touch before update on public.collateral_records
  for each row execute function app.touch_updated_at();

create table if not exists public.collateral_documents (
  id            uuid primary key default gen_random_uuid(),
  collateral_id uuid not null references public.collateral_records(id) on delete cascade,
  document_type text not null check (char_length(document_type) between 2 and 60),
  storage_path  text not null,
  status        text not null default 'pending' check (status in ('pending','verified','rejected')),
  uploaded_at   timestamptz not null default now(),
  reviewed_at   timestamptz,
  reviewed_by   uuid references auth.users(id)
);

create index if not exists collateral_documents_record_idx
  on public.collateral_documents (collateral_id);

revoke all on public.collateral_records from anon, authenticated;
revoke all on public.collateral_documents from anon, authenticated;
grant select on public.collateral_records to authenticated;
grant select on public.collateral_documents to authenticated;
grant select, insert, update, delete on public.collateral_records, public.collateral_documents to service_role;

alter table public.collateral_records enable row level security;
alter table public.collateral_documents enable row level security;

drop policy if exists collateral_own on public.collateral_records;
create policy collateral_own on public.collateral_records for select to authenticated
  using (user_id = auth.uid());
drop policy if exists collateral_staff on public.collateral_records;
create policy collateral_staff on public.collateral_records for select to authenticated
  using (app.has_permission('loans:read'));

drop policy if exists collateral_docs_own on public.collateral_documents;
create policy collateral_docs_own on public.collateral_documents for select to authenticated
  using (exists (select 1 from public.collateral_records c
                  where c.id = collateral_documents.collateral_id and c.user_id = auth.uid()));
drop policy if exists collateral_docs_staff on public.collateral_documents;
create policy collateral_docs_staff on public.collateral_documents for select to authenticated
  using (app.has_permission('collateral:verify'));
