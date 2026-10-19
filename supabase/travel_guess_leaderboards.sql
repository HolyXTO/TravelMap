-- =====================================================
-- Travel Guess Game Leaderboard Cloud Table
-- 请在 Supabase 控制台 > SQL Editor 中执行此脚本以支持跨设备云端实时同步
-- =====================================================

create table if not exists public.travel_guess_leaderboards (
  id text primary key,
  category text not null check (category in ('global', 'domestic', 'foreign')),
  player_name text not null,
  score integer not null,
  date timestamptz not null default now(),
  best_dist double precision not null,
  avg_dist double precision not null,
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- 创建索引以加速排行榜按分类及得分快速检索
create index if not exists idx_leaderboard_cat_score
  on public.travel_guess_leaderboards (category, score desc, avg_dist asc, date desc);

-- 启用 Row Level Security (RLS)
alter table public.travel_guess_leaderboards enable row level security;

-- 策略 1：允许所有人公开读取排行榜（全球/国内/国外 Top 10）
drop policy if exists "public_read_leaderboards" on public.travel_guess_leaderboards;
create policy "public_read_leaderboards"
  on public.travel_guess_leaderboards for select
  using (true);

-- 策略 2：允许任意玩家在对局结束后自动上传新战绩（无需登录账号）
drop policy if exists "public_insert_leaderboards" on public.travel_guess_leaderboards;
create policy "public_insert_leaderboards"
  on public.travel_guess_leaderboards for insert
  with check (true);
