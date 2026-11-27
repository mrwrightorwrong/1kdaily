-- Phase 8 · 03 — guarantor invitation and consent
create or replace function public.invite_guarantor(p_application_id uuid, p_email text)
returns text
language plpgsql security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_app public.loan_applications;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_token text;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  if position('@' in v_email) < 2 then
    raise exception 'Enter a valid email address.' using errcode = '22023';
  end if;

  select * into v_app from public.loan_applications where id = p_application_id and user_id = v_uid;
  if not found then raise exception 'Application not found.' using errcode = 'P0002'; end if;
  if v_app.status not in ('submitted','under_review','approved','awaiting_disbursement') then
    raise exception 'A guarantor cannot be added at this stage.' using errcode = '22023';
  end if;

  if v_email = lower((select email from auth.users where id = v_uid)) then
    raise exception 'You cannot guarantee your own loan.' using errcode = '22023';
  end if;

  insert into public.guarantor_invitations (application_id, borrower_id, email)
  values (p_application_id, v_uid, v_email)
  returning token into v_token;

  perform app.log_audit(v_uid, null, 'guarantor.invited', 'loan_application', p_application_id::text,
    null, jsonb_build_object('email', v_email), null, null, null);

  return v_token;
end;
$$;

revoke all on function public.invite_guarantor(uuid, text) from public;
grant execute on function public.invite_guarantor(uuid, text) to authenticated;

create or replace function public.accept_guarantor_invitation(
  p_token text,
  p_full_name text,
  p_relationship text default null
)
returns uuid
language plpgsql security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_inv public.guarantor_invitations;
  v_app public.loan_applications;
  v_name text := btrim(coalesce(p_full_name, ''));
  v_id uuid;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  if char_length(v_name) < 2 then
    raise exception 'Enter your full name.' using errcode = '22023';
  end if;

  select lower(email) into v_email from auth.users where id = v_uid;

  select * into v_inv from public.guarantor_invitations
   where token = p_token for update;

  if not found then raise exception 'Invitation not found.' using errcode = 'P0002'; end if;
  if v_inv.status in ('accepted','declined','revoked') then
    raise exception 'This invitation has already been used.' using errcode = '22023';
  end if;
  if v_inv.expires_at < now() then
    raise exception 'This invitation has expired.' using errcode = '22023';
  end if;
  if lower(v_inv.email) <> v_email then
    raise exception 'This invitation was sent to a different email address.' using errcode = '42501';
  end if;

  select * into v_app from public.loan_applications where id = v_inv.application_id;
  if not found then raise exception 'Application not found.' using errcode = 'P0002'; end if;

  insert into public.guarantors
    (application_id, invitation_id, user_id, full_name, email, phone, relationship,
     guarantee_amount_kobo, status, terms_version, consented_at)
  values
    (v_inv.application_id, v_inv.id, v_uid, v_name, v_inv.email, null,
     nullif(btrim(coalesce(p_relationship, '')), ''),
     v_app.requested_amount_kobo, 'accepted', '2026-11', now())
  returning id into v_id;

  update public.guarantor_invitations set status = 'accepted' where id = v_inv.id;

  perform app.log_audit(v_uid, null, 'guarantor.accepted', 'guarantor', v_id::text,
    null, jsonb_build_object('application_id', v_inv.application_id,
                             'guarantee_amount_kobo', v_app.requested_amount_kobo),
    'Guarantor consented', null, null);

  return v_id;
end;
$$;

revoke all on function public.accept_guarantor_invitation(text, text, text) from public;
grant execute on function public.accept_guarantor_invitation(text, text, text) to authenticated;

create or replace function public.decline_guarantor_invitation(p_token text)
returns void
language plpgsql security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_inv public.guarantor_invitations;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  select lower(email) into v_email from auth.users where id = v_uid;

  select * into v_inv from public.guarantor_invitations where token = p_token for update;
  if not found then raise exception 'Invitation not found.' using errcode = 'P0002'; end if;
  if v_inv.status in ('accepted','declined','revoked') then
    raise exception 'This invitation has already been used.' using errcode = '22023';
  end if;
  if lower(v_inv.email) <> v_email then
    raise exception 'This invitation was sent to a different email address.' using errcode = '42501';
  end if;

  update public.guarantor_invitations set status = 'declined' where id = v_inv.id;

  perform app.log_audit(v_uid, null, 'guarantor.declined', 'guarantor_invitation', v_inv.id::text,
    null, jsonb_build_object('status', 'declined'), null, null, null);
end;
$$;

revoke all on function public.decline_guarantor_invitation(text) from public;
grant execute on function public.decline_guarantor_invitation(text) to authenticated;
