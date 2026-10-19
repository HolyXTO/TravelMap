-- =====================================================
-- Map Fill Leaderboard Table (中国地图/世界地图盲填排行榜)
-- 若需要在 Supabase 单独建立独立表，可在 Supabase 控制台 > SQL Editor 中执行此脚本。
-- 即使未执行此脚本，系统也会自动无缝兼容并使用 travel_guess_leaderboards 跨设备同步。
-- =====================================================

create table if not exists public.map_fill_leaderboards (
  id text primary key,
  mode text not null check (mode in ('china', 'world', 'province')),
  player_name text not null,
  score integer not null,
  total integer not null,
  elapsed_seconds integer not null,
  apm integer not null,
  title text not null default '',
  date timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- 创建索引以加速按模式、得分及用时排序检索
create index if not exists idx_map_fill_leaderboard
  on public.map_fill_leaderboards (mode, score desc, elapsed_seconds asc, date desc);

-- 启用 Row Level Security (RLS)
alter table public.map_fill_leaderboards enable row level security;

-- 策略 1：允许所有人公开读取排行榜
drop policy if exists "public_read_map_fill" on public.map_fill_leaderboards;
create policy "public_read_map_fill"
  on public.map_fill_leaderboards for select
  using (true);

-- 策略 2：允许任意玩家在对局结束后自动上传新战绩（无需登录账号）
drop policy if exists "public_insert_map_fill" on public.map_fill_leaderboards;
create policy "public_insert_map_fill"
  on public.map_fill_leaderboards for insert
  with check (true);

-- 策略 3：允许更新已有战绩（支持 upsert 及跨设备对局记录合并）
drop policy if exists "public_update_map_fill" on public.map_fill_leaderboards;
create policy "public_update_map_fill"
  on public.map_fill_leaderboards for update
  using (true)
  with check (true);

-- 策略 4：允许删除记录（管理或清理测试数据）
drop policy if exists "public_delete_map_fill" on public.map_fill_leaderboards;
create policy "public_delete_map_fill"
  on public.map_fill_leaderboards for delete
  using (true);
