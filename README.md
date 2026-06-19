# MiroFish Trader — Multi-Agent AI Trading Swarm

**Distributed trading intelligence powered by Claude + VibeTrade + MiroFish Swarm Orchestration**

---

## Overview

MiroFish Trader is a production-grade multi-agent trading platform that combines:

- **VibeTrade** — AI-powered trade execution engine (Claude-native)
- **MiroFish Swarm** — Orchestration layer for multi-agent coordination
- **Multi-Broker Support** — Alpaca, Interactive Brokers, Kraken, Zerodha
- **Real-Time Data** — Market feeds, sentiment analysis, technical indicators
- **Consensus Trading** — Agents vote on trade signals, execute coordinated positions

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              MiroFish Swarm Orchestrator                    │
│         (Agent coordination, consensus, risk mgmt)          │
└────┬──────────┬──────────┬──────────┬──────────────────────┘
     │          │          │          │
  ┌──▼──┐   ┌──▼──┐   ┌──▼──┐   ┌──▼──┐
  │Agent│   │Agent│   │Agent│   │Agent│
  │  1  │   │  2  │   │  3  │   │  N  │
  │(VT) │   │(VT) │   │(VT) │   │(VT) │
  └──┬──┘   └──┬──┘   └──┬──┘   └──┬──┘
     │         │         │         │
  ┌──▼────┐ ┌─▼──────┐ ┌─▼──────┐ ┌──▼────┐
  │Alpaca │ │   IB   │ │ Kraken │ │Zerodha│
  └───────┘ └────────┘ └────────┘ └───────┘
     │         │         │         │
     └────┬────┴────┬────┴────┬────┘
          │ Market Data │ Order Status │
          └──────────────────────────┘
```

### Components

| Component | Role | Technology |
|-----------|------|-----------|
| **Swarm Orchestrator** | Agent coordination, consensus, risk limits | TypeScript + MiroFish core |
| **Agent (VibeTrade)** | Trade analysis, order generation | Claude SDK + TypeScript |
| **Broker Adapter** | Multi-broker abstraction | Alpaca, IB, Kraken APIs |
| **Data Pipeline** | Real-time market data + indicators | Yahoo Finance, RSS, WebSocket |
| **Risk Manager** | Portfolio limits, position tracking, P&L | Swarm-wide ledger |
| **Dashboard** | Strategy monitoring, P&L visualization | Next.js + React |

---

## Features

### ✅ Multi-Agent Trading
- Each agent runs independent VibeTrade instance
- Agents specialize in different strategies (momentum, value, arbitrage, etc.)
- Swarm voting determines final trade execution
- Conflict resolution (prevents overlapping positions)

### ✅ AI-Driven Decision Making
- Claude analyzes market conditions per agent
- Each agent reasons independently
- Consensus emerges from multi-agent deliberation
- Explainable trade decisions (audit trail)

### ✅ Multi-Broker Execution
- Abstracted broker interface (adapter pattern)
- Alpaca (US stocks, options)
- Interactive Brokers (global markets, crypto)
- Kraken (crypto trading)
- Zerodha (NSE India)
- Easy to add more (Fidelity, etc.)

### ✅ Real-Time Monitoring
- Live portfolio P&L per agent
- Aggregate swarm P&L
- Risk metrics (drawdown, Sharpe, volatility)
- Order execution tracking
- Heartbeat monitoring (broker health)

### ✅ Event-Driven Triggers
- Market price alerts
- Technical indicator breaches
- News sentiment changes
- Portfolio rebalancing triggers
- Risk limit violations

### ✅ Backtesting
- Vitest-based test framework
- Historical data replay
- Strategy validation
- Performance metrics
- Drawdown analysis

---

## Getting Started

### Prerequisites
- Node.js >= 20
- GitHub account (for remote access)
- Broker API keys (Alpaca, IB, etc.)
- Claude API key (Anthropic)

### Installation

```bash
# Clone the repository
git clone https://github.com/deviecall-design/mirofish-trader.git
cd mirofish-trader

# Install dependencies
npm install

# Install broker adapters
npm install --save \
  @alpacahq/ts-sdk \
  ib-sdk \
  kraken-api \
  node-zerodha

# Setup environment
cp .env.example .env
# Edit .env with your broker API keys + Claude API key

# Start development
npm run dev:swarm      # Start swarm orchestrator
npm run dev:agent      # Start agent (in another terminal)
npm run dev:dashboard  # Start dashboard UI (port 3000)
```

### First Trade (Paper Money)
```bash
# 1. Configure Alpaca sandbox
ALPACA_ENDPOINT=https://paper-trading-api.alpaca.markets

# 2. Run swarm with single agent
npm run start:swarm -- --agents=1 --paper-trading

# 3. Watch dashboard at localhost:3000
# 4. Observe agent analyzing markets + generating trade ideas
# 5. Approve/reject trades manually
# 6. Monitor P&L in real-time
```

---

## Directory Structure

```
mirofish-trader/
├── swarm/                          # Orchestration layer
│   ├── src/
│   │   ├── orchestrator.ts        # Swarm controller
│   │   ├── agents/
│   │   │   ├── agent-pool.ts      # Agent lifecycle mgmt
│   │   │   └── consensus.ts       # Voting mechanism
│   │   ├── risk/
│   │   │   ├── portfolio-tracker.ts
│   │   │   ├── risk-limits.ts
│   │   │   └── p-and-l.ts
│   │   └── data/
│   │       ├── market-feed.ts
│   │       └── data-aggregator.ts
│   ├── package.json
│   └── tsconfig.json
│
├── adapters/                       # Broker abstraction layer
│   ├── alpaca/
│   │   ├── adapter.ts
│   │   ├── paper-trading.ts
│   │   └── live-trading.ts
│   ├── interactive-brokers/
│   ├── kraken/
│   └── zerodha/
│
├── vibetrade/                      # VibeTrade submodule
│   ├── backend/                    # Forked from vibetrade-ai/vibe-trade
│   ├── frontend/
│   └── package.json
│
├── dashboard/                      # Swarm monitoring UI
│   ├── app/
│   ├── components/
│   ├── public/
│   └── package.json
│
├── tests/                          # Integration + backtesting
│   ├── backtest.test.ts
│   ├── consensus.test.ts
│   └── broker-adapter.test.ts
│
├── docs/                           # Architecture + guides
│   ├── ARCHITECTURE.md
│   ├── INTEGRATION.md
│   ├── RISK-FRAMEWORK.md
│   └── BROKER-SETUP.md
│
├── .env.example
├── package.json
└── README.md
```

---

## Configuration

### `.env` Setup

```env
# Claude API
ANTHROPIC_API_KEY=sk-ant-...

# Alpaca (Paper Trading)
ALPACA_API_KEY=...
ALPACA_SECRET_KEY=...
ALPACA_BASE_URL=https://paper-trading-api.alpaca.markets

# Interactive Brokers
IB_ACCOUNT_ID=...
IB_CLIENT_ID=...
IB_HOST=localhost
IB_PORT=7497

# Kraken
KRAKEN_API_KEY=...
KRAKEN_PRIVATE_KEY=...

# Zerodha (NSE India)
ZERODHA_API_KEY=...
ZERODHA_ACCESS_TOKEN=...

# Swarm Config
SWARM_NUM_AGENTS=3
SWARM_MODE=paper-trading  # paper-trading | live-trading
SWARM_RISK_LIMIT=10000     # Max portfolio drawdown ($)
SWARM_POSITION_LIMIT=100000 # Max single position ($)
```

---

## Running the Swarm

### Development Mode
```bash
# Terminal 1: Start swarm orchestrator
npm run dev:swarm

# Terminal 2: Start agent(s)
npm run dev:agent

# Terminal 3: Start dashboard
cd dashboard && npm run dev
# Visit: http://localhost:3000
```

### Production Mode
```bash
# Build all components
npm run build

# Start swarm (with all agents)
npm run start:swarm

# Start dashboard
npm run start:dashboard
```

### Paper Trading (Sandbox)
```bash
# Run with Alpaca paper trading
npm run paper-trading
# All trades execute on sandbox, no real money at risk
```

### Backtesting
```bash
# Run strategy backtest
npm run backtest -- --strategy momentum --from 2023-01-01 --to 2024-01-01

# View results
npm run backtest:report
```

---

## Key Workflows

### 1. Adding a New Agent Strategy
```typescript
// swarm/src/agents/strategies/momentum.ts
export class MomentumAgent extends Agent {
  async analyzeMarket() {
    // Get last 50 days of OHLCV data
    // Calculate 20-day + 50-day moving averages
    // If price > both MAs → BUY signal
    // Send signal to swarm for consensus
  }
}
```

### 2. Adding a New Broker
```typescript
// adapters/your-broker/adapter.ts
export class YourBrokerAdapter implements BrokerAdapter {
  async placeOrder(order: Order) { ... }
  async getBalance() { ... }
  async getOpenPositions() { ... }
}

// swarm/src/swarm.ts
adapters.register('your-broker', new YourBrokerAdapter());
```

### 3. Configuring Risk Limits
```typescript
// swarm/src/risk/risk-limits.ts
const RISK_CONFIG = {
  maxDrawdown: 0.10,           // 10% portfolio drawdown
  maxPositionSize: 0.05,       // 5% per trade
  dailyLossLimit: 5000,        // Stop trading if lose $5k/day
  maxOpenPositions: 20,
  minPortfolioBalance: 10000,
};
```

---

## Integration with VibeTrade

MiroFish Trader extends VibeTrade with:

1. **Multi-Agent Coordination** — Each agent runs VibeTrade independently
2. **Consensus Voting** — Agents vote on trade signals before execution
3. **Shared Risk Management** — Portfolio-level limits across all agents
4. **Unified Data Pipeline** — Market data shared, not duplicated
5. **Distributed Ledger** — All trades tracked in master ledger

### VibeTrade Customizations

```typescript
// vibetrade/backend/src/adapters/mirofish-broker.ts
export class MiroFishBrokerAdapter extends BrokerAdapter {
  // Instead of executing trades immediately,
  // send signal to swarm for consensus voting
  async placeOrder(order: Order) {
    return this.swarmOrchestrator.proposeOrder(order);
  }
}
```

---

## Testing

```bash
# Unit tests
npm run test

# Integration tests (with paper trading)
npm run test:integration

# Backtesting
npm run test:backtest

# Coverage report
npm run test:coverage
```

---

## Monitoring & Dashboards

### Real-Time Dashboard (http://localhost:3000)
- Live portfolio P&L per agent
- Aggregate swarm performance
- Open positions + risk metrics
- Order execution log
- Market data feed

### Grafana Integration (Optional)
- Time-series metrics (P&L, Sharpe, drawdown)
- Alert rules (risk breaches)
- Historical performance trends

---

## Risk Management

### Portfolio Risk Limits
- Max drawdown per day: 10%
- Max single position: 5% of portfolio
- Max open positions: 20
- Min required balance: $10,000

### Circuit Breakers
- Stop all trading if daily loss > $5,000
- Pause agent if 3+ consecutive losing trades
- Alert if portfolio correlation > 0.8 (concentration)

### Position Reconciliation
- Broker API called every 30 seconds
- P&L marked-to-market continuously
- Mismatch detection + alerts

---

## Security

- ✅ API keys encrypted in `.env` (never committed)
- ✅ Two-factor auth on broker accounts
- ✅ Order confirmation before execution (manual review mode)
- ✅ IP whitelisting on broker accounts
- ✅ Rate limiting on API calls
- ✅ Audit log of all trades (immutable)

---

## Roadmap

### Phase 1: Foundation (Complete)
- [x] Swarm orchestrator core
- [x] VibeTrade integration
- [x] Alpaca adapter
- [x] Basic dashboard

### Phase 2: Multi-Broker (In Progress)
- [ ] Interactive Brokers adapter
- [ ] Kraken crypto support
- [ ] Zerodha NSE India
- [ ] Risk management improvements

### Phase 3: Advanced Features (Planned)
- [ ] Options trading
- [ ] Margin trading
- [ ] Short selling
- [ ] Derivatives (futures, swaps)
- [ ] Portfolio optimization (Markowitz)

### Phase 4: Scale (Q3-Q4 2026)
- [ ] Institutional broker integration
- [ ] Smart order routing
- [ ] Execution analytics
- [ ] ML-based agent optimization

---

## Support & Contributing

### Issues
Report bugs via GitHub Issues: https://github.com/deviecall-design/mirofish-trader/issues

### Contributing
1. Fork the repo
2. Create feature branch (`git checkout -b feature/your-feature`)
3. Commit changes (`git commit -am 'Add feature'`)
4. Push to branch (`git push origin feature/your-feature`)
5. Open Pull Request

### Code of Conduct
Be respectful, collaborative, and professional.

---

## License

MIT License — See LICENSE file for details

---

## Disclaimer

**This is alpha software.** Use paper trading first. No financial advice. Trade at your own risk. Always validate with a licensed advisor.

---

## Contact

- **Issues:** GitHub Issues
- **Discussions:** GitHub Discussions
- **Email:** hello@deviecall.com

---

**Built with ❤️ by Deviecall Design**
