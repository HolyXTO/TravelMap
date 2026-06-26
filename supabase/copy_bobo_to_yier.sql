-- One-time helper: copy Bobo's visits to Yier without duplicating existing places.
-- Run in Supabase SQL Editor if you want Person B/Yier to match Person A/Bobo.

update public.travel_profiles
set display_name = case
  when display_name = 'Person A' then 'Bobo'
  when display_name = 'Person B' then 'Yier'
  when display_name = 'Person' then 'Yier'
  else display_name
end
where display_name in ('Person A', 'Person B', 'Person');

with source_profile as (
  select id
  from public.travel_profiles
  where display_name = 'Bobo'
  order by created_at
  limit 1
),
target_profile as (
  select id
  from public.travel_profiles
  where display_name = 'Yier'
  order by created_at
  limit 1
),
copied_visits as (
  insert into public.visits (profile_id, place_id, visited_at, trip_type, note, created_by)
  select
    target_profile.id,
    source_visit.place_id,
    source_visit.visited_at,
    source_visit.trip_type,
    source_visit.note,
    source_visit.created_by
  from public.visits source_visit
  cross join source_profile
  cross join target_profile
  where source_visit.profile_id = source_profile.id
    and not exists (
      select 1
      from public.visits target_visit
      where target_visit.profile_id = target_profile.id
        and target_visit.place_id = source_visit.place_id
    )
  returning id, place_id
)
insert into public.visit_photos (visit_id, storage_path, caption, created_by)
select
  copied_visits.id,
  source_photo.storage_path,
  source_photo.caption,
  source_photo.created_by
from copied_visits
join source_profile on true
join public.visits source_visit
  on source_visit.profile_id = source_profile.id
 and source_visit.place_id = copied_visits.place_id
join public.visit_photos source_photo
  on source_photo.visit_id = source_visit.id;
