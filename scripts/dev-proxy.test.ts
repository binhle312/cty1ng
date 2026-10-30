import { spawn, type ChildProcess } from "node:child_process";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { freePort, readFrames, testServer } from "../backend/test/helpers.ts";

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

afterAll(async () => {
  vite.kill();
  await backend.close();
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
});
