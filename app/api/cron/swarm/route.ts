import { NextRequest } from "next/server";
import { execFile } from "node:child_process";
import { supabase, Direction, WatchlistRow } from "@/app/lib/supabase";
import { fetchOhlcvHistory, OhlcvBar } from "@/app/lib/prices";
import { getSentiment as getMiroFishSentiment } from "@/app/lib/mirofish-client";
import { sendTelegram } from "@/app/lib/telegram";
import {
  KRONOS_BUY_THRESHOLD_PCT,
  KRONOS_SELL_THRESHOLD_PCT,
  KRONOS_MIN_CONVICTION,
  KRONOS_PRED_LEN,
  KRONOS_LOOKBACK_BARS,
  KRONOS_FORECAST_TIMEOUT_MS,
} from "@/app/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function checkAuth(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured — allow (local dev)
  const header = req.headers.get("authorization");
  const queryParam = req.nextUrl.searchParams.get("secret");
  return header === `Bearer ${secret}` || queryParam === secret;
}

interface ForecastSummary {
  current_price: number;
  predicted_close: number;
  predicted_low: number;
  predicted_high: number;
  expected_return: number;
  horizon_bars: number;
  horizon: string;
}

interface SentimentReading {
  conviction: number;
  bias: number;
  source: string;
}

type ThesisAction = "BUY" | "SELL" | "HOLD";

interface TradeThesis {
  symbol: string;
  action: ThesisAction;
  currentPrice: number;
  predictedClose: number;
  expectedReturn: number;
  confidence: number;
  rationale: string;
  vetoed: boolean;
}

interface SwarmResult {
  evaluated: string[];
  theses: { symbol: string; action: ThesisAction; confidence: number; sentimentSource: string }[];
  errors: { symbol: string; error: string }[];
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const symbol = req.nextUrl.searchParams.get("symbol");
  const result = await runSwarmAgent(symbol ?? undefined);
  return Response.json(result);
}

export async function POST(req: NextRequest) {
  return GET(req);
}

// Renders a Kronos forecast as MiroFish seed material — a market-signal
// bulletin the simulated agents react to. Mirrors
// mirofish.agents.swarm_agent.build_seed_material so the live route and the
// Python backtest hand the simulator the same shape of input.
function buildSeedMaterial(symbol: string, forecast: ForecastSummary): string {
  const direction = forecast.expected_return >= 0 ? "rise" : "fall";
  const pct = Math.abs(forecast.expected_return) * 100;
  return (
    `Market signal bulletin — ${symbol}\n` +
    `A quantitative K-line foundation model (Kronos) forecasts ${symbol} ` +
    `will ${direction} ${pct.toFixed(2)}% over the next ${forecast.horizon_bars} ` +
    `bars (~${forecast.horizon}), from ${forecast.current_price.toFixed(4)} to a price ` +
    `target of ${forecast.predicted_close.toFixed(4)}.\n` +
    `Forecast range: low ${forecast.predicted_low.toFixed(4)} / high ${forecast.predicted_high.toFixed(
      4
    )}.\n` +
    `Question for the simulation: how do retail traders, swing traders ` +
    `and skeptics react to this forecast becoming public? Do they front-run ` +
    `it, fade it, or ignore it?`
  );
}

// Cheap deterministic stand-in for the MiroFish swarm, used when the
// backend is unconfigured, unreachable, or times out. Mirrors
// mirofish.agents.swarm_agent.HeuristicSentimentSimulator.
function heuristicSentiment(expectedReturn: number): SentimentReading {
  const sensitivity = 25;
  const bias = Math.tanh(sensitivity * expectedReturn);
  const conviction = Math.min(1, 0.4 + 0.6 * Math.abs(bias));
  return { conviction, bias, source: "heuristic" };
}

// Spawns `python -m mirofish.forecast_cli`, feeding OHLCV bars via stdin and
// reading the forecast summary back as JSON from stdout. Kronos is a
// torch/HuggingFace model — it can't run in the Node process directly.
const FORECAST_EXEC_OPTS = {
  timeout: KRONOS_FORECAST_TIMEOUT_MS,
  maxBuffer: 10 * 1024 * 1024,
} as const;

// A non-literal first argument makes Turbopack trace the whole repository
// into this route (the warning names next.config.ts). The default stays a
// string literal. The env override is marked ignored so it does not.
function spawnForecast(args: string[], onExit: (err: Error | null, stdout: string, stderr: string) => void) {
  const override = process.env.KRONOS_PYTHON_BIN;
  if (override) {
    return execFile(/* turbopackIgnore: true */ override, args, FORECAST_EXEC_OPTS, onExit);
  }
  return execFile("python3", args, FORECAST_EXEC_OPTS, onExit);
}

function runForecastCli(symbol: string, bars: OhlcvBar[]): Promise<ForecastSummary> {
  return new Promise((resolve, reject) => {
    const args = [
      "-m",
      "mirofish.forecast_cli",
      "--asset",
      symbol,
      "--pred-len",
      String(KRONOS_PRED_LEN),
      "--lookback",
      String(KRONOS_LOOKBACK_BARS),
    ];
    if (process.env.KRONOS_MOCK === "true") args.push("--mock");
    if (process.env.KRONOS_REPO_PATH) args.push("--kronos-repo", process.env.KRONOS_REPO_PATH);

    const child = spawnForecast(args, (err, stdout, stderr) => {
        if (err) {
          reject(new Error(`forecast_cli failed for ${symbol}: ${stderr || err.message}`));
          return;
        }
        try {
          const parsed = JSON.parse(stdout);
          if (parsed.error) {
            reject(new Error(`forecast_cli error for ${symbol}: ${parsed.error}`));
            return;
          }
          resolve(parsed as ForecastSummary);
        } catch (parseErr) {
          reject(
            new Error(`forecast_cli returned invalid JSON for ${symbol}: ${String(parseErr)}`)
          );
        }
      }
    );
    child.stdin?.write(JSON.stringify({ bars }));
    child.stdin?.end();
  });
}

// Combines a Kronos forecast with a sentiment reading into a trade thesis.
// Mirrors mirofish.agents.swarm_agent.SwarmAgent.decide_trade's math exactly
// so the live route and the Python backtest agree on the same inputs.
function decideTrade(
  symbol: string,
  forecast: ForecastSummary,
  sentiment: SentimentReading
): TradeThesis {
  const buyThreshold = KRONOS_BUY_THRESHOLD_PCT / 100;
  const sellThreshold = KRONOS_SELL_THRESHOLD_PCT / 100;
  const expectedReturn = forecast.expected_return;

  const forecastDirection = Math.tanh(25 * expectedReturn);
  const agreement = forecastDirection * sentiment.bias;

  let action: ThesisAction = "HOLD";
  if (expectedReturn >= buyThreshold) action = "BUY";
  else if (expectedReturn <= sellThreshold) action = "SELL";

  let vetoed = false;
  if (action !== "HOLD" && agreement < 0 && sentiment.conviction >= 1 - KRONOS_MIN_CONVICTION) {
    // The crowd strongly and confidently leans against the forecast —
    // stand aside rather than fight both signals.
    vetoed = true;
    action = "HOLD";
  }

  const edge = Math.abs(expectedReturn) / Math.max(buyThreshold, 1e-9);
  let confidence = Math.min(1, 0.5 * Math.min(edge, 2)) * (0.5 + 0.5 * sentiment.conviction);
  if (agreement > 0) confidence = Math.min(1, confidence * (1 + 0.25 * agreement));
  else if (agreement < 0) confidence *= 1 + 0.5 * agreement;
  if (action === "HOLD") confidence = Math.min(confidence, 0.5);
  confidence = Math.max(0, confidence);

  let rationale =
    `Kronos projects ${(expectedReturn * 100).toFixed(2)}% over ${forecast.horizon_bars} bars ` +
    `(target ${forecast.predicted_close.toFixed(4)} vs current ${forecast.current_price.toFixed(
      4
    )}); swarm sentiment bias ${sentiment.bias >= 0 ? "+" : ""}${sentiment.bias.toFixed(
      2
    )} with conviction ${sentiment.conviction.toFixed(2)} (${sentiment.source}).`;
  if (vetoed) rationale += " Trade vetoed: confident crowd disagreement with the forecast.";

  return {
    symbol,
    action,
    currentPrice: forecast.current_price,
    predictedClose: forecast.predicted_close,
    expectedReturn,
    confidence,
    rationale,
    vetoed,
  };
}

async function runSwarmAgent(symbolFilter?: string): Promise<SwarmResult> {
  const sb = supabase();
  const result: SwarmResult = { evaluated: [], theses: [], errors: [] };

  let query = sb.from("watchlist").select("*").eq("active", true);
  if (symbolFilter) query = query.eq("symbol", symbolFilter.toUpperCase());
  const { data: watchlist } = await query;

  for (const row of (watchlist ?? []) as WatchlistRow[]) {
    result.evaluated.push(row.symbol);
    try {
      const bars = await fetchOhlcvHistory(row.symbol, KRONOS_LOOKBACK_BARS);
      if (!bars || bars.length < 16) {
        result.errors.push({ symbol: row.symbol, error: "insufficient price history" });
        continue;
      }

      const forecast = await runForecastCli(row.symbol, bars);
      const seed = buildSeedMaterial(row.symbol, forecast);

      const sentiment: SentimentReading =
        (await getMiroFishSentiment(seed)) ?? heuristicSentiment(forecast.expected_return);

      const thesis = decideTrade(row.symbol, forecast, sentiment);
      const direction: Direction =
        thesis.action === "BUY" ? "bullish" : thesis.action === "SELL" ? "bearish" : "neutral";

      // thesis.rationale already carries the expected return, price target, and
      // sentiment detail in prose — the signals table has no `meta`/JSON column
      // to store it separately (see scan/route.ts, which has the same gap).
      const { data: inserted, error: insertError } = await sb
        .from("signals")
        .insert({
          symbol: row.symbol,
          direction,
          conviction: Math.round(thesis.confidence * 100),
          summary: thesis.rationale,
          status: thesis.action === "HOLD" ? "ignored" : "pending",
          price: thesis.currentPrice,
        })
        .select("*")
        .single();

      if (insertError) {
        result.errors.push({ symbol: row.symbol, error: `signal insert failed: ${insertError.message}` });
      }

      result.theses.push({
        symbol: row.symbol,
        action: thesis.action,
        confidence: thesis.confidence,
        sentimentSource: sentiment.source,
      });

      if (inserted && thesis.action !== "HOLD") {
        const emoji = thesis.action === "BUY" ? "🟢" : "🔴";
        await sendTelegram(
          `${emoji} <b>SwarmAgent Thesis</b>: ${row.symbol} ${thesis.action} ` +
            `(confidence: ${Math.round(thesis.confidence * 100)}/100)\n${thesis.rationale}\n` +
            `Reply <code>/approve ${row.symbol}</code> or <code>/ignore ${row.symbol}</code>`
        );
      }
    } catch (err) {
      console.error(`SwarmAgent failed for ${row.symbol}:`, err);
      result.errors.push({
        symbol: row.symbol,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}
