# MiroFish Trader — Quick Start Guide

Get up and running with the multi-agent trading swarm in 10 minutes.

---

## Prerequisites

- Node.js >= 20 (check: `node --version`)
- npm >= 10 (check: `npm --version`)
- Git
- A text editor (VSCode recommended)

---

## Step 1: Clone & Setup

```bash
# Clone the repository
git clone https://github.com/deviecall-design/mirofish-trader.git
cd mirofish-trader

# Install dependencies (all workspaces)
npm install

# Copy environment template
cp .env.example .env
```

---

## Step 2: Configure Environment

Edit `.env` with your credentials:

```bash
# Open .env in your editor
vim .env
```

**Minimum required:**
```env
ANTHROPIC_API_KEY=sk-*** ← From Anthropic dashboard

ALPACA_API_KEY=P*** ← From Alpaca account
A...n

SWARM_NUM_AGENTS=3
SWARM_MODE=paper-trading
```

**For live trading (later):**
```env
ALPACA_BASE_URL=https://api.alpaca.markets  # (not sandbox)
ALPACA_PAPER_TRADING=false
SWARM_MODE=live-trading
```

---

## Step 3: Get API Keys

### Alpaca (US Stocks)
1. Visit: https://alpaca.markets/
2. Sign up (free account)
3. Go to: Dashboard → API Keys
4. Copy your **API Key** and **Secret Key** to `.env`

### Claude API (Anthropic)
1. Visit: https://console.anthropic.com
2. Sign up or log in
3. Go to: API Keys
4. Create new API key
5. Copy to `.env` as `ANTHROPIC_API_KEY`

---

## Step 4: Run in Paper Trading Mode (Safe!)

```bash
# Terminal 1: Start the swarm orchestrator
npm run dev:swarm
# Expected output: "Orchestrator listening on port 3001"

# Terminal 2: Start the agents
npm run dev:agent
# Expected output: "Agent 1 online", "Agent 2 online", "Agent 3 online"

# Terminal 3: Start the dashboard
npm run dev:dashboard
# Expected output: "Dashboard ready at http://localhost:3000"
```

---

## Step 5: Open Dashboard

Visit: **http://localhost:3000**

You should see:
- Portfolio balance (e.g., $100,000)
- 3 agents online
- Market data feed (SPY, QQQ, etc.)
- Empty positions (trading hasn't started yet)

---

## Step 6: Trigger First Trading Cycle

The swarm automatically analyzes markets every 60 seconds. To trigger manually:

```bash
# In swarm terminal, press Enter to force analysis
# Or wait 60 seconds for automatic cycle
```

Expected flow:
```
[Swarm] Fetching market data...
[Agent-1] Analyzing SPY...
[Agent-2] Analyzing QQQ...
[Agent-3] Analyzing IWM...
[Consensus] BUY SPY (2 votes)
[Consensus] SELL QQQ (rejected, 1 vote)
[Risk Manager] Approved: BUY SPY
[Broker] Executed: 10 shares SPY @ $450.25
[Portfolio] Updated: SPY +10
```

Watch your dashboard update in real-time!

---

## Step 7: View P&L

Dashboard shows:
- **Total P&L** — Cumulative profit/loss
- **Daily P&L** — Today's earnings
- **Agent P&L** — Each agent's contribution
- **Open Positions** — What you're holding

---

## Step 8: Stop Trading (Anytime)

```bash
# Terminal 1: Press Ctrl+C to stop swarm
# Terminal 2: Press Ctrl+C to stop agents
# Terminal 3: Press Ctrl+C to stop dashboard
```

---

## Next Steps

### 1. Backtest Your Strategy
```bash
npm run backtest -- --from 2023-01-01 --to 2024-01-01

# View results
npm run backtest:report
```

### 2. Add Custom Agent Strategy
See: `ARCHITECTURE.md` → "Adding a New Agent Strategy"

### 3. Add New Broker
See: `ARCHITECTURE.md` → "Adding a New Broker"

### 4. Go Live (Eventually)
- Run paper trading for at least 1 week
- Validate strategy performance
- Start with small capital ($1,000)
- Change `SWARM_MODE=live-trading` in `.env`
- Change broker endpoint from sandbox to production

---

## Troubleshooting

### "Cannot find module '@anthropic-ai/sdk'"
```bash
# Install dependencies properly
npm install

# Or reinstall a specific workspace
npm install --workspace=swarm
```

### "ANTHROPIC_API_KEY is undefined"
```bash
# Make sure .env file exists and has the key
cat .env | grep ANTHROPIC_API_KEY

# Should output: ANTHROPIC_API_KEY=sk-*** ← Make sure it's not empty
```

### "Alpaca API: Invalid credentials"
```bash
# Check your API key is correct
# Try logging into Alpaca dashboard manually
# Verify you're using the right endpoint (paper vs live)
```

### "No trades being executed"
```bash
# Check swarm logs for errors
tail -f logs/swarm-*.log

# Verify market data is loading
# SPY should have a price in the dashboard
```

---

## Paper Trading Tips

- **Don't risk real money yet** — Use paper trading for 1–4 weeks
- **Watch the logs** — Understand why agents make decisions
- **Adjust risk limits** — Start conservative, increase if confident
- **Monitor agent performance** — Which strategies work best?
- **Backtest improvements** — Before deploying new strategies

---

## Configuration Examples

### Conservative (Low Risk)
```env
SWARM_NUM_AGENTS=3
SWARM_RISK_LIMIT=5000
SWARM_POSITION_LIMIT=50000
SWARM_DAILY_LOSS_LIMIT=2500
```

### Moderate (Balanced)
```env
SWARM_NUM_AGENTS=3
SWARM_RISK_LIMIT=10000
SWARM_POSITION_LIMIT=100000
SWARM_DAILY_LOSS_LIMIT=5000
```

### Aggressive (High Risk — Not Recommended for Beginners!)
```env
SWARM_NUM_AGENTS=5
SWARM_RISK_LIMIT=20000
SWARM_POSITION_LIMIT=200000
SWARM_DAILY_LOSS_LIMIT=10000
```

---

## Useful Commands

```bash
# View logs in real-time
npm run logs:swarm
npm run logs:agents
npm run logs:dashboard

# Test broker connection
npm run test:broker

# Validate strategy on historical data
npm run backtest -- --strategy momentum

# Run all tests
npm test

# Format code
npm run format

# Check code quality
npm run lint
```

---

## Getting Help

- **Documentation:** See `ARCHITECTURE.md` for deep dives
- **Issues:** https://github.com/deviecall-design/mirofish-trader/issues
- **Discussions:** https://github.com/deviecall-design/mirofish-trader/discussions
- **Email:** hello@deviecall.com

---

## Safety Reminders

⚠️ **IMPORTANT**
- This is alpha software — Use at your own risk
- Always test with paper money first
- No financial advice — Consult a licensed advisor
- Past performance ≠ future results
- Markets can be volatile — Manage your risk

---

**Ready to trade? Start with Step 1 above!**
