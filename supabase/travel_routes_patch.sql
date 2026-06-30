-- Patch older TravelMap Supabase projects so routes and profiles use stable text ids.
--
-- Why this exists:
-- Some early databases used uuid ids in public.travel_profiles. The current app
-- uses stable text ids, person-a and person-b. If only travel_routes.profile_id
-- is converted to text while travel_profiles.id is still uuid, PostgreSQL raises:
--   foreign key constraint "travel_routes_profile_id_fkey" cannot be implemented
--   Key columns "profile_id" and "id" are of incompatible types: text and uuid.
--
-- Run this whole file once in Supabase SQL Editor. It preserves display names
-- such as Xiao / Tang and only normalizes the underlying ids.

begin;

create table if not exists public.travel_routes (
  id uuid primary key default gen_random_uuid(),
  profile_id text not null,
  start_place_id text not null,
  end_place_id text not null,
  traveled_at date,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.visits
  drop constraint if exists visits_profile_id_fkey;

alter table public.travel_routes
  drop constraint if exists travel_routes_profile_id_fkey;

alter table public.travel_profiles
  alter column id type text using id::text;

alter table public.visits
  alter column profile_id type text using profile_id::text;

alter table public.travel_routes
  alter column profile_id type text using profile_id::text;

do $$
declare
  first_profile_id text;
  second_profile_id text;
begin
  select id
    into first_profile_id
  from public.travel_profiles
  where lower(display_name) in ('xiao', 'bobo')
  order by
    case
      when id = 'person-a' then 0
      when lower(color) = '#2563eb' then 1
      else 2
    end,
    created_at
  limit 1;

  if first_profile_id is null then
    select id
      into first_profile_id
    from public.travel_profiles
    order by
      case
        when id = 'person-a' then 0
        when lower(color) = '#2563eb' then 1
        else 2
      end,
      created_at
    limit 1;
  end if;

  select id
    into second_profile_id
  from public.travel_profiles
  where lower(display_name) in ('tang', 'yier')
    and id <> first_profile_id
  order by
    case
      when id = 'person-b' then 0
      when lower(color) = '#dc2626' then 1
      else 2
    end,
    created_at
  limit 1;

  if second_profile_id is null then
    select id
      into second_profile_id
    from public.travel_profiles
    where id <> first_profile_id
    order by
      case
        when id = 'person-b' then 0
        when lower(color) = '#dc2626' then 1
        else 2
      end,
      created_at
    limit 1;
  end if;

  if first_profile_id is null or second_profile_id is null then
    raise exception 'Could not resolve two travel profiles to person-a/person-b.';
  end if;

  if exists (
    select 1
    from public.travel_profiles
    where id in ('__tmp_person_a__', '__tmp_person_b__')
  ) then
    raise exception 'Temporary profile ids already exist. Please rename them before running this patch.';
  end if;

  update public.visits
  set profile_id = case
    when profile_id = first_profile_id then 'person-a'
    when profile_id = second_profile_id then 'person-b'
    else profile_id
  end
  where profile_id in (first_profile_id, second_profile_id);

  update public.travel_routes
  set profile_id = case
    when profile_id = first_profile_id then 'person-a'
    when profile_id = second_profile_id then 'person-b'
    else profile_id
  end
  where profile_id in (first_profile_id, second_profile_id);

  update public.travel_profiles
  set id = case
    when id = first_profile_id then '__tmp_person_a__'
    when id = second_profile_id then '__tmp_person_b__'
    else id
  end
  where id in (first_profile_id, second_profile_id);

  update public.travel_profiles
  set id = case
    when id = '__tmp_person_a__' then 'person-a'
    when id = '__tmp_person_b__' then 'person-b'
    else id
  end
  where id in ('__tmp_person_a__', '__tmp_person_b__');
end $$;

alter table public.visits
  add constraint visits_profile_id_fkey
  foreign key (profile_id) references public.travel_profiles(id) on delete cascade;

alter table public.travel_routes
  add constraint travel_routes_profile_id_fkey
  foreign key (profile_id) references public.travel_profiles(id) on delete cascade;

alter table public.travel_routes enable row level security;

drop policy if exists "Public can read routes" on public.travel_routes;
create policy "Public can read routes"
  on public.travel_routes for select
  using (true);

drop policy if exists "Only editor can insert routes" on public.travel_routes;
create policy "Only editor can insert routes"
  on public.travel_routes for insert
  to authenticated
  with check (public.is_travelmap_editor() and auth.uid() = created_by);

drop policy if exists "Only editor can update routes" on public.travel_routes;
create policy "Only editor can update routes"
  on public.travel_routes for update
  to authenticated
  using (public.is_travelmap_editor())
  with check (public.is_travelmap_editor());

drop policy if exists "Only editor can delete routes" on public.travel_routes;
create policy "Only editor can delete routes"
  on public.travel_routes for delete
  to authenticated
  using (public.is_travelmap_editor());

commit;
