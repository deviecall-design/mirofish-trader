# Mirofish Dashboard Elevation — Phase 5 Specification
**Goal:** Transform dashboard from signal-feed into intelligent investment decision system  
**Timeline:** 3 weeks (10h Phase 5 + integration work)  
**Owner:** Damien (Manus designs UI, you implement components)

---

## Vision: Jarvis-Style Investment Dashboard

**Before:** Feed of bullish/bearish signals  
**After:** "Here are your top 5 investments to activate today, with reasoning, risks, and stress-test results."

### Key Transformations
1. **Signal Ranking** — Identify actionable opportunities (Echo consensus framework)
2. **Risk Intelligence** — Show what could go wrong + early warnings (Ember patterns)
3. **Multi-Factor Scoring** — Score investments 6 ways, not just trend (ElectraScan approach)
4. **Scenario Testing** — Portfolio outcomes under macro shocks (MiroFish scenarios)
5. **Investment Thesis** — Why buy this? (OpenClaw RAG + Claude)
6. **Daily Narrative** — Auto-generated summary + journal (Claude Ares)

---

## Dashboard Layout (5 Sections)

### 1. Portfolio Health (Top Banner)
```
┌─────────────────────────────────────────────────┐
│ PORTFOLIO HEALTH                                │
├─────────────────────────────────────────────────┤
│ Overall Signal: BULLISH (78% conviction)        │
│ Last 24h: 14 signals | 7-day trend: UP 3 days  │
│ ⚠️ Warnings: 1 conviction decay | 1 regime shift│
│ Scenario Test: Rate shock = -8% portfolio      │
└─────────────────────────────────────────────────┘
```

**Data Source:** Orchestrator + Ember warnings + scenario engine

**Components:**
- `<PortfolioHealthCard />` — Conviction + trend chart
- `<WarningBanner />` — Critical alerts (red if conviction collapsing)
- `<ScenarioQuickTest />` — Rate shock scenario at a glance

---

### 2. Key Investments to Activate (Hero Section)
```
┌─────────────────────────────────────────────────┐
│ KEY INVESTMENTS TO ACTIVATE (Top 5)             │
├─────────────────────────────────────────────────┤
│ 1. HE1.L — Helium shortage thesis               │
│    └─ Swarm: 82% bullish (macro/momentum)       │
│    └─ Rank: #1 (valuation + macro tailwind)     │
│    └─ Risk: Binary tech breakthrough            │
│    └─ [Open Position] [Add More] [Deep Dive]    │
│                                                 │
│ 2. ASML — Semiconductor secular trend           │
│    └─ Swarm: 78% bullish (momentum + macro)     │
│    └─ Rank: #2 (momentum aligned + growth)      │
│    └─ Risk: Policy/tariff disruption            │
│    └─ [Open Position] [Add More] [Deep Dive]    │
│                                                 │
│ [Show 3 more] [Create New Signal] [Edit Rank]   │
└─────────────────────────────────────────────────┘
```

**Data Source:** Orchestrator (signals) + Consensus framework + Scoring engine

**Components:**
- `<InvestmentCard />` — Symbol, archetype breakdown, rank, risk, actions
- `<ConvictionBadge />` — "High / Medium / Low" (Echo-style)
- `<ThesisQuickView />` — Expandable "Why this is ranked #1?"
- `<RiskIndicator />` — What could go wrong

**Key Feature:** Click [Deep Dive] → expands to full analysis (section 4)

---

### 3. Signals History + Trends (Secondary)
```
┌─────────────────────────────────────────────────┐
│ SIGNALS HISTORY & TRENDS                        │
├─────────────────────────────────────────────────┤
│ [Last 7 Days] [Last 30 Days] [YTD]              │
│                                                 │
│ Conviction Trend ────────────────┐              │
│                                ↗︎ 78%            │
│ [Line chart: 7-day rolling avg]                 │
│                                                 │
│ Archetype Breakdown (7-day):                    │
│ Momentum: 35% | Macro: 28% | Sentiment: 22%    │
│                                                 │
│ [Export Journal] [Stress Test] [Notes]          │
└─────────────────────────────────────────────────┘
```

**Data Source:** Historical signals from Supabase + aggregates

**Components:**
- `<ConvictionTrendChart />` — 7/30-day rolling conviction
- `<ArchetypeBreakdownChart />` — Radar or stacked bar
- `<SignalsTable />` — Last 20 signals with filters
- `<JournalExport />` — Export to markdown/PDF

---

### 4. Deep Dive: Single Investment Analysis
```
┌─────────────────────────────────────────────────┐
│ ASML — Semiconductor Leadership                 │
├─────────────────────────────────────────────────┤
│ PRICE: $245 | 7-day: +3.2% | 52-week: +28%    │
│ SWARM SIGNAL: 78% Bullish | Conviction: 82     │
│                                                 │
│ [ARCHETYPE BREAKDOWN]                          │
│ Momentum:    78% bullish (18% bearish)          │
│ Macro:       76% bullish (trend support)        │
│ Sentiment:   71% bullish (tech optimism)        │
│ Contrarian:  45% bullish (some dissent)         │
│                                                 │
│ [INVESTMENT THESIS]                             │
│ \"Secular AI/semiconductor uptrend + Fed       │
│  accommodation. ASML is the chokepoint for      │
│  chip supply. Strong institutional demand.\"     │
│                                                 │
│ [RISK ANALYSIS]                                 │
│ • Tariff shock: -15% if US-China escalate      │
│ • Valuation: P/E 35x (premium to sector)       │
│ • Execution: Supply chain still fragile        │
│                                                 │
│ [SCENARIO OUTCOMES]                             │
│ Soft Landing (+12): Target $315 (+28%)         │
│ Rate Shock (-8): Target $195 (-20%)             │
│ Credit Crisis (-15): Target $155 (-37%)        │
│                                                 │
│ [POSITION ACTIONS]                              │
│ [Open 5% Position] [Add 2%] [Set Alert] [Exit] │
└─────────────────────────────────────────────────┘
```

**Data Source:** Signals + Echo consensus + ElectraScan scoring + MiroFish scenarios + OpenClaw thesis

**Components:**
- `<SymbolHeader />` — Price, technicals, time series
- `<ArchetypeBreakdown />` — Polar chart or bars
- `<ThesisPanel />` — Generated from OpenClaw + Claude
- `<RiskMatrix />` — Risk × impact matrix
- `<ScenarioComparison />` — 3–4 macro scenarios with outcomes
- `<PositionManager />` — Quick action buttons

---

### 5. Scenario Playbook (Planning)
```
┌─────────────────────────────────────────────────┐
│ SCENARIO PLAYBOOK                               │
│ \"What if the Fed cuts 50bps? What do I do?\"  │
├─────────────────────────────────────────────────┤
│ [Soft Landing] [Rate Cut] [Rate Shock] [Recession]
│                                                 │
│ RATE CUT SCENARIO                               │
│ ├─ Portfolio return: +12%                       │
│ ├─ Best positions: TSLA (+28%), ASML (+20%)    │
│ ├─ Worst positions: XLV (-2%), GLD (-8%)       │
│ ├─ Recommended action:                          │
│ │  \"Increase duration. Add growth. Trim bonds.\" │
│ └─ [Activate Plan] [Full Analysis]              │
│                                                 │
│ RATE SHOCK SCENARIO                             │
│ ├─ Portfolio return: -8%                        │
│ ├─ Best positions: XLE (+15%), XLV (+5%)       │
│ ├─ Worst positions: TSLA (-25%), ARKK (-18%)   │
│ ├─ Recommended action:                          │
│ │  \"Trim growth. Pivot to value/defense.\"      │
│ └─ [Activate Plan] [Full Analysis]              │
│                                                 │
│ [Create Custom Scenario] [Backtest]             │
└─────────────────────────────────────────────────┘
```

**Data Source:** MiroFish scenario engine (from Phase 3)

**Components:**
- `<ScenarioTab />` — One scenario per tab
- `<OutcomeComparison />` — Winners/losers side-by-side
- `<ActionPlan />` — Recommended pivot
- `<ScenarioBuilder />` — Custom "What if?" creation

---

## Data Architecture

```
┌─────────────────────────────────────┐
│ PHASE 5: Dashboard                  │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Portfolio Health                │ │ ← Orchestrator + Ember
│ │ [Conviction, Warnings, Scenarios]│ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Key Investments (Ranking)       │ │ ← Echo Consensus +
│ │ [Top 5 by Multi-Factor Score]   │ │    ElectraScan Scoring
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Deep Dive (Single Investment)   │ │ ← Full signal +
│ │ [Archetype, Thesis, Risk, etc.] │ │    OpenClaw RAG +
│ └─────────────────────────────────┘ │    Claude thesis
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Scenario Playbook               │ │ ← MiroFish scenarios +
│ │ [Rate cut, shock, recession]    │ │    Outcome simulation
│ └─────────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
         ↑         ↑        ↑
         │         │        │
    Phase 2    Phase 3   Phase 4
    (Core)   (Agents)  (Adapters)
```

---

## Component List (Manus Designs These)

### Core Components
1. **PortfolioHealthCard** — Conviction + trend + warnings
2. **InvestmentCard** — Single signal card (symbol, rank, thesis preview)
3. **ConvictionBadge** — "High / Medium / Low" with color
4. **ThesisPanel** — Full investment thesis (generated text + sources)
5. **RiskMatrix** — Risk factors × impact matrix
6. **ArchetypeBreakdown** — Polar or bar chart of agent votes
7. **ScenarioComparison** — 2–3 scenarios side-by-side
8. **ConvictionTrendChart** — 7/30-day rolling line chart
9. **ArchetypeBreakdownChart** — Aggregate archetype mix over time
10. **SignalsTable** — Sortable/filterable signal history
11. **WarningBanner** — Red banner for critical alerts
12. **PositionManager** — [Open] [Add] [Trim] [Exit] buttons
13. **ScenarioTab** — Tab interface for scenario playbook
14. **SymbolHeader** — Price, technicals, chart

---

## Integration Checklist

### Week 1: Echo + Ember
- [ ] Create `consensusFramework.ts` (Echo pattern)
  - InvestmentCase interface
  - Evidence builder (macro/tech/sentiment)
  - Confidence stratification (high/med/low)
- [ ] Create `earlyWarnings.ts` (Ember pattern)
  - PortfolioWarning interface
  - Conviction decay detector
  - Regime change detector
  - Trend predictor

### Week 2: ElectraScan + MiroFish
- [ ] Create `investmentScoring.ts` (ElectraScan pattern)
  - 6-factor scoring (valuation, momentum, macro, sentiment, risk, conviction)
  - Ranking algorithm (1–100)
  - Explanation generator
- [ ] Create `scenarioEngine.ts` (MiroFish pattern)
  - Re-run swarm with adjusted macro context
  - Compare baseline vs scenario
  - Winner/loser identification

### Week 3: OpenClaw + Claude Ares
- [ ] Create `thesisGenerator.ts` (OpenClaw + Claude)
  - Retrieve personal investment principles
  - Synthesize with swarm signal + market data
  - Generate thesis text (2–3 paragraphs)
- [ ] Create `narrativeGenerator.ts` (Claude Ares)
  - Daily brief (portfolio summary)
  - Trade journal auto-entry
  - Monthly performance report

---

## Success Criteria

1. **Actionability** ✅
   - Dashboard shows top-5 investments to buy today
   - Each investment has [Open Position] button (1-click)

2. **Transparency** ✅
   - Click any investment → expands to full thesis + evidence
   - Shows why swarm ranked it, which agents agree/disagree

3. **Risk Awareness** ✅
   - Risk matrix shows 3–5 downside scenarios + impact
   - Early warnings highlight conviction decay / regime shifts

4. **Stress Testing** ✅
   - Scenario playbook shows +12% (soft landing) to -15% (crisis)
   - "Activate Plan" button pivots portfolio for each scenario

5. **Thesis Quality** ✅
   - You can explain your thesis to an investor
   - OpenClaw + Claude synthesis is coherent and evidence-backed

---

## Future Enhancements (Post-Phase 5)

1. **Execution Integration** (Phase 4 output)
   - Show live portfolio: positions, P&L, allocation
   - One-click order placement (Alpaca/IB/Kraken)

2. **Performance Tracking**
   - Signal win rate (% of bullish signals > 0%)
   - Archetype performance (which agent type wins most)
   - Scenario accuracy (did rate cut happen like we modeled?)

3. **Personal Thesis Library**
   - Save all generated theses
   - Compare thesis from 3 months ago vs today
   - Learn what drives your conviction

4. **Notification System**
   - Alert when signal appears for watchlist symbol
   - Warn when conviction drops 20% in 1 day
   - Notify when scenario triggers (rates drop 50bps)

5. **Export/Reporting**
   - Monthly investor letter (auto-generated)
   - Trade journal (manually + auto entries)
   - Performance dashboard (benchmark vs SPY)

---

## Notes for Manus

**Design Principles:**
- Jarvis-inspired (clean, confident, data-driven)
- Minimize scrolling (hero section shows top 5, everything else expands)
- Dark mode preferred (reduces eye strain for day traders)
- Mobile-responsive (but desktop-first)
- Use color to signal: green=bullish, red=bearish, gray=neutral, orange=warning

**Interactions:**
- Hover on conviction number → show 7-day trend sparkline
- Click investment card → expand to deep dive (no modal, inline scroll)
- Scenario playbook → tab navigation (not separate page)
- Warning banner → click to see full event history

**Data Viz:**
- Conviction trend: line chart with shaded confidence band
- Archetype breakdown: polar chart (symmetry shows consensus)
- Risk matrix: 2D scatter (risk vs impact)
- Scenario outcomes: side-by-side bars (baseline vs scenario)

---

## Files to Create

```
app/
├── lib/
│   ├── consensusFramework.ts      ← Echo integration
│   ├── earlyWarnings.ts           ← Ember integration
│   ├── investmentScoring.ts       ← ElectraScan integration
│   ├── scenarioEngine.ts          ← MiroFish integration
│   ├── thesisGenerator.ts         ← OpenClaw + Claude
│   └── narrativeGenerator.ts      ← Claude Ares
├── components/
│   ├── dashboard/
│   │   ├── PortfolioHealthCard.tsx
│   │   ├── KeyInvestmentsSection.tsx
│   │   ├── InvestmentCard.tsx
│   │   ├── DeepDive.tsx
│   │   ├── ScenarioPlaybook.tsx
│   │   ├── SignalsHistory.tsx
│   │   └── WarningBanner.tsx
│   ├── shared/
│   │   ├── ConvictionBadge.tsx
│   │   ├── ThesisPanel.tsx
│   │   ├── RiskMatrix.tsx
│   │   ├── ArchetypeBreakdown.tsx
│   │   └── ScenarioComparison.tsx
│   └── charts/
│       ├── ConvictionTrendChart.tsx
│       ├── ArchetypeBreakdownChart.tsx
│       └── RiskScatterChart.tsx
└── page.tsx (refactored for new layout)
```

---

## Deployment Checklist

- [ ] All Tier 1 integrations complete (Echo, Ember)
- [ ] All Tier 2 integrations complete (ElectraScan, MiroFish)
- [ ] All Tier 3 integrations complete (OpenClaw, Ares)
- [ ] Components match Manus design
- [ ] Data flows correctly (no empty states)
- [ ] Responsive on mobile
- [ ] Performance optimized (no N+1 queries)
- [ ] Testing (signal ranking correct, scenarios realistic)
- [ ] Staging review (get stakeholder feedback)
- [ ] Production deployment

---

## Estimated Effort

- **Echo Consensus Framework:** 4h
- **Ember Early Warnings:** 4h
- **ElectraScan Scoring:** 5h
- **MiroFish Scenarios:** 5h
- **OpenClaw RAG + Thesis:** 8h
- **Claude Ares Narrative:** 4h
- **Component Implementation:** 20h
- **Testing + Refinement:** 10h
- **Total:** ~60 hours (2–3 weeks)

---

## Questions for Damien

1. What's your watchlist for helium? (HE1.L, LIN, APD, ASPI, BNL.AX) — should these be pre-populated?
2. Do you want 1-click order placement in this phase, or save for Phase 6?
3. What's your risk tolerance per signal? (Max position size by conviction?)
4. Should scenarios run on a schedule (daily) or on-demand?
5. Do you have previous thesis documents to index into OpenClaw?
