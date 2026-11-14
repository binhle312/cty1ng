import { spawn, type ChildProcess } from "node:child_process";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { freePort, readFrames, testServer } from "../backend/test/helpers.ts";
import viteConfig from "../frontend/vite.config.ts";

// M0c plan, decision A: in development the Vite dev server forwards `/api/*` to the backend.
// This runs the real dev server (frontend/vite.config.ts) in front of a real backend and checks
// that the backend's Host and Origin checks still pass for the app, and still refuse a foreign
// origin, through the proxy.
const FRONTEND = resolve(import.meta.dirname, "../frontend");

let backend: Awaited<ReturnType<typeof testServer>>;
let vite: ChildProcess;
let base: string;

async function waitUntilUp(url: string): Promise<void> {
  for (let i = 0; i < 100; i += 1) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error(`${url} did not start`);
}

beforeAll(async () => {
  const vitePort = await freePort();
  base = `http://127.0.0.1:${String(vitePort)}`;
  backend = await testServer({ ALLOWED_ORIGINS: base });
  vite = spawn(
    join(FRONTEND, "node_modules/.bin/vite"),
    ["--port", String(vitePort), "--strictPort"],
    { cwd: FRONTEND, env: { ...process.env, PORT: String(backend.port) }, stdio: "ignore" },
  );
  await waitUntilUp(base);
}, 30_000);

let backendClosed = false;
async function closeBackend() {
  if (backendClosed) return;
  backendClosed = true;
  await backend.close();
}

afterAll(async () => {
  vite.kill();
  await closeBackend();
});

describe("Vite dev proxy", () => {
  it("passes the Host check: GET /api/health answers", async () => {
    const response = await fetch(`${base}/api/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ db: "ok" });
  });

  it("passes the Origin check for the dev frontend's own origin", async () => {
    const response = await fetch(`${base}/api/_test/events`, {
      method: "POST",
      headers: { origin: base, "content-type": "application/json" },
      body: JSON.stringify({ note: "through the proxy" }),
    });
    expect(response.status).toBe(201);
  });

  it("still refuses a foreign origin", async () => {
    const response = await fetch(`${base}/api/_test/events`, {
      method: "POST",
      headers: { origin: "https://evil.com", "content-type": "application/json" },
      body: JSON.stringify({ note: "x" }),
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "origin_rejected" } });
  });

  it("streams events: the first frame is ready", async () => {
    const abort = new AbortController();
    const response = await fetch(`${base}/api/stream`, { signal: abort.signal });
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    if (response.body === null) throw new Error("no body");
    for await (const frame of readFrames(response.body)) {
      if (frame.event === undefined) continue;
      expect(frame.event).toBe("ready");
      break;
    }
    abort.abort();
  });

  // security.md §2.1, item 36 of the P3 list: the dev page has the production CSP. Vite's React
  // refresh script and the styles of its client are inline, so they get a nonce.
  it("the dev page sends the production CSP with a nonce for scripts and styles", async () => {
    const response = await fetch(`${base}/`);
    expect(response.headers.get("content-security-policy") ?? "no CSP").toMatch(
      /^default-src 'self'; script-src 'self' 'nonce-([A-Za-z0-9+/]{22}==)'; style-src 'self' 'nonce-\1'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'$/,
    );
  });

  it("the dev page sends the other headers of security.md §2.1", async () => {
    const response = await fetch(`${base}/`);
    const other = ["x-content-type-options", "referrer-policy"].map((name) => [
      name,
      response.headers.get(name),
    ]);
    expect(Object.fromEntries(other)).toEqual({
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    });
  });

  it("each inline script of the dev page has the nonce of the CSP", async () => {
    const response = await fetch(`${base}/`);
    const nonce = /'nonce-([^']+)'/.exec(response.headers.get("content-security-policy") ?? "");
    const html = await response.text();
    const inline = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>/g)].map((tag) => tag[0]);
    expect(inline.length).toBeGreaterThan(0);
    const scriptNonces = inline.map((tag) => /\snonce="([^"]*)"/.exec(tag)?.[1]);
    expect(scriptNonces).toEqual(inline.map(() => nonce?.[1] ?? "no nonce in the CSP"));
  });

  // The Vite client reads this meta to put the nonce on the `<style>` tags that it adds.
  it("the dev page gives the Vite client the nonce for its styles", async () => {
    const response = await fetch(`${base}/`);
    const nonce = /'nonce-([^']+)'/.exec(response.headers.get("content-security-policy") ?? "");
    const html = await response.text();
    const meta = /<meta property="csp-nonce" nonce="([^"]*)"/.exec(html);
    expect(meta?.[1]).toBe(nonce?.[1] ?? "no nonce in the CSP");
  });

  // realtime-events.md §3, rule for `make dev`: without this the browser keeps a dead stream
  // that looks open, and gets no live events until a reload. Last in the file: it stops the
  // backend.
  it("ends the client's stream when the backend closes it", async () => {
    const response = await fetch(`${base}/api/stream`);
    if (response.body === null) throw new Error("no body");
    const frames = readFrames(response.body);
    const next = async () => {
      const result = await frames.next();
      return result.done === true ? null : result.value;
    };
    let frame = await next();
    while (frame !== null && frame.event !== "ready") frame = await next();
    expect(frame?.event).toBe("ready");

    await closeBackend();
    // The stream ends (with or without an error) well before the 15 s heartbeat.
    const ended = (async () => {
      try {
        while ((await next()) !== null);
      } catch {
        // A cut connection ends the body with an error.
      }
      return "ended";
    })();
    const late = new Promise<string>((r) => setTimeout(r, 2_000, "still open after 2 s"));
    expect(await Promise.race([ended, late])).toBe("ended");
  });
});

// The nonce of the dev page (security.md §2.1): a new one at each start of the dev server, and
// none in the production build.
describe("Vite config nonce", () => {
  const configFor = (command: "serve" | "build") => {
    if (typeof viteConfig !== "function") throw new Error("vite.config.ts exports no function");
    return viteConfig({ command, mode: command === "serve" ? "development" : "production" });
  };

  it("each start of the dev server makes a new nonce", () => {
    const first = configFor("serve").html?.cspNonce;
    const second = configFor("serve").html?.cspNonce;
    const nonce = /^[A-Za-z0-9+/]{22}==$/;
    expect({ valid: nonce.test(first ?? ""), changed: first !== second }).toEqual({
      valid: true,
      changed: true,
    });
  });

  it("the production build has no nonce", () => {
    const build = configFor("build");
    expect(build.html?.cspNonce).toBeUndefined();
  });
});
