-- Phase 8 · 01 — guarantors and invitations
create table if not exists public.guarantor_invitations (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.loan_applications(id) on delete cascade,
  borrower_id    uuid not null references auth.users(id) on delete cascade,
  email          text not null check (position('@' in email) > 1),
  token          text not null unique default replace(gen_random_uuid()::text, '-', ''),
  status         text not null default 'invited'
                   check (status in ('invited', 'opened', 'accepted', 'declined', 'expired', 'revoked')),
  expires_at     timestamptz not null default now() + interval '7 days',
  created_at     timestamptz not null default now()
);

create index if not exists guarantor_invitations_app_idx
  on public.guarantor_invitations (application_id, created_at desc);

create table if not exists public.guarantors (
  id                    uuid primary key default gen_random_uuid(),
  application_id        uuid not null references public.loan_applications(id) on delete restrict,
  invitation_id         uuid references public.guarantor_invitations(id) on delete set null,
  user_id               uuid references auth.users(id) on delete set null,
  full_name             text not null check (char_length(full_name) between 1 and 120),
  email                 text not null,
  phone                 text,
  relationship          text check (relationship is null or char_length(relationship) <= 80),
  guarantee_amount_kobo numeric(20,0) not null check (guarantee_amount_kobo > 0),
  status                text not null default 'invited'
                          check (status in ('invited', 'accepted', 'declined', 'verified', 'invalid', 'released')),
  terms_version         text,
  consented_at          timestamptz,
  verified_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint consent_required_for_acceptance check (
    status not in ('accepted', 'verified') or consented_at is not null
  )
);

create index if not exists guarantors_app_idx on public.guarantors (application_id);
create index if not exists guarantors_user_idx on public.guarantors (user_id);

drop trigger if exists guarantors_touch on public.guarantors;
create trigger guarantors_touch before update on public.guarantors
  for each row execute function app.touch_updated_at();

revoke all on public.guarantor_invitations from anon, authenticated;
revoke all on public.guarantors from anon, authenticated;
grant select on public.guarantor_invitations to authenticated;
grant select on public.guarantors to authenticated;
grant select, insert, update, delete on public.guarantor_invitations, public.guarantors to service_role;

alter table public.guarantor_invitations enable row level security;
alter table public.guarantors enable row level security;

drop policy if exists invitations_borrower on public.guarantor_invitations;
create policy invitations_borrower on public.guarantor_invitations for select to authenticated
  using (borrower_id = auth.uid());
drop policy if exists invitations_staff on public.guarantor_invitations;
create policy invitations_staff on public.guarantor_invitations for select to authenticated
  using (app.has_permission('loans:read'));

drop policy if exists guarantors_borrower on public.guarantors;
create policy guarantors_borrower on public.guarantors for select to authenticated
  using (exists (select 1 from public.loan_applications a
                  where a.id = guarantors.application_id and a.user_id = auth.uid()));
drop policy if exists guarantors_self on public.guarantors;
create policy guarantors_self on public.guarantors for select to authenticated
  using (user_id = auth.uid());
drop policy if exists guarantors_staff on public.guarantors;
create policy guarantors_staff on public.guarantors for select to authenticated
  using (app.has_permission('loans:read'));
