import { describe, expect, it } from "vitest";
import {
  PRICE_UNAVAILABLE,
  formatMarketCap,
  formatMoney,
  quoteCurrencyForSymbol,
  toDisplay,
} from "./currency";

describe("quoteCurrencyForSymbol", () => {
  it("maps each market suffix", () => {
    expect(quoteCurrencyForSymbol("NVDA")).toBe("USD");
    expect(quoteCurrencyForSymbol("DRO.AX")).toBe("AUD");
    expect(quoteCurrencyForSymbol("IMP.JO")).toBe("ZAc");
    expect(quoteCurrencyForSymbol("1SN.L")).toBe("GBp");
    expect(quoteCurrencyForSymbol("btc")).toBe("USD");
  });
});

describe("formatMoney", () => {
  it("labels US, ASX, JSE and LSE in their own currency", () => {
    expect(formatMoney(224.58, "USD")).toBe("$224.58");
    expect(formatMoney(1.602, "AUD")).toBe("A$1.60");
    expect(formatMoney(19874, "ZAc")).toBe("R198.74");
    expect(formatMoney(13.1, "GBp")).toBe("£0.131");
  });

  it("does not put a dollar sign on an ASX or JSE quote", () => {
    expect(formatMoney(1.6, "AUD").startsWith("$")).toBe(false);
    expect(formatMoney(19874, "ZAc").includes("$")).toBe(false);
  });

  it("says when a price could not be fetched", () => {
    expect(formatMoney(null, "USD")).toBe(PRICE_UNAVAILABLE);
    expect(formatMoney(undefined, "AUD")).toBe(PRICE_UNAVAILABLE);
  });

  it("keeps the raw quote for calculations and only converts for display", () => {
    expect(toDisplay(19874, "ZAc")).toEqual({ amount: 198.74, currency: "ZAR" });
    expect(toDisplay(224.58, "USD")).toEqual({ amount: 224.58, currency: "USD" });
  });
});

describe("formatMarketCap", () => {
  it("uses the listing currency", () => {
    expect(formatMarketCap(3.2, "AUD")).toBe("A$3.2B");
    expect(formatMarketCap(2500, "USD")).toBe("$2.5T");
    expect(formatMarketCap(null, "USD")).toBe("—");
  });
});
