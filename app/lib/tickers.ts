// Watchlist symbols must be exchange tickers. Company names such as
// "LIGHTBRIDGE" used to be uppercased and inserted as-is, and Yahoo then
// returned no price. This module rejects those and, when a search hit is
// unambiguous, resolves the name to a ticker. It does not write to the database.

const TICKER_RE = /^[A-Z0-9]{1,5}(\.[A-Z]{1,3})?$/;

export interface SymbolHit {
  symbol: string;
  name: string;
}

export function normalizeSymbolInput(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, " ");
}

export function looksLikeTicker(symbol: string): boolean {
  return TICKER_RE.test(symbol.trim().toUpperCase());
}

export type ResolveResult =
  | { ok: true; symbol: string; resolvedFrom?: string }
  | { ok: false; reason: string };

const QUOTE_TYPES = new Set(["EQUITY", "ETF", "CRYPTOCURRENCY"]);

const SEARCH_HOSTS = [
  "https://query2.finance.yahoo.com",
  "https://query1.finance.yahoo.com",
];

export async function searchYahooSymbols(query: string): Promise<SymbolHit[]> {
  for (const host of SEARCH_HOSTS) {
    try {
      const res = await fetch(
        `${host}/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=6&newsCount=0`,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            Accept: "application/json,text/plain,*/*",
          },
          cache: "no-store",
          signal: AbortSignal.timeout(8_000),
        }
      );
      if (!res.ok) continue;
      const hits = hitsFromYahooSearch(await res.json());
      if (hits.length) return hits;
    } catch {
      continue;
    }
  }
  return [];
}

export function hitsFromYahooSearch(data: unknown): SymbolHit[] {
  const quotes = (data as { quotes?: unknown[] } | null)?.quotes;
  if (!Array.isArray(quotes)) return [];
  const hits: SymbolHit[] = [];
  for (const row of quotes) {
    if (!row || typeof row !== "object") continue;
    const quote = row as {
      symbol?: string;
      shortname?: string;
      longname?: string;
      quoteType?: string;
    };
    const symbol = quote.symbol?.trim().toUpperCase();
    if (!symbol || !looksLikeTicker(symbol)) continue;
    if (quote.quoteType && !QUOTE_TYPES.has(quote.quoteType)) continue;
    hits.push({
      symbol,
      name: quote.shortname || quote.longname || symbol,
    });
  }
  return hits;
}

export async function resolveWatchlistSymbol(
  raw: string,
  deps: {
    hasQuote: (symbol: string) => Promise<boolean>;
    search: (query: string) => Promise<SymbolHit[]>;
  }
): Promise<ResolveResult> {
  const input = normalizeSymbolInput(raw);
  if (!input) return { ok: false, reason: "symbol required" };

  if (looksLikeTicker(input)) {
    if (await deps.hasQuote(input)) return { ok: true, symbol: input };
    return {
      ok: false,
      reason: `No price for ${input}. Check the ticker and exchange suffix (for example .AX).`,
    };
  }

  let hits: SymbolHit[] = [];
  try {
    hits = await deps.search(input);
  } catch {
    hits = [];
  }

  const primary = hits.filter((hit) => !hit.symbol.includes("."));
  const chosen = hits.length === 1 ? hits[0] : primary.length === 1 ? primary[0] : null;
  if (chosen) {
    return { ok: true, symbol: chosen.symbol, resolvedFrom: input };
  }

  if (hits.length > 1) {
    const sample = hits
      .slice(0, 4)
      .map((hit) => `${hit.symbol} (${hit.name})`)
      .join(", ");
    return {
      ok: false,
      reason: `“${input}” matches more than one listing. Enter a ticker: ${sample}`,
    };
  }

  return {
    ok: false,
    reason: `“${input}” is not a ticker. Enter the exchange symbol, for example LEU instead of Centrus.`,
  };
}
