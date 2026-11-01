import { describe, expect, it } from "vitest";
import { testBackend } from "../helpers.ts";

// api.md §7: GET /api/health.
describe("GET /api/health", () => {
  // The test config sets no *_API_KEY (testing.md §2), so every catalog model is unavailable.
  it("is 200 with the database up, worker not started, and no available model", async () => {
    const backend = testBackend();
    const response = await backend.request("/api/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      db: "ok",
      worker: "not_started",
      catalog: { models: 6, available: 0 },
    });
    backend.close();
  });

  it("counts fake:scripted and fake:effort as available when FAKE_MODEL=1", async () => {
    const backend = testBackend({ FAKE_MODEL: "1" });
    expect(await (await backend.request("/api/health")).json()).toMatchObject({
      catalog: { models: 8, available: 2 },
    });
    backend.close();
  });

  it("is 503 when the database does not answer", async () => {
    const backend = testBackend();
    backend.close(); // closes the connections; the app object stays
    const response = await backend.request("/api/health");
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ db: "error" });
  });
});
