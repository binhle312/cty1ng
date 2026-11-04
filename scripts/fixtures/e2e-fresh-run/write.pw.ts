import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

test("writes into the server on the port", async ({ request }) => {
  const response = await request.post(`http://127.0.0.1:${String(process.env.FIXTURE_PORT)}/write`);
  expect(response.ok()).toBe(true);
  // The data folder of the run: it exists now, and this test's caller checks that it goes.
  const dataDir = String(process.env.E2E_DATA_DIR);
  expect(existsSync(dataDir)).toBe(true);
  writeFileSync(join(String(process.env.FIXTURE_OUTPUT), "data-dir-in-test"), dataDir);
});
