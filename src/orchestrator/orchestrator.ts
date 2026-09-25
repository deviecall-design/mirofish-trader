import EventEmitter from "events";
import {
  InvestmentSignal,
  OrchestratorConfig,
  OrchestratorState,
  AgentState,
  VotingResult,
  OrchestratorEvent,
} from "../types/index.js";

export interface Agent {
  id: string;
  specialty: string;
  analyze(signal: InvestmentSignal): Promise<any>; // Returns Vote
}

export class EventBus extends EventEmitter {
  emit(event: string, ...args: any[]): boolean {
    return super.emit(event, ...args);
  }

  on(event: string, handler: (...args: any[]) => void): this {
    return super.on(event, handler);
  }

  once(event: string, handler: (...args: any[]) => void): this {
    return super.once(event, handler);
  }

  off(event: string, handler: (...args: any[]) => void): this {
    return super.off(event, handler);
  }
}

/**
 * Core orchestrator: dispatches signals to agents, collects votes,
 * and maintains swarm state.
 */
export class Orchestrator {
  private agents: Map<string, Agent> = new Map();
  private eventBus: EventBus = new EventBus();
  private state: OrchestratorState = {
    activeSignals: [],
    votingQueue: [],
    agentStates: new Map(),
    eventLog: [],
  };
  private config: OrchestratorConfig;

  constructor(config: OrchestratorConfig = {}) {
    this.config = {
      logLevel: "info",
      dispatchTimeoutMs: 30000,
      ...config,
    };
  }

  /**
   * Register an agent with the orchestrator
   */
  registerAgent(id: string, agent: Agent): void {
    this.agents.set(id, agent);
    this.state.agentStates.set(id, {
      id,
      specialty: agent.specialty,
      isOnline: true,
      analysisCount: 0,
      errorCount: 0,
    });

    this.log(`Agent registered: ${id} (${agent.specialty})`);
    this.emitEvent({
      type: "agent-registered",
      agentId: id,
    });
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(id: string): void {
    this.agents.delete(id);
    const agentState = this.state.agentStates.get(id);
    if (agentState) {
      agentState.isOnline = false;
    }
    this.log(`Agent unregistered: ${id}`);
  }

  /**
   * Get a registered agent by ID
   */
  getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  /**
   * Get all registered agents
   */
  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Dispatch a signal to all agents and collect votes
   * Returns the aggregated voting result
   */
  async dispatch(signal: InvestmentSignal): Promise<VotingResult> {
    this.log(`Dispatching signal: ${signal.symbol} ${signal.type}`);
    this.state.activeSignals.push(signal);
    this.state.votingQueue.push(signal);

    this.emitEvent({
      type: "signal-received",
      signal,
    });

    this.emitEvent({
      type: "dispatch-started",
      signal,
    });

    // Dispatch to all agents in parallel
    const promises = Array.from(this.agents.entries()).map(([id, agent]) =>
      this.analyzeWithAgent(id, agent, signal)
    );

    const votes = await Promise.allSettled(promises);

    // Aggregate results
    const successfulVotes = votes
      .filter((v) => v.status === "fulfilled")
      .map((v) => (v as PromiseFulfilledResult<any>).value);

    const failedVotes = votes.filter((v) => v.status === "rejected");
    if (failedVotes.length > 0) {
      this.log(
        `${failedVotes.length} agents failed to analyze signal`,
        "warn"
      );
    }

    // Calculate conviction
    const approved = successfulVotes.filter((v) => v.approve).length;
    const threshold = 0.66; // 66% majority
    const approvalPercentage = approved / successfulVotes.length;
    const averageConfidence =
      successfulVotes.reduce((sum, v) => sum + v.confidence, 0) /
      successfulVotes.length;
    const conviction = approvalPercentage * averageConfidence;

    const result: VotingResult = {
      signal,
      approved: approvalPercentage >= threshold,
      threshold,
      conviction,
      votes: successfulVotes,
      timestamp: Date.now(),
    };

    this.state.lastVote = result;
    this.emitEvent({
      type: "dispatch-complete",
      result,
    });

    // Remove from active queue
    this.state.votingQueue = this.state.votingQueue.filter(
      (s) => s.id !== signal.id
    );

    return result;
  }

  /**
   * Have a specific agent analyze a signal
   * Private helper
   */
  private async analyzeWithAgent(
    agentId: string,
    agent: Agent,
    signal: InvestmentSignal
  ): Promise<any> {
    try {
      const timeout = this.config.dispatchTimeoutMs || 30000;
      const vote = await Promise.race([
        agent.analyze(signal),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(`Agent ${agentId} analysis timeout`)),
            timeout
          )
        ),
      ]);

      // Update agent state
      const agentState = this.state.agentStates.get(agentId);
      if (agentState) {
        agentState.lastVote = vote;
        agentState.analysisCount++;
      }

      return vote;
    } catch (error) {
      // Update error count
      const agentState = this.state.agentStates.get(agentId);
      if (agentState) {
        agentState.errorCount++;
      }

      this.emitEvent({
        type: "agent-failed",
        agentId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Get current orchestrator state
   */
  getState(): OrchestratorState {
    return { ...this.state };
  }

  /**
   * Event subscription
   */
  on(event: string, handler: (...args: any[]) => void): void {
    this.eventBus.on(event, handler);
  }

  once(event: string, handler: (...args: any[]) => void): void {
    this.eventBus.once(event, handler);
  }

  off(event: string, handler: (...args: any[]) => void): void {
    this.eventBus.off(event, handler);
  }

  /**
   * Private helpers
   */
  private emitEvent(event: OrchestratorEvent): void {
    this.state.eventLog.push(event);
    // Keep last 1000 events
    if (this.state.eventLog.length > 1000) {
      this.state.eventLog = this.state.eventLog.slice(-1000);
    }

    const eventName = event.type;
    this.eventBus.emit(eventName, event);
  }

  private log(message: string, level: "debug" | "info" | "warn" | "error" = "info"): void {
    const logLevel = this.config.logLevel || "info";
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    if (levels[level] >= levels[logLevel]) {
      console.log(`[Orchestrator] [${level.toUpperCase()}] ${message}`);
    }
  }
}

/**
 * Export for consumers
 */
export type { InvestmentSignal, VotingResult, OrchestratorState };
