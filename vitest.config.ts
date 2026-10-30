import { defineConfig } from "vitest/config";

// One Vitest run for the whole workspace (`pnpm test`). M0b and M0c add backend/ and frontend/.
export default defineConfig({
  test: {
    include: ["shared/src/**/*.test.ts", "scripts/**/*.test.ts"],
  },
});
