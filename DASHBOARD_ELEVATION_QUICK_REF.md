# Mirofish Dashboard Elevation — Quick Reference Card

## Vision: Jarvis Dashboard
Transform from signal-feed → intelligent investment decision system

---

## 6 Integrations at a Glance

| Tier | Repo | What | Dashboard Feature |
|------|------|------|-------------------|
| **1️⃣** | echo-oncology | Consensus framework | Evidence-ranked signals + dissent |
| **1️⃣** | ember-osdk | Early warnings | Conviction decay/regime alerts |
| **2️⃣** | electrascan | Multi-factor scoring | 6-way radar per investment |
| **2️⃣** | mirofish | Scenario modeling | Portfolio stress outcomes |
| **3️⃣** | openclaw | Thesis RAG | Auto-generated investment case |
| **3️⃣** | claude-ares | Narratives | Daily briefs + auto-journal |

---

## 5 Dashboard Sections

```
┌─ PORTFOLIO HEALTH
│  └─ Conviction trend + warnings + scenario snapshot
├─ KEY INVESTMENTS TO ACTIVATE
│  └─ Top 5 ranked by 6 factors, click for deep dive
├─ SIGNALS HISTORY
│  └─ 7-day trend chart + archetype mix
├─ DEEP DIVE (expandable per investment)
│  └─ Full thesis + risks + scenario outcomes
└─ SCENARIO PLAYBOOK
   └─ "What if Fed cuts 50bps?" + portfolio pivot
```

---

## Success Criteria

✅ **Actionability** — Can you see top 5 to buy today?  
✅ **Transparency** — Why is this ranked #1? (evidence cards)  
✅ **Risk Aware** — What could go wrong? (dissent + warnings)  
✅ **Stress Tested** — Portfolio under rate shock? (scenarios)  
✅ **Thesis Quality** — Explain to investor? (generated + sourced)  

---

## Implementation: 3 Weeks / 60 Hours

### Week 1: Foundation (8h)
- [ ] Echo consensus framework → signal ranking
- [ ] Ember early warnings → conviction decay detection

### Week 2: Depth (10h)
- [ ] ElectraScan 6-factor scoring → investment ranking
- [ ] MiroFish scenario engine → stress test portfolio

### Week 3: Polish (12h)
- [ ] OpenClaw RAG → thesis generation
- [ ] Claude Ares → daily narratives
- [ ] Component build → match Manus design (30h more in Phase 5)

---

## Key Files

```
~/mirofish-trader/
├── DASHBOARD_ELEVATION_SPEC.md         ← Full spec (2000+ words)
├── DASHBOARD_ELEVATION_QUICK_REF.md    ← This file
├── app/lib/
│   ├── consensusFramework.ts           ← Echo
│   ├── earlyWarnings.ts                ← Ember
│   ├── investmentScoring.ts            ← ElectraScan
│   ├── scenarioEngine.ts               ← MiroFish
│   ├── thesisGenerator.ts              ← OpenClaw
│   └── narrativeGenerator.ts           ← Claude Ares
└── app/components/dashboard/           ← UI components
```

**Skill:** `~/.hermes/skills/software-development/dashboard-elevation-investment-system/`

---

## Questions for You

1. **Watchlist symbols?** Pre-populate HE1.L, LIN, APD, ASPI, BNL.AX, MLX.AX?
2. **Order placement?** 1-click orders now, or defer to Phase 6?
3. **Risk limits?** Max position size per conviction level?
4. **Scenario frequency?** Daily calc or on-demand?
5. **Thesis docs?** Have historical thesis documents to index?

---

## Timeline Context

```
Phase 1: Architecture          ✅ Done
Phase 2: Orchestrator          ✅ Done
Phase 3: Agents + Consensus    ⏳ 16h (next)
Phase 4: Broker Adapters       ⏳ 30h
Phase 5: Dashboard Elevation   ⏳ 60h (THIS)
```

**When:** Start Phase 3 after Phase 2 merges to main.

---

## Pitfalls to Avoid

1. ❌ Don't rebuild from scratch — copy working patterns from Echo/Ember
2. ❌ Don't use fake scenario data — use real historical rates
3. ❌ Don't hide thesis sources — always show which agents + docs
4. ❌ Don't alert on every conviction twitch — threshold >15%/day
5. ❌ Don't recalc scenarios on every page load — cache results

---

## Command Reference

```bash
cd ~/mirofish-trader

# Check Phase 2 tests
pnpm test -- orchestrator.test.ts

# View spec
cat DASHBOARD_ELEVATION_SPEC.md

# View quick ref (this file)
cat DASHBOARD_ELEVATION_QUICK_REF.md
```

---

## Design Notes (for Manus)

**Layout:** 5-section vertical scroll (banner → hero → history → deep dive → scenarios)  
**Colors:** Green=bullish, Red=bearish, Orange=warning, Gray=neutral  
**Interactions:** Hover conviction → trend sparkline | Click signal → expand inline  
**Mobile:** Desktop-first, responsive below 1024px  
**Theme:** Dark mode preferred (day traders, eye strain)  

---

## Contact

- **Damien:** You (building this)
- **Manus:** UI design (5 sections)
- **You:** Implementation post-Phase 4

---

**Last updated:** June 26, 2026 | **Status:** Architecture complete, Phase 3 ready
