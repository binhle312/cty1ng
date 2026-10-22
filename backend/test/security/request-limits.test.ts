import { afterEach, describe, expect, it } from "vitest";
import { makeTestApp, OWN_ORIGIN, type TestApp } from "../support/test-app";

let app: TestApp | undefined;
afterEach(() => {
  app?.dispose();
  app = undefined;
});

const post = (target: TestApp, body: string) =>
  target.request("/api/_test/events", {
    method: "POST",
    headers: { origin: OWN_ORIGIN, "content-type": "application/json" },
    body,
  });

describe("request body checks (security.md §2.7, §2.9, §3)", () => {
  it("a body over 1 MB gets 413 too_large before it is parsed", async () => {
    app = makeTestApp();
    const response = await post(app, JSON.stringify({ note: "x".repeat(1024 * 1024) }));
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ error: { code: "too_large" } });
  });

  it("unknown JSON fields get 422 validation_error naming the field", async () => {
    app = makeTestApp();
    const response = await post(app, JSON.stringify({ note: "x", extra: true }));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: { code: "validation_error", field: "extra" },
    });
  });
});
