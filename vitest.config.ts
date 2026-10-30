import { defineConfig } from "vitest/config";

// One Vitest run for the whole workspace (`pnpm test`): Node tests, and the frontend's
// component and unit tests in jsdom.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          // Many of these tests start processes (the import gate, startup checks, migration
          // races, the Vite dev proxy). Alone each takes about a second; with the whole run in
          // parallel they need more than the 5 s default.
          testTimeout: 20_000,
          include: [
            "shared/src/**/*.test.ts",
            "scripts/**/*.test.ts",
            "backend/src/**/*.test.ts",
            "backend/test/**/*.test.ts",
          ],
        },
      },
      {
        test: {
          name: "frontend",
          environment: "jsdom",
          setupFiles: ["frontend/test/setup.ts"],
          include: ["frontend/src/**/*.test.{ts,tsx}"],
        },
      },
    ],
  },
});
