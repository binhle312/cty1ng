import { expect, test } from "@playwright/test";

test("writes into the server on the port", async ({ request }) => {
  const response = await request.post(`http://127.0.0.1:${String(process.env.FIXTURE_PORT)}/write`);
  expect(response.ok()).toBe(true);
});
