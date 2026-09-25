# MiroFish-Trader: Complete Integration Plan
**Status:** Phase 2 ✅ | Phase 3-5 📋 | Dashboard Elevation 🚀

---

## What You Have Now (Phase 2 Complete)

✅ **Orchestrator Core** (`src/orchestrator/orchestrator.ts`)
- Multi-agent dispatch (parallel Promise.allSettled)
- Conviction calculation (approval % × confidence)
- Event bus for inter-component comms

✅ **Type System** (`src/types/index.ts`)
- 12 interfaces covering signal → execution → dashboard

✅ **Tests** (`src/__tests__/orchestrator.test.ts`)
- 5 passing tests (registration, dispatch, voting, events, conviction)

✅ **Documentation**
- ARCHITECTURE.md (5-phase build plan)
- QUICKSTART.md (local setup)
- GIT_WORKFLOW.md (incremental merge process)
- PHASE2_SUMMARY.md (design decisions)

---

## What You Need Next (Phases 3-5)

### Phase 3: Agents + Consensus (16 hours)
**Goal:** Claude-powered agents that vote, consensus engine that aggregates

```
Input:  MarketContext (price, trend, macro bias, social bias)
        ↓
Agents: [Momentum, Macro, Sentiment, Contrarian] (parallel)
        ↓
Voting: Each agent votes + conviction
        ↓
Output: SwarmResult (bullish/bearish, conviction 0-100)
```

**Build order:**
1. Agent system (4 Claude instances with specialized prompts)
2. Voting logic (confidence + conviction calculation)
3. Consensus engine (aggregate votes → recommendation)
4. Mirofish integration (consume existing data layer)

**Files to create:**
```
src/
├── agents/
│   ├── agent.interface.ts
│   ├── momentum.agent.ts
│   ├── macro.agent.ts
│   ├── sentiment.agent.ts
│   └── contrarian.agent.ts
├── consensus/
│   ├── consensus.engine.ts
│   └── voting.logic.ts
└── integrations/
    └── mirofish.integration.ts
```

**Deliverable:** feature/swarm-agents branch ready for PR to main

---

### Phase 4: Broker Adapters (30 hours)
**Goal:** Execute trades on real brokers, track positions

```
SwarmResult (bullish ASML, 82% conviction)
    ↓
Adapter Layer (Alpaca / IB / Kraken / Zerodha)
    ↓
Execution:
├─ Place order (buy 100 ASML @ market)
├─ Confirm fill
├─ Log action (timestamp, price, shares)
└─ Update portfolio
    ↓
Dashboard: "2026-06-26 10:30 Opened ASML position (245.50, 100 shares)"
```

**Build order:**
1. Alpaca adapter (REST API, paper trading first)
2. Interactive Brokers adapter (IBKR TWS)
3. Kraken adapter (crypto positions)
4. Zerodha adapter (Australia, ASX)
5. Position manager (track holds, P&L, allocation)
6. Action logger (every decision + outcome)

**Files to create:**
```
src/adapters/
├── base.adapter.ts
├── alpaca.adapter.ts
├── interactive-brokers.adapter.ts
├── kraken.adapter.ts
├── zerodha.adapter.ts
├── position.manager.ts
└── action.logger.ts

app/api/
├── positions/route.ts
├── execute/route.ts
└── orderHistory/[symbol]/route.ts
```

**Deliverable:** feature/swarm-adapters branch ready for PR

---

### Phase 5: Dashboard Elevation (60 hours)
**Goal:** Transform dashboard from signal-feed into investment decision system

**6 integrations:**
```
1. Echo Oncology        → Consensus framework (evidence-ranked signals)
2. Ember OSDK           → Early warnings (conviction decay, regime shifts)
3. ElectraScan          → 6-factor scoring (valuation, momentum, macro, sentiment, risk, conviction)
4. MiroFish (GitHub)    → ReportAgent pattern (thesis generation)
5. OpenClaw             → RAG for investment thesis (synthesize swarm + your docs)
6. Claude Ares          → Daily narratives (briefs, journal auto-entry)
```

**5 dashboard sections:**
```
1. Portfolio Health     → Overall conviction + warnings + scenario snapshot
2. Key Investments     → Top 5 ranked by 6 factors, click for deep dive
3. Signals History     → 7-day conviction trend + archetype mix
4. Deep Dive           → Full thesis + archetype breakdown + risks + scenarios
5. Scenario Playbook   → "What if rates drop 50bps?" + portfolio outcomes
```

**Build order:**
1. Week 1: Echo consensus + Ember warnings (8h)
2. Week 2: ElectraScan scoring + MiroFish scenarios (10h)
3. Week 3: OpenClaw thesis + Claude Ares narratives + component impl (42h)

**Files to create:**
```
app/lib/
├── consensusFramework.ts        (Echo)
├── earlyWarnings.ts             (Ember)
├── investmentScoring.ts         (ElectraScan)
├── scenarioEngine.ts            (MiroFish)
├── reportAgentPattern.ts        (GitHub MiroFish)
├── agentInterviewer.ts          (GitHub MiroFish)
├── investmentActionLogger.ts    (GitHub MiroFish)
├── thesisGenerator.ts           (OpenClaw)
└── narrativeGenerator.ts        (Claude Ares)

app/components/dashboard/
├── PortfolioHealthCard.tsx
├── KeyInvestmentsSection.tsx
├── InvestmentCard.tsx
├── DeepDive.tsx
├── ScenarioPlaybook.tsx
├── SignalsHistory.tsx
└── WarningBanner.tsx

app/api/
├── deepDive/[symbol]/route.ts
├── thesis/generate/route.ts
├── scenarios/run/route.ts
└── actionHistory/[symbol]/route.ts
```

**Deliverable:** feature/swarm-dashboard branch + Manus design implementation

---

## Timeline

```
Phase 2: ✅ DONE (June 26)
├─ Orchestrator core
├─ Type system
├─ Tests passing
└─ Documentation complete

Phase 3: ⏳ NEXT (July 1-7, 16h)
├─ Agents (momentum, macro, sentiment, contrarian)
├─ Voting + conviction
├─ Mirofish integration
└─ PR feature/swarm-agents → main

Phase 4: ⏳ (July 8-21, 30h)
├─ Alpaca, IB, Kraken, Zerodha adapters
├─ Position manager
├─ Action logger
└─ PR feature/swarm-adapters → main

Phase 5: ⏳ (July 22 - Aug 18, 60h)
├─ Week 1: Echo + Ember (8h)
├─ Week 2: ElectraScan + MiroFish (10h)
├─ Week 3: OpenClaw + Ares + components (42h)
└─ PR feature/swarm-dashboard → main + deploy
```

**Total:** 106 hours (3 weeks full-time, 2 months part-time)

---

## Git Workflow (Incremental Merge Strategy)

```bash
# Phase 2: Already done
# Docs merged to main June 24
# Code in feature/swarm-core (not pushed yet)

# Phase 3:
git checkout main
git pull
git checkout -b feature/swarm-agents
# ... implement agents + consensus
# ... test locally
git push origin feature/swarm-agents
# → Create PR, review, merge to main

# Phase 4:
git checkout main
git pull
git checkout -b feature/swarm-adapters
# ... implement adapters + position manager
git push origin feature/swarm-adapters
# → PR, merge to main

# Phase 5:
git checkout main
git pull
git checkout -b feature/swarm-dashboard
# ... implement 6 integrations + dashboard components
# ... test with Manus design
git push origin feature/swarm-dashboard
# → PR, merge to main → deploy
```

**Why incremental?**
1. Documentation on main helps anyone onboard
2. Smaller PRs = easier reviews + faster iteration
3. Can deploy docs first, code later
4. Each phase is self-contained, can work in parallel with other projects

---

## Success Criteria (End of Phase 5)

| Criterion | Metric |
|-----------|--------|
| **Actionability** | Dashboard shows top-5 investments to buy today |
| **Transparency** | Click any investment → expand to thesis + evidence |
| **Risk Aware** | Risk matrix shows 3–5 downside scenarios + early warnings |
| **Stress Tested** | Scenario playbook shows portfolio outcomes (rate shock, credit crisis, etc.) |
| **Thesis Quality** | Can explain any investment to an investor (evidence + sourced) |
| **Auto-Journaling** | Daily briefs + trade journal auto-populated from decisions |
| **Action History** | Every decision logged with reasoning + P&L |

---

## Key Numbers

- **LOC written so far:** ~600 (orchestrator + types + tests)
- **LOC to write (Phases 3-5):** ~3,000
- **Components to build:** 14 React components
- **Integrations:** 6 repos (Echo, Ember, ElectraScan, MiroFish, OpenClaw, Ares)
- **Broker adapters:** 4 (Alpaca, IB, Kraken, Zerodha)
- **Total effort:** 106 hours
- **Timeline:** 3 weeks full-time, 2 months part-time

---

## What to Do Next

**Option A: Start Phase 3 immediately**
- Ready for 16h agent build
- Orchestrator is solid foundation
- No blocking dependencies

**Option B: Clarify Phase 5 design with Manus first**
- Get UI design for 5 dashboard sections
- Then Phase 3 + 4 build the data layer
- Implement components in Phase 5 once design ready

**Option C: Adjust scope/timeline**
- Skip one broker (not all 4 needed immediately)
- Defer some integrations (focus on core 3: Echo, Ember, ElectraScan)
- Adjust timeline based on other commitments (Ares, Ember)

---

## Questions for You

1. **Phase 3 kickoff?** Ready to start agents + consensus?
2. **Manus coordination?** Should Manus design 5 dashboard sections now, or after Phase 4?
3. **Broker priority?** All 4 adapters, or start with Alpaca (paper trading)?
4. **Integration scope?** Keep all 6, or focus on core 3 (Echo, Ember, ElectraScan)?
5. **Timeline?** Full-time (3 weeks), part-time (2 months), or flexible?

---

## Files at a Glance

| Document | Purpose |
|----------|---------|
| **ARCHITECTURE.md** | 5-phase build plan + component specs |
| **DASHBOARD_ELEVATION_SPEC.md** | Full dashboard spec (2000+ words) |
| **DASHBOARD_ELEVATION_QUICK_REF.md** | One-page quick reference |
| **MIROFISH_GITHUB_INTEGRATION.md** | What to use from public repo |
| **PHASE2_SUMMARY.md** | Phase 2 work summary (orchestrator done) |
| **GIT_WORKFLOW.md** | Incremental merge process |

**All in:** ~/mirofish-trader/

---

## Next Session Checklist

- [ ] Review Phase 3 scope (agents + consensus)
- [ ] Confirm Phase 5 design with Manus
- [ ] Decide Phase 4 scope (all 4 brokers or just Alpaca?)
- [ ] Confirm timeline (full-time vs part-time)
- [ ] Merge Phase 2 docs to main
- [ ] Create feature/swarm-agents branch
- [ ] Kick off Phase 3

---

**Updated:** June 26, 2026  
**Status:** Phase 2 Complete, Phase 3 Ready to Start  
**Owner:** Damien  
**Collaborators:** Manus (design), Claude (agents), Hermes (infrastructure)
