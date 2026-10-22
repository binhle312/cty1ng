import { afterEach, describe, expect, it } from "vitest";
import { makeTestApp, OWN_ORIGIN, ping, type TestApp } from "../support/test-app";
import { SseReader } from "../support/sse-client";

const SENTINEL = "sk-ant-sentinel-0123456789abcdef";

let app: TestApp | undefined;
afterEach(() => {
  app?.dispose();
  app = undefined;
});

describe("API keys never leave the server (security.md §2.6, §3)", () => {
  it("no endpoint returns the value of a *_API_KEY", async () => {
    app = makeTestApp({ ANTHROPIC_API_KEY: SENTINEL, OTHER_API_KEY: `${SENTINEL}-2` });
    const bodies: string[] = [];
    for (const path of ["/api/health", "/api/openapi.json", "/api/nope"]) {
      const response = await app.request(path);
      bodies.push(await response.text(), JSON.stringify([...response.headers]));
    }
    await ping(app, "x");
    const stream = new SseReader(
      await app.request("/api/stream", { headers: { origin: OWN_ORIGIN } }),
    );
    await stream.nextFrame();
    await stream.nextFrame();
    bodies.push(JSON.stringify(stream.frames));
    await stream.close();
    for (const body of bodies) expect(body).not.toContain("sk-ant-sentinel");
  });

  it("log lines never contain a key's value, wherever it appears", () => {
    app = makeTestApp({ ANTHROPIC_API_KEY: SENTINEL });
    app.logger.info(
      { provider: { apiKey: SENTINEL }, detail: `request failed for ${SENTINEL}` },
      "x",
    );
    app.logger.error({ err: new Error(`401 invalid x-api-key ${SENTINEL}`) }, `oops ${SENTINEL}`);
    app.logger.warn({ env: { ANTHROPIC_API_KEY: SENTINEL } }, "env dump");
    const output = app.logs.join("");
    expect(output).toContain("[redacted]");
    expect(output).not.toContain(SENTINEL);
  });
});

describe("redaction edge cases (security.md §2.6)", () => {
  it("redacts short keys and keys with characters JSON escapes", () => {
    const short = "k3y";
    const escaped = 'sk"quote\\back\nline';
    app = makeTestApp({ SHORT_API_KEY: short, ODD_API_KEY: escaped });
    app.logger.info({ detail: `short ${short} odd ${escaped}` }, `msg ${escaped}`);
    app.logger.error({ err: new Error(escaped) }, "error with odd key");
    const output = app.logs.join("");
    expect(output).not.toContain(short);
    expect(output).not.toContain(escaped);
    // Pino writes JSON, so the key also appears in its escaped form.
    expect(output).not.toContain(JSON.stringify(escaped).slice(1, -1));
    expect(output).toContain("[redacted]");
  });
});
