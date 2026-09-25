# MiroFish GitHub Integration — What to Use for Mirofish-Trader

**Source:** https://github.com/666ghj/MiroFish (Public repo)  
**Your local fork:** ~/mirofish/

---

## Overview: What MiroFish Does

MiroFish is a **swarm intelligence simulation engine** that:
1. Ingests seed materials (documents, reports, narratives)
2. Builds a knowledge graph (GraphRAG + Zep)
3. Generates agent personas from the graph
4. Runs multi-round agent simulations (agents interact, create posts, influence others)
5. Generates detailed prediction reports (ReportAgent with ReACT pattern)
6. Allows deep interaction (chat with any agent, ask questions)

**Architecture:**
```
Seed Materials
    ↓
GraphRAG Build (Zep)
    ↓
Entity Extraction (Personas)
    ↓
Agent Configuration
    ↓
Parallel Simulation (OASIS)
    ↓
Report Generation (ReportAgent + ReACT)
    ↓
Deep Interaction (Chat with agents)
```

---

## What You Can Use for Mirofish-Trader Dashboard

### 🎯 Tier 1: High Value (Directly Applicable)

#### 1. **ReportAgent Pattern** → Dashboard Narrative Generation
**What it is:** ReACT (Reasoning + Acting) pattern for generating detailed reports  
**File:** `backend/app/services/report_agent.py`  
**Why it's valuable:**
- Plans report structure first (outline)
- Generates sections iteratively with multi-turn reasoning
- Uses tools to search/interview agents
- Handles language localization

**For Mirofish-Trader:**
```typescript
// app/lib/reportAgentPattern.ts
// Use ReportAgent's multi-step generation for:
// 1. Daily market brief (outline → sections → final)
// 2. Investment thesis (similar structure)
// 3. Trading journal entries (auto-populate)

// Instead of just "ASML: Bullish 78%"
// Generate: "ASML rallied 3.2% today on strong guidance.
//  Our swarm sees this as secular (macro agents 76%, momentum 78%).
//  Risk: tariff shock could trigger reversal. [Evidence →]"
```

**Integration Point:**
- Copy ReportAgent's tool-calling loop
- Instead of Zep tools, call your Supabase + orchestrator APIs
- Use same ReACT pattern for thesis + narrative generation

---

#### 2. **Agent Action Logging** → Portfolio Event History
**What it is:** Fine-grained tracking of every agent action in simulation  
**File:** `backend/app/services/simulation_runner.py` → `AgentAction` dataclass  
**Why it's valuable:**
- Timestamps every action
- Tracks action type, arguments, results
- Supports round-based simulation
- JSON serializable

**For Mirofish-Trader:**
```typescript
// Adapt for investment decisions:
interface InvestmentAction {
  round_num: number           // Trading day
  timestamp: string
  signal_id: string           // Which swarm signal triggered it
  action_type: 'OPEN_POSITION' | 'ADD_MORE' | 'TRIM' | 'EXIT' | 'HOLD'
  symbol: string
  conviction: number          // Agent confidence (0-100)
  agents_voting: number       // How many agents agreed
  result?: string            // Outcome (P&L, fill price, etc.)
  success: boolean
}

// Then in dashboard: show action history with reasons
// "2026-06-26 10:30 OPEN ASML
//  └─ Signal: Semiconductor momentum (78 agents, 82% conviction)
//  └─ Result: Filled 245.50, +3.2% day 1"
```

**Integration Point:**
- Store these in Supabase `investment_actions` table
- Use same logging pattern as MiroFish simulation_runner.py
- Dashboard can replay action history with reasoning

---

#### 3. **Entity/Agent Interview** → Investment Deep Dive
**What it is:** Structured Q&A with simulation agents about their reasoning  
**File:** `backend/app/api/simulation.py` → interview logic  
**Why it's valuable:**
- Query individual agents (momentum, macro, sentiment, contrarian)
- Get their reasoning: "Why did you vote bullish?"
- Structured responses
- Optimize to avoid tool calling (direct text response)

**For Mirofish-Trader:**
```typescript
// app/api/deepDive/[symbol]/route.ts
// Instead of just showing vote counts:
// GET /api/deepDive/ASML → calls orchestrator agents

interface AgentInterview {
  agent_type: 'momentum' | 'macro' | 'sentiment' | 'contrarian'
  vote: 'bullish' | 'bearish' | 'neutral'
  reasoning: string      // Agent's own words
  confidence: number
  key_factors: string[]
}

// Response:
{
  symbol: "ASML",
  interviews: [
    {
      agent_type: "momentum",
      vote: "bullish",
      reasoning: "Technical strength: Above 200-day MA, RSI > 70, strong earnings whispers",
      confidence: 82
    },
    {
      agent_type: "macro",
      vote: "bullish",
      reasoning: "AI capex cycle still in early innings, ASML is chokepoint for chip supply",
      confidence: 76
    }
  ]
}
```

**Integration Point:**
- Call your Orchestrator agents with a "reasoning" prompt
- Format as structured responses (no tool calling)
- Display in Deep Dive section with agent breakdowns

---

### 🎯 Tier 2: Medium Value (Patterns to Adapt)

#### 4. **Simulation Manager** → Scenario Engine
**What it is:** Manages simulation lifecycle (start, run, pause, stop, monitor)  
**File:** `backend/app/services/simulation_manager.py`  
**Why it's valuable:**
- Parallel simulation (multiple scenarios at once)
- Status monitoring (which round, progress, ETA)
- Cleanup on failure/stop
- Logging + reporting

**For Mirofish-Trader:**
```typescript
// Adapt for scenario testing:
// Instead of multi-agent simulation, you're re-running swarm
// with adjusted market context

interface ScenarioRun {
  scenario_id: string
  name: 'rate_shock' | 'soft_landing' | 'credit_crisis'
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number        // % complete
  start_time: Date
  end_time?: Date
  results: ScenarioResult[]
}

// Workflow:
// 1. User clicks "Run Rate Shock Scenario"
// 2. ScenarioManager spawns parallel runs (10yr yield -50bps, VIX +20%)
// 3. Runs swarm simulation with adjusted context
// 4. Collects results: winners/losers, portfolio delta, recommendations
// 5. Stores in cache, returns to dashboard
```

**Integration Point:**
- Copy SimulationManager's status/monitoring logic
- Apply to your scenario engine
- Support parallel runs (rate shock + credit crisis simultaneously)

---

#### 5. **Graph Building Pipeline** → Investment Knowledge Base
**What it is:** Ingests documents → builds knowledge graph → extracts entities  
**Files:** 
- `backend/app/utils/file_parser.py`
- `backend/app/services/text_processor.py`
- `backend/app/services/ontology_generator.py`

**Why it's valuable:**
- Structured knowledge extraction
- Entity relationships (company → sector → macro)
- Multi-language support
- Automatic ontology generation

**For Mirofish-Trader:**
```typescript
// Build an "Investment Knowledge Graph" from your inputs:
// - Annual reports (companies)
// - Earnings transcripts (sector trends)
// - Your thesis documents
// - Market research

// Entities: Company → CEO → Sector → Macro Trend
// Relationships: "ASML manufactures → Semiconductors → AI growth"

// Use for:
// 1. Auto-populate sector trends (macro bias source)
// 2. Link signals to news/events
// 3. Build context for thesis generation
// 4. Track evolution of your investment ideas

// Example: User uploads "AI Capex Boom Report"
// → System extracts: TSLA, NVDA, ASML, ADBE as beneficiaries
// → Links to macro agent signals
// → Suggests these are correlated bullish bets
```

**Integration Point:**
- Use file_parser for earnings/research doc uploads
- Run text_processor for entity extraction
- Store in Supabase as `investment_entities` + `relationships`
- Use in dashboard for context/correlation analysis

---

### 🎯 Tier 3: Lower Value (Reference Only)

#### 6. **OASIS Simulation Core** → Too Specialized
**File:** `backend/app/services/oasis_profile_generator.py`  
**Why skip it:** Designed for social simulation (agents posting on Twitter/Reddit)  
Not directly applicable to investment swarm (you have your own agents in orchestrator.ts)

#### 7. **Frontend UI** → Design Inspiration Only
**Files:** `frontend/` (React components)  
**Why:** Built for MiroFish's report UI, not investment dashboard  
Better to follow Manus's design for mirofish-trader

---

## Integration Action Plan

### Phase 3 + 4: Adapt MiroFish Patterns

```
// Week 1: Add ReportAgent pattern to thesisGenerator
app/lib/
├── reportAgentPattern.ts      ← Copy from backend/app/services/report_agent.py
├── agentInterviewer.ts        ← Copy interview logic from simulation.py
└── thesisGenerator.ts         ← Wire both together

// Week 2: Add action logging to investmentActions
app/lib/
├── investmentActionLogger.ts  ← Adapt from simulation_runner.py
└── actionHistory.ts           ← Query + display in dashboard

// Week 3: Build scenario manager
app/lib/
└── scenarioManager.ts         ← Adapt from simulation_manager.py
    ├── Start scenario run
    ├── Monitor progress
    ├── Collect results
    └── Cache + return

// Dashboard updates
app/components/
├── DeepDive.tsx               ← Call agentInterviewer → show Q&A
├── InvestmentThesis.tsx       ← Call reportAgentPattern → generate
└── ActionHistory.tsx          ← Display investmentActions
```

---

## Code to Copy/Adapt

### 1. ReportAgent ReACT Loop
```python
# FROM: backend/app/services/report_agent.py

def generate_report_section(self, section: str, context: Dict):
    """
    Multi-turn reasoning for one section:
    1. Think (reasoning)
    2. Act (call tools)
    3. Reflect (iterate)
    """
    messages = [system_prompt, initial_request]
    
    for turn in range(max_turns):
        response = self.llm.call(messages)
        
        if "call_tool" in response:
            tool_result = self.call_tool(tool_name, args)
            messages.append({"role": "assistant", "content": response})
            messages.append({"role": "user", "content": tool_result})
        else:
            # Final response
            return response
```

**Adapt for investment thesis:**
```typescript
// app/lib/thesisGenerator.ts
async function generateThesis(symbol: string, signal: SwarmResult) {
  const messages = [
    { role: "system", content: THESIS_SYSTEM_PROMPT },
    { role: "user", content: `Generate thesis for ${symbol}` }
  ];
  
  for (let turn = 0; turn < 3; turn++) {
    const response = await claude.messages.create({ messages });
    
    if (response.includes("SEARCH_DOCS") || response.includes("QUERY_AGENTS")) {
      // Call tools: search OpenClaw docs, interview swarm agents
      const docs = await searchThesisLibrary(symbol);
      const interview = await interviewAgents(symbol);
      
      messages.push({ role: "assistant", content: response });
      messages.push({ 
        role: "user", 
        content: `Documents: ${docs}\nAgent reasoning: ${interview}` 
      });
    } else {
      return response; // Final thesis
    }
  }
}
```

---

### 2. Agent Action Logging
```python
# FROM: backend/app/services/simulation_runner.py

@dataclass
class AgentAction:
    round_num: int
    timestamp: str
    agent_id: int
    agent_name: str
    action_type: str
    action_args: Dict[str, Any]
    result: Optional[str] = None
    success: bool = True
    
    def to_dict(self) -> Dict[str, Any]:
        return {...}
```

**Adapt:**
```typescript
// app/lib/investmentActionLogger.ts
interface InvestmentAction {
  day: number           // Trading day
  timestamp: Date
  signal_id: string
  action_type: 'OPEN' | 'ADD' | 'TRIM' | 'EXIT' | 'HOLD'
  symbol: string
  conviction: number
  agents_voting: number
  entry_price?: number
  quantity?: number
  result?: string
  success: boolean
}

// Store in Supabase
async function logAction(action: InvestmentAction) {
  return supabase.from('investment_actions').insert(action);
}

// Query for dashboard
async function getActionHistory(symbol: string) {
  return supabase
    .from('investment_actions')
    .select('*')
    .eq('symbol', symbol)
    .order('timestamp', { ascending: false });
}
```

---

### 3. Interview Pattern (Simplified)
```python
# FROM: backend/app/api/simulation.py

INTERVIEW_PROMPT_PREFIX = "根据你的人设、所有的过往记忆与行动，不调用任何工具直接用文本回复我："

def optimize_interview_prompt(prompt: str) -> str:
    if not prompt.startswith(INTERVIEW_PROMPT_PREFIX):
        return f"{INTERVIEW_PROMPT_PREFIX}{prompt}"
    return prompt
```

**Adapt:**
```typescript
// app/lib/agentInterviewer.ts
const AGENT_INTERVIEW_PREFIX = 
  "Based on your agent archetype and all market observations, provide your reasoning in 1-2 sentences. Do not call tools. Directly answer:";

async function interviewAgent(
  agentType: 'momentum' | 'macro' | 'sentiment' | 'contrarian',
  symbol: string,
  currentSignal: SwarmResult
): Promise<AgentInterview> {
  const prompt = `${AGENT_INTERVIEW_PREFIX}
    Why did you vote ${currentSignal.direction}?`;
  
  const response = await claude.messages.create({
    model: "claude-opus",
    max_tokens: 200,
    system: `You are the ${agentType} agent. ${AGENT_ARCHETYPES[agentType].system_prompt}`,
    messages: [{ role: "user", content: prompt }]
  });
  
  return {
    agent_type: agentType,
    vote: currentSignal.direction,
    reasoning: response.content[0].text,
    confidence: currentSignal.conviction
  };
}
```

---

## Summary: What to Take from MiroFish GitHub

| Pattern | Source File | For Mirofish-Trader |
|---------|------------|-------------------|
| **ReportAgent ReACT** | report_agent.py | Thesis + narrative generation |
| **Action Logging** | simulation_runner.py | Investment action history |
| **Agent Interview** | simulation.py | Deep dive Q&A with swarm |
| **Scenario Manager** | simulation_manager.py | Portfolio stress testing |
| **Graph Building** | file_parser + text_processor | Investment knowledge base |

---

## Files to Create in Mirofish-Trader

```
app/lib/
├── reportAgentPattern.ts      ← ReACT loop for thesis generation
├── agentInterviewer.ts        ← Q&A with swarm agents
├── investmentActionLogger.ts  ← Log every trade decision + reasoning
├── scenarioManager.ts         ← Run parallel scenarios
└── investmentKnowledgeBase.ts ← Index docs, extract entities

app/api/
├── deepDive/[symbol]/route.ts     ← Interview agents → Deep Dive section
├── thesis/generate/route.ts        ← Generate investment thesis
├── actionHistory/[symbol]/route.ts ← Get action log
└── scenarios/run/route.ts          ← Start scenario run

app/components/
├── DeepDive.tsx               ← Show agent interviews + thesis
└── ActionHistory.tsx          ← Timeline of decisions
```

---

## Next Steps

1. **Phase 3:** Build Agents + Consensus (your own orchestrator, not MiroFish)
2. **Phase 4:** Wire broker adapters (execution)
3. **Phase 5:** Implement dashboard integrations
   - [ ] Copy ReportAgent ReACT for thesis generation
   - [ ] Copy action logging pattern for history
   - [ ] Copy interview logic for deep dive
   - [ ] Copy scenario manager for stress testing
   - [ ] Implement investmentKnowledgeBase for context

**Total new code:** ~500 lines TypeScript (much shorter than MiroFish's Python backend — you're adapting, not reimplementing)

---

## Not Recommended: Don't Copy

❌ **OASIS Simulation Core** — You have your own orchestrator  
❌ **Frontend UI** — Use Manus's design instead  
❌ **Zep Integration** — You use Supabase + orchestrator APIs  
❌ **Social simulation agents** — Your agents are investment-focused  

**Why:** MiroFish is optimized for social/narrative prediction. Your needs are different (financial + deterministic execution).

---

## Architecture Comparison

| Aspect | MiroFish | Mirofish-Trader |
|--------|----------|-----------------|
| **Agents** | Social (Twitter/Reddit personas) | Financial (momentum, macro, sentiment, contrarian) |
| **Simulation** | Rounds of interactions, emergent behavior | Single swarm vote, conviction calculation |
| **Reports** | Prediction narratives (ReACT) | Investment theses + action logs |
| **Data** | Document-based graphs | Market data + swarm signals |
| **Storage** | Zep (graph DB) | Supabase (vectors + tables) |
| **Valuable Pattern** | ReportAgent, interview, action logging | Yes — adapting all three |

---

**Recommendation:** Use MiroFish as a reference for **report generation patterns**, **action logging**, and **agent interview workflows**. Skip the simulation engine (you have orchestrator.ts already).
