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
- `POST /api/jarvis` — Jarvis assistant (Claude tool-use; backs the chat panel)

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

## Jarvis assistant

Every page has a floating ⚡ button (bottom right) that opens Jarvis — a
Claude-powered chat panel with push-to-talk voice input and optional spoken
replies. It can answer questions (positions, P&L, pending signals, live
prices), run swarm simulations on demand, and approve/ignore signals. Any
approval shows an explicit Confirm/Cancel card first; Jarvis can never place
an order on its own. Requires `ANTHROPIC_API_KEY`.

## Live execution (Binance, testnet-first)

By default every trade is paper. To enable real execution for crypto symbols
(BTC, ETH — equities always stay paper):

1. Run `supabase/migrations/20260705_orders_and_trade_mode.sql` in the
   Supabase SQL editor (adds `trades.mode` and the `orders` audit table).
2. Create testnet API keys at https://testnet.binance.vision and set
   `BINANCE_API_KEY`, `BINANCE_API_SECRET`, `EXECUTION_ENABLED=true`,
   and `TRADING_API_SECRET` (leave `BINANCE_TESTNET=true` and
   `LIVE_TRADING_ENABLED=false`).
3. Approve a bullish BTC or ETH signal with
   `Authorization: Bearer $TRADING_API_SECRET` on the request. The dashboard
   Approve button and Jarvis do not send that header, so they cannot place
   a broker order. Verify end-to-end: market fill at the real testnet price,
   an OCO TP/SL order on the exchange, `mode=testnet` in the journal, and
   the cron closing the trade from the exchange fill.
4. **Go live only after step 3 passes:** swap in production API keys and set
   both `BINANCE_TESTNET=false` and `LIVE_TRADING_ENABLED=true`. Either one
   alone stays on testnet. Keep `MAX_POSITION_USD` small at first. The same
   bearer secret is still required on the request.

Safety rails, all enforced in code before any order is sent:

- Human approval is still required in the Jarvis prompt, and every broker
  order also requires `Authorization: Bearer $TRADING_API_SECRET`. Telegram
  `/approve` opens a paper trade only; it does not call Binance.
- Risk guard: `MAX_POSITION_USD`, `MAX_OPEN_POSITIONS`,
  `DAILY_LOSS_LIMIT_USD`, and `KILL_SWITCH=true` to block all execution
  instantly.
- TP/SL is placed as a real OCO order on Binance at entry time, so exits
  trigger in real time rather than on the 15-minute cron (the cron just syncs
  fill status back to the journal).
- Bearish signals stay paper (spot Binance has no shorting); a blocked or
  failed real order leaves the signal pending and notifies Telegram — it is
  never silently converted to a paper fill.

## Telegram setup

After deploying, set the webhook:

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook?url=https://YOUR_DOMAIN/api/telegram"
```

## Cron secret

Vercel sends `Authorization: Bearer $CRON_SECRET` automatically to cron paths
when `CRON_SECRET` is configured for the project. The scan endpoint accepts
that header or `?secret=…` as a query param.
