-- TravelMap photo storage policies.
-- Run this after creating the `travel-photos` bucket in Supabase Storage.

update storage.buckets
set public = true
where id = 'travel-photos';

drop policy if exists "Public can read travel photos" on storage.objects;
create policy "Public can read travel photos"
  on storage.objects for select
  using (bucket_id = 'travel-photos');

drop policy if exists "Only editor can upload travel photos" on storage.objects;
create policy "Only editor can upload travel photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'travel-photos'
    and public.is_travelmap_editor()
  );

drop policy if exists "Only editor can update travel photos" on storage.objects;
create policy "Only editor can update travel photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'travel-photos'
    and public.is_travelmap_editor()
  )
  with check (
    bucket_id = 'travel-photos'
    and public.is_travelmap_editor()
  );

drop policy if exists "Only editor can delete travel photos" on storage.objects;
create policy "Only editor can delete travel photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'travel-photos'
    and public.is_travelmap_editor()
  );

