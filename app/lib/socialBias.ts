/**
 * Social Bias Adapter — StockTwits Sentiment Integration
 * Fetches retail sentiment from StockTwits to generate a bias scalar [-1, 1]
 * -1 = maximum bearish sentiment
 * +1 = maximum bullish sentiment
 */

interface StockTwitsMessage {
  created_at: string;
  body: string;
  sentiment: "Bullish" | "Bearish" | null;
}

interface StockTwitsResponse {
  messages: StockTwitsMessage[];
}

const CACHE_TTL_MS = 300000; // 5 minutes
const sentimentCache = new Map<string, { bias: number; timestamp: number }>();

// Sentiment keywords for fallback if StockTwits doesn't provide explicit sentiment
const BULLISH_KEYWORDS = [
  "moon",
  "bull",
  "buy",
  "long",
  "undervalued",
  "gem",
  "hodl",
  "rocket",
  "pump",
  "gains",
];
const BEARISH_KEYWORDS = [
  "dump",
  "crash",
  "short",
  "oversold",
  "baghold",
  "rug",
  "liquidation",
  "panic",
  "sell",
  "dump",
];

function scoreText(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.filter((kw) => lower.includes(kw)).length;
}

async function fetchStockTwitsSentiment(symbol: string): Promise<StockTwitsMessage[]> {
  try {
    const url = `https://api.stocktwits.com/api/2/streams/symbol/${symbol}.json?limit=30`;
    const res = await fetch(url, {
      next: { revalidate: 300 }, // 5-min cache
    });
    if (!res.ok) {
      console.warn(`StockTwits API error for ${symbol}: ${res.status}`);
      return [];
    }
    const data = (await res.json()) as StockTwitsResponse;
    return data.messages || [];
  } catch (err) {
    console.error(`Failed to fetch StockTwits sentiment for ${symbol}:`, err);
    return [];
  }
}

function calculateBiasFromMessages(messages: StockTwitsMessage[]): number {
  if (messages.length === 0) return 0;

  let bullishCount = 0;
  let bearishCount = 0;
  let neutralCount = 0;

  for (const msg of messages) {
    // Use explicit sentiment if available
    if (msg.sentiment === "Bullish") {
      bullishCount++;
    } else if (msg.sentiment === "Bearish") {
      bearishCount++;
    } else {
      // Fallback to keyword detection
      const bullishScore = scoreText(msg.body, BULLISH_KEYWORDS);
      const bearishScore = scoreText(msg.body, BEARISH_KEYWORDS);

      if (bullishScore > bearishScore) {
        bullishCount++;
      } else if (bearishScore > bullishScore) {
        bearishCount++;
      } else {
        neutralCount++;
      }
    }
  }

  const total = bullishCount + bearishCount + neutralCount;
  if (total === 0) return 0;

  // Calculate sentiment ratio
  // Higher bullish ratio = +1, higher bearish ratio = -1
  const bullishRatio = bullishCount / total;
  const bearishRatio = bearishCount / total;

  // bias = (bullish - bearish) / total
  const bias = (bullishRatio - bearishRatio);

  // Apply recency weight (newer messages slightly more important)
  // For MVP, we'll weight all equally — can improve with timestamps later

  // Apply volume confidence (more messages = higher confidence)
  const volumeConfidence = Math.min(1, total / 20); // 20 msgs = max confidence

  return bias * volumeConfidence;
}

export async function getSocialBias(symbol: string): Promise<number> {
  // Check cache
  const cached = sentimentCache.get(symbol);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.bias;
  }

  // Fetch messages from StockTwits
  const messages = await fetchStockTwitsSentiment(symbol);

  // Calculate bias from messages
  const bias = calculateBiasFromMessages(messages);

  // Clamp to [-1, 1]
  const clampedBias = Math.max(-1, Math.min(1, bias));

  // Cache the result
  sentimentCache.set(symbol, { bias: clampedBias, timestamp: Date.now() });

  return clampedBias;
}
