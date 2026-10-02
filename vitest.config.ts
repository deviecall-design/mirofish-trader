import { defineConfig } from "vitest/config";

// The kill-switch test is self-contained (it imports vitest). Older
// jest-style tests in this branch are not wired to a runner.
export default defineConfig({
  test: {
    include: ["app/lib/telegram.test.ts"],
    environment: "node",
  },
});
