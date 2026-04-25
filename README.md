# MiroFish Trader

A Next.js App Router paper-trading engine driven by MiroFish swarm-intelligence
sentiment predictions, with a Telegram approval loop.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Environment

Copy `.env.example` to `.env.local` and fill in the values (Supabase, Telegram,
`CRON_SECRET`, `ANTHROPIC_API_KEY`).

## Database

Run `supabase/schema.sql` against the Supabase project (SQL editor in the
dashboard). It creates `watchlist`, `signals`, `trades` with RLS keyed to a
fixed `mirofish_owner()` and seeds the default watchlist
(BTC, ETH, NVDA, ASML, PLTR, TSM, TSLA, DRO).

## Routes

- `/` — dashboard (P&L, open positions, win rate, recent signals)
- `/signals` — sentiment feed with approve/ignore buttons
- `/journal` — every paper trade with entry/exit/P&L
- `/performance` — win rate, avg return, max drawdown, equity chart
- `/watchlist` — symbols + themes, add new symbols
- `POST /api/telegram` — Telegram webhook (`/approve SYM`, `/ignore SYM`)
- `GET /api/cron/scan` — 15-min scan job (Vercel cron)

## How it works

1. Vercel cron hits `/api/cron/scan` every 15 minutes.
2. The scan fetches prices for each active watchlist symbol
   (CoinGecko for BTC/ETH, Yahoo Finance v8 for equities).
3. If a symbol has moved ±2% since the last observation, it runs the MiroFish
   swarm (1000 agents across momentum, contrarian, macro, sentiment archetypes)
   and inserts a signal.
4. A Telegram message is sent to the configured chat with `/approve SYM` and
   `/ignore SYM` instructions.
5. Approving (via Telegram or the Signals page) opens a paper trade at the
   current price with TP +5% and SL -3%.
6. Each scan also closes open trades that have hit TP or SL.

## Telegram setup

After deploying, set the webhook:

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook?url=https://YOUR_DOMAIN/api/telegram"
```

## Cron secret

Vercel sends `Authorization: Bearer $CRON_SECRET` automatically to cron paths
when `CRON_SECRET` is configured for the project. The scan endpoint accepts
that header or `?secret=…` as a query param.
