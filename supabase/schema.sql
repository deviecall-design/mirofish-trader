-- MiroFish Trader schema
-- Run via Supabase SQL editor against project zmzvbppivxnyhcacxdxb.

-- Enable pgcrypto for gen_random_uuid()
create extension if not exists "pgcrypto";

-- Single-user mode: a fixed owner_id (uuid) used everywhere.
-- Replace this with auth.uid() once auth is added.
create or replace function mirofish_owner() returns uuid
language sql immutable as $$
  select '00000000-0000-0000-0000-000000000001'::uuid
$$;

-- watchlist
create table if not exists public.watchlist (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default mirofish_owner(),
  symbol text not null,
  theme text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (owner_id, symbol)
);

-- signals
create table if not exists public.signals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default mirofish_owner(),
  symbol text not null,
  direction text not null check (direction in ('bullish','bearish','neutral')),
  conviction integer not null check (conviction between 0 and 100),
  summary text not null,
  status text not null default 'pending' check (status in ('pending','approved','ignored')),
  price numeric,
  created_at timestamptz not null default now()
);

create index if not exists signals_symbol_status_idx
  on public.signals (symbol, status, created_at desc);

-- trades
create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default mirofish_owner(),
  symbol text not null,
  direction text not null check (direction in ('bullish','bearish','neutral')),
  entry_price numeric not null,
  exit_price numeric,
  quantity numeric not null default 1,
  status text not null default 'open' check (status in ('open','closed')),
  pnl numeric,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  signal_id uuid references public.signals(id) on delete set null
);

create index if not exists trades_status_idx on public.trades (status, opened_at desc);

-- RLS
alter table public.watchlist enable row level security;
alter table public.signals   enable row level security;
alter table public.trades    enable row level security;

-- Permissive policies tied to mirofish_owner() so the anon key can
-- read/write its own rows in single-user mode.
drop policy if exists watchlist_owner_all on public.watchlist;
create policy watchlist_owner_all on public.watchlist
  for all using (owner_id = mirofish_owner())
  with check (owner_id = mirofish_owner());

drop policy if exists signals_owner_all on public.signals;
create policy signals_owner_all on public.signals
  for all using (owner_id = mirofish_owner())
  with check (owner_id = mirofish_owner());

drop policy if exists trades_owner_all on public.trades;
create policy trades_owner_all on public.trades
  for all using (owner_id = mirofish_owner())
  with check (owner_id = mirofish_owner());

-- Seed watchlist
insert into public.watchlist (symbol, theme) values
  ('BTC',  'Crypto'),
  ('ETH',  'Crypto'),
  ('NVDA', 'AI/Tech'),
  ('ASML', 'AI/Tech'),
  ('PLTR', 'AI/Tech'),
  ('TSM',  'AI/Tech'),
  ('TSLA', 'Speculative'),
  ('DRO.AX',  'Speculative')
on conflict (owner_id, symbol) do nothing;
