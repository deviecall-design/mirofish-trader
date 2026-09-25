import { defineConfig } from "vitest/config";

// Scoped to the new risk/broker tests. The older jest-style tests
// (macroBias.test.ts, socialBias.test.ts, src/__tests__) predate any
// installed runner and are excluded until they are migrated.
export default defineConfig({
  test: {
    include: [
      "app/lib/risk.test.ts",
      "app/lib/orderAuth.test.ts",
      "app/lib/brokers/**/*.test.ts",
    ],
    environment: "node",
  },
});
