import { defineConfig } from "vitest/config";

// One Vitest run for the whole workspace (`pnpm test`): Node tests, and the frontend's
// component and unit tests in jsdom.
//
// Many Node tests start processes (the import gate, startup checks, migration races, the Vite
// dev proxy). While they run, the whole machine is busy: a test that takes about a second alone
// (a process start, or the first render of the app in jsdom) can need more than the 5 s default.
const TEST_TIMEOUT_MS = 20_000;

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          testTimeout: TEST_TIMEOUT_MS,
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
          testTimeout: TEST_TIMEOUT_MS,
          setupFiles: ["frontend/test/setup.ts"],
          include: ["frontend/src/**/*.test.{ts,tsx}"],
        },
      },
    ],
  },
});
