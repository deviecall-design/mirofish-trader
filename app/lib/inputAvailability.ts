// One reading from a feed the Monte Carlo model uses (FRED macro, StockTwits).
// `available` is false when the number is a fallback, almost always 0.
// `detail` explains a fallback or a partial read. Both are written into the
// signal summary so the scan records them without a new database column.

export interface InputReading {
  value: number;
  available: boolean;
  detail: string | null;
}

export function unavailableInput(detail: string): InputReading {
  return { value: 0, available: false, detail };
}

function formatReading(name: string, reading: InputReading): string {
  if (!reading.available) {
    const why = reading.detail ? ` (${reading.detail})` : "";
    return `${name} unavailable, treated as 0${why}`;
  }
  const n = `${reading.value >= 0 ? "+" : ""}${reading.value.toFixed(2)}`;
  return reading.detail ? `${name} ${n} (${reading.detail})` : `${name} ${n}`;
}

export function formatInputLine(macro: InputReading, social: InputReading): string {
  return `Inputs: ${formatReading("macro", macro)}; ${formatReading("social", social)}.`;
}
