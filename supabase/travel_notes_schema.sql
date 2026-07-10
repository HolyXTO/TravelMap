-- =====================================================
-- Travel Notes Cloud Storage
-- 请在 Supabase 控制台 > SQL Editor 中执行此脚本
-- =====================================================

-- 创建旅行记录表
create table if not exists public.travel_notes (
  id          text primary key,
  city        text not null,
  cover_image text,
  start_date  text,
  end_date    text,
  rating      integer default 10,
  summary     text,
  center      double precision[] default '{0,0}',
  addresses   jsonb not null default '[]',
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 启用 Row Level Security
alter table public.travel_notes enable row level security;

-- 所有人可以读取旅行记录（公开展示）
create policy "public_read_travel_notes"
  on public.travel_notes for select
  using (true);

-- 只有编辑者可以写入
create policy "editor_insert_travel_notes"
  on public.travel_notes for insert to authenticated
  with check (public.is_travelmap_editor());

-- 只有编辑者可以更新
create policy "editor_update_travel_notes"
  on public.travel_notes for update to authenticated
  using (public.is_travelmap_editor())
  with check (public.is_travelmap_editor());

-- 只有编辑者可以删除
create policy "editor_delete_travel_notes"
  on public.travel_notes for delete to authenticated
  using (public.is_travelmap_editor());

-- 自动更新 updated_at 字段的触发器
create or replace function public.update_travel_notes_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_travel_notes_updated_at on public.travel_notes;
create trigger trg_travel_notes_updated_at
  before update on public.travel_notes
  for each row execute procedure public.update_travel_notes_updated_at();
