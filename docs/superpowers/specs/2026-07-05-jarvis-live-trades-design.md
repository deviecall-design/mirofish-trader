# Jarvis Chat + Live Trade Execution — Design

Date: 2026-07-05
Status: Approved by owner (chat conversation, 2026-07-05)

## Goal

Two upgrades to the mirofish-trader dashboard (mirofish-trader.vercel.app):

1. **Jarvis** — a Claude-powered chat panel (typed + push-to-talk voice) embedded in the
   dashboard that can answer questions about signals/positions/performance and take
   gated actions (approve/ignore signals, propose orders).
2. **Live trade execution** — real order placement for crypto symbols via Binance,
   testnet-first, behind hard risk limits, with human approval required for every order.

## Decisions (made by owner)

- **Trade scope:** Binance Testnet first; go-live is a config flip after verified fills.
- **Venue:** Binance for crypto (BTC, ETH). Equities (NVDA, ASML, TSLA, PLTR, DRO.AX)
  stay on the existing paper path; Alpaca/IBKR are future work.
- **Jarvis UX:** chat panel with push-to-talk voice input (browser Web Speech API),
  optional spoken replies (speechSynthesis).
- **Autonomy:** human approval always. Jarvis proposes; the owner confirms every order.

## Architecture

Extend the existing Next.js app in place (approach A). The broker layer implements the
`BrokerAdapter` shape already planned in ARCHITECTURE.md Phase 4, so it can later be
lifted into the standalone orchestrator without rework.

### 1. Broker layer — `app/lib/brokers/`

- `types.ts` — `BrokerAdapter` interface: `placeMarketOrder`, `placeOcoOrder`,
  `getOrder`, `cancelOrder`, `getBalance`, `isEnabled`.
- `binance.ts` — signed REST adapter (HMAC-SHA256 via node:crypto, no new deps).
  - Base URL from `BINANCE_TESTNET`: `https://testnet.binance.vision` when `true`
    (default), `https://api.binance.com` when explicitly `false`.
  - Symbols map through the existing `CRYPTO_PAIRS` convention (BTC → BTCUSDT).
  - Market entry order, then OCO exit (TP +5% / SL −3%, same constants as the cron)
    placed at the exchange so exits fire in real time, not on the 15-min cron.
- Execution is enabled only when `BINANCE_API_KEY` + `BINANCE_API_SECRET` are set and
  `EXECUTION_ENABLED=true`. Otherwise every path falls back to paper (current behaviour).

### 2. Risk guard — `app/lib/risk.ts`

Pure function `checkOrder(intent, state)` consulted before **every** order:

- `KILL_SWITCH=true` blocks all execution instantly.
- `MAX_POSITION_USD` (default 100) — per-order notional cap.
- `MAX_OPEN_POSITIONS` (default 3) — count of open non-paper trades.
- `DAILY_LOSS_LIMIT_USD` (default 50) — sum of today's realised non-paper PnL.

Returns `{ allowed, reason }`; callers must refuse on `allowed=false`. Unit-tested.

### 3. Database — `supabase/schema.sql` additions

- `trades.mode` text default `'paper'` check in (`'paper'`,`'testnet'`,`'live'`).
- New `orders` table: id, owner_id, trade_id → trades, symbol, side, type
  (`market`/`oco`), qty, status (`requested`/`filled`/`cancelled`/`rejected`),
  broker (`binance`), broker_order_id, fill_price, raw jsonb (exchange response,
  audit trail), requested_at, filled_at. RLS matching existing tables.

### 4. Execution flow changes

- `approveSignal` (app/signals/actions.ts): if symbol is crypto AND execution enabled →
  risk check → Binance market order → OCO exit → insert trade (`mode='testnet'|'live'`,
  real fill price) + two `orders` rows. Any failure or non-crypto symbol → existing
  paper path unchanged.
- Cron scan (app/api/cron/scan/route.ts): for open trades with mode ≠ paper, query the
  exchange OCO status and close the trade from real fills instead of simulating TP/SL.
  Paper trades keep the existing simulated close logic.

### 5. Jarvis — `app/api/jarvis/route.ts` + `app/components/JarvisPanel.tsx`

- API route: Claude tool-use loop (ANTHROPIC_API_KEY already in env). Tools:
  `get_positions`, `get_pending_signals`, `get_price`, `run_swarm`, `get_performance`,
  `approve_signal`, `ignore_signal`. Mutating tools return a confirmation payload first;
  the UI renders an explicit Confirm/Cancel card and only a confirmed second call
  executes. The route never places orders directly — it goes through `approveSignal`,
  which enforces the risk guard.
- Panel: collapsible dock rendered in `app/layout.tsx` (client component). Push-to-talk
  via `webkitSpeechRecognition` where available; optional TTS toggle via
  `speechSynthesis`. Graceful degradation to typed chat.

### 6. Env additions (.env.example)

```
EXECUTION_ENABLED=false
BINANCE_TESTNET=true
BINANCE_API_KEY=
BINANCE_API_SECRET=
KILL_SWITCH=false
MAX_POSITION_USD=100
MAX_OPEN_POSITIONS=3
DAILY_LOSS_LIMIT_USD=50
```

## Error handling

- Broker/network failures during approve → signal stays pending, error surfaced to UI
  and Telegram; no trade row is written without a confirmed fill.
- Risk-guard rejection → order refused, reason shown in UI/Jarvis/Telegram.
- Jarvis API failures → chat shows the error; no silent retries of mutating tools.

## Testing & go-live path

1. Unit tests: risk guard rules; Binance request signing (deterministic HMAC vectors);
   order-intent construction.
2. `next build` must pass (Vercel deploy gate).
3. End-to-end on testnet: signal → approve → market fill → OCO placed → forced exit →
   journal shows mode='testnet' trade with real prices.
4. Go live only after (3): set `BINANCE_TESTNET=false` with live API keys, keep
   `MAX_POSITION_USD` small initially.

## Out of scope (this round)

Equities execution (Alpaca/IBKR), wake-word/hands-free voice, multi-user auth,
standalone orchestrator service, backtesting.
