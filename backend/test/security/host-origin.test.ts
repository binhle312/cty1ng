import { connect } from "node:net";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { HOST, ORIGIN, testBackend, testServer } from "../helpers.ts";

// security.md §2.1 and §3, M0 AC3: the Host and Origin checks on every route, the stream too.
let backend: ReturnType<typeof testBackend>;
beforeEach(() => {
  backend = testBackend();
});
afterEach(() => {
  backend.close();
});

const post = (headers: Record<string, string>) =>
  backend.request("/api/_test/events", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ note: "x" }),
  });

async function code(response: Response): Promise<string> {
  const body: unknown = await response.json();
  return typeof body === "object" && body !== null && "error" in body
    ? JSON.stringify(body.error)
    : "";
}

describe("Origin check", () => {
  it("refuses a POST from another origin with 403 origin_rejected", async () => {
    const response = await post({ origin: "https://evil.com" });
    expect(response.status).toBe(403);
    expect(await code(response)).toContain('"code":"origin_rejected"');
  });

  it.each([
    ["no Origin", {}],
    ["Origin: null", { origin: "null" }],
  ])("refuses a POST with %s", async (_label, headers) => {
    const response = await post(headers);
    expect(response.status).toBe(403);
    expect(await code(response)).toContain("origin_rejected");
  });

  it.each([ORIGIN, "http://localhost:5173", `http://${HOST}`])(
    "accepts a POST from %s",
    async (origin) => {
      expect((await post({ origin })).status).toBe(201);
    },
  );

  it("checks a GET only when it sends an Origin", async () => {
    expect((await backend.request("/api/health")).status).toBe(200);
    expect(
      (await backend.request("/api/health", { headers: { origin: "https://evil.com" } })).status,
    ).toBe(403);
  });

  it("applies to the stream", async () => {
    const response = await backend.request("/api/stream", {
      headers: { origin: "https://evil.com" },
    });
    expect(response.status).toBe(403);
    expect(await code(response)).toContain("origin_rejected");
  });

  it("sends CORS headers only to allowed origins", async () => {
    const allowed = await backend.request("/api/health", { headers: { origin: ORIGIN } });
    expect(allowed.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    const preflight = await backend.request("/api/_test/events", {
      method: "OPTIONS",
      headers: { origin: "https://evil.com", "access-control-request-method": "POST" },
    });
    expect(preflight.status).toBe(403);
    expect(preflight.headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("Host check", () => {
  it.each(["evil.com", "evil.com:8000", "127.0.0.1:9999", "localhost"])(
    "refuses Host %s with 403 host_rejected",
    async (host) => {
      const response = await backend.request("/api/health", { headers: { host } });
      expect(response.status).toBe(403);
      expect(await code(response)).toContain('"code":"host_rejected"');
    },
  );

  it.each(["a b", "127.0.0.1:8000, 127.0.0.1:8000", "", "127.0.0.1:8000/x"])(
    "refuses a malformed Host %j with 400 bad_request",
    async (host) => {
      const response = await backend.request("/api/health", { headers: { host } });
      expect(response.status).toBe(400);
      expect(await code(response)).toContain('"code":"bad_request"');
    },
  );

  it.each([HOST, "localhost:8000", "LOCALHOST:8000"])("accepts Host %s", async (host) => {
    expect((await backend.request("/api/health", { headers: { host } })).status).toBe(200);
  });

  it("applies to the stream", async () => {
    expect((await backend.request("/api/stream", { headers: { host: "evil.com" } })).status).toBe(
      403,
    );
  });
});

// Over a real socket: what Node and @hono/node-server do with raw requests.
describe("Host check on the wire", () => {
  let server: Awaited<ReturnType<typeof testServer>>;
  beforeAll(async () => {
    server = await testServer();
  });
  afterAll(async () => {
    await server.close();
  });

  function raw(request: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = connect(server.port, "127.0.0.1", () => socket.end(request));
      let data = "";
      socket.on("data", (chunk) => (data += chunk.toString()));
      socket.on("end", () => {
        resolve(data);
      });
      socket.on("error", reject);
    });
  }

  it("refuses two Host headers with 400", async () => {
    const host = `127.0.0.1:${server.port}`;
    const response = await raw(
      `GET /api/health HTTP/1.1\r\nHost: ${host}\r\nHost: ${host}\r\nConnection: close\r\n\r\n`,
    );
    expect(response).toMatch(/^HTTP\/1\.1 400/);
    expect(response).toContain('"code":"bad_request"');
  });

  it("refuses a request with no Host header with 400", async () => {
    const response = await raw("GET /api/health HTTP/1.0\r\n\r\n");
    expect(response).toMatch(/^HTTP\/1\.\d 400/);
  });

  it("checks the Host header, not an absolute URL in the request line", async () => {
    const response = await raw(
      `GET http://127.0.0.1:${server.port}/api/health HTTP/1.1\r\nHost: evil.com\r\nConnection: close\r\n\r\n`,
    );
    expect(response).toMatch(/^HTTP\/1\.1 403/);
    expect(response).toContain("host_rejected");
  });
});
