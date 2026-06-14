create table if not exists public.draws (
  draw_no text primary key,
  draw_date date not null,
  front int[] not null check (array_length(front, 1) = 5),
  back int[] not null check (array_length(back, 1) = 2),
  pool bigint,
  source text not null default 'api',
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  draw_no text not null,
  budget numeric not null check (budget >= 0),
  total_cost numeric not null check (total_cost >= 0),
  lines jsonb not null default '[]'::jsonb,
  status text not null default 'planned' check (status in ('planned', 'bought', 'checked')),
  note text
);

create table if not exists public.plan_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  draw_no text not null,
  budget numeric not null,
  strategy text not null,
  total_cost numeric not null,
  plan jsonb not null
);

create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.draws enable row level security;
alter table public.tickets enable row level security;
alter table public.plan_runs enable row level security;
alter table public.settings enable row level security;

-- MVP 是个人服务端应用：浏览器不直接读写 Supabase，Next.js API 使用 service role。
-- 因此不开放 anon RLS policy，避免公开票据记录。
