import { defineConfig } from "vitest/config";

// Scoped to the new risk/broker tests. The older jest-style tests
// (macroBias.test.ts, socialBias.test.ts, src/__tests__) predate any
// installed runner and are excluded until they are migrated.
export default defineConfig({
  test: {
    include: [
      "app/lib/risk.test.ts",
      "app/lib/brokers/**/*.test.ts",
      "app/lib/pnl.test.ts",
      "app/lib/freshness.test.ts",
      "app/lib/signalPolicy.test.ts",
      "app/lib/inputAvailability.test.ts",
    ],
    environment: "node",
  },
});
