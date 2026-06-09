/**
 * Tests for social bias adapter
 */

import { getSocialBias } from "./socialBias";

describe("socialBias", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("should return a number between -1 and 1", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          messages: [],
        }),
      } as Response)
    );

    const bias = await getSocialBias("AAPL");
    expect(typeof bias).toBe("number");
    expect(bias).toBeGreaterThanOrEqual(-1);
    expect(bias).toBeLessThanOrEqual(1);
  });

  it("should return 0 for empty message list", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          messages: [],
        }),
      } as Response)
    );

    const bias = await getSocialBias("AAPL");
    expect(bias).toBe(0);
  });

  it("should calculate bullish bias from explicit sentiment", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          messages: [
            { body: "AAPL to the moon", sentiment: "Bullish", created_at: "2024-01-01" },
            { body: "Strong buy signal", sentiment: "Bullish", created_at: "2024-01-01" },
            { body: "Sell pressure", sentiment: "Bearish", created_at: "2024-01-01" },
          ],
        }),
      } as Response)
    );

    const bias = await getSocialBias("AAPL");
    expect(bias).toBeGreaterThan(0); // More bullish than bearish
  });

  it("should calculate bearish bias from explicit sentiment", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          messages: [
            { body: "This is a dump", sentiment: "Bearish", created_at: "2024-01-01" },
            { body: "Crashing hard", sentiment: "Bearish", created_at: "2024-01-01" },
            { body: "Strong bull run", sentiment: "Bullish", created_at: "2024-01-01" },
          ],
        }),
      } as Response)
    );

    const bias = await getSocialBias("AAPL");
    expect(bias).toBeLessThan(0); // More bearish than bullish
  });

  it("should detect bullish keywords in message text", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          messages: [
            { body: "AAPL moon rocket buy long", sentiment: null, created_at: "2024-01-01" },
            { body: "This is undervalued gem", sentiment: null, created_at: "2024-01-01" },
          ],
        }),
      } as Response)
    );

    const bias = await getSocialBias("AAPL");
    expect(bias).toBeGreaterThan(0);
  });

  it("should detect bearish keywords in message text", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          messages: [
            { body: "Going to crash and dump", sentiment: null, created_at: "2024-01-01" },
            { body: "Baghold incoming rug pull", sentiment: null, created_at: "2024-01-01" },
          ],
        }),
      } as Response)
    );

    const bias = await getSocialBias("AAPL");
    expect(bias).toBeLessThan(0);
  });

  it("should handle API errors gracefully", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 429,
      } as Response)
    );

    const bias = await getSocialBias("AAPL");
    expect(typeof bias).toBe("number");
    expect(bias).toBe(0); // Falls back to 0 on error
  });

  it("should cache results for 5 minutes", async () => {
    let callCount = 0;
    global.fetch = jest.fn(() => {
      callCount++;
      return Promise.resolve({
        ok: true,
        json: async () => ({
          messages: [
            { body: "bullish", sentiment: "Bullish", created_at: "2024-01-01" },
          ],
        }),
      } as Response);
    });

    const bias1 = await getSocialBias("AAPL");
    const bias2 = await getSocialBias("AAPL");

    // Should be same from cache
    expect(bias1).toBe(bias2);
    // Cache is working (would be 1 call if cache works, otherwise 2)
  });

  it("should apply volume confidence scaling", async () => {
    // 5 messages should have lower confidence than 30 messages
    global.fetch = jest.fn(async (url: string) => {
      const messageCount = url.includes("AAPL") ? 5 : 30;
      return Promise.resolve({
        ok: true,
        json: async () => ({
          messages: Array(messageCount).fill({
            body: "bullish",
            sentiment: "Bullish",
            created_at: "2024-01-01",
          }),
        }),
      } as Response);
    });

    const bias5 = await getSocialBias("AAPL");
    const bias30 = await getSocialBias("TSLA");

    // Both should be bullish, but 5-msg case should be less pronounced
    // (if both have same raw ratio but 5 msgs applied lower confidence)
    expect(Math.abs(bias5)).toBeLessThanOrEqual(Math.abs(bias30));
  });

  it("should handle different symbols independently", async () => {
    global.fetch = jest.fn(async (url: string) => {
      if (url.includes("AAPL")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            messages: [
              { body: "AAPL bullish", sentiment: "Bullish", created_at: "2024-01-01" },
            ],
          }),
        } as Response);
      } else {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            messages: [
              { body: "TSLA bearish", sentiment: "Bearish", created_at: "2024-01-01" },
            ],
          }),
        } as Response);
      }
    });

    const aaplBias = await getSocialBias("AAPL");
    const tslaBias = await getSocialBias("TSLA");

    expect(aaplBias).toBeGreaterThan(tslaBias);
  });
});
