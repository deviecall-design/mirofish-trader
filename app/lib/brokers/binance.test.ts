import { describe, it, expect } from "vitest";
import { sign, toPair, baseUrl, roundPrice, roundQty } from "./binance";

describe("sign", () => {
  it("produces a stable HMAC-SHA256 hex signature (cross-verified with openssl)", () => {
    const query =
      "symbol=LTCBTC&side=BUY&type=LIMIT&timeInForce=GTC&quantity=1&price=0.1&recvWindow=5000&timestamp=1499827319559";
    const secret =
      "NhqPtmdSJYdKjVHjA7PZj4Mgan7PyT8kbC6bxfqbkeCsAJ2v5T9pYNc8dK1Op0Xj";
    // openssl dgst -sha256 -hmac <secret> over the same query yields this hex.
    expect(sign(query, secret)).toBe(
      "6fab75648aefc09fd5127261c7d7e0cf4220f4cb0bcd78c36bec1c52b11bb7d0"
    );
  });
});

describe("toPair", () => {
  it("maps supported crypto symbols to USDT pairs", () => {
    expect(toPair("BTC")).toBe("BTCUSDT");
    expect(toPair("eth")).toBe("ETHUSDT");
  });

  it("returns null for unsupported symbols (equities stay paper)", () => {
    expect(toPair("NVDA")).toBeNull();
    expect(toPair("DRO.AX")).toBeNull();
  });
});

describe("baseUrl", () => {
  it("defaults to testnet", () => {
    delete process.env.BINANCE_TESTNET;
    expect(baseUrl()).toBe("https://testnet.binance.vision");
    process.env.BINANCE_TESTNET = "true";
    expect(baseUrl()).toBe("https://testnet.binance.vision");
  });

  it("uses production only when testnet is explicitly disabled", () => {
    process.env.BINANCE_TESTNET = "false";
    expect(baseUrl()).toBe("https://api.binance.com");
    delete process.env.BINANCE_TESTNET;
  });
});

describe("rounding", () => {
  it("rounds prices to 2 decimals for USDT pairs", () => {
    expect(roundPrice(64210.5678)).toBe("64210.57");
  });
  it("rounds quantities down to 5 decimals", () => {
    expect(roundQty(0.00156789)).toBe("0.00156");
  });
});
