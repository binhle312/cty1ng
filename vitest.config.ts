import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "shared/src/**/*.test.ts",
      "backend/src/**/*.test.ts",
      "backend/test/**/*.test.ts",
      "scripts/**/*.test.ts",
    ],
    exclude: ["**/node_modules/**", "reference/**", "**/fixtures/**"],
    environment: "node",
    testTimeout: 15_000,
  },
});
