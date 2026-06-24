-- TravelMap first-version schema for Supabase.
-- Run this in Supabase SQL Editor after creating the project.

create table if not exists public.travel_profiles (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  color text not null default '#2563eb',
  created_at timestamptz not null default now()
);

create table if not exists public.places (
  id text primary key,
  level text not null check (level in ('country', 'region', 'city')),
  parent_id text references public.places(id) on delete set null,
  name text not null,
  local_name text not null,
  iso_code text,
  region text,
  longitude double precision,
  latitude double precision,
  geojson_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.travel_profiles(id) on delete cascade,
  place_id text not null references public.places(id) on delete restrict,
  visited_at date not null,
  trip_type text not null,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.visit_photos (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.visits(id) on delete cascade,
  storage_path text not null,
  caption text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.travel_profiles enable row level security;
alter table public.places enable row level security;
alter table public.visits enable row level security;
alter table public.visit_photos enable row level security;

create policy "Public can read profiles"
  on public.travel_profiles for select
  using (true);

create policy "Public can read places"
  on public.places for select
  using (true);

create policy "Public can read visits"
  on public.visits for select
  using (true);

create policy "Public can read visit photos"
  on public.visit_photos for select
  using (true);

create policy "Authenticated editors can insert visits"
  on public.visits for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "Authenticated editors can update own visits"
  on public.visits for update
  to authenticated
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

create policy "Authenticated editors can delete own visits"
  on public.visits for delete
  to authenticated
  using (auth.uid() = created_by);

create policy "Authenticated editors can insert photos"
  on public.visit_photos for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "Authenticated editors can update own photos"
  on public.visit_photos for update
  to authenticated
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

create policy "Authenticated editors can delete own photos"
  on public.visit_photos for delete
  to authenticated
  using (auth.uid() = created_by);
