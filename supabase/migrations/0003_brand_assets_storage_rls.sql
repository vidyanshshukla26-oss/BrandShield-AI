insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'brand-assets',
  'brand-assets',
  false,
  8388608,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists brand_assets_org_read on storage.objects;
create policy brand_assets_org_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'brand-assets'
  and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then public.is_org_member(((storage.foldername(name))[1])::uuid)
    else false
  end
);

drop policy if exists brand_assets_org_insert on storage.objects;
create policy brand_assets_org_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'brand-assets'
  and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then public.is_org_member(((storage.foldername(name))[1])::uuid)
    else false
  end
);

drop policy if exists brand_assets_org_update on storage.objects;
create policy brand_assets_org_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'brand-assets'
  and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then public.is_org_member(((storage.foldername(name))[1])::uuid)
    else false
  end
)
with check (
  bucket_id = 'brand-assets'
  and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then public.is_org_member(((storage.foldername(name))[1])::uuid)
    else false
  end
);

drop policy if exists brand_assets_org_delete on storage.objects;
create policy brand_assets_org_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'brand-assets'
  and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then public.is_org_member(((storage.foldername(name))[1])::uuid)
    else false
  end
);
