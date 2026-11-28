-- Phase 8 · 06 — closing the loop: notifications, invitation email status,
-- and a retention window for released collateral documents.
--
-- Notifications are written by triggers, not by application code. A status
-- change and the message about it therefore land in the same transaction: there
-- is no path where a guarantor accepts and the borrower is never told.

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null check (kind ~ '^[a-z][a-z0-9_.]{2,60}$'),
  title      text not null check (char_length(title) between 3 and 140),
  body       text check (body is null or char_length(body) <= 400),
  href       text check (href is null or (left(href, 1) = '/' and char_length(href) <= 200)),
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications (user_id) where read_at is null;

revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant select, insert, update, delete on public.notifications to service_role;
alter table public.notifications enable row level security;

drop policy if exists notifications_own on public.notifications;
create policy notifications_own on public.notifications for select to authenticated
  using (user_id = auth.uid());

create or replace function app.notify(
  p_user uuid,
  p_kind text,
  p_title text,
  p_body text,
  p_href text
)
returns void
language sql security definer
set search_path = public, pg_catalog, pg_temp
as $$
  insert into public.notifications (user_id, kind, title, body, href)
  select p_user, p_kind, left(p_title, 140), left(p_body, 400), p_href
   where p_user is not null;
$$;

revoke all on function app.notify(uuid, text, text, text, text) from public;

-- Authenticated users cannot update rows directly (no grant), so read state is
-- changed through this function only, scoped to their own notifications.
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns integer
language plpgsql security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  update public.notifications
     set read_at = now()
   where user_id = v_uid
     and read_at is null
     and (p_ids is null or id = any (p_ids));

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_notifications_read(uuid[]) from public;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function app.notify_guarantor_response()
returns trigger
language plpgsql security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_name text;
begin
  if new.status in ('accepted', 'declined') and old.status is distinct from new.status then
    select coalesce(nullif(btrim(coalesce(g.full_name, '')), ''), new.email)
      into v_name
      from public.guarantors g
     where g.invitation_id = new.id
     limit 1;

    perform app.notify(
      new.borrower_id,
      'guarantor.' || new.status,
      case when new.status = 'accepted' then 'Guarantor accepted' else 'Guarantor declined' end,
      case
        when new.status = 'accepted'
          then coalesce(v_name, new.email) || ' accepted your invitation. We will verify them before disbursement.'
        else coalesce(v_name, new.email) || ' declined your invitation. You can invite someone else.'
      end,
      '/app/loans');
  end if;
  return new;
end;
$$;

drop trigger if exists guarantor_invitations_notify on public.guarantor_invitations;
create trigger guarantor_invitations_notify
  after update of status on public.guarantor_invitations
  for each row execute function app.notify_guarantor_response();

create or replace function app.notify_collateral_change()
returns trigger
language plpgsql security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_label text := replace(new.category, '_', ' ');
  v_title text;
  v_body text;
begin
  if new.status not in ('verified', 'rejected', 'released')
     or old.status is not distinct from new.status then
    return new;
  end if;

  v_title := case new.status
    when 'verified' then 'Collateral verified'
    when 'rejected' then 'Collateral needs attention'
    else 'Collateral released'
  end;

  v_body := case new.status
    when 'verified' then
      'Your ' || v_label || ' is verified and held until the loan is closed.'
    when 'rejected' then
      coalesce(nullif(btrim(coalesce(new.review_notes, '')), ''),
               'Your ' || v_label || ' could not be accepted. Please review the details.')
    else
      'Your ' || v_label || ' has been released. Documents are kept for 90 days, then deleted.'
  end;

  perform app.notify(new.user_id, 'collateral.' || new.status, v_title, v_body, '/app/loans');
  return new;
end;
$$;

drop trigger if exists collateral_records_notify on public.collateral_records;
create trigger collateral_records_notify
  after update of status on public.collateral_records
  for each row execute function app.notify_collateral_change();

create or replace function app.notify_guarantor_review()
returns trigger
language plpgsql security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_borrower uuid;
begin
  if new.status not in ('verified', 'invalid')
     or old.status is not distinct from new.status then
    return new;
  end if;

  select a.user_id into v_borrower
    from public.loan_applications a
   where a.id = new.application_id;

  perform app.notify(
    v_borrower,
    'guarantor.' || new.status,
    case when new.status = 'verified' then 'Guarantor verified' else 'Guarantor could not be verified' end,
    case
      when new.status = 'verified'
        then coalesce(new.full_name, new.email) || ' has been verified for your application.'
      else coalesce(new.full_name, new.email) || ' could not be verified. You may need to invite someone else.'
    end,
    '/app/loans');

  return new;
end;
$$;

drop trigger if exists guarantors_notify on public.guarantors;
create trigger guarantors_notify
  after update of status on public.guarantors
  for each row execute function app.notify_guarantor_review();

create or replace function app.notify_loan_closed()
returns trigger
language plpgsql security definer
set search_path = public, pg_catalog, pg_temp
as $$
begin
  if new.status = 'closed' and old.status is distinct from new.status then
    perform app.notify(
      new.user_id,
      'loan.closed',
      'Your loan is settled',
      'Every instalment is paid. Your collateral and guarantors can now be released.',
      '/app/loans');

    insert into public.notifications (user_id, kind, title, body, href)
    select g.user_id,
           'guarantor.loan_closed',
           'The loan you guaranteed is settled',
           'The borrower has repaid the loan in full. No further action is needed from you.',
           '/app/loans'
      from public.guarantors g
     where g.application_id = new.id
       and g.user_id is not null
       and g.status = 'verified';
  end if;
  return new;
end;
$$;

drop trigger if exists loan_applications_notify_closed on public.loan_applications;
create trigger loan_applications_notify_closed
  after update of status on public.loan_applications
  for each row execute function app.notify_loan_closed();

-- ---------------------------------------------------------------------------
-- Invitation email state
-- ---------------------------------------------------------------------------

alter table public.guarantor_invitations
  add column if not exists email_status text not null default 'queued',
  add column if not exists email_sent_at timestamptz,
  add column if not exists email_error text;

alter table public.guarantor_invitations
  drop constraint if exists guarantor_invitations_email_status_check;
alter table public.guarantor_invitations
  add constraint guarantor_invitations_email_status_check
  check (email_status in ('queued', 'sent', 'failed', 'skipped'));

-- Called by the server after attempting delivery. Service role only: a client
-- must never be able to claim an invitation was emailed.
create or replace function public.mark_guarantor_invitation_email(
  p_token text,
  p_status text,
  p_error text default null
)
returns void
language plpgsql security definer
set search_path = public, pg_catalog, pg_temp
as $$
begin
  if p_status not in ('sent', 'failed', 'skipped') then
    raise exception 'Unknown email status.' using errcode = '22023';
  end if;

  update public.guarantor_invitations
     set email_status = p_status,
         email_sent_at = case when p_status = 'sent' then now() else null end,
         email_error = left(nullif(btrim(coalesce(p_error, '')), ''), 300)
   where token = p_token;

  if not found then
    raise exception 'Invitation not found.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.mark_guarantor_invitation_email(text, text, text) from public;
grant execute on function public.mark_guarantor_invitation_email(text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Document retention after release
-- ---------------------------------------------------------------------------

alter table public.collateral_records
  add column if not exists documents_retain_until date;

create or replace function public.release_collateral(
  p_collateral_id uuid,
  p_notes text default null
)
returns void
language plpgsql security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_record public.collateral_records;
  v_app public.loan_applications;
  v_notes text := btrim(coalesce(p_notes, ''));
begin
  if not app.has_permission('collateral:verify') then
    raise exception 'Permission denied.' using errcode = '42501';
  end if;

  select * into v_record from public.collateral_records where id = p_collateral_id for update;
  if not found then
    raise exception 'Collateral not found.' using errcode = 'P0002';
  end if;
  if v_record.release_status = 'released' then
    return; -- already released; the action is idempotent
  end if;
  if v_record.status <> 'verified' then
    raise exception 'Only verified collateral can be released.' using errcode = '22023';
  end if;

  select * into v_app from public.loan_applications where id = v_record.application_id for share;
  if not found then
    raise exception 'Application not found.' using errcode = 'P0002';
  end if;
  if v_app.status <> 'closed' then
    raise exception 'Collateral can only be released once the loan is closed.' using errcode = '22023';
  end if;

  update public.collateral_records
     set release_status = 'released',
         status = 'released',
         documents_retain_until = current_date + 90
   where id = p_collateral_id;

  perform app.log_audit(auth.uid(), null, 'collateral.released', 'collateral', p_collateral_id::text,
    jsonb_build_object('release_status', 'held'),
    jsonb_build_object('release_status', 'released', 'application_id', v_record.application_id,
                       'documents_retain_until', current_date + 90),
    nullif(v_notes, ''), null, null);
end;
$$;

revoke all on function public.release_collateral(uuid, text) from public;
grant execute on function public.release_collateral(uuid, text) to authenticated;

-- Deletes evidence whose retention window has elapsed and returns the storage
-- paths so a tool can remove the objects. Service role only.
create or replace function public.purge_released_collateral_documents(p_limit integer default 100)
returns table (document_id uuid, storage_path text)
language plpgsql security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_row record;
begin
  for v_row in
    select d.id, d.storage_path, c.id as collateral_id
      from public.collateral_documents d
      join public.collateral_records c on c.id = d.collateral_id
     where c.release_status = 'released'
       and c.documents_retain_until is not null
       and c.documents_retain_until < current_date
     order by c.documents_retain_until
     limit least(greatest(coalesce(p_limit, 100), 1), 500)
     for update of d skip locked
  loop
    delete from public.collateral_documents where id = v_row.id;

    perform app.log_audit(null, 'system', 'collateral.documents_purged', 'collateral',
      v_row.collateral_id::text,
      jsonb_build_object('document_id', v_row.id),
      null, 'Retention period elapsed', null, null);

    document_id := v_row.id;
    storage_path := v_row.storage_path;
    return next;
  end loop;
end;
$$;

revoke all on function public.purge_released_collateral_documents(integer) from public;
grant execute on function public.purge_released_collateral_documents(integer) to service_role;
