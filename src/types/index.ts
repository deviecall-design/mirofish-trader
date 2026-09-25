/**
 * Core data types for MiroFish Swarm orchestrator
 */

// ============ Investment Signals ============

export interface InvestmentSignal {
  id: string;
  timestamp: number; // Unix ms
  symbol: string; // BTC, AAPL, etc.
  type: "buy" | "sell" | "hold";
  price: number; // Current market price
  confidence: number; // 0â1, source confidence
  source: "mirofish" | "technical" | "fundamental" | "macro"; // Where it came from
  metadata?: Record<string, any>; // Extra context
}

// ============ Orchestrator ============

export interface OrchestratorConfig {
  port?: number;
  logLevel?: "debug" | "info" | "warn" | "error";
  dispatchTimeoutMs?: number; // Max time to wait for all agents
  persistenceDir?: string; // Where to save state
}

export interface OrchestratorState {
  activeSignals: InvestmentSignal[];
  votingQueue: InvestmentSignal[];
  lastVote?: VotingResult;
  agentStates: Map<string, AgentState>;
  eventLog: OrchestratorEvent[];
}

export interface AgentState {
  id: string;
  specialty: string;
  isOnline: boolean;
  lastVote?: Vote;
  analysisCount: number;
  errorCount: number;
}

export type OrchestratorEvent =
  | { type: "signal-received"; signal: InvestmentSignal }
  | { type: "dispatch-started"; signal: InvestmentSignal }
  | { type: "dispatch-complete"; result: VotingResult }
  | { type: "agent-registered"; agentId: string }
  | { type: "agent-failed"; agentId: string; error: string };

// ============ Agents & Consensus ============

export interface Vote {
  agentId: string;
  approve: boolean; // Should we execute?
  confidence: number; // 0â1, agent's confidence in this decision
  reasoning: string; // Why this agent voted this way
  timestamp: number;
}

export interface VotingResult {
  signal: InvestmentSignal;
  approved: boolean; // Did votes pass threshold?
  threshold: number; // What threshold was used (0.5, 0.66, etc.)
  conviction: number; // Final conviction = (% approved) Ã (avg confidence)
  votes: Vote[];
  timestamp: number;
}

export interface ConvictionResult {
  approved: boolean;
  approvalPercentage: number; // 0â1
  averageConfidence: number; // 0â1
  conviction: number; // Final score used for execution
}

export interface AnalysisResult {
  signal: InvestmentSignal;
  vote: Vote;
  analysis: string; // Full reasoning
  timestamp: number;
}

// ============ Broker Adapters ============

export interface BrokerAdapterConfig {
  broker: "alpaca" | "ib" | "kraken" | "zerodha";
  apiKey: string;
  apiSecret?: string;
  baseUrl?: string;
  riskLimits?: RiskLimits;
}

export interface RiskLimits {
  maxPositionSize: number; // 0â1, % of portfolio
  maxDrawdown: number; // 0â1, max loss
  maxDailyLoss: number; // 0â1, daily loss limit
}

export interface ExecutionResult {
  id: string; // Order ID at broker
  broker: string;
  signal: InvestmentSignal;
  status: "pending" | "filled" | "rejected";
  filledPrice?: number;
  filledQuantity?: number;
  pnl?: number; // Unrealized PnL
  timestamp: number;
  error?: string; // If rejected
}

export interface Balance {
  broker: string;
  cash: number;
  equity: number; // Total account value
  buyingPower: number;
  timestamp: number;
}

export interface Order {
  id: string;
  symbol: string;
  type: "buy" | "sell";
  quantity: number;
  price: number;
  status: "pending" | "filled" | "rejected" | "cancelled";
  filledAt?: number;
  createdAt: number;
}

export interface RiskMetrics {
  currentExposure: number; // 0â1, % of portfolio deployed
  maxDrawdown: number; // Historical max loss
  sharpeRatio: number; // Return / volatility
  winRate: number; // % of winning trades
}

// ============ MiroFish Integration ============

export interface SwarmSignal {
  symbol: string;
  consensusScore: number; // 0â1, swarm agreement
  trend: "bullish" | "bearish" | "neutral";
  confidence: number; // 0â1
  agents: number; // How many agents in swarm
  timestamp: number;
}

export interface Asset {
  symbol: string;
  trend: "up" | "down" | "stable";
  momentum: number; // -1 to +1
  volume: number;
  priceChange24h: number; // % change
  consensusScore: number; // From MiroFish
}

// ============ Dashboard ============

export interface DashboardState {
  currentSignal?: InvestmentSignal;
  votingResult?: VotingResult;
  executionResults: ExecutionResult[];
  agentVotes: Vote[];
  balance: Balance[];
  riskMetrics: RiskMetrics;
  performanceMetrics: PerformanceMetrics;
  trendingAssets: Asset[];
}

export interface PerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number; // 0â1
  totalPnL: number;
  totalPnLPercentage: number;
  sharpeRatio: number;
  maxDrawdown: number;
  timestamp: number;
}

export interface WebSocketMessage {
  type: "signal" | "vote" | "execution" | "state";
  data: any;
  timestamp: number;
}
