import { defineConfig } from "vitest/config";

// One Vitest run for the whole workspace (`pnpm test`). M0c adds frontend/.
export default defineConfig({
  test: {
    include: [
      "shared/src/**/*.test.ts",
      "scripts/**/*.test.ts",
      "backend/src/**/*.test.ts",
      "backend/test/**/*.test.ts",
    ],
  },
});
