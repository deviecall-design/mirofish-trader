# Jarvis + Live Trades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Claude-powered Jarvis chat panel (typed + voice) to the dashboard and real Binance order execution (testnet-first) behind hard risk limits with mandatory human approval.

**Architecture:** Extend the Next.js app in place. New `app/lib/brokers/` layer (BrokerAdapter interface + signed Binance REST adapter), `app/lib/risk.ts` guard consulted before every order, execution wired into the existing `approveSignal` server action, exchange-side OCO TP/SL replacing simulated closes for non-paper trades, `/api/jarvis` Claude tool-use route, and a `JarvisPanel` client component in the root layout.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5, Supabase JS, `@anthropic-ai/sdk` (new), `node:crypto` for HMAC signing (no broker SDK dep), vitest (new devDep), Web Speech API (browser built-in).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-05-jarvis-live-trades-design.md` — all behavior traces to it.
- Model for Jarvis: `claude-opus-4-8` (per claude-api skill default), adaptive thinking, no sampling params.
- Execution only when `EXECUTION_ENABLED=true` AND Binance keys present; `BINANCE_TESTNET` defaults to `true`; `KILL_SWITCH=true` blocks everything.
- No order without human approval; the Jarvis route mutates only via the existing server-action code paths.
- All paths must degrade to current paper behavior when execution is disabled or fails pre-order.
- `next build` must pass (Vercel gate). New tests must pass via `npm test`.
- Existing jest-style tests (macroBias/socialBias/orchestrator) are not runnable today (no runner installed); vitest config includes only the new test files to avoid taking on that migration here.

---

### Task 1: Test runner + dependencies

**Files:** Modify `package.json`; Create `vitest.config.ts`.

- [ ] `npm install @anthropic-ai/sdk && npm install -D vitest`
- [ ] Add script `"test": "vitest run"`.
- [ ] `vitest.config.ts` with `test.include = ["app/lib/risk.test.ts", "app/lib/brokers/**/*.test.ts"]` (existing jest-style tests excluded deliberately — see Global Constraints).
- [ ] Commit `chore: add vitest runner and anthropic sdk`.

### Task 2: Risk guard (TDD)

**Files:** Create `app/lib/risk.ts`, `app/lib/risk.test.ts`.

**Interfaces (produces):**
```ts
export interface OrderIntent { symbol: string; side: "BUY" | "SELL"; notionalUsd: number }
export interface RiskState { openPositions: number; todayRealizedPnlUsd: number }
export interface RiskConfig { killSwitch: boolean; maxPositionUsd: number; maxOpenPositions: number; dailyLossLimitUsd: number }
export function riskConfigFromEnv(): RiskConfig
export function checkOrder(intent: OrderIntent, state: RiskState, cfg?: RiskConfig): { allowed: true } | { allowed: false; reason: string }
```

- [ ] Write failing tests: kill switch blocks; notional over `maxPositionUsd` blocks; `openPositions >= maxOpenPositions` blocks; `todayRealizedPnlUsd <= -dailyLossLimitUsd` blocks; a small order in clean state passes; env parsing defaults (100 / 3 / 50, killSwitch false).
- [ ] Run `npm test` → FAIL (module missing). Implement pure functions. Run → PASS.
- [ ] Commit `feat: add pre-order risk guard`.

### Task 3: Broker layer — types + Binance adapter

**Files:** Create `app/lib/brokers/types.ts`, `app/lib/brokers/binance.ts`, `app/lib/brokers/binance.test.ts`.

**Interfaces (produces):**
```ts
// types.ts
export interface PlacedOrder { brokerOrderId: string; status: "filled" | "requested" | "rejected"; fillPrice: number | null; executedQty: number | null; raw: unknown }
export interface BrokerAdapter {
  name: string
  isEnabled(): boolean
  placeMarketOrder(symbol: string, side: "BUY" | "SELL", quoteNotionalUsd: number): Promise<PlacedOrder>
  placeOcoExit(symbol: string, side: "BUY" | "SELL", qty: number, takeProfitPrice: number, stopLossPrice: number): Promise<PlacedOrder>
  getOcoStatus(symbol: string, brokerOrderId: string): Promise<{ done: boolean; exitPrice: number | null; raw: unknown }>
}
// binance.ts
export function binanceBroker(): BrokerAdapter        // reads env each call
export function sign(query: string, secret: string): string  // exported for tests
export function toPair(symbol: string): string | null        // BTC -> BTCUSDT via same map convention as prices.ts
```

Implementation notes:
- Base URL: `process.env.BINANCE_TESTNET === "false" ? "https://api.binance.com" : "https://testnet.binance.vision"` (testnet unless explicitly disabled).
- `sign` = HMAC-SHA256 hex of the query string using `node:crypto` `createHmac`.
- Market entry: `POST /api/v3/order` with `type=MARKET&quoteOrderQty=<notional>`; parse `fills` for weighted avg fill price and `executedQty`.
- OCO exit for a bullish entry: `POST /api/v3/orderList/oco` selling `qty` with `abovePrice` TP / `belowPrice` SL (round prices to tick via exchangeInfo-free heuristic: 2 decimals for USDT pairs — documented limitation).
- `getOcoStatus`: `GET /api/v3/orderList?origClientOrderId=` fallback `GET /api/v3/order`; done when any leg `FILLED`, exitPrice from that leg.
- `isEnabled()` = `EXECUTION_ENABLED === "true"` && key && secret && `toPair(symbol)` supported at call sites.
- Every request sends `X-MBX-APIKEY` header, `timestamp`, `recvWindow=5000`, `signature`.

- [ ] Write failing test: `sign("symbol=LTCBTC&side=BUY&type=LIMIT&timeInForce=GTC&quantity=1&price=0.1&recvWindow=5000&timestamp=1499827319559", "NhqPtmdSJYdKjVHjA7PZj4Mgan7PyT8kbC6bxfqbkeCsAJ2v5T9pYNc8dK1Op0Xj") === "c8db56825ae71d6d79447849e617115f4a920fa2acdcab2b053c4b2838bd6b71"` (Binance docs vector) + `toPair` mapping tests.
- [ ] Run → FAIL. Implement. Run → PASS.
- [ ] Commit `feat: add BrokerAdapter interface and Binance adapter (testnet-first)`.

### Task 4: Schema — orders table + trades.mode

**Files:** Modify `supabase/schema.sql`; Create `supabase/migrations/20260705_orders_and_trade_mode.sql`.

- [ ] Append to schema.sql and mirror as ALTERs in the migration file:
```sql
alter table trades add column if not exists mode text not null default 'paper'
  check (mode in ('paper','testnet','live'));

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default mirofish_owner(),
  trade_id uuid references trades(id) on delete set null,
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
alter table orders enable row level security;
create policy orders_owner on orders using (owner_id = mirofish_owner()) with check (owner_id = mirofish_owner());
create index if not exists orders_trade_idx on orders (trade_id);
```
(Match RLS policy style to existing tables in schema.sql when writing.)
- [ ] Add `mode: "paper" | "testnet" | "live"` to `TradeRow` and an `OrderRow` interface in `app/lib/supabase.ts`.
- [ ] Commit `feat: add orders table and trade mode to schema`.

### Task 5: Execution wiring — approve flow + cron sync

**Files:** Create `app/lib/execution.ts`; Modify `app/signals/actions.ts`, `app/api/cron/scan/route.ts`.

**Interfaces (produces):**
```ts
// execution.ts
export interface ExecutionResult { executed: boolean; mode: "paper" | "testnet" | "live"; entryPrice: number; qty: number; reason?: string; entryOrder?: PlacedOrder; exitOrder?: PlacedOrder }
export function executionMode(): "paper" | "testnet" | "live"
export async function executeEntry(symbol: string, direction: Direction): Promise<ExecutionResult>
```
- `executeEntry`: paper result unless (crypto symbol && broker enabled). Risk check via `checkOrder` with state loaded by caller-provided values — keep it self-contained: query open non-paper trade count + today's realized non-paper pnl (in USD ≈ pnl% × notional; use pnl of closed trades today × MAX_POSITION_USD/100 as conservative estimate — document). On rejection return `{executed:false, reason}` so caller falls back to paper only if the rejection is a *capability* gap, but risk rejections must ABORT the approval (no paper fallback masking a blocked real order — the user asked for the order, we refuse loudly).
- BUY only for bullish signals; bearish signals on spot Binance stay paper (no margin/short support this round — documented in result reason).
- TP/SL prices: entry × 1.05 / entry × 0.97 (reuse the cron constants; export them from a shared module `app/lib/constants.ts` to avoid divergence).

Changes to `approveSignal`:
- [ ] After status flip to approved, call `executeEntry(signal.symbol, signal.direction)`.
- [ ] Insert trade with `mode`, real `entry_price`/`quantity` when executed; insert two `orders` rows (market + oco) with raw broker responses.
- [ ] On broker error mid-flow: revert signal to `pending`, send Telegram error, rethrow.
- [ ] Telegram message includes mode tag, e.g. `✅ Approved BTC bullish @ $64,210.55 [testnet]`.

Changes to cron scan phase 1:
- [ ] For open trades where `mode != 'paper'`: look up the trade's OCO order row, call `getOcoStatus`; if done, close trade with real `exit_price` + pnl, mark order filled, Telegram notify. Skip the simulated TP/SL branch for these trades.
- [ ] Paper trades: unchanged.
- [ ] Commit `feat: wire Binance execution into approve flow and cron sync`.

### Task 6: Jarvis API route

**Files:** Create `app/api/jarvis/route.ts`, `app/api/jarvis/tools.ts`.

- POST body: `{ messages: Array<{role:"user"|"assistant", content: any}> }` (client keeps history). Route runs a manual tool-use loop (max 8 iterations) with `client.messages.create({ model: "claude-opus-4-8", max_tokens: 2048, thinking: {type:"adaptive"}, system: JARVIS_SYSTEM, tools, messages })`.
- Tools (`tools.ts`), executed server-side against Supabase/libs:
  - `get_positions` — open + recent closed trades with pnl and mode
  - `get_pending_signals` — pending signals w/ conviction + summary
  - `get_price(symbol)` — `fetchPrice`
  - `run_swarm(symbol)` — fetch price, `getMacroBias`/`getSocialBias`, `runSwarm`, return SwarmResult
  - `get_performance` — win rate, total pnl, counts from closed trades
  - `approve_signal(signal_id, confirm)` / `ignore_signal(signal_id)` — when `confirm !== true`, return `{needs_confirmation: true, ...order preview}` (UI renders Confirm card; Claude re-calls with confirm true only after user clicks Confirm — the system prompt forbids self-confirming, and the UI sends the confirmation as an explicit user message).
- System prompt: Jarvis persona; must never claim an order was placed without a successful tool result; must present order details and wait for explicit user confirmation before any `confirm: true` call.
- Auth: same-origin only route; no secrets to client. Return `{reply, toolEvents}` where toolEvents lets UI show what happened.
- [ ] Manual verification: `curl -X POST localhost:3000/api/jarvis -d '{"messages":[{"role":"user","content":"what are my open positions?"}]}'` returns a coherent reply (requires ANTHROPIC_API_KEY in .env.local).
- [ ] Commit `feat: add Jarvis Claude tool-use API route`.

### Task 7: Jarvis panel UI (chat + voice)

**Files:** Create `app/components/JarvisPanel.tsx`; Modify `app/layout.tsx` (render `<JarvisPanel />` inside body, after main).

- Client component. Floating button (bottom-right, 🐟/⚡ style consistent with header) toggling a dock (~380px wide, max-h 70vh) with message list, input, mic button, TTS toggle.
- State: `messages` array mirrored to the API shape; loading spinner; error row on failure.
- Voice in: `window.SpeechRecognition || window.webkitSpeechRecognition`, push-to-talk (press to start, auto-submit on final result); hide mic button when unsupported.
- Voice out: optional toggle; `speechSynthesis.speak(new SpeechSynthesisUtterance(reply))`, cancel on new message.
- Confirmation cards: when a tool event has `needs_confirmation`, render order preview with Confirm/Cancel buttons; Confirm sends a user message `"CONFIRM <signal_id>"`; Cancel sends `"cancel that"`.
- Styling: existing CSS vars (`--panel`, `--border`, `--muted`, `--foreground`), Tailwind utility classes matching layout.tsx conventions.
- [ ] `next build` passes; manual check via dev server.
- [ ] Commit `feat: add Jarvis chat panel with push-to-talk voice`.

### Task 8: Env docs, verification, wrap-up

**Files:** Modify `.env.example`, `README.md` (Routes + How it works sections).

- [ ] Append env vars (EXECUTION_ENABLED, BINANCE_TESTNET, BINANCE_API_KEY, BINANCE_API_SECRET, KILL_SWITCH, MAX_POSITION_USD, MAX_OPEN_POSITIONS, DAILY_LOSS_LIMIT_USD).
- [ ] README: document Jarvis route/panel, execution modes, go-live procedure (testnet e2e first, then BINANCE_TESTNET=false), kill switch.
- [ ] `npm test` → all new tests pass. `npm run build` → passes.
- [ ] Commit `docs: env and README for Jarvis + execution`.

## Self-Review Notes

- Spec coverage: broker layer (T3), risk guard (T2), schema (T4), approve/cron (T5), Jarvis route (T6), panel+voice (T7), env/testing (T1, T8). Error handling behaviors from spec live in T5/T6 steps.
- Bearish-spot limitation and tick-size rounding heuristic are documented deviations, surfaced in README (T8).
- Type names cross-checked: `PlacedOrder` (T3) consumed in T5 `ExecutionResult`; `Direction` from existing `app/lib/supabase.ts`.
