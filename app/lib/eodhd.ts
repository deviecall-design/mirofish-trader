// Server-only EODHD client. The API key is read from EODHD_API_KEY and is
// never exposed with a NEXT_PUBLIC_ prefix. Callers keep Yahoo as a fallback
// when the key is unset or a symbol comes back as "NA".

const REALTIME = "https://eodhd.com/api/real-time";
const EOD = "https://eodhd.com/api/eod";
const BATCH_SIZE = 20;
const TIMEOUT_MS = 8_000;

export interface EodhdRealtime {
  code: string;
  close: number | null;
  previousClose: number | null;
  changePercent: number | null;
  timestamp: number | null;
}

export interface EodBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** App symbols use Yahoo suffixes. EODHD uses its own exchange codes. */
export function toEodhdCode(symbol: string): string | null {
  const upper = symbol.trim().toUpperCase();
  if (!upper || upper === "BTC" || upper === "ETH") return null;
  const dot = upper.lastIndexOf(".");
  if (dot === -1) return `${upper}.US`;
  const base = upper.slice(0, dot);
  const suffix = upper.slice(dot + 1);
  if (!base || !suffix) return null;
  switch (suffix) {
    case "AX":
      return `${base}.AU`;
    case "JO":
      return `${base}.JSE`;
    case "L":
      return `${base}.LSE`;
    default:
      return null;
  }
}

export function eodhdApiKey(): string | null {
  const key = process.env.EODHD_API_KEY?.trim();
  return key ? key : null;
}

/** Numbers are numeric. The string "NA" and blanks are missing. */
export function parseEodhdNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.toUpperCase() === "NA") return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseRealtimePayload(data: unknown): EodhdRealtime[] {
  const rows = Array.isArray(data) ? data : data && typeof data === "object" ? [data] : [];
  const out: EodhdRealtime[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const code = typeof record.code === "string" ? record.code.trim().toUpperCase() : "";
    if (!code) continue;
    const close = parseEodhdNumber(record.close);
    const previousClose = parseEodhdNumber(record.previousClose);
    let changePercent = parseEodhdNumber(record.change_p);
    if (changePercent == null && close != null && previousClose) {
      changePercent = ((close - previousClose) / previousClose) * 100;
    }
    out.push({
      code,
      close,
      previousClose,
      changePercent,
      timestamp: parseEodhdNumber(record.timestamp),
    });
  }
  return out;
}

export function parseEodPayload(data: unknown): EodBar[] {
  if (!Array.isArray(data)) return [];
  const bars: EodBar[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const date = typeof record.date === "string" ? record.date : "";
    const close = parseEodhdNumber(record.close);
    const open = parseEodhdNumber(record.open);
    const high = parseEodhdNumber(record.high);
    const low = parseEodhdNumber(record.low);
    if (!date || close == null || open == null || high == null || low == null) continue;
    const volume = parseEodhdNumber(record.volume);
    bars.push({ date, open, high, low, close, volume: volume ?? 0 });
  }
  return bars;
}

export function isoDaysAgo(days: number, now = new Date()): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString().slice(0, 10);
}

export interface ResolvedEodhdQuote {
  price: number;
  changePercent: number | null;
  /** Set when the figure is a daily close rather than a live quote. */
  asOf: string | null;
  sparkline: number[];
}

/** Live close wins. A real-time "NA" falls back to the latest daily bar. */
export function resolveEodhdQuote(
  live: EodhdRealtime | null,
  bars: EodBar[]
): ResolvedEodhdQuote | null {
  const sparkline = bars.slice(-7).map((bar) => bar.close);
  if (live?.close != null) {
    return { price: live.close, changePercent: live.changePercent, asOf: null, sparkline };
  }
  const last = bars[bars.length - 1];
  if (!last) return null;
  const prev = bars[bars.length - 2];
  const changePercent =
    prev && prev.close ? ((last.close - prev.close) / prev.close) * 100 : null;
  return { price: last.close, changePercent, asOf: last.date, sparkline };
}

async function getJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchEodhdRealtime(codes: string[], apiKey: string): Promise<EodhdRealtime[]> {
  const out: EodhdRealtime[] = [];
  for (let i = 0; i < codes.length; i += BATCH_SIZE) {
    const chunk = codes.slice(i, i + BATCH_SIZE);
    const [first, ...rest] = chunk;
    const params = new URLSearchParams({ api_token: apiKey, fmt: "json" });
    if (rest.length) params.set("s", rest.join(","));
    const data = await getJson(`${REALTIME}/${encodeURIComponent(first)}?${params}`);
    if (data) out.push(...parseRealtimePayload(data));
  }
  return out;
}

export async function fetchEodhdDaily(
  code: string,
  apiKey: string,
  from: string
): Promise<EodBar[]> {
  const params = new URLSearchParams({
    api_token: apiKey,
    fmt: "json",
    from,
    order: "a",
  });
  const data = await getJson(`${EOD}/${encodeURIComponent(code)}?${params}`);
  return data ? parseEodPayload(data) : [];
}
