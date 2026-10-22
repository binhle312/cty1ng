import { afterEach, describe, expect, it } from "vitest";
import { makeTestApp, type TestApp } from "../support/test-app";

let app: TestApp | undefined;
afterEach(() => {
  app?.dispose();
  app = undefined;
});

describe("GET /api/health (api.md §7)", () => {
  it("reports the database, a worker that has not started, and an empty catalog", async () => {
    app = makeTestApp();
    const response = await app.request("/api/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      db: "ok",
      worker: "not_started",
      catalog: { models: 0, available: 0 },
    });
  });

  it("counts the fake:scripted model when FAKE_MODEL=1", async () => {
    app = makeTestApp({ FAKE_MODEL: "1" });
    const response = await app.request("/api/health");
    expect(await response.json()).toMatchObject({ catalog: { models: 1, available: 1 } });
  });

  it("reports db: error when the database is unreachable", async () => {
    app = makeTestApp();
    app.connections.read.sqlite.close();
    const response = await app.request("/api/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ db: "error" });
  });

  it("answers unknown paths with 404 not_found", async () => {
    app = makeTestApp();
    const response = await app.request("/api/nope");
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: "not_found" } });
  });
});
