-- Swap all travel data owned by Xiao and Tang.
--
-- Run this after supabase/travel_routes_patch.sql if route saving still reports:
-- invalid input syntax for type uuid: "person-a"
--
-- This swaps:
--   1. visits.profile_id
--   2. travel_routes.profile_id, when the table exists
--
-- Photos do not need a separate update because visit_photos belongs to visits
-- through visit_id, so each photo follows the visit it is attached to.

begin;

do $$
declare
  xiao_id public.travel_profiles.id%type;
  tang_id public.travel_profiles.id%type;
begin
  select id
    into xiao_id
  from public.travel_profiles
  where lower(display_name) = 'xiao'
  order by
    case when id = 'person-a' then 0 else 1 end,
    created_at
  limit 1;

  select id
    into tang_id
  from public.travel_profiles
  where lower(display_name) = 'tang'
  order by
    case when id = 'person-b' then 0 else 1 end,
    created_at
  limit 1;

  if xiao_id is null or tang_id is null then
    raise exception 'Could not find both profiles. Expected display_name Xiao and Tang.';
  end if;

  if xiao_id = tang_id then
    raise exception 'Xiao and Tang resolved to the same profile id: %', xiao_id;
  end if;

  update public.visits
  set profile_id = case
    when profile_id = xiao_id then tang_id
    when profile_id = tang_id then xiao_id
    else profile_id
  end
  where profile_id in (xiao_id, tang_id);

  if to_regclass('public.travel_routes') is not null then
    update public.travel_routes
    set profile_id = case
      when profile_id = xiao_id then tang_id
      when profile_id = tang_id then xiao_id
      else profile_id
    end
    where profile_id in (xiao_id, tang_id);
  end if;
end $$;

commit;
