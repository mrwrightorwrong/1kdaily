-- Phase 8 · 04 — collateral submission, review, release; guarantor verification
--
-- Two rules are enforced here rather than in the UI:
--   1. a borrower can only touch collateral on their own application, and only
--      while the loan is still being arranged;
--   2. collateral is released only after the loan is closed, and only by staff
--      holding collateral:verify. Verification never releases security.

-- Risk officers own collateral verification; super_admin already has it.
insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.admin_roles r, public.admin_permissions p
where r.key = 'risk_officer' and p.key = 'collateral:verify'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Borrower: submit and document collateral
-- ---------------------------------------------------------------------------

create or replace function public.submit_collateral(
  p_application_id uuid,
  p_category text,
  p_description text,
  p_estimated_value_kobo numeric default null,
  p_valuation_method text default null,
  p_valuation_date date default null,
  p_ownership_evidence text default null,
  p_security_agreement_ref text default null
)
returns uuid
language plpgsql security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_app public.loan_applications;
  v_description text := btrim(coalesce(p_description, ''));
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into v_app
    from public.loan_applications
   where id = p_application_id and user_id = v_uid;
  if not found then
    raise exception 'Application not found.' using errcode = 'P0002';
  end if;

  if v_app.status not in ('submitted', 'under_review', 'approved', 'awaiting_disbursement') then
    raise exception 'Collateral cannot be added at this stage.' using errcode = '22023';
  end if;

  if p_category not in ('vehicle', 'equipment', 'property', 'business_asset', 'other') then
    raise exception 'Choose a valid collateral category.' using errcode = '22023';
  end if;
  if char_length(v_description) < 3 then
    raise exception 'Describe the collateral in a few words.' using errcode = '22023';
  end if;
  if p_estimated_value_kobo is not null and p_estimated_value_kobo <= 0 then
    raise exception 'An estimated value must be greater than zero.' using errcode = '22023';
  end if;

  insert into public.collateral_records
    (application_id, user_id, category, description, estimated_value_kobo,
     valuation_method, valuation_date, ownership_evidence, security_agreement_ref)
  values
    (p_application_id, v_uid, p_category, left(v_description, 400), p_estimated_value_kobo,
     nullif(btrim(coalesce(p_valuation_method, '')), ''),
     p_valuation_date,
     nullif(btrim(coalesce(p_ownership_evidence, '')), ''),
     nullif(btrim(coalesce(p_security_agreement_ref, '')), ''))
  returning id into v_id;

  perform app.log_audit(v_uid, null, 'collateral.submitted', 'collateral', v_id::text,
    null,
    jsonb_build_object('application_id', p_application_id, 'category', p_category,
                       'estimated_value_kobo', p_estimated_value_kobo),
    null, null, null);

  return v_id;
end;
$$;

revoke all on function public.submit_collateral(uuid, text, text, numeric, text, date, text, text) from public;
grant execute on function public.submit_collateral(uuid, text, text, numeric, text, date, text, text) to authenticated;

create or replace function public.attach_collateral_document(
  p_collateral_id uuid,
  p_document_type text,
  p_storage_path text
)
returns uuid
language plpgsql security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_record public.collateral_records;
  v_type text := btrim(coalesce(p_document_type, ''));
  v_path text := btrim(coalesce(p_storage_path, ''));
  v_prefix text;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into v_record
    from public.collateral_records
   where id = p_collateral_id and user_id = v_uid;
  if not found then
    raise exception 'Collateral not found.' using errcode = 'P0002';
  end if;
  if v_record.release_status <> 'held' then
    raise exception 'This collateral has been released.' using errcode = '22023';
  end if;

  if char_length(v_type) < 2 then
    raise exception 'Name the document type.' using errcode = '22023';
  end if;
  if position('..' in v_path) > 0 then
    raise exception 'Invalid document path.' using errcode = '22023';
  end if;

  -- The object must live in this borrower's folder for this record. Without
  -- this, a caller could register a path belonging to another customer.
  v_prefix := 'collateral/' || v_uid::text || '/' || p_collateral_id::text || '/';
  if v_path not like v_prefix || '%' then
    raise exception 'Documents must be stored under your own collateral folder.' using errcode = '22023';
  end if;

  insert into public.collateral_documents (collateral_id, document_type, storage_path)
  values (p_collateral_id, left(v_type, 60), v_path)
  returning id into v_id;

  perform app.log_audit(v_uid, null, 'collateral.document_attached', 'collateral', p_collateral_id::text,
    null, jsonb_build_object('document_id', v_id, 'document_type', v_type),
    null, null, null);

  return v_id;
end;
$$;

revoke all on function public.attach_collateral_document(uuid, text, text) from public;
grant execute on function public.attach_collateral_document(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Staff: review documents, verify or reject collateral, then release it
-- ---------------------------------------------------------------------------

create or replace function public.review_collateral_document(
  p_document_id uuid,
  p_decision text
)
returns void
language plpgsql security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_doc public.collateral_documents;
begin
  if not app.has_permission('collateral:verify') then
    raise exception 'Permission denied.' using errcode = '42501';
  end if;
  if p_decision not in ('verify', 'reject') then
    raise exception 'Unknown decision.' using errcode = '22023';
  end if;

  select * into v_doc from public.collateral_documents where id = p_document_id for update;
  if not found then
    raise exception 'Document not found.' using errcode = 'P0002';
  end if;
  if v_doc.status <> 'pending' then
    raise exception 'This document has already been reviewed.' using errcode = '22023';
  end if;

  update public.collateral_documents
     set status = case when p_decision = 'verify' then 'verified' else 'rejected' end,
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_document_id;

  perform app.log_audit(auth.uid(), null, 'collateral.document_' || p_decision, 'collateral',
    v_doc.collateral_id::text, jsonb_build_object('document_id', p_document_id),
    jsonb_build_object('status', p_decision), null, null, null);
end;
$$;

revoke all on function public.review_collateral_document(uuid, text) from public;
grant execute on function public.review_collateral_document(uuid, text) to authenticated;

create or replace function public.review_collateral(
  p_collateral_id uuid,
  p_decision text,
  p_notes text default null
)
returns void
language plpgsql security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_record public.collateral_records;
  v_notes text := btrim(coalesce(p_notes, ''));
  v_status text;
begin
  if not app.has_permission('collateral:verify') then
    raise exception 'Permission denied.' using errcode = '42501';
  end if;
  if p_decision not in ('verify', 'reject') then
    raise exception 'Unknown decision.' using errcode = '22023';
  end if;
  if p_decision = 'reject' and char_length(v_notes) < 10 then
    raise exception 'A rejection reason of at least 10 characters is required.' using errcode = '22023';
  end if;

  select * into v_record from public.collateral_records where id = p_collateral_id for update;
  if not found then
    raise exception 'Collateral not found.' using errcode = 'P0002';
  end if;
  if v_record.release_status = 'released' then
    raise exception 'Released collateral cannot be reviewed.' using errcode = '22023';
  end if;
  if v_record.status not in ('submitted', 'pending_verification', 'under_review', 'rejected') then
    raise exception 'This collateral has already been decided.' using errcode = '22023';
  end if;

  v_status := case when p_decision = 'verify' then 'verified' else 'rejected' end;

  update public.collateral_records
     set status = v_status,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         review_notes = nullif(v_notes, '')
   where id = p_collateral_id;

  perform app.log_audit(auth.uid(), null, 'collateral.' || p_decision, 'collateral', p_collateral_id::text,
    jsonb_build_object('status', v_record.status),
    jsonb_build_object('status', v_status, 'application_id', v_record.application_id),
    nullif(v_notes, ''), null, null);
end;
$$;

revoke all on function public.review_collateral(uuid, text, text) from public;
grant execute on function public.review_collateral(uuid, text, text) to authenticated;

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
         status = 'released'
   where id = p_collateral_id;

  perform app.log_audit(auth.uid(), null, 'collateral.released', 'collateral', p_collateral_id::text,
    jsonb_build_object('release_status', 'held'),
    jsonb_build_object('release_status', 'released', 'application_id', v_record.application_id),
    nullif(v_notes, ''), null, null);
end;
$$;

revoke all on function public.release_collateral(uuid, text) from public;
grant execute on function public.release_collateral(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Guarantor: staff verification, and release after the loan closes
-- ---------------------------------------------------------------------------

create or replace function public.verify_guarantor(
  p_guarantor_id uuid,
  p_decision text,
  p_notes text default null
)
returns void
language plpgsql security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_guarantor public.guarantors;
  v_notes text := btrim(coalesce(p_notes, ''));
  v_status text;
begin
  if not app.has_permission('loans:approve') then
    raise exception 'Permission denied.' using errcode = '42501';
  end if;
  if p_decision not in ('verify', 'reject') then
    raise exception 'Unknown decision.' using errcode = '22023';
  end if;
  if p_decision = 'reject' and char_length(v_notes) < 10 then
    raise exception 'A rejection reason of at least 10 characters is required.' using errcode = '22023';
  end if;

  select * into v_guarantor from public.guarantors where id = p_guarantor_id for update;
  if not found then
    raise exception 'Guarantor not found.' using errcode = 'P0002';
  end if;
  if v_guarantor.status <> 'accepted' then
    raise exception 'Only a guarantor who has consented can be verified.' using errcode = '22023';
  end if;

  v_status := case when p_decision = 'verify' then 'verified' else 'invalid' end;

  update public.guarantors
     set status = v_status,
         verified_at = case when p_decision = 'verify' then now() else verified_at end
   where id = p_guarantor_id;

  perform app.log_audit(auth.uid(), null, 'guarantor.' || p_decision, 'guarantor', p_guarantor_id::text,
    jsonb_build_object('status', v_guarantor.status),
    jsonb_build_object('status', v_status, 'application_id', v_guarantor.application_id),
    nullif(v_notes, ''), null, null);
end;
$$;

revoke all on function public.verify_guarantor(uuid, text, text) from public;
grant execute on function public.verify_guarantor(uuid, text, text) to authenticated;

create or replace function public.release_guarantor(
  p_guarantor_id uuid,
  p_notes text default null
)
returns void
language plpgsql security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_guarantor public.guarantors;
  v_app public.loan_applications;
  v_notes text := btrim(coalesce(p_notes, ''));
begin
  if not app.has_permission('loans:approve') then
    raise exception 'Permission denied.' using errcode = '42501';
  end if;

  select * into v_guarantor from public.guarantors where id = p_guarantor_id for update;
  if not found then
    raise exception 'Guarantor not found.' using errcode = 'P0002';
  end if;
  if v_guarantor.status = 'released' then
    return; -- idempotent
  end if;
  if v_guarantor.status <> 'verified' then
    raise exception 'Only a verified guarantor can be released.' using errcode = '22023';
  end if;

  select * into v_app from public.loan_applications where id = v_guarantor.application_id for share;
  if not found then
    raise exception 'Application not found.' using errcode = 'P0002';
  end if;
  if v_app.status <> 'closed' then
    raise exception 'A guarantor can only be released once the loan is closed.' using errcode = '22023';
  end if;

  update public.guarantors set status = 'released' where id = p_guarantor_id;

  perform app.log_audit(auth.uid(), null, 'guarantor.released', 'guarantor', p_guarantor_id::text,
    jsonb_build_object('status', 'verified'),
    jsonb_build_object('status', 'released', 'application_id', v_guarantor.application_id),
    nullif(v_notes, ''), null, null);
end;
$$;

revoke all on function public.release_guarantor(uuid, text) from public;
grant execute on function public.release_guarantor(uuid, text) to authenticated;
