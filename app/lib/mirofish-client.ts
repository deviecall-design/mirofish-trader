/**
 * MiroFish Sentiment Client — HTTP client for the MiroFish backend
 * simulation API (see MIROFISH_GITHUB_INTEGRATION.md; fork lives at
 * ~/mirofish, backend/app/api/simulation.py).
 *
 * A full MiroFish run spins up an OASIS multi-agent world from seed
 * material and can take minutes, so this client starts a simulation,
 * polls until it completes, and returns the resulting sentiment reading.
 * Callers should treat a null result (backend unconfigured, unreachable,
 * failed, or not done before the timeout) as "fall back to a heuristic."
 */

export interface MiroFishSentiment {
  conviction: number; // 0..1 — how strongly the simulated crowd agrees with itself
  bias: number; // -1..1 — net direction of the crowd (-1 bearish, +1 bullish)
  source: "mirofish-swarm";
  detail?: Record<string, unknown>;
}

type SimulationStatus = "pending" | "running" | "completed" | "failed";

interface StartSimulationResponse {
  simulation_id: string;
}

interface SimulationStatusResponse {
  status: SimulationStatus;
  progress?: number;
  error?: string;
}

interface SimulationResultResponse {
  conviction: number;
  bias: number;
  detail?: Record<string, unknown>;
}

function baseUrl(): string | null {
  const url = process.env.MIROFISH_API_URL;
  return url ? url.replace(/\/$/, "") : null;
}

function authHeaders(): Record<string, string> {
  const key = process.env.MIROFISH_API_KEY;
  return key ? { Authorization: `Bearer ${key}` } : {};
}

export function isConfigured(): boolean {
  return baseUrl() !== null;
}

async function startSimulation(seedMaterial: string): Promise<string> {
  const base = baseUrl();
  if (!base) throw new Error("MIROFISH_API_URL not configured");
  const res = await fetch(`${base}/api/simulation/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ seed_material: seedMaterial }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`MiroFish start failed (${res.status})`);
  const data = (await res.json()) as StartSimulationResponse;
  if (!data.simulation_id) throw new Error("MiroFish start response missing simulation_id");
  return data.simulation_id;
}

async function getSimulationStatus(id: string): Promise<SimulationStatusResponse> {
  const base = baseUrl();
  if (!base) throw new Error("MIROFISH_API_URL not configured");
  const res = await fetch(`${base}/api/simulation/${id}/status`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`MiroFish status check failed (${res.status})`);
  return (await res.json()) as SimulationStatusResponse;
}

async function getSimulationResult(id: string): Promise<MiroFishSentiment> {
  const base = baseUrl();
  if (!base) throw new Error("MIROFISH_API_URL not configured");
  const res = await fetch(`${base}/api/simulation/${id}/result`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`MiroFish result fetch failed (${res.status})`);
  const data = (await res.json()) as SimulationResultResponse;
  return {
    conviction: Math.min(1, Math.max(0, data.conviction)),
    bias: Math.min(1, Math.max(-1, data.bias)),
    source: "mirofish-swarm",
    detail: data.detail,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface GetSentimentOptions {
  pollIntervalMs?: number;
  timeoutMs?: number;
}

/**
 * Runs a MiroFish simulation on the given seed material (a market-signal
 * bulletin — see buildSeedMaterial in the swarm cron route) and returns the
 * resulting sentiment reading, or null if the backend isn't configured, the
 * run fails, or it doesn't complete before the timeout.
 */
export async function getSentiment(
  seedMaterial: string,
  { pollIntervalMs = 5000, timeoutMs = 120000 }: GetSentimentOptions = {}
): Promise<MiroFishSentiment | null> {
  if (!isConfigured()) return null;

  try {
    const id = await startSimulation(seedMaterial);
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const status = await getSimulationStatus(id);
      if (status.status === "completed") return await getSimulationResult(id);
      if (status.status === "failed") {
        console.error(`MiroFish simulation ${id} failed:`, status.error);
        return null;
      }
      await sleep(pollIntervalMs);
    }
    console.error(`MiroFish simulation ${id} timed out after ${timeoutMs}ms`);
    return null;
  } catch (err) {
    console.error("MiroFish sentiment client error:", err);
    return null;
  }
}
