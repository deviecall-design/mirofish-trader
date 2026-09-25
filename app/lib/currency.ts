// Market labels for prices. Numbers from Yahoo stay in the provider's quote
// unit (JSE in cents, LSE in pence). Display converts those minor units so a
// rand or pound symbol is not stuck on a cent or penny figure. Percent P&L
// keeps using the raw quote, so this file must not rescale stored prices.

export const PRICE_UNAVAILABLE = "price unavailable";

const MINOR_UNITS: Record<string, { currency: string; divisor: number }> = {
  GBp: { currency: "GBP", divisor: 100 },
  GBX: { currency: "GBP", divisor: 100 },
  ZAc: { currency: "ZAR", divisor: 100 },
  ZAC: { currency: "ZAR", divisor: 100 },
  ILA: { currency: "ILS", divisor: 100 },
};

const PREFIX: Record<string, string> = {
  USD: "$",
  AUD: "A$",
  ZAR: "R",
  GBP: "£",
  EUR: "€",
  CAD: "C$",
  HKD: "HK$",
  CHF: "CHF ",
  JPY: "¥",
  SGD: "S$",
  NZD: "NZ$",
  ILS: "₪",
  KRW: "₩",
  TWD: "NT$",
};

/** Quote currency Yahoo (or the exchange suffix) actually uses, including minor units. */
export function quoteCurrencyForSymbol(symbol: string): string {
  const upper = symbol.trim().toUpperCase();
  if (upper === "BTC" || upper === "ETH") return "USD";
  const suffix = upper.includes(".") ? (upper.split(".").pop() ?? "") : "";
  switch (suffix) {
    case "AX":
      return "AUD";
    case "JO":
      return "ZAc";
    case "L":
      return "GBp";
    case "TO":
    case "V":
      return "CAD";
    case "HK":
      return "HKD";
    case "DE":
    case "PA":
    case "AS":
      return "EUR";
    case "SW":
      return "CHF";
    case "SI":
      return "SGD";
    case "NZ":
      return "NZD";
    case "T":
      return "JPY";
    case "TW":
      return "TWD";
    case "KS":
    case "KQ":
      return "KRW";
    default:
      return "USD";
  }
}

export function displayCurrency(quoteCurrency: string): string {
  return MINOR_UNITS[quoteCurrency]?.currency ?? quoteCurrency;
}

export function toDisplay(
  amount: number,
  quoteCurrency: string
): { amount: number; currency: string } {
  const minor = MINOR_UNITS[quoteCurrency];
  if (!minor) return { amount, currency: quoteCurrency };
  return { amount: amount / minor.divisor, currency: minor.currency };
}

export function formatMoney(
  amount: number | null | undefined,
  quoteCurrency: string
): string {
  if (amount == null || !Number.isFinite(amount)) return PRICE_UNAVAILABLE;
  const shown = toDisplay(amount, quoteCurrency);
  const digits = Math.abs(shown.amount) < 1 ? 4 : 2;
  const formatted = shown.amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  });
  const prefix = PREFIX[shown.currency] ?? `${shown.currency} `;
  return `${prefix}${formatted}`;
}

/** Market cap is already in major units of billions (Yahoo `marketCap`). */
export function formatMarketCap(
  billions: number | null | undefined,
  quoteCurrency: string
): string {
  if (billions == null || !Number.isFinite(billions)) return "—";
  const currency = displayCurrency(quoteCurrency);
  const prefix = PREFIX[currency] ?? `${currency} `;
  if (billions >= 1000) return `${prefix}${(billions / 1000).toFixed(1)}T`;
  if (billions >= 1) return `${prefix}${billions.toFixed(1)}B`;
  return `${prefix}${(billions * 1000).toFixed(0)}M`;
}
