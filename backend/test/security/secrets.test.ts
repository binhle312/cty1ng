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

describe("redaction keeps every log record valid JSON with intact metadata", () => {
  /** Parses each emitted line; fails the test if any line is not a JSON object. */
  function records(target: TestApp): Record<string, unknown>[] {
    return target.logs
      .join("")
      .split("\n")
      .filter((line) => line !== "")
      .map((line) => {
        const parsed: unknown = JSON.parse(line);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          throw new Error(`log line is not a JSON object: ${line}`);
        }
        return Object.fromEntries(Object.entries(parsed));
      });
  }

  it.each([
    ["a one-character key", "3"],
    ["a key equal to pino's msg field", "msg"],
    ["a key equal to the level field", "level"],
    ["a key equal to a level name", "info"],
    ["a key equal to the time field", "time"],
    ["a key with JSON escape characters", 'sk"q\\x\n'],
  ])("%s", (_label, secret) => {
    app = makeTestApp({ PROBE_API_KEY: secret });
    const child = app.logger.child({ request_id: "req-1" });
    child.info(
      { event: "probe", detail: `value ${secret} here`, status: 300 },
      `message ${secret}`,
    );
    child.error({ event: "probe.error", err: new Error(`failed with ${secret}`) }, "plain message");
    child.warn(new Error(`bare error ${secret}`));

    const all = records(app);
    const probe = all.find((record) => record.event === "probe");
    const failure = all.find((record) => record.event === "probe.error");

    // Metadata is untouched, and the secret is replaced only inside the values we logged.
    expect(probe).toMatchObject({ level: 30, request_id: "req-1", status: 300 });
    expect(typeof probe?.time).toBe("string");
    expect(probe?.msg).toBe("message [redacted]");
    expect(probe?.detail).toBe("value [redacted] here");
    expect(failure).toMatchObject({ level: 50, request_id: "req-1", msg: "plain message" });
    expect(failure?.err).toMatchObject({ type: "Error", message: "failed with [redacted]" });
    const bare = all.find((record) => record.level === 40 && record.err !== undefined);
    expect(bare).toMatchObject({
      msg: "bare error [redacted]",
      err: { message: "bare error [redacted]" },
    });
  });
});
