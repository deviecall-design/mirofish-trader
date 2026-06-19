# MiroFish Trader — Architecture & Integration Guide

**Technical deep-dive into swarm orchestration, agent coordination, and VibeTrade integration**

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────┐
│           Market Data Pipeline                      │
│  (Yahoo Finance, RSS, Broker WebSockets, Indicators)
└────────────┬──────────────────────────────┬────────┘
             │                              │
    ┌────────▼─────────────────────────────▼──────┐
    │     MiroFish Swarm Orchestrator              │
    │  ┌──────────────────────────────────────┐   │
    │  │ Agent Pool Manager (3–N agents)      │   │
    │  └──────────────────────────────────────┘   │
    │  ┌──────────────────────────────────────┐   │
    │  │ Consensus Engine (voting mechanism)  │   │
    │  └──────────────────────────────────────┘   │
    │  ┌──────────────────────────────────────┐   │
    │  │ Risk Manager (limits, P&L, tracking) │   │
    │  └──────────────────────────────────────┘   │
    │  ┌──────────────────────────────────────┐   │
    │  │ Order Executor & Settlement          │   │
    │  └──────────────────────────────────────┘   │
    └─────────┬─────────────────────────────┬─────┘
              │                             │
    ┌─────────▼────────────┬──────────────▼──────┐
    │   Agent 1 (VibeTrade)│   Agent N (VibeTrade)
    │   Strategy: Momentum │   Strategy: Value
    │   Broker: Alpaca     │   Broker: IB
    └─────────┬────────────┴──────────────┬──────┘
              │                           │
    ┌─────────▼─────────────────────────▼──────┐
    │      Broker Adapter Layer                │
    │  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
    │  │ Alpaca   │ │ IB       │ │ Kraken   │ │
    │  └──────────┘ └──────────┘ └──────────┘ │
    └──────────────────────────────────────────┘
              │         │         │
         ┌────▼─┐  ┌────▼─┐  ┌───▼──┐
         │Stock │  │Global│  │Crypto│
         │ Mkt  │  │ Mkt  │  │ Mkt  │
         └──────┘  └──────┘  └──────┘
```

---

## Core Components

### 1. Swarm Orchestrator (`swarm/src/orchestrator.ts`)

**Responsibility:** Coordinate agents, manage consensus, enforce risk limits

```typescript
class SwarmOrchestrator {
  agents: Agent[] = [];
  riskManager: RiskManager;
  consensusEngine: ConsensusEngine;
  ledger: TradeLogEntry[] = []; // Immutable trade record
  
  async startTradingCycle() {
    // 1. Fetch market data
    const marketData = await this.getMarketData();
    
    // 2. Each agent analyzes independently
    const signals = await Promise.all(
      this.agents.map(agent => agent.analyze(marketData))
    );
    
    // 3. Consensus voting
    const trades = await this.consensusEngine.vote(signals);
    
    // 4. Risk check
    const approved = await this.riskManager.approve(trades);
    
    // 5. Execute approved trades
    const results = await this.executeOrders(approved);
    
    // 6. Log + update portfolio
    this.ledger.push(...results);
    this.updatePortfolio(results);
  }
}
```

### 2. Agent (VibeTrade Instance)

**Responsibility:** Independent market analysis + trade signal generation

```typescript
class Agent {
  id: string;
  vibeTrade: VibeTrade;  // Forked VibeTrade instance
  strategy: Strategy;     // Momentum, Value, Growth, etc.
  broker: BrokerAdapter;
  
  async analyze(marketData: MarketData) {
    // 1. Feed market data to Claude
    const analysis = await this.vibeTrade.analyzeMarket(marketData);
    
    // 2. Generate trade signals
    const signals = analysis.map(analysis => ({
      symbol: analysis.ticker,
      action: analysis.recommendation,  // BUY, SELL, HOLD
      confidence: analysis.confidence,  // 0–1
      reasoning: analysis.reasoning,
    }));
    
    return signals;
  }
}
```

### 3. Consensus Engine (`swarm/src/agents/consensus.ts`)

**Responsibility:** Aggregate agent signals → Final trade decisions

```typescript
class ConsensusEngine {
  // Voting rules:
  // - BUY if >= 2 agents agree
  // - SELL if >= 2 agents agree
  // - HOLD otherwise
  // - Weight votes by agent confidence
  
  async vote(signals: Signal[][]) {
    const results = [];
    
    for (const symbol of this.getAllSymbols(signals)) {
      const votes = signals
        .filter(s => s.symbol === symbol)
        .map(s => ({ action: s.action, confidence: s.confidence }));
      
      const decision = this.tallyVotes(votes);
      
      if (decision.consensus >= 0.66) {  // 66% threshold
        results.push({
          symbol,
          action: decision.action,
          strength: decision.consensus,
        });
      }
    }
    
    return results;
  }
}
```

### 4. Risk Manager (`swarm/src/risk/`)

**Responsibility:** Portfolio risk tracking, limit enforcement, P&L calculation

```typescript
class RiskManager {
  portfolio: Portfolio;
  limits: RiskLimits = {
    maxDrawdown: 0.10,           // 10%
    maxPositionSize: 0.05,       // 5% per trade
    dailyLossLimit: 5000,        // $5k
    maxOpenPositions: 20,
  };
  
  async approve(trades: Trade[]): Promise<Trade[]> {
    const approved = [];
    
    for (const trade of trades) {
      const projectedPortfolio = this.portfolio.project(trade);
      
      if (this.isWithinLimits(projectedPortfolio)) {
        approved.push(trade);
      } else {
        console.warn(`Trade rejected: ${trade.symbol} breaches limits`);
      }
    }
    
    return approved;
  }
  
  private isWithinLimits(portfolio: Portfolio): boolean {
    const drawdown = (portfolio.initialBalance - portfolio.balance) / portfolio.initialBalance;
    const largestPosition = portfolio.positions.reduce((max, p) => 
      Math.max(max, p.value / portfolio.balance), 0);
    const todayLoss = portfolio.todayPnL;
    
    return (
      drawdown <= this.limits.maxDrawdown &&
      largestPosition <= this.limits.maxPositionSize &&
      todayLoss >= -this.limits.dailyLossLimit &&
      portfolio.positions.length <= this.limits.maxOpenPositions
    );
  }
}
```

### 5. Broker Adapter Layer

**Responsibility:** Unified interface for multi-broker execution

```typescript
abstract class BrokerAdapter {
  abstract placeOrder(order: Order): Promise<OrderResult>;
  abstract getBalance(): Promise<Balance>;
  abstract getOpenPositions(): Promise<Position[]>;
  abstract getOrderStatus(orderId: string): Promise<OrderStatus>;
  abstract cancelOrder(orderId: string): Promise<void>;
}

// Concrete implementations
class AlpacaAdapter extends BrokerAdapter { ... }
class InteractiveBrokersAdapter extends BrokerAdapter { ... }
class KrakenAdapter extends BrokerAdapter { ... }
```

---

## VibeTrade Integration

### How VibeTrade Fits Into the Swarm

VibeTrade is **forked** and customized as follows:

```
vibetrade/                        (Submodule)
├── backend/
│   ├── src/
│   │   ├── server.ts            (Modified: no direct execution)
│   │   ├── adapters/
│   │   │   ├── mirofish.ts      (NEW: MiroFish consensus bridge)
│   │   │   └── [other brokers]  (Disabled in swarm mode)
│   │   ├── strategies/
│   │   │   ├── momentum.ts
│   │   │   ├── value.ts
│   │   │   └── [custom strategies]
│   │   └── claude-client.ts      (Claude analysis engine)
│   └── package.json
└── [frontend unchanged]
```

### Key Modifications to VibeTrade

**1. Disable Direct Trade Execution**
```typescript
// vibetrade/backend/src/adapters/mirofish.ts
class MiroFishAdapter extends BrokerAdapter {
  async placeOrder(order: Order) {
    // Instead of executing immediately,
    // send to swarm for consensus + risk check
    return this.mirofish.proposeOrder({
      agentId: this.agentId,
      symbol: order.symbol,
      quantity: order.quantity,
      price: order.price,
      side: order.side,
      reasoning: order.reasoning,
    });
  }
}
```

**2. Enable Multi-Agent Strategies**
```typescript
// Each agent specializes
Agent 1: Momentum (short-term momentum trades)
Agent 2: Value (fundamental analysis + deep dives)
Agent 3: Growth (tech stocks, high growth)
Agent N: Custom strategy (user-defined)
```

**3. Shared Market Data Pipeline**
```typescript
// Avoid redundant API calls
MarketDataCache (shared across agents)
  ├── Yahoo Finance (historical OHLCV)
  ├── RSS Parser (news sentiment)
  ├── WebSocket feeds (real-time quotes)
  └── Custom indicators (RSI, MACD, Bollinger Bands)
```

---

## Data Flow: From Market to Trade

### Step-by-Step Execution

```
1. MARKET DATA INGEST
   ├─ Yahoo Finance: 1-min OHLCV for tracked symbols
   ├─ RSS feeds: News + earnings updates
   └─ WebSocket: Real-time broker quotes
   │
   └─> MarketDataCache (shared, 30-sec refresh)

2. AGENT ANALYSIS
   ├─ Agent 1 analyzes with Claude
   │  └─> "SPY momentum is strong, RSI > 70"
   ├─ Agent 2 analyzes with Claude
   │  └─> "QQQ trading 2% below fair value"
   └─ Agent N analyzes with Claude
      └─> "[custom analysis]"

3. SIGNAL GENERATION
   ├─ Agent 1: BUY SPY (confidence: 0.85)
   ├─ Agent 2: BUY QQQ (confidence: 0.72)
   └─ Agent N: HOLD (confidence: 0.60)

4. CONSENSUS VOTING
   ├─ Tally votes: BUY appears 2× (consensus ≥ 66%)
   ├─ SELL appears 0× (rejected)
   └─ HOLD appears 1× (low confidence, rejected)

5. RISK EVALUATION
   ├─ Portfolio impact: SPY → 4.5% of portfolio ✓
   ├─ QQQ → 3.8% of portfolio ✓
   ├─ Drawdown impact: +0.2% max ✓
   └─ All trades APPROVED

6. EXECUTION (Multi-Broker)
   ├─ Route SPY → Alpaca (best execution)
   ├─ Route QQQ → IB (lowest fees)
   └─ Monitor fills in real-time

7. SETTLEMENT & LOGGING
   ├─ Update portfolio
   ├─ Calculate P&L
   ├─ Write to immutable ledger
   └─ Broadcast dashboard update
```

---

## Risk Framework

### Portfolio Risk Limits

```
Daily Risk Budget: $10,000
├─ Max single trade loss: $500
├─ Max cumulative daily loss: $5,000
├─ Max overnight exposure: 30% of portfolio
└─ Emergency stop: Loss > $10,000

Position Sizing:
├─ Kelly Criterion: f* = (p × b - q) / b
│  where: p = win rate, q = loss rate, b = avg win/loss ratio
├─ Max position: 5% of portfolio
└─ Min position: $100 (or minimum lot size per broker)

Concentration Risk:
├─ No sector > 25% of portfolio
├─ No single stock > 10%
├─ Min number of positions: 5 (diversification)
└─ Max correlation between top 2 holdings: 0.7
```

### Circuit Breakers

```
Level 1 (Yellow): Loss > 5%
  └─> Reduce position sizes by 50%

Level 2 (Orange): Loss > 7.5%
  └─> Stop taking new positions

Level 3 (Red): Loss > 10% OR Daily loss > $5,000
  └─> HALT ALL TRADING
```

---

## Testing Strategy

### Unit Tests (Vitest)
```bash
npm run test

# Tests:
# - Consensus voting logic
# - Risk calculations
# - Broker adapter interfaces
# - Order placement + settlement
```

### Integration Tests (Paper Trading)
```bash
npm run test:integration

# Tests:
# - Full trading cycle (market data → signal → execution)
# - Multi-agent coordination
# - Risk limit enforcement
# - P&L calculation accuracy
```

### Backtesting
```bash
npm run backtest -- --from 2023-01-01 --to 2024-01-01

# Outputs:
# - Total return + Sharpe ratio
# - Max drawdown
# - Win rate
# - Avg trade duration
# - Slippage analysis
```

---

## Monitoring & Observability

### Metrics Exported

```
Portfolio Metrics:
  - Total P&L ($)
  - Return (%)
  - Sharpe ratio
  - Max drawdown (%)
  - Win rate (%)

Per-Agent Metrics:
  - Agent ID
  - Trades executed
  - Win rate
  - P&L contribution
  - Strategy performance

Market Metrics:
  - SPY / QQQ price
  - VIX (volatility)
  - Market regime (bullish / bearish / sideways)

Risk Metrics:
  - Portfolio concentration (%)
  - Sector exposure
  - Hedge ratio (long vs short)
  - Current drawdown
```

### Dashboard (http://localhost:3000)
- Real-time P&L chart
- Agent performance table
- Open positions heatmap
- Order execution log
- Risk limit status
- Market data feed

---

## Deployment

### Development
```bash
npm run dev:swarm      # Port 3001
npm run dev:agent      # Port 3002
npm run dev:dashboard  # Port 3000
```

### Staging (Paper Trading)
```bash
npm run build
npm start:swarm -- --mode paper-trading
npm start:dashboard
# Use Alpaca sandbox endpoint
```

### Production (Live Trading)
```bash
npm run build
npm start:swarm -- --mode live-trading
npm start:dashboard
# Real money (careful!)
```

---

## Troubleshooting

### Agent Not Producing Signals
- [ ] Check Claude API key in `.env`
- [ ] Verify market data pipeline (Yahoo Finance accessible?)
- [ ] Check agent logs: `logs/agent-*.log`

### Trades Rejected by Risk Manager
- [ ] Check current portfolio value
- [ ] Verify max position size calculation
- [ ] Check daily loss limit

### Order Stuck in "PENDING"
- [ ] Verify broker connectivity
- [ ] Check broker API rate limits
- [ ] Confirm order still exists on broker (reconciliation)

### P&L Mismatch
- [ ] Broker API marked prices may differ
- [ ] Transaction fees not included?
- [ ] Check ledger for all fills

---

## Security Checklist

- [ ] API keys in `.env` (never committed)
- [ ] `.env.local` in `.gitignore`
- [ ] Two-factor auth enabled on all broker accounts
- [ ] IP whitelisting on broker API
- [ ] Order confirmation enabled before execution
- [ ] Rate limiting enforced (avoid API throttling)
- [ ] Audit log immutable (no deletions)
- [ ] Encrypted connection to brokers (HTTPS/TLS)

---

## Next Steps

1. **Set up Alpaca account** (paper trading first)
2. **Configure `.env`** with broker API keys
3. **Run backtesting** with historical data
4. **Deploy on staging** with paper money
5. **Monitor for 1 week** before going live
6. **Start with small position sizes** (1% of capital)

---

**Architecture v1.0 — Subject to change as swarm evolves**
