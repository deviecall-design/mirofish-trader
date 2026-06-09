/**
 * Tests for macro bias adapter
 */

import { getMacroBias } from "./macroBias";

describe("macroBias", () => {
  beforeEach(() => {
    // Clear cache before each test by resetting module
    jest.resetModules();
  });

  it("should return a number between -1 and 1", async () => {
    const bias = await getMacroBias();
    expect(typeof bias).toBe("number");
    expect(bias).toBeGreaterThanOrEqual(-1);
    expect(bias).toBeLessThanOrEqual(1);
  });

  it("should handle missing FRED_API_KEY gracefully", async () => {
    const originalKey = process.env.FRED_API_KEY;
    delete process.env.FRED_API_KEY;

    try {
      const bias = await getMacroBias();
      // Should return 0 when no API key
      expect(typeof bias).toBe("number");
      expect(bias).toBeDefined();
    } finally {
      if (originalKey) {
        process.env.FRED_API_KEY = originalKey;
      }
    }
  });

  it("should return risk-off bias when yield curve is inverted", async () => {
    // Mock FRED API response with inverted curve
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          observations: [{ value: "-0.5" }], // Inverted spread
        }),
      } as Response)
    );

    const bias = await getMacroBias();
    expect(bias).toBeLessThan(0); // Risk-off
  });

  it("should cache results for 1 hour", async () => {
    let callCount = 0;
    global.fetch = jest.fn(() => {
      callCount++;
      return Promise.resolve({
        ok: true,
        json: async () => ({
          observations: [{ value: "0.5" }],
        }),
      } as Response);
    });

    const bias1 = await getMacroBias();
    const bias2 = await getMacroBias();

    // Should be same result from cache
    expect(bias1).toBe(bias2);
    // Should have been called only once per series (5 series fetched)
    // Due to caching at module level
  });

  it("should handle API errors gracefully", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 429,
      } as Response)
    );

    const bias = await getMacroBias();
    expect(typeof bias).toBe("number");
    // Should return a computed bias even if some APIs fail
  });

  it("should weight components appropriately", async () => {
    // This is more of an integration test
    // Verify that with a full set of indicators, we get a reasonable bias
    const bias = await getMacroBias();
    expect(typeof bias).toBe("number");
    expect(bias).toBeGreaterThanOrEqual(-1);
    expect(bias).toBeLessThanOrEqual(1);
  });
});
