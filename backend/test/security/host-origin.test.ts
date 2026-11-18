import { connect } from "node:net";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createHttpApp } from "../../src/adapters/http/app.ts";
import { loadConfig } from "../../src/app/config.ts";
import { HOST, ORIGIN, memoryLogger, testBackend, testServer, idleServices } from "../helpers.ts";

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

// security.md §2.1, item 35 of the P3 list: a refused request gets the headers of every other
// answer. The status and the code stay those of the checks above.
const SECURITY_HEADERS = {
  "content-security-policy":
    "default-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};
const EVIL = "https://evil.com";

describe("refused requests carry the security headers", () => {
  it.each(
    (
      [
        [
          "a malformed Host",
          () => backend.request("/api/health", { headers: { host: "a b" } }),
          400,
          "bad_request",
        ],
        [
          "a foreign Host",
          () => backend.request("/api/health", { headers: { host: "evil.com" } }),
          403,
          "host_rejected",
        ],
        [
          "the stream with a foreign Host",
          () => backend.request("/api/stream", { headers: { host: "evil.com" } }),
          403,
          "host_rejected",
        ],
        ["a POST with a foreign Origin", () => post({ origin: EVIL }), 403, "origin_rejected"],
        ["a POST with no Origin", () => post({}), 403, "origin_rejected"],
        [
          "a GET with a foreign Origin",
          () => backend.request("/api/health", { headers: { origin: EVIL } }),
          403,
          "origin_rejected",
        ],
        [
          "the stream with a foreign Origin",
          () => backend.request("/api/stream", { headers: { origin: EVIL } }),
          403,
          "origin_rejected",
        ],
        [
          "a preflight from a foreign Origin",
          () =>
            backend.request("/api/_test/events", {
              method: "OPTIONS",
              headers: { origin: EVIL, "access-control-request-method": "POST" },
            }),
          403,
          "origin_rejected",
        ],
      ] as const
    ).map(([label, send, status, errorCode]) => [label, { send, status, errorCode }] as const),
  )("%s gets the security headers", async (_label, { send, status, errorCode }) => {
    const response = await send();
    expect(response.status).toBe(status);
    expect(await code(response)).toContain(`"code":"${errorCode}"`);
    const sent = Object.keys(SECURITY_HEADERS).map((name) => [name, response.headers.get(name)]);
    expect(Object.fromEntries(sent)).toEqual(SECURITY_HEADERS);
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

  // Item 35 of the P3 list, on a real socket. Node's own 400 for an HTTP/1.1 request with no
  // Host comes before the app, so it cannot have them.
  it.each(
    (
      [
        [
          "two Host headers",
          (host: string) =>
            `GET /api/health HTTP/1.1\r\nHost: ${host}\r\nHost: ${host}\r\nConnection: close\r\n\r\n`,
          400,
        ],
        ["HTTP/1.0 with no Host", () => "GET /api/health HTTP/1.0\r\n\r\n", 400],
        [
          "an absolute URL with a foreign Host",
          (host: string) =>
            `GET http://${host}/api/health HTTP/1.1\r\nHost: evil.com\r\nConnection: close\r\n\r\n`,
          403,
        ],
      ] as const
    ).map(([label, request, status]) => [label, { request, status }] as const),
  )("on the wire, %s gets the security headers", async (_label, { request, status }) => {
    const response = await raw(request(`127.0.0.1:${server.port}`));
    expect(response).toMatch(new RegExp(`^HTTP/1\\.\\d ${String(status)} `));
    const head = response.split("\r\n\r\n")[0] ?? "";
    const lines = head.split("\r\n").slice(1);
    const all = new Map(
      lines.map((line) => {
        const at = line.indexOf(":");
        return [line.slice(0, at).toLowerCase(), line.slice(at + 1).trim()];
      }),
    );
    const onWire = Object.keys(SECURITY_HEADERS).map((name) => [name, all.get(name) ?? null]);
    expect(Object.fromEntries(onWire)).toEqual(SECURITY_HEADERS);
  });
});

// Review of PR #48: no request may be refused because of the stream's HEAD handling, and a
// HEAD must not open a subscription (Hono runs the GET handler and drops the body).
describe("HEAD /api/stream", () => {
  it("answers with the stream headers and opens no subscription", async () => {
    let opened = 0;
    const app = createHttpApp({
      log: memoryLogger().log,
      allowedHosts: [HOST],
      allowedOrigins: [ORIGIN],
      health: () =>
        Promise.resolve({ db: "ok", worker: "not_started", catalog: { models: 0, available: 0 } }),
      openStream: () => {
        opened += 1;
        return new ReadableStream();
      },
      testPing: null,
      apiDocs: false,
      frontendDir: null,
      ...idleServices(),
    });
    const response = await app.request(`http://${HOST}/api/stream`, {
      method: "HEAD",
      headers: { host: HOST },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(opened).toBe(0);
  });
});

// Review of PR #48: every HOST the configuration accepts must be one the Host check serves.
describe("HOST settings and the Host check agree", () => {
  it.each(["127.0.0.1", "localhost", "::1", "127.0.0.2"])(
    "HOST=%s is refused or its own requests pass",
    (host) => {
      let config;
      try {
        config = loadConfig({ HOST: host, PORT: "8000" });
      } catch {
        return; // refused at start: fine
      }
      const own = host.includes(":") ? `[${host}]:8000` : `${host}:8000`;
      expect(config.allowedHosts).toContain(own);
    },
  );
});
