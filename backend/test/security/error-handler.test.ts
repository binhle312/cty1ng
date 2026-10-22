import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createHttpApp } from "../../src/adapters/http/app";
import { createLogger } from "../../src/app/logger";
import { BASE, OWN_ORIGIN, PORT } from "../support/test-app";

describe("unhandled errors (security.md §2.10, §3)", () => {
  it("return a code and the request id, with no stack trace, path or message in the body", async () => {
    const logs: string[] = [];
    const logger = createLogger({
      level: "info",
      secretValues: [],
      destination: new Writable({
        write(chunk: Buffer, _encoding, done) {
          logs.push(chunk.toString("utf8"));
          done();
        },
      }),
    });
    const app = createHttpApp({
      port: PORT,
      allowedOrigins: [],
      logger,
      health: { check: () => Promise.reject(new Error("unused")) },
      openStream: () => new ReadableStream(),
      testEvents: {
        ping: () => Promise.reject(new Error("SQLITE_CORRUPT at /home/owner/data/app.db")),
      },
    });

    const response = await app.request(`${BASE}/api/_test/events`, {
      method: "POST",
      headers: {
        host: `127.0.0.1:${PORT}`,
        origin: OWN_ORIGIN,
        "content-type": "application/json",
      },
      body: JSON.stringify({ note: "x" }),
    });

    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).not.toMatch(/SQLITE|\/home\/|stack|at .*\.ts/);
    const requestId = response.headers.get("x-request-id");
    expect(JSON.parse(text)).toEqual({
      error: { code: "internal_error", message: "Something went wrong.", request_id: requestId },
    });
    expect(response.headers.get("content-security-policy")).not.toBeNull();
    // The full error is in the server log, under the same request id.
    const logged = logs.find((line) => line.includes('"http.unhandled_error"'));
    expect(logged).toContain(`"request_id":"${requestId ?? "missing"}"`);
    expect(logged).toContain("SQLITE_CORRUPT");
  });
});
