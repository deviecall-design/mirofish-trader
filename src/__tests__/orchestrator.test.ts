import { describe, it, expect, beforeEach } from "vitest";
import { Orchestrator } from "../orchestrator.js";
import { InvestmentSignal } from "../../types/index.js";

describe("Orchestrator", () => {
  let orchestrator: Orchestrator;

  beforeEach(() => {
    orchestrator = new Orchestrator({ logLevel: "debug" });
  });

  it("should register and retrieve agents", () => {
    const mockAgent = {
      id: "test-agent",
      specialty: "fundamental",
      analyze: async () => ({ approve: true, confidence: 0.8 }),
    };

    orchestrator.registerAgent(mockAgent.id, mockAgent);
    const retrieved = orchestrator.getAgent(mockAgent.id);

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe("test-agent");
  });

  it("should dispatch signals and collect votes", async () => {
    const agent1 = {
      id: "agent-1",
      specialty: "technical",
      analyze: async () => ({
        agentId: "agent-1",
        approve: true,
        confidence: 0.9,
        reasoning: "Strong uptrend",
        timestamp: Date.now(),
      }),
    };

    const agent2 = {
      id: "agent-2",
      specialty: "fundamental",
      analyze: async () => ({
        agentId: "agent-2",
        approve: true,
        confidence: 0.7,
        reasoning: "Good fundamentals",
        timestamp: Date.now(),
      }),
    };

    orchestrator.registerAgent(agent1.id, agent1);
    orchestrator.registerAgent(agent2.id, agent2);

    const signal: InvestmentSignal = {
      id: "signal-1",
      timestamp: Date.now(),
      symbol: "AAPL",
      type: "buy",
      price: 150,
      confidence: 0.8,
      source: "technical",
    };

    const result = await orchestrator.dispatch(signal);

    expect(result.approved).toBe(true);
    expect(result.votes.length).toBe(2);
    expect(result.conviction).toBeGreaterThan(0);
  });

  it("should handle agent failures gracefully", async () => {
    const goodAgent = {
      id: "good-agent",
      specialty: "technical",
      analyze: async () => ({
        agentId: "good-agent",
        approve: true,
        confidence: 0.8,
        reasoning: "OK",
        timestamp: Date.now(),
      }),
    };

    const badAgent = {
      id: "bad-agent",
      specialty: "fundamental",
      analyze: async () => {
        throw new Error("Analysis failed");
      },
    };

    orchestrator.registerAgent(goodAgent.id, goodAgent);
    orchestrator.registerAgent(badAgent.id, badAgent);

    const signal: InvestmentSignal = {
      id: "signal-1",
      timestamp: Date.now(),
      symbol: "BTC",
      type: "sell",
      price: 45000,
      confidence: 0.6,
      source: "mirofish",
    };

    const result = await orchestrator.dispatch(signal);

    // Should still work with 1 valid vote
    expect(result.votes.length).toBe(1);
    expect(result.approved).toBe(true);
  });

  it("should emit events on signal and dispatch", async () => {
    const agent = {
      id: "test-agent",
      specialty: "technical",
      analyze: async () => ({
        agentId: "test-agent",
        approve: false,
        confidence: 0.3,
        reasoning: "Weak signal",
        timestamp: Date.now(),
      }),
    };

    orchestrator.registerAgent(agent.id, agent);

    let signalReceivedFired = false;
    let dispatchCompleteFired = false;

    orchestrator.on("signal-received", () => {
      signalReceivedFired = true;
    });

    orchestrator.on("dispatch-complete", () => {
      dispatchCompleteFired = true;
    });

    const signal: InvestmentSignal = {
      id: "signal-1",
      timestamp: Date.now(),
      symbol: "ETH",
      type: "hold",
      price: 2500,
      confidence: 0.5,
      source: "macro",
    };

    await orchestrator.dispatch(signal);

    expect(signalReceivedFired).toBe(true);
    expect(dispatchCompleteFired).toBe(true);
  });

  it("should calculate conviction correctly", async () => {
    // 3 agents: 2 approve (0.9, 0.8), 1 rejects (0.6)
    // Approval % = 2/3 = 0.667
    // Avg confidence = (0.9 + 0.8) / 3 = 0.567
    // Conviction = 0.667 * 0.567 = 0.378

    const agents = [
      {
        id: "agent-1",
        specialty: "technical",
        analyze: async () => ({
          agentId: "agent-1",
          approve: true,
          confidence: 0.9,
          reasoning: "Strong",
          timestamp: Date.now(),
        }),
      },
      {
        id: "agent-2",
        specialty: "fundamental",
        analyze: async () => ({
          agentId: "agent-2",
          approve: true,
          confidence: 0.8,
          reasoning: "Good",
          timestamp: Date.now(),
        }),
      },
      {
        id: "agent-3",
        specialty: "macro",
        analyze: async () => ({
          agentId: "agent-3",
          approve: false,
          confidence: 0.6,
          reasoning: "Weak",
          timestamp: Date.now(),
        }),
      },
    ];

    agents.forEach((agent) =>
      orchestrator.registerAgent(agent.id, agent)
    );

    const signal: InvestmentSignal = {
      id: "signal-1",
      timestamp: Date.now(),
      symbol: "SPY",
      type: "buy",
      price: 450,
      confidence: 0.7,
      source: "technical",
    };

    const result = await orchestrator.dispatch(signal);

    expect(result.approved).toBe(true); // 2/3 > 0.66
    expect(result.conviction).toBeCloseTo(0.378, 1);
  });
});
