-- Migration: live-execution support (run once in the Supabase SQL editor).
-- Adds trades.mode and the orders audit table. Idempotent.

alter table public.trades add column if not exists mode text not null default 'paper'
  check (mode in ('paper','testnet','live'));

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default mirofish_owner(),
  trade_id uuid references public.trades(id) on delete set null,
  symbol text not null,
  side text not null check (side in ('BUY','SELL')),
  type text not null check (type in ('market','oco')),
  qty numeric,
  status text not null default 'requested'
    check (status in ('requested','filled','cancelled','rejected')),
  broker text not null default 'binance',
  broker_order_id text,
  fill_price numeric,
  raw jsonb,
  requested_at timestamptz not null default now(),
  filled_at timestamptz
);

create index if not exists orders_trade_idx on public.orders (trade_id);

alter table public.orders enable row level security;
drop policy if exists orders_owner_all on public.orders;
create policy orders_owner_all on public.orders
  for all using (owner_id = mirofish_owner())
  with check (owner_id = mirofish_owner());
