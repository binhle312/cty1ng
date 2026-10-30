import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createHttpApp } from "../../src/adapters/http/app.ts";
import { HOST, ORIGIN, memoryLogger, testBackend } from "../helpers.ts";

// security.md §2.9, §2.10 and §3: unknown fields → 422, a body over 1 MB → 413, and an
// unhandled error gives a code and a request id, never a stack trace.
const json = { host: HOST, origin: ORIGIN, "content-type": "application/json" };

describe("request validation", () => {
  it.each([
    ["an unknown field", JSON.stringify({ note: "x", extra: 1 }), 422, "validation_error", "extra"],
    ["a wrong type", JSON.stringify({ note: 5 }), 422, "validation_error", "note"],
    ["a missing field", JSON.stringify({}), 422, "validation_error", "note"],
    ["malformed JSON", '{"note"', 400, "bad_request", undefined],
  ])("answers %s with %i", async (_label, body, status, errorCode, field) => {
    const backend = testBackend();
    const response = await backend.request("/api/_test/events", {
      method: "POST",
      headers: json,
      body,
    });
    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({
      error: { code: errorCode, ...(field && { field }) },
    });
    backend.close();
  });

  it("answers a body that is not JSON with 400", async () => {
    const backend = testBackend();
    const response = await backend.request("/api/_test/events", {
      method: "POST",
      headers: { origin: ORIGIN, "content-type": "text/plain" },
      body: "note=x",
    });
    expect(response.status).toBe(400);
    backend.close();
  });

  it("answers a body over 1 MB with 413 too_large", async () => {
    const backend = testBackend();
    const body = JSON.stringify({ note: "a".repeat(1024 * 1024) });
    const response = await backend.request("/api/_test/events", {
      method: "POST",
      headers: json,
      body,
    });
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ error: { code: "too_large" } });
    backend.close();
  });

  it("answers an unknown path with 404 not_found", async () => {
    const backend = testBackend();
    const response = await backend.request("/api/nope");
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: "not_found" } });
    backend.close();
  });
});

describe("unhandled errors", () => {
  const { log, lines } = memoryLogger();
  const app = createHttpApp({
    log,
    allowedHosts: [HOST],
    allowedOrigins: [ORIGIN],
    health: () =>
      Promise.reject(new Error("SQLITE_CORRUPT at /home/owner/data/app.db: SELECT secret")),
    openStream: () => new ReadableStream(),
    testPing: null,
  });

  it("gives 500 internal_error with the request id, and no stack, SQL or path", async () => {
    const response = await app.request(`http://${HOST}/api/health`, { headers: { host: HOST } });
    expect(response.status).toBe(500);
    const text = await response.text();
    const requestId = response.headers.get("x-request-id") ?? "missing";
    expect(JSON.parse(text)).toEqual({
      error: {
        code: "internal_error",
        message: "Something went wrong. The server log has the details.",
        request_id: requestId,
      },
    });
    for (const leak of ["SQLITE", "/home/", "SELECT", "at ", ".ts"])
      expect(text).not.toContain(leak);

    // The full error is in the server log, under the same request id.
    const Logged = z.object({
      msg: z.string(),
      request_id: z.string(),
      err: z.object({ message: z.string() }),
    });
    const logged = lines
      .map((line) => Logged.safeParse(JSON.parse(line)))
      .flatMap((result) =>
        result.success && result.data.msg === "unhandled error" ? [result.data] : [],
      );
    expect(logged).toHaveLength(1);
    expect(logged[0]?.request_id).toBe(requestId);
    expect(logged[0]?.err.message).toContain("SQLITE_CORRUPT");
  });

  it("gives every response a fresh X-Request-Id, ignoring one the client sent", async () => {
    const a = await app.request(`http://${HOST}/api/nope`, {
      headers: { host: HOST, "x-request-id": "mine" },
    });
    const b = await app.request(`http://${HOST}/api/nope`, { headers: { host: HOST } });
    expect(a.headers.get("x-request-id")).not.toBe("mine");
    expect(a.headers.get("x-request-id")).not.toBe(b.headers.get("x-request-id"));
    expect(await a.json()).toMatchObject({ error: { request_id: a.headers.get("x-request-id") } });
  });
});

describe("response headers", () => {
  it("sends the CSP and the other headers of security.md §2.1", async () => {
    const backend = testBackend();
    const response = await backend.request("/api/health");
    expect(response.headers.get("content-security-policy")).toBe(
      "default-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'",
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    backend.close();
  });
});
