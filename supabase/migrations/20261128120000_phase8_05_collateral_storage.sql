-- Phase 8 · 05 — private storage for collateral documents
--
-- The bucket is private and has no anon/authenticated policies: uploads and
-- signed links are issued server-side with the service role, after the RPC has
-- checked ownership. A path looks like collateral/<user_id>/<record_id>/<file>.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'collateral',
  'collateral',
  false,
  8388608, -- 8 MiB
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Belt and braces: remove any broad policy that may have existed on this bucket.
drop policy if exists "collateral public read" on storage.objects;
drop policy if exists "collateral owner write" on storage.objects;
