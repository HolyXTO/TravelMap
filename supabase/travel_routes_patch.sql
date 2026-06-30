create table if not exists public.travel_routes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.travel_profiles(id) on delete cascade,
  start_place_id text not null,
  end_place_id text not null,
  traveled_at date,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

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
