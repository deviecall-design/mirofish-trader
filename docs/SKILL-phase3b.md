---
name: mirofish
description: Run MiroFish swarm intelligence simulations to predict stock market sentiment, investor behaviour, and macro event outcomes. Trigger whenever Damien says "run MiroFish", "simulate market reaction", "predict sentiment for", "MiroFish analysis", "swarm predict", "run a simulation on", or any phrase suggesting he wants to model how market participants might react to a financial event, news item, earnings release, or macro signal. Also trigger proactively when working on Eka Noe investment analysis and a market catalyst or event is identified that warrants sentiment simulation (e.g. Fed decision, DRO earnings, ASML supply chain disruption, BTC macro move). Always use this skill when MiroFish simulation would complement existing technical/fundamental analysis.
---

# MiroFish Skill — Swarm Intelligence for Market Prediction

MiroFish is an open-source multi-agent simulation engine that spawns thousands of AI agents (retail investors, analysts, institutional traders) and runs them through a simulated social environment to predict how market participants will *react and influence each other* in response to a financial event or signal.

This is not price prediction. It's **group behaviour forecasting** — a sentiment stress-test layer on top of your existing Eka Noe investment analysis.

---

## When to Use MiroFish vs. Eka Noe

| Use Case | Tool |
|----------|------|
| Technical price signals, watchlist status | Eka Noe |
| Macro news, earnings, policy impact on sentiment | **MiroFish** |
| Fed rate decisions, geopolitical events | **MiroFish** |
| DRO / ASML / NVDA / BTC catalyst analysis | **Both** |
| "How will retail vs institutional react?" | **MiroFish** |

---

## How MiroFish Works (Quick Reference)

1. **Seed input** — provide financial reports, news articles, earnings releases, or macro signals as PDF/MD/TXT files
2. **Ontology extraction** — LLM extracts entities, relationships, and stakeholders into a knowledge graph
3. **Agent generation** — hundreds of agents are created (retail investors, hedge funds, analysts, media) with distinct personalities and opinion biases
4. **Simulation** — agents interact on dual simulated platforms (Twitter-like + Reddit-like) in real-time rounds via OASIS engine
5. **Report generation** — ReportAgent synthesises sentiment shifts, tipping points, coalition dynamics, and confidence intervals
6. **Verdict** — Machine-readable `verdict.json` with prediction, confidence (0-1), key dynamics, and signals array

---

## Setup on Clawbot (Mac Mini)

### Installed Fork: `amadad/mirofish` (CLI-native)

Cloned to `/Users/aresopt13/mirofish`. This fork is **CLI-only** — no web UI. It uses your Claude Code subscription as the LLM provider.

**Setup (already completed):**
```bash
brew install uv
uv python install 3.12
git clone https://github.com/amadad/mirofish.git ~/mirofish
cd ~/mirofish
cp .env.example .env   # LLM_PROVIDER=claude-cli (default)
uv sync
ln -s /opt/homebrew/bin/claude /opt/homebrew/bin/claude-cli  # symlink for doctor check
uv run mirofish doctor  # all checks should pass
```

**Why this fork:**
- Full English translation of original 666ghj/MiroFish
- CLI-native — designed for Claude Code / agent invocation (no web server)
- Uses `claude-cli` as LLM provider (no separate API key needed)
- Local graph storage via JSON (no external cloud dependency)
- Accepts PDFs, markdown, and text as seed inputs
- Python 3.12 + uv for dependency management

### Environment Config

`.env` at repo root — only one variable matters:
```env
LLM_PROVIDER=claude-cli
```
Valid values: `claude-cli` (default, uses Claude Code subscription) or `codex-cli`.

### Alternative: `nikmcfly/MiroFish-Offline` (fully local, no API costs)

```bash
git clone https://github.com/nikmcfly/MiroFish-Offline.git
cd MiroFish-Offline
cp .env.example .env
docker compose up -d
docker exec mirofish-ollama ollama pull qwen2.5:32b
docker exec mirofish-ollama ollama pull nomic-embed-text
```

Opens web UI at `http://localhost:3000`

**Why this fork:** Completely local (Neo4j + Ollama). No API keys required. Higher VRAM demand (~32B model). Better for privacy-sensitive inputs. Has a web UI unlike the amadad CLI fork.

---

## CLI Usage

### Run a simulation
```bash
cd ~/mirofish
uv run mirofish run \
  --files seed_article.pdf market_brief.md \
  --requirement "How will ASX retail investors react to DroneShield winning a US DoD contract?" \
  --platform parallel \
  --json
```

**Options:**
- `--files` — one or more PDF/MD/TXT seed files (required)
- `--requirement` — plain-English simulation prompt (required)
- `--platform` — `parallel` (default, both Twitter+Reddit), `twitter`, or `reddit`
- `--max-rounds` — number of simulation rounds
- `--output-dir` — custom output directory
- `--json` — machine-readable output (suppresses Rich display)

### List past runs
```bash
uv run mirofish runs list --json
```
Returns slim summary: `run_id`, `status`, `created_at`, `artifact_count`.

### Get full run details
```bash
uv run mirofish runs status <run_id> --json
```

### Export run artifacts
```bash
uv run mirofish runs export <run_id> --json
```

### Diagnostics
```bash
uv run mirofish doctor
```

---

## Run Output Structure

Each run produces an immutable directory under `uploads/runs/<run_id>/`:

```
uploads/runs/<run_id>/
  manifest.json          # Run metadata
  inputs/                # Frozen copies of seed files
  graph/                 # Knowledge graph JSON
  simulation/            # OASIS simulation data
  report/
    report.md            # Full narrative report
    summary.json         # Structured summary
    verdict.json         # Machine-readable verdict (read this first)
  visuals/               # SVG snapshots (no browser needed)
  logs/                  # Run logs
```

**Key output: `verdict.json`** — prediction, confidence (0-1), key_dynamics, and signals array. Agents should read this first, then `summary.json`, then `report.md` only if deeper analysis needed.

---

## Financial Simulation Workflow

### Step 1 — Prepare Seed Material

Assemble a tight seed packet (2-4 documents max):

| Seed Type | Example for DRO |
|-----------|-----------------|
| News article | DRO earnings release or ASX announcement |
| Market brief | Sector context (defence tech, drone stocks) |
| Macro signal | Fed statement, AUD/USD move, geopolitical event |
| Analyst note | Broker report excerpt (paraphrased, not copied) |

**Quality rule:** Bounded + legible. Don't upload everything — give the system enough structure to build a coherent world.

### Step 2 — Write Your Requirement Prompt

Good examples for the watchlist:
- *"Predict market sentiment reaction to ASML reporting a 15% miss on EUV shipments"*
- *"How will retail and institutional investors react to DroneShield winning a US DoD contract?"*
- *"Simulate investor behaviour after a Fed surprise 50bp rate cut"*
- *"Predict BTC sentiment shift after a US spot ETF outflow event"*

### Step 3 — Interpret the Output

Read in this order:
1. `verdict.json` — quick machine-readable prediction + confidence
2. `summary.json` — structured executive summary
3. `report.md` — full narrative with sentiment trajectory, key influencers, alternative scenarios

---

## Integration with Eka Noe

MiroFish output can feed directly into your Eka Noe investment analysis:

1. **Eka Noe** identifies a catalyst or price signal on a watchlist stock
2. **MiroFish** simulates how market participants will react and form sentiment
3. Combined output: technical signal + behavioural overlay = higher conviction trade thesis

**Example integration prompt:**
> *"Eka Noe flagged DRO is approaching key resistance. Run MiroFish on today's ASX defence sector news to check if sentiment supports a breakout or fade."*

---

## Post-Run Auto-Delivery (Slack + Telegram)

After **every** MiroFish run completes, the agent MUST deliver the verdict summary to Damien via both Slack DM and Telegram. This is the default behaviour — do not skip unless Damien explicitly says "don't notify" or "skip delivery".

### Delivery Trigger

Fire the delivery sequence immediately after:
- `mirofish run ...` exits successfully (exit code 0)
- `verdict.json` and `summary.json` are readable in `uploads/runs/<run_id>/report/`

If the run fails, send a short failure notice to Slack only (not Telegram — keeps Telegram noise low).

### Message Template

```
🐟 MiroFish — <TICKER/TOPIC> Simulation Complete

Verdict: <1-sentence prediction from verdict.json>
Confidence: <confidence>  (e.g. 0.72)
Net direction: <positive | negative | mixed>

Top signals:
• <signal_1> — <direction> (<strength>)
• <signal_2> — <direction> (<strength>)
• <signal_3> — <direction> (<strength>)

Key dynamic: <first key_dynamic from verdict.json>

Run ID: <run_id>
Local report: ~/mirofish/uploads/runs/<run_id>/report/report.md

Not financial advice. For research only.
```

Keep total message ≤ 1500 chars so both Slack and Telegram render without truncation.

### Slack Delivery (MCP — confirmed available)

Use the Slack MCP `slack_send_message` tool. DM Damien directly.

```
slack_send_message
  channel: U0AKZ8L8119       # Damien Callaghan (damienc13@gmail.com)
  text: <message from template above>
```

If he specifies a different channel mid-conversation (e.g. a project channel), honour that for the current run only; revert to the DM ID as default next run.

### Telegram Delivery (reuses voice-bot config)

**Configured via direct Bot API.** Reuses credentials already provisioned for the Ares voice bot at `/Users/aresopt13/claude-ares/voice-bot/.env`:

```env
TELEGRAM_BOT_TOKEN=<bot token, shared with voice-bot>
ALLOWED_CHAT_IDS=<comma-separated; first entry = Damien's chat>
```

**Do not duplicate credentials.** Source them inline from voice-bot's `.env` at delivery time:

```bash
set -a
source /Users/aresopt13/claude-ares/voice-bot/.env
set +a

# First chat ID is Damien's primary
CHAT_ID="${ALLOWED_CHAT_IDS%%,*}"

curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d "chat_id=${CHAT_ID}" \
  --data-urlencode "text=$(cat /tmp/mirofish-verdict-msg.txt)" \
  > /dev/null
```

Notes:
- The `voice-bot/.env` file is gitignored — never commit it or echo its values back to the user.
- If `ALLOWED_CHAT_IDS` is empty, skip Telegram and note it in the Slack message.
- Telegram plain-text mode is fine for the verdict template; no need for MarkdownV2 escaping.

### Delivery Failure Handling

- If Slack send fails: retry once, then report failure inline in conversation
- If Telegram send fails: log and continue — don't block on Telegram
- Never abandon the verdict — at minimum, print the full summary to the conversation so Damien can see it

### Opt-Out

Damien can disable auto-delivery per-run by adding to his simulation request:
- *"don't notify"* / *"skip delivery"* / *"local only"*

For permanent opt-out, he can create `~/.mirofish/no-notify` (empty file) — agent checks for this before delivering.

---

## Important Caveats

- **MiroFish does not predict prices** — it models social/behavioural dynamics
- **No published benchmarks** yet comparing simulations to actual outcomes
- **Sensitivity to initial conditions** — small changes in seed material can shift outcomes
- **LLM agent behaviour != real human behaviour** — treat outputs as scenario stress-tests, not forecasts
- **Best used as an additional lens**, not a primary signal. Combine with Eka Noe technicals + fundamentals.
- Results are **plausible scenarios**, not probability estimates
- **camel-oasis==0.2.5 and camel-ai==0.2.78 are pinned** — upgrading either can break the simulation pipeline
- **Never delete `uploads/runs/`** — run artifacts are the product, each run is immutable

> Think of it as SimCity for investor sentiment — fascinating for "what if" exploration, not absolute foresight.

---

## Quick-Start Checklist

- [x] Clone `amadad/mirofish` on Clawbot (`~/mirofish`)
- [x] Install uv + Python 3.12
- [x] Set `LLM_PROVIDER=claude-cli` in `.env`
- [x] Run `uv sync` (131 packages installed)
- [x] Symlink `claude` -> `claude-cli`
- [x] Slack DM target confirmed: `U0AKZ8L8119` (Damien Callaghan)
- [x] Telegram Bot API: reuses `voice-bot/.env` (`TELEGRAM_BOT_TOKEN` + `ALLOWED_CHAT_IDS`)
- [x] `mirofish doctor` — all checks pass
- [ ] Run first test simulation with a DRO seed file
- [ ] Review verdict.json output
- [ ] Overlay findings into Eka Noe thesis for DRO

---

## FinceptTerminal Integration (June 2026)

### What is FinceptTerminal?

FinceptTerminal (v4.0.3+, C++20 native, Qt6) is a professional financial analysis platform with:
- **37 AI Investor Agents** — personality-driven archetypes (Buffett, Graham, Lynch, Munger, Klarman, Marks, etc.)
- **100+ Data Connectors** — Polygon, Kraken, FRED, Yahoo Finance, DBnomics, World Bank, government APIs, crypto exchanges, 16 broker integrations
- **Real-Time Trading** — crypto (Kraken/HyperLiquid WebSocket), equities, algo trading, paper trading engine
- **Multi-Asset Analytics** — DCF, portfolio optimization, VaR, Sharpe, derivatives pricing, fixed income, alternatives
- **QuantLib Suite** — 18 quantitative modules (pricing, risk, stochastic, volatility, fixed income)
- **Geopolitical Intelligence** — maritime tracking, relationship mapping, satellite data overlays
- **AI Quant Lab** — ML models, factor discovery, HFT, reinforcement learning trading

### MiroFish + FinceptTerminal Data Flow

Use FinceptTerminal as a **seed data aggregator** and **agent archetype provider** for MiroFish simulations:

#### 1. Export FinceptTerminal Market Context as MiroFish Seed

**Goal:** Seed MiroFish simulations with real-time market data and multi-source intelligence.

Steps:
1. Run FinceptTerminal analysis on your watchlist (DRO, NVDA, ASML, TSLA, BTC, ETH)
2. Export equity/crypto/macro context as JSON or markdown:
   ```bash
   # From FinceptTerminal UI: Data → Export → JSON/Markdown
   # Includes: latest price, technical metrics, broker sentiment, news feeds
   ```
3. Copy exported data to MiroFish seed directory:
   ```bash
   cp ~/Downloads/fincept-export-DRO.json ~/mirofish/seeds/
   ```
4. Run MiroFish simulation with FinceptTerminal export as seed:
   ```bash
   cd ~/mirofish
   uv run mirofish run \
     --files seeds/fincept-export-DRO.json \
     --requirement "Given DRO technical setup and current broker sentiment from FinceptTerminal, predict how ASX retail and institutional investors will react to upcoming earnings?" \
     --json
   ```

**Output:** Sentiment prediction + key tipping points informed by real-time data.

#### 2. Map FinceptTerminal Investor Agents → MiroFish Agent Pool

**Goal:** Seed MiroFish simulations with FinceptTerminal's 37 personality-driven investor archetypes.

FinceptTerminal's investor agents:
- **Value Investors:** Buffett, Graham, Lynch, Munger, Klarman, Marks, Dalio (consensus/contrarian layer)
- **Quant/Macro:** Druckenmiller, Soros, Renaissance (macro forecasting, sentiment shift)
- **Economic:** FOMC members, central bankers, geopolitical analysts (policy feedback loop)
- **Retail/Social:** Reddit traders, meme-stock communities, influencers (sentiment contagion)

**Integration approach:**
1. FinceptTerminal agents → MiroFish ontology mapping (JSON schema)
2. Each FinceptTerminal agent imports into MiroFish as an agent archetype with personality, bias profile, and trade thesis
3. Simulation runs with FinceptTerminal agents + MiroFish social networks → combined sentiment

Steps (future — requires MiroFish agent framework extension):
```bash
# Export FinceptTerminal agents to MiroFish format
cd ~/mirofish
uv run scripts/fincept-agent-bridge.py \
  --source ~/FinceptTerminal/agents/ \
  --target ./agents/fincept-archetypes/ \
  --format mirofish-compatible

# Run simulation with FinceptTerminal agent pool
uv run mirofish run \
  --files seeds/fincept-export-DRO.json \
  --agents agents/fincept-archetypes/ \
  --requirement "Simulate DRO earnings surprise with full FinceptTerminal investor archetype pool" \
  --json
```

#### 3. Real-Time Data Bridge (WebSocket)

**Future:** Stream FinceptTerminal real-time market data (via Kraken/HyperLiquid/broker APIs) into MiroFish simulations as they run:

```bash
# Start FinceptTerminal data stream server
cd ~/FinceptTerminal && ./FinceptTerminal --api-server --port 9090

# Connect MiroFish to live stream
cd ~/mirofish
uv run mirofish run \
  --fincept-live ws://localhost:9090/data \
  --requirement "Stream live BTC/ETH/DRO prices into sentiment simulation" \
  --json
```

### Data Formats & Tools

| Tool | Export Format | Use in MiroFish |
|------|---------------|----------------|
| FinceptTerminal | JSON (market data, agent opinions) | Seed files + agent archetypes |
| FinceptTerminal APIs | REST/WebSocket | Real-time feed (future) |
| FinceptTerminal QuantLib | Python modules | Analytics overlay |
| FinceptTerminal Data Connectors | Polygon/FRED/Kraken | Enrichment sources |

### Workflow: DRO Earnings Analysis with FinceptTerminal + MiroFish

1. **Open FinceptTerminal**
   - Load DRO equity research module
   - Run DCF model, technical analysis, broker sentiment aggregation
   - Export context: `~/Downloads/DRO-earnings-brief.json`

2. **Seed MiroFish**
   ```bash
   cd ~/mirofish
   uv run mirofish run \
     --files ~/Downloads/DRO-earnings-brief.json \
     --requirement "DRO reports 12% revenue growth but misses guidance. How will ASX retail traders, Buffett-style value investors, and geopolitical hedge funds react? Predict 7-day sentiment trajectory." \
     --json
   ```

3. **Interpret Verdict**
   - Read `verdict.json` (prediction + confidence)
   - Cross-reference with FinceptTerminal DCF valuation → thesis clarity
   - Combine with Eka Noe technical signals → trade thesis

4. **Deliver Results**
   - MiroFish sentiment verdict → Slack + Telegram
   - FinceptTerminal analysis snapshots → linked in report

### Setup Checklist

- [ ] Install FinceptTerminal v4.0.3+ on Clawbot (macOS arm64: `.dmg` installer)
- [ ] Verify FinceptTerminal data connectors are live (Polygon, Kraken, Yahoo Finance, etc.)
- [ ] Export sample DRO/BTC/ETH context from FinceptTerminal as JSON
- [ ] Add FinceptTerminal export directory to MiroFish seeds path
- [ ] Test: run MiroFish with FinceptTerminal seed on DRO
- [ ] Document custom agent mapping (Buffett → MiroFish archetype)
- [ ] Schedule weekly: FinceptTerminal analysis → MiroFish simulation on watchlist catalysts

---

## Macro + Sentiment Bias Integration (June 2026)

### Real-Time Market Context

As of June 2026, MiroFish swarm signals are powered by real market data from two sources:

**Macro Bias** (25% of swarm conviction):
- FRED economic indicators: Treasury yield spreads (T10Y2Y), financial conditions (NFCI), VIX, USD strength (DXY)
- Normalized to [−1, +1] scalar where −1 = risk-off, +1 = risk-on
- Updated hourly; reflects macro regime shifts, geopolitical risk, policy changes

**Social Bias** (25% of swarm conviction):
- StockTwits per-symbol sentiment: retail investor positioning and momentum
- Normalized to [−1, +1] scalar where −1 = max bearish, +1 = max bullish
- Updated every 5 minutes; reflects retail sentiment, meme stock dynamics, social contagion

### How Conviction Scores Work

The swarm conviction (0–100) is now driven by:
1. **Momentum agents** (30%): Recent price move + trend
2. **Contrarian agents** (20%): Fade large moves, seek reversals
3. **Macro agents** (25%): FRED data bias → macro regime alignment
4. **Sentiment agents** (25%): StockTwits bias → retail sentiment alignment

**Result:** High conviction = multiple agent archetypes agree AND macro/social context supports the signal.

### Example: DRO Signal

```
DRO bullish conviction 72/100
├─ Momentum: bullish (price +2.1% on volume spike)
├─ Macro: neutral (T10Y2Y inverted but VIX stable)
├─ Sentiment: bullish (StockTwits +68% bullish, 15 trending posts)
└─ Contrarian: split (RSI overbought, but trend intact)
→ Conviction 72: three archetypes aligned despite overbought technicals
```

### Limitations

- Macro data updates hourly (FRED); sentiment updates every 5 min (StockTwits)
- Real-time dashboard shows latest signal; historical signals frozen at conviction time
- Bias adapters degrade gracefully: if FRED API fails, macro bias → 0 (neutral)
- No predictive power — models investor *reaction*, not price movement

---

## Connected Tools Reference

| Task | Tool |
|------|------|
| Price/technical signal | Eka Noe (web_search + Crypto.com MCP) |
| Sentiment simulation | MiroFish (CLI, Clawbot at `~/mirofish`) |
| Market data aggregation | FinceptTerminal (native C++20 desktop app, 100+ connectors) |
| Real-time trading context | FinceptTerminal broker APIs (16 integrations) |
| Deep async research | Manus (via Zapier MCP) |
| News seed material | web_search |
| Report synthesis | Claude Ares (Finance & Investment agent) |
| Scheduling | Zapier (optional — trigger Eka Noe + MiroFish briefing) |
