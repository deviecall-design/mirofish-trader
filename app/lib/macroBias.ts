/**
 * Macro Bias Adapter — FRED API Integration
 * Fetches macro indicators to generate a bias scalar [-1, 1]
 * -1 = maximum risk-off (tightening, fear, inverted curve)
 * +1 = maximum risk-on (easing, complacency, strong growth)
 */

interface FREDSeries {
  T10Y2Y?: number; // 10yr - 2yr yield spread
  NFCI?: number; // Chicago Fed National Financial Conditions Index
  VIX?: number; // Implied volatility (CBOE)
  DEXUSEU?: number; // EUR/USD exchange rate (proxy for DXY)
  T10YIE?: number; // 10yr breakeven inflation rate
}

const CACHE_TTL_MS = 3600000; // 1 hour
let macroCache: { bias: number; timestamp: number } | null = null;

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

async function fetchFREDSeries(seriesId: string): Promise<number | null> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    console.warn("FRED_API_KEY not configured — falling back to 0");
    return null;
  }

  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&limit=1`;
    const res = await fetch(url, { next: { revalidate: 300 } }); // 5-min cache
    if (!res.ok) {
      console.error(`FRED API error for ${seriesId}: ${res.status}`);
      return null;
    }
    const data = (await res.json()) as {
      observations?: Array<{ value: string }>;
    };
    const obs = data.observations?.[0];
    if (!obs) return null;
    const val = parseFloat(obs.value);
    return isNaN(val) ? null : val;
  } catch (err) {
    console.error(`Failed to fetch FRED series ${seriesId}:`, err);
    return null;
  }
}

export async function getMacroBias(): Promise<number> {
  // Check cache
  if (macroCache && Date.now() - macroCache.timestamp < CACHE_TTL_MS) {
    return macroCache.bias;
  }

  const series: FREDSeries = {};

  // Fetch all indicators in parallel
  const [t10y2y, nfci, vix, dexuseu, t10yie] = await Promise.all([
    fetchFREDSeries("T10Y2Y"), // 10yr - 2yr spread
    fetchFREDSeries("NFCI"), // Financial Conditions Index
    fetchFREDSeries("VIXCLS"), // VIX (close)
    fetchFREDSeries("DEXUSEU"), // EUR/USD (DXY proxy)
    fetchFREDSeries("T10YIE"), // 10yr breakeven inflation
  ]);

  series.T10Y2Y = t10y2y ?? undefined;
  series.NFCI = nfci ?? undefined;
  series.VIX = vix ?? undefined;
  series.DEXUSEU = dexuseu ?? undefined;
  series.T10YIE = t10yie ?? undefined;

  // Calculate bias from components
  let bias = 0;
  let componentCount = 0;

  // 1. Inverted yield curve signal (-0.3 weight if inverted)
  if (series.T10Y2Y !== undefined) {
    const invertedSignal = series.T10Y2Y < 0 ? 1 : 0;
    bias -= 0.3 * invertedSignal;
    componentCount += 0.3;
  }

  // 2. Financial tightening signal (-0.25 weight, normalized via sigmoid)
  if (series.NFCI !== undefined) {
    // Higher NFCI = tighter conditions = risk-off
    const nfciNorm = sigmoid(series.NFCI); // [0, 1]
    bias -= 0.25 * (nfciNorm * 2 - 1); // Shift to [-1, 1]
    componentCount += 0.25;
  }

  // 3. Volatility signal (-0.2 weight)
  if (series.VIX !== undefined) {
    // Baseline VIX ~15, fear threshold ~20
    const vixNorm = Math.min(1, Math.max(-1, (series.VIX - 15) / 20));
    bias -= 0.2 * vixNorm;
    componentCount += 0.2;
  }

  // 4. USD strength signal (-0.15 weight)
  if (series.DEXUSEU !== undefined) {
    // Strong USD (high EURUSD inverse, ~1.1 baseline) = risk-off
    const dxyNorm = Math.min(1, Math.max(-1, (series.DEXUSEU - 1.1) / 0.15));
    bias -= 0.15 * dxyNorm;
    componentCount += 0.15;
  }

  // 5. Real rates signal (-0.1 weight)
  if (series.T10YIE !== undefined && series.T10Y2Y !== undefined) {
    // Rough estimate: real 10yr = 10yr yield - breakeven inflation
    // Use T10Y2Y as proxy for 10yr level
    const realRateEst = (series.T10Y2Y + 2) - series.T10YIE; // 2yr proxy + spread
    const rateNorm = Math.min(1, Math.max(-1, realRateEst / 2));
    bias -= 0.1 * rateNorm;
    componentCount += 0.1;
  }

  // Normalize by available components
  if (componentCount > 0) {
    bias = bias / componentCount;
  }

  // Clamp to [-1, 1]
  bias = Math.max(-1, Math.min(1, bias));

  // Cache the result
  macroCache = { bias, timestamp: Date.now() };

  return bias;
}
