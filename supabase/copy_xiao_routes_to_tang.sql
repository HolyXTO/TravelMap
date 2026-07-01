-- One-time helper: copy Xiao's saved routes to Tang, skipping exact duplicates.
-- Run this once in Supabase SQL Editor after the travel_routes table exists.

do $$
declare
  source_profile_id text;
  target_profile_id text;
begin
  select id
  into source_profile_id
  from public.travel_profiles
  where lower(display_name) = lower('Xiao')
  order by case when id = 'person-a' then 0 else 1 end
  limit 1;

  select id
  into target_profile_id
  from public.travel_profiles
  where lower(display_name) = lower('Tang')
  order by case when id = 'person-b' then 0 else 1 end
  limit 1;

  if source_profile_id is null or target_profile_id is null then
    raise exception 'Could not find Xiao or Tang in public.travel_profiles.';
  end if;

  insert into public.travel_routes (
    profile_id,
    start_place_id,
    end_place_id,
    traveled_at,
    note,
    created_by
  )
  select
    target_profile_id,
    route.start_place_id,
    route.end_place_id,
    route.traveled_at,
    route.note,
    route.created_by
  from public.travel_routes route
  where route.profile_id = source_profile_id
    and not exists (
      select 1
      from public.travel_routes existing
      where existing.profile_id = target_profile_id
        and existing.start_place_id = route.start_place_id
        and existing.end_place_id = route.end_place_id
        and coalesce(existing.traveled_at::text, '') = coalesce(route.traveled_at::text, '')
        and coalesce(existing.note, '') = coalesce(route.note, '')
    );
end $$;
