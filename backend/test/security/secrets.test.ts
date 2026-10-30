import { describe, expect, it } from "vitest";
import { createLogger, redactingStream } from "../../src/adapters/log/pino-logger.ts";
import { ORIGIN, sleep, testBackend } from "../helpers.ts";

// security.md §2.6 and §3: no response and no log line ever contains the value of a
// `*_API_KEY` variable.
const SENTINEL = "sk-test-SENTINEL-4f9a2c71e0b3";

describe("API keys", () => {
  it("never appear in a response of any endpoint, nor in the log", async () => {
    const backend = testBackend({ OPENAI_API_KEY: SENTINEL, ANTHROPIC_API_KEY: `${SENTINEL}-2` });
    const texts: string[] = [];
    const requests: [string, RequestInit?][] = [
      ["/api/health"],
      ["/api/openapi.json"],
      ["/api/nope"],
      ["/api/health", { headers: { host: "evil.com" } }],
      [
        "/api/_test/events",
        {
          method: "POST",
          headers: { origin: ORIGIN, "content-type": "application/json" },
          body: "{}",
        },
      ],
    ];
    for (const [path, init] of requests) {
      const response = await backend.request(path, init);
      texts.push(JSON.stringify([...response.headers]), await response.text());
    }
    const abort = new AbortController();
    const stream = await backend.request("/api/stream", { signal: abort.signal });
    await backend.postTestEvent("x");
    await sleep(50);
    abort.abort();
    texts.push(await stream.text().catch(() => ""));

    expect(backend.config.secrets).toContain(SENTINEL);
    for (const text of [...texts, ...backend.lines]) expect(text).not.toContain("SENTINEL");
    backend.close();
  });

  it("are redacted from log messages, fields, child bindings and JSON-escaped text", () => {
    const lines: string[] = [];
    const quoted = 'key-with-"quote"-and-\\slash';
    const log = createLogger({
      level: "info",
      secrets: [SENTINEL, quoted],
      destination: { write: (line: string) => void lines.push(line) },
    });
    log.info(`message ${SENTINEL}`);
    log.info({ header: `Bearer ${SENTINEL}`, nested: { key: SENTINEL } }, "field");
    log.child({ api_key: SENTINEL }).info("child");
    log.info({ value: quoted }, "escaped");
    log.error({ err: new Error(`provider said ${SENTINEL}`) }, "error");
    expect(lines).toHaveLength(5);
    for (const line of lines) {
      expect(line).not.toContain("SENTINEL");
      expect(line).not.toContain("quote");
      expect(() => {
        JSON.parse(line);
      }).not.toThrow();
    }
    expect(lines.join()).toContain("[REDACTED]");
  });

  it("leaves the log untouched when no key is set", () => {
    const destination = { write: () => undefined };
    expect(redactingStream(destination, [])).toBe(destination);
  });

  it("keep newlines escaped, so text cannot forge a log line", () => {
    const lines: string[] = [];
    const log = createLogger({
      level: "info",
      secrets: [],
      destination: { write: (l: string) => void lines.push(l) },
    });
    log.info({ text: 'reply\n{"level":50,"msg":"forged"}' }, "model output");
    expect(lines).toHaveLength(1);
    expect(lines[0]?.trimEnd().split("\n")).toHaveLength(1);
  });
});
