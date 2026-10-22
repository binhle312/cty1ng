import { afterEach, describe, expect, it } from "vitest";
import { BASE, DEV_ORIGIN, makeTestApp, OWN_ORIGIN, PORT, type TestApp } from "../support/test-app";

let app: TestApp | undefined;
afterEach(() => {
  app?.dispose();
  app = undefined;
});

const post = (target: TestApp, headers: Record<string, string>) =>
  target.request("/api/_test/events", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ note: "x" }),
  });

/** Headers from security.md §2.1 that every response, including a rejection, must carry. */
function expectSecurityHeaders(response: Response): void {
  expect(response.headers.get("content-security-policy")).toBe(
    "default-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'",
  );
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  expect(response.headers.get("strict-transport-security")).toBeNull();
}

describe("AC3: Host and Origin checks (security.md §2.1, §3)", () => {
  it("AC3: POST with Origin https://evil.com gets 403 origin_rejected", async () => {
    app = makeTestApp();
    const response = await post(app, { origin: "https://evil.com" });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "origin_rejected" } });
  });

  it("POST without Origin gets 403 origin_rejected", async () => {
    app = makeTestApp();
    const response = await post(app, {});
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "origin_rejected" } });
  });

  it("POST from the app's own origin or an ALLOWED_ORIGINS entry passes", async () => {
    app = makeTestApp();
    expect((await post(app, { origin: OWN_ORIGIN })).status).toBe(201);
    expect((await post(app, { origin: DEV_ORIGIN })).status).toBe(201);
    expect((await post(app, { origin: `http://localhost:${PORT}` })).status).toBe(201);
  });

  it.each(["evil.com", "127.0.0.1:9999", "127.0.0.1.evil.com:8000", ""])(
    "AC3: Host %j gets 403 host_rejected",
    async (host) => {
      app = makeTestApp();
      const response = await app.http.request(`${BASE}/api/health`, { headers: { host } });
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ error: { code: "host_rejected" } });
    },
  );

  it("a GET that sends a foreign Origin is rejected; a GET without Origin passes", async () => {
    app = makeTestApp();
    expect(
      (await app.request("/api/health", { headers: { origin: "https://evil.com" } })).status,
    ).toBe(403);
    expect((await app.request("/api/health")).status).toBe(200);
  });

  it("the SSE endpoint applies the same checks", async () => {
    app = makeTestApp();
    const foreign = await app.request("/api/stream", { headers: { origin: "https://evil.com" } });
    expect(foreign.status).toBe(403);
    const wrongHost = await app.http.request(`${BASE}/api/stream`, {
      headers: { host: "evil.com" },
    });
    expect(wrongHost.status).toBe(403);
  });

  it("rejected responses carry the security headers (owner, PR #10)", async () => {
    app = makeTestApp();
    expectSecurityHeaders(await post(app, { origin: "https://evil.com" }));
    expectSecurityHeaders(
      await app.http.request(`${BASE}/api/health`, { headers: { host: "evil.com" } }),
    );
    expectSecurityHeaders(await app.request("/api/health"));
  });

  it("CORS answers only ALLOWED_ORIGINS, never a wildcard", async () => {
    app = makeTestApp();
    const allowed = await app.request("/api/health", { headers: { origin: DEV_ORIGIN } });
    expect(allowed.headers.get("access-control-allow-origin")).toBe(DEV_ORIGIN);
    const preflight = await app.request("/api/_test/events", {
      method: "OPTIONS",
      headers: { origin: "https://evil.com", "access-control-request-method": "POST" },
    });
    expect(preflight.status).toBe(403);
    expect(preflight.headers.get("access-control-allow-origin")).toBeNull();
  });
});
