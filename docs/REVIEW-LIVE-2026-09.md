# MiroFish Trader — review of the live code, September 2026

Reviewed against commit `8f968d0` (“Restore main to the code currently live on Vercel (b07526e)”), which is `main` as of 25 September 2026. That commit is the 3 August screener work (`b07526e`) plus the fast-forward that put it on `main`.

The earlier note, `REVIEW-2026-09.md`, was written the same day against an older `main` (`f117e2d`, 9 June). It looked at the live site, then compared that site with a repository that did not contain the live source. This note re-checks those findings against the source that is now on `main`.

No production data was read or changed. Row counts, open positions, and “last signal 24 July” below are the 25 September database observations from the earlier review. They were not re-queried.

This pull request also makes two code changes, described in the last section: real-money orders now need an explicit opt-in that is off by default, broker orders require a secret, and `next build` succeeds when the Supabase env vars are missing.

---

## Can this app place a real-money order?

**Yes, the code that was on `main` before this pull request could.** It does not do so with the defaults, and the live site’s header was showing “Execution paper”, which means production did not have `EXECUTION_ENABLED=true` when that header was checked. The path still existed.

A real Binance spot order (host `https://api.binance.com`, not the testnet) was sent when all of the following were true:

1. `EXECUTION_ENABLED=true`
2. `BINANCE_API_KEY` and `BINANCE_API_SECRET` set
3. `BINANCE_TESTNET=false` (that single string switched the host from `testnet.binance.vision` to production)
4. Someone approved a **bullish** signal for **BTC** or **ETH**
5. The risk guard allowed it (`KILL_SWITCH` not `true`, notional within `MAX_POSITION_USD`, open non-paper positions under `MAX_OPEN_POSITIONS`, today’s realized loss under `DAILY_LOSS_LIMIT_USD`)

Who could trigger that approval, with no login:

- The Approve button on the Signals page and the dashboard (`app/signals/actions.ts` `approveSignal`, called from `app/signals/SignalActions.tsx`). Next.js checks the site origin. It does not check who the person is. Anyone who can load the page can invoke the action.
- `POST /api/jarvis` (`app/api/jarvis/route.ts`). No secret. The model is told to wait for a yes, but that is a prompt, not a lock. A caller can ask it to approve, and the tool calls the same `approveSignal` (`app/api/jarvis/tools.ts`).

What cannot place a Binance order:

- Telegram `/approve` (`app/api/telegram/route.ts`) inserts a paper trade directly. It never calls `executeEntry`.
- `GET /api/cron/scan` closes paper trades in the database and, for an existing testnet or live trade, reads the exchange OCO status. It does not send a new order.
- `GET /api/cron/swarm` inserts signals. It does not send an order. It is not on the Vercel cron schedule (`vercel.json` only lists `/api/cron/scan`).

Equities never go to Binance. Bearish and neutral signals stay paper even when execution is on, because spot Binance cannot short (`app/lib/execution.ts`).

**After this pull request**, production Binance is used only when `LIVE_TRADING_ENABLED=true` **and** `BINANCE_TESTNET=false`. `BINANCE_TESTNET=false` on its own stays on the testnet host. Testnet orders still work, but only if the request sends `Authorization: Bearer $TRADING_API_SECRET`. If that secret is unset, no broker order is sent. The Approve button and Jarvis do not send the header, so they cannot place a testnet or live order. Paper approvals are unchanged while `EXECUTION_ENABLED` is not `true`.

---

## Earlier findings, one by one

Status words: **still true**, **fixed**, **changed**, **not applicable**.

### The repository did not match the live site

**Fixed.** `main` is now the live tree. Routes that the earlier review could not find are in git: `/screener`, `/api/jarvis`, `/api/screener`, `/api/chart`, `/api/debug/macro`, `/api/cron/swarm`. Fonts in `app/layout.tsx` are Chakra Petch, Instrument Sans, and JetBrains Mono. A local `next build` of this tree lists those routes.

The earlier “do not edit `main`, the live source is only on Vercel” warning does not apply anymore. Editing `main` is what Vercel auto-deploys.

### What the app is

**Changed.** It is still a paper dashboard by default. It is no longer “nothing here sends an order to a broker.” `app/lib/brokers/binance.ts` and `app/lib/execution.ts` can send a spot market order and an OCO exit for BTC and ETH. See the section above for the switches.

Pages match the earlier table: Dashboard, Signals, Journal, Performance, Watchlist, Screener (`app/layout.tsx`).

The header badges are not all hard-coded anymore. **Changed:** “Execution” reads `executionMode()` (`app/layout.tsx`). “Jarvis” is “active” only when `ANTHROPIC_API_KEY` is set, and “offline” otherwise. It is still not a health check of Claude. **Still true:** “Swarm / 1000 agents” is a fixed label.

### Data map — Supabase

**Not re-checked** against the live database. Schema in git now has more than the three original tables.

| Earlier claim | Status |
| --- | --- |
| Tables are `watchlist`, `signals`, `trades` only | **Changed.** `supabase/schema.sql` and `supabase/migrations/20260705_orders_and_trade_mode.sql` add `trades.mode` (`paper` / `testnet` / `live`) and an `orders` audit table. Still no `settings`, screener, or prompts tables. |
| Client is the anon key from `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Still true.** `app/lib/supabase.ts`. `SUPABASE_SERVICE_ROLE_KEY` is in `.env.example` and is not referenced by app code. |
| RLS lets the anon key read and write every row for the fixed owner id | **Still true**, and it now covers `orders` as well (`supabase/schema.sql`). |
| Watchlist page can add a symbol but not edit, pause, or delete | **Still true.** `app/watchlist/actions.ts` only inserts. The page copy still says “Toggle active” (`app/watchlist/page.tsx`) and there is no toggle. |
| Approving a neutral signal opens a paper trade | **Still true** for paper. `approveSignal` does not reject `neutral`. Broker execution refuses non-bullish directions and stays paper (`app/lib/execution.ts`). |
| Scanner last wrote a signal on 24 July 2026; dashboard still shows old rows; the featured ask is the May LYC.AX note | **Not re-checked** (database). The code that would feature it is **still true**: the dashboard picks the pending signal with the highest conviction (`app/page.tsx`). |
| Company names on the watchlist (`CENTRUS`, `LIGHTBRIDGE`, `NUSCALE`) will not price | **Still true** as a data problem. The scanner skips a symbol when Yahoo returns nothing (`app/lib/prices.ts`). Not re-checked whether those rows are still there. |

### Hard-coded behaviour

| Earlier claim | Status |
| --- | --- |
| 1000 agents, archetype mix, `Math.random` jitter, sentence templates | **Still true.** `app/lib/mirofish.ts`. |
| Move ±2%, take-profit +5%, stop-loss −3% | **Still true.** `app/lib/constants.ts`, used by the scan cron and by the OCO prices. |
| BTC/ETH from Binance, everything else from Yahoo | **Still true.** `app/lib/prices.ts`. Public price reads use `api.binance.com` even when order execution is on the testnet. That is a price quote, not an order. |
| Theme dropdown and nav labels are code | **Still true.** `app/watchlist/WatchlistEditor.tsx`, `app/layout.tsx`. |
| Fixed owner uuid | **Still true.** `mirofish_owner()` in `supabase/schema.sql`. |
| FRED and StockTwits adapters | **Still true.** `app/lib/macroBias.ts`, `app/lib/socialBias.ts`. |
| `ANTHROPIC_API_KEY` is unused | **Fixed.** `app/api/jarvis/route.ts` calls Claude (`claude-opus-4-8`) when the key is set. |
| Kronos is not in the repository | **Fixed.** `mirofish/` (Python forecast and swarm) and `app/api/cron/swarm/route.ts`. The Kronos sentence in the signal table can now be produced by that route. The route is not on the Vercel cron schedule. |

### Things the earlier review could only see on the live site

| Earlier claim | Status |
| --- | --- |
| Screener sector lists are hard-coded, not in Supabase | **Still true**, and they are now in git. `app/lib/screener.ts` `SECTORS`. “My Watchlist” inside the screener is 12 hard-coded symbols, not the Supabase watchlist. |
| Consensus dial is the top pending conviction rescaled: `round((0.33 + 0.67 * conviction/100) * 100)`, agents = that percent × 10 | **Still true.** `app/page.tsx` (about lines 160–162 and 257–262). LYC conviction 72 still displays as 81% and 810 of 1000. |
| Agent ticker ids are a formula; fallback is `AGENT-0447` | **Still true.** `app/components/AgentWire.tsx`. |
| Macro / social chips poll `GET /api/debug/macro` every 60s | **Still true.** `app/page.tsx`. The route is public (`app/api/debug/macro/route.ts`). |
| Jarvis posts `{messages}` to `POST /api/jarvis` with no login | **Still true.** `app/components/JarvisChat.tsx`. Confirm is a chat message (“Yes, I confirm…”), which the model may turn into `approve_signal` with `confirm: true`. |
| Screener prices are fetched from Yahoo in the browser and stay `$--` because of CORS | **Changed.** This source fetches Yahoo and Binance on the server (`app/lib/screener.ts`, `app/api/screener/route.ts`). The browser calls `/api/screener` and `/api/chart` only (`app/screener/page.tsx`). The September console full of Yahoo CORS errors does not match this source. If prices are still empty, the cause is the server-side Yahoo call failing, not a browser CORS block. |
| `GET /api/chart` returned 404 `no data` for NVDA, BTC, and LYC.AX | **Not re-checked** live. The route exists and returns 404 when the history fetch fails (`app/api/chart/route.ts`). |

### Environment and feeds

| Earlier claim | Status |
| --- | --- |
| Supabase URL and anon key are required or `supabase.ts` throws at import | **Changed** in this pull request. The throw is now inside `supabase()`, on the first call that needs a client. Importing the module during `next build` no longer fails. A request that needs Supabase without the vars still gets that error. |
| Anon JWT is in the public JavaScript | **Still true.** That is normal for Supabase. It is dangerous here because the policies allow writes. |
| `CRON_SECRET` empty means the scan is allowed; the secret is also accepted as `?secret=` | **Still true** for both cron routes (`app/api/cron/scan/route.ts`, `app/api/cron/swarm/route.ts`). The earlier live check got 401, so production has the secret set. The code still fails open if the variable is removed. |
| Telegram checks the chat id only when `TELEGRAM_CHAT_ID` is set, and does not check a webhook secret | **Still true.** `app/api/telegram/route.ts`. |
| No `NEXT_PUBLIC_` secret other than the Supabase URL and anon key | **Still true.** Broker keys, `TRADING_API_SECRET`, `CRON_SECRET`, and `ANTHROPIC_API_KEY` are server-only. Do not add `NEXT_PUBLIC_` to any of them. |

### What looks real but is simulated, stale, or decorative

| Earlier claim | Status |
| --- | --- |
| “1000 agents” is a label and a formula, not a thousand models on each page load | **Still true.** The scanner does loop in `runSwarm` (`app/lib/mirofish.ts`) with random jitter. The dial does not re-run that loop. |
| “Jarvis active” is painted green | **Changed.** It tracks whether `ANTHROPIC_API_KEY` is set (`app/layout.tsx`). Still not a health check. |
| Consensus dial is a rescaled old conviction | **Still true.** |
| May LYC.AX / DRO.AX narratives and the Kronos BTC row are stored prose | **Not re-checked** (database). Kronos text can now be written by `/api/cron/swarm`. |
| Total P&L is the sum of each trade’s percent, so max drawdown can pass −100% | **Still true.** `app/page.tsx` (`totalPnl`) and `app/performance/page.tsx` (cumulative sum of `pnl`). |
| Prices are labelled US dollars, including ASX, LSE, and JSE | **Still true.** `formatUsd` in `app/journal/page.tsx`. Dashboard telemetry prefixes `$` (`app/page.tsx`). |
| Paper execution is labelled, and there is no plain disclaimer | **Still true** while execution is paper. There is still no “not financial advice” sentence in the app. The header can also say “Testnet” or “Armed · Live Capital · Binance” when those modes are on (`app/layout.tsx`). |

### How Damien can update data

**Still true.** Add a watchlist row on the site. Approve or ignore a signal on the site or, if the bot is set up, in Telegram. Everything else is the Supabase Table Editor (project ref `zmzvbppivxnyhcacxdxb`) or a code change.

**Still true, and do not do it in the browser:** the anon key can write. An agent should not use that key to edit production rows, and should not put the service role key in the client. This pass did not write to the database. No new SQL was applied. The existing migration file is still the one to run by hand if `trades.mode` / `orders` are not there yet: `supabase/migrations/20260705_orders_and_trade_mode.sql`.

The recommended admin page (Option A in the earlier review) is **not built**. Leave it for a later pull request, after login and row-level security. Options B and C are unchanged as ideas. Not applicable as work in this pull request.

### Enhancements the earlier review listed

| Item | Status |
| --- | --- |
| Put the live source in git | **Fixed** by the fast-forward onto `main`. |
| Ignore the May LYC.AX / DRO.AX signals in Supabase | **Not done.** Data change, out of scope. Not re-checked. |
| Fix name-like tickers; close duplicate open neutrals | **Not done.** Same reason. |
| Disclaimer and a login wall | **Not done.** Later pull request. |
| Proxy Yahoo on the server | **Changed.** Screener and chart routes already fetch on the server. Whether Yahoo answers is a separate operational question. |
| Show AUD / GBP / ZAR instead of `$` | **Still true** as a bug. Not done here. |
| Label the dial as a score | **Still true.** Not done here. |
| Auth and row-level security | **Still true.** This pull request only locks broker orders. Paper writes, Jarvis chat, and the debug route stay open. |
| Scanner looks stopped; Hobby cron may be daily | **Not re-checked.** `vercel.json` still schedules `*/15 * * * *`. On the Hobby plan that schedule does not run every 15 minutes. |
| P&L math | **Still true.** Not done here. |
| Signal quality (random jitter, almost all neutral) | **Still true** in `app/lib/mirofish.ts`. Not re-counted in the database. |
| Jest tests cannot run; no CI | **Changed.** `package.json` has `"test": "vitest run"`. `vitest.config.ts` runs `app/lib/risk.test.ts`, `app/lib/orderAuth.test.ts`, and `app/lib/brokers/**/*.test.ts`. `macroBias.test.ts` and `socialBias.test.ts` still call Jest and are excluded. No `.github` workflow. |
| `npm audit` critical Next.js advisory on 16.2.4 | **Still true** as a version pin. `package.json` is still `next` `16.2.4`. This pull request did not upgrade it. `npm ci` on 25 September still reported 1 critical and 7 high. |
| Homepage is prerendered; spinner never clears if the Supabase read throws | **Still true.** Build output marks `/` as static. `app/page.tsx` calls `setLoading(false)` only on success; the `catch` only logs. |

### Australia note

**Still true** as a product fact, not as legal advice. The site is public, speech is `en-AU` (`app/components/JarvisChat.tsx`), the clock is `en-AU` (`app/page.tsx`), and the copy can be read as a view on what to buy. There is still no disclaimer and no login. The earlier practical suggestion stands: if this is Damien’s private journal, put it behind a login before treating it as something other people use. That work is a later pull request.

### Phased plan

Phase 0 (recover the live source) is **done**. Phases 1–5 (lock writes, settings tables, `/admin`, scanners reading those tables, a five-line routine in the README) are **not started**, on purpose. This pull request is only the trading-safety gate, the build fix, and this note.

---

## New findings (not in the earlier review)

1. **Real orders were one env flag away, and the flag was easy to misread.** `BINANCE_TESTNET=false` meant production money. That is fixed in this pull request by `LIVE_TRADING_ENABLED`, which must be exactly `true` as well. See `liveTradingEnabled()` in `app/lib/brokers/binance.ts`.

2. **The order endpoints had no authentication.** `POST /api/jarvis` and `approveSignal` are still callable without a login. Broker orders now refuse unless `Authorization: Bearer $TRADING_API_SECRET` is present (`app/lib/orderAuth.ts`). Paper trades do not use that check. An unset secret means no broker order at all (fail closed). This is the opposite of the cron routes, which allow the call when `CRON_SECRET` is empty.

3. **`POST /api/jarvis` is an open bill and an open read.** Anyone can post a chat, which calls Anthropic, and the tools return open positions, pending signals, and performance (`app/api/jarvis/tools.ts`). The screener’s “Run swarm” button posts to the same route (`app/screener/page.tsx`).

4. **`GET /api/debug/macro`, `GET /api/screener`, and `GET /api/chart` have no auth.** They do not write orders. They do spend outbound calls to FRED, StockTwits, Yahoo, and Binance.

5. **`/api/cron/swarm` can spawn a process.** `execFile` runs `python3 -m mirofish.forecast_cli` (`app/api/cron/swarm/route.ts`). Arguments are passed as an array, not through a shell. If `CRON_SECRET` is unset, anyone can hit it. It is not on the Vercel schedule. The same fail-open auth as the scan cron applies.

6. **Turbopack warning.** `next build` warned that a dynamic filesystem path traced the whole project, import trace `next.config.ts` → `app/api/cron/swarm/route.ts`. The cause was `execFile` with a non-literal Python path (`KRONOS_PYTHON_BIN`). The default call is now the literal `"python3"`. The env override is marked `turbopackIgnore`. `next.config.ts` adds `outputFileTracingIncludes` so `mirofish/**` stays in that function’s bundle. A local `next build` no longer prints the warning. Behaviour when `KRONOS_PYTHON_BIN` is unset is the same command as before (`python3`).

7. **Preview builds crashed while collecting page data.** `app/lib/supabase.ts` threw at import if `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` was missing. `app/api/telegram/route.ts` (and the layout, via `execution.ts`) imported that module. Fixed by creating the client on first use. `next build` with those variables unset now completes.

8. **Telegram approve and the website approve are not the same trade.** The website goes through `executeEntry` (paper, testnet, or live). Telegram always inserts a paper row and does not set `mode`. A Telegram approve cannot open a Binance position. It can still mark a signal approved and insert a paper trade, including when `TELEGRAM_CHAT_ID` is empty.

---

## What the original author said about the swarm

Checked against `app/lib/mirofish.ts`, `app/lib/macroBias.ts`, `app/lib/socialBias.ts`, and the scan cron. Calls below were made from this environment on 25 September 2026. The live database was not queried.

### 1. Is the description accurate?

Mostly, for the scanner. A few parts are looser than the code.

What matches `runSwarm()`:

- It loops 1000 virtual agents. The mix is momentum 30%, contrarian 20%, macro 25%, sentiment 25% (`ARCHETYPE_MIX`). Rounding those shares lands on 300, 200, 250, and 250.
- Each agent adds `jitter()`, which is `Math.random()` in a range of ±0.2, then turns that into a bullish and a bearish probability with a sigmoid, then rolls `Math.random()` again to pick bullish, bearish, or neutral.
- The scanner (`app/api/cron/scan/route.ts`) passes a live price from `fetchPrice()`, the percent move since the last stored price, a macro number, and a social number.
- Macro is five FRED series, clamped to −1..+1: yield curve `T10Y2Y`, Chicago Fed financial conditions `NFCI`, VIX as series `VIXCLS` (not a series named `VIX`), EUR/USD `DEXUSEU`, and 10-year breakeven inflation `T10YIE`. If `FRED_API_KEY` is missing, each fetch returns null and `getMacroBias()` returns 0. It does not throw.
- Social is StockTwits messages for that symbol. The code intends to use a Bullish/Bearish tag, and otherwise count keywords. An HTTP error, a thrown request, or an empty message list becomes 0.

What the description skips:

- Momentum and contrarian agents never read FRED or StockTwits. They only see the price move, plus jitter. Macro agents are `0.6 * macro + 0.2 * trend + jitter`. Sentiment agents are `0.6 * social + 0.3 * trend + jitter`. Half the swarm ignores the two outside feeds entirely.
- The sigmoid outputs are multiplied by 0.85, so even a strong bias leaves about 15% of the roll as neutral before the 55% vote hurdle that decides the signal direction.
- Jarvis’s “run the swarm” tool does call `fetchPrice()`, but it then passes `pctChange: 0` (`app/api/jarvis/tools.ts`). That run is macro, social, and randomness, with no price move.
- StockTwits tags are not where the code looks. See below. The keyword list is the path that actually scores messages.
- The Kronos cron (`app/api/cron/swarm/route.ts`) is a different generator. It does not call `runSwarm()`.

### 2. Do FRED and StockTwits return data today?

**StockTwits: yes for US symbols and BTC, from this machine, with no API key.** At 03:41 UTC the public stream returned HTTP 200 and 30 messages for `NVDA`, `TSLA`, `AAPL`, `BTC`, `BTC.X`, and `ETH.X`. `DRO.AX` returned HTTP 404 “Symbol not found”, so an ASX symbol falls through to social bias 0.

The messages do carry sentiment, but on `entities.sentiment.basic` (`"Bullish"` / `"Bearish"`). The top-level `sentiment` field the code checks was null on every message sampled. Those tags are ignored. Every message is scored with the keyword list (`moon`, `buy`, `dump`, and so on). A normal sentence with no keyword counts as neutral. So the social number is a keyword skim, not StockTwits’ own tags. The public API is not locked from this environment.

The live site’s `GET /api/debug/macro` at 03:41 UTC returned `social_bias: 0.1666…` and `degraded: false`. That route averages StockTwits for TSLA and NVDA only. A non-zero value means production did get messages and the keyword score was not zero. It does not mean the tags were used.

**FRED: the series are still published. This app’s call is not showing a live reading.**

- No `FRED_API_KEY` is set in this environment. A request to `api.stlouisfed.org` without a key returned HTTP 400, “Variable api_key is not set.”
- The same five series are updating on the public FRED CSV (no key): VIXCLS through 22 Sep 2026 (14.21), T10Y2Y through 24 Sep (0.31), NFCI through 18 Sep (−0.555), DEXUSEU through 18 Sep (1.1464), T10YIE through 24 Sep (2.33).
- Production `GET /api/debug/macro` returned `macro_bias: 0` and `degraded: false`. `getMacroBias()` returns exactly 0, and does not throw, when the key is missing or every series comes back empty. The dashboard then has nothing to distinguish “the economy is neutral” from “FRED was not read.”
- Even with a key, the request uses `limit=1` and does not set `sort_order`. FRED’s default is `asc`, so `limit=1` is the oldest observation in the series, not the latest. A configured key would still not be “today’s” macro.

**If both outside numbers are 0, the scanner swarm is the price move plus randomness.** Momentum and contrarian were already only that. Macro agents collapse to `0.2 * trend + jitter`, sentiment agents to `0.3 * trend + jitter`. Nothing in the signal text says so. The failure is also easy to miss in the cron: `getMacroBias()` and `getSocialBias()` return 0 instead of throwing, so the `catch` blocks that force a 0 never run.

### 3. Does the UI say when an input fell back to 0?

**No.**

- The dashboard chips (`BiasChip` in `app/page.tsx`) print `+0%` in the same style as a real neutral reading. They do not read the `degraded` field, and that field is false anyway when the functions return 0 on purpose.
- `BiasIndicator` (`app/components/BiasIndicator.tsx`) can show “Neutral” for 0 and is not mounted on any page.
- The signal sentence (`buildSummary`) mentions the move and the conviction. It does not mention missing FRED or StockTwits data.
- Jarvis returns the swarm result and not a flag that an input was unavailable.

### Dormant since April, one logged trade

**The code does not say this, and it does not match the database snapshot already recorded.** This pass did not query Supabase. The 25 September review of the live database counted 155 signals and 53 trades (47 closed, 6 open), with the newest signal on 24 July 2026. That is a quiet scanner since late July, not a bot dormant since April with a single trade. There is no other trade log in the repo that contains one trade.

### Later change, not in this pull request

Label the dial as a **simulated score**, for example “Simulated vote, not 1000 analysts” or “Conviction score (price, plus randomness if macro and social are missing).” Keep the stored 0–100 next to it so a conviction of 72 is not shown as “810 of 1000 agents.”

When macro or social is the fallback 0, show **“input unavailable”** on that chip instead of `+0%`. The API should say which feed failed (no key, HTTP error, empty messages, symbol not on StockTwits). A real measured zero can stay `+0%`, with a different label, so a calm reading is not confused with a dead feed.

---

## Left for later pull requests

Do not treat this list as done.

- Supabase row-level security, so the anon key cannot insert or update, and a login wall.
- An `/admin` page for watchlist edits, signal text, and the hard-coded screener lists.
- Server-side price failures on the screener (the fetch moved server-side; empty cells are a separate bug if Yahoo still refuses).
- P&L as a sum of percents, currency symbols, stale high-conviction signals, and neutral approvals opening paper trades.
- A visible disclaimer.
- An honest label on the conviction dial (“simulated vote”, not “N of 1000 agents”), and an “input unavailable” chip when FRED or StockTwits fell back to 0. Do not show that fallback as `+0%`.
- Cron routes that fail open when `CRON_SECRET` is empty, and the `?secret=` query parameter.
- Auth on Jarvis reads, `/api/debug/macro`, and the Telegram webhook.

---

## What this pull request changed

- `LIVE_TRADING_ENABLED` must be `true` and `BINANCE_TESTNET` must be `false` before the adapter uses `https://api.binance.com`. Testnet remains the default.
- `executeEntry` calls `assertBrokerOrderAuthorized()` before `placeMarketOrder`. The caller must send `Authorization: Bearer $TRADING_API_SECRET`. Unset secret blocks every broker order. Paper approvals are unchanged when execution is off.
- `supabase()` throws only when a caller needs a client and the env vars are missing, so preview builds succeed.
- Swarm route: literal `python3` by default, so the Turbopack whole-repo trace warning is gone, with `mirofish/**` still included for that route.
- `.env.example` and the live-execution section of `README.md` match the new flags.

`npx vitest run`: 20 tests passed. `npx next build` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` unset: succeeded.
