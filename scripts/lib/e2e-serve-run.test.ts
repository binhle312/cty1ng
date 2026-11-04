import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { serveIsRunning, writeServeMarker } from "./e2e-serve-marker.ts";
import { listeningPort, serveServers, startServers, type ServeServer } from "./e2e-serve-run.ts";
import { groupAlive } from "./process-group.ts";

// The marker means one thing: this script's own servers hold the ports. `pnpm e2e` writes test data
// into the servers it reuses, so the marker must never exist while another server could answer.

const FIXTURE = `
import { createServer } from "node:http";
const port = Number(process.env.PORT);
const announce = (at = port) => console.log(JSON.stringify({ level: 30, port: at, msg: "listening" }));
process.on("SIGTERM", () => {
  if (process.env.ON_STOP === "late-line") announce();
  if (process.env.ON_STOP === "slow") setTimeout(() => process.exit(0), 400);
  else setTimeout(() => process.exit(0), 20);
});
const listen = () => {
  const server = createServer((_request, response) => response.end("{}"));
  server.on("error", () => process.exit(1));
  server.listen(port, "127.0.0.1", () => {
    if (process.env.WRONG_PORT === "1") announce(port + 1);
    else if (process.env.SILENT !== "1") announce();
  });
};
setTimeout(listen, Number(process.env.DELAY_MS ?? "0"));
console.log("booted");
setInterval(() => {}, 1000);
`;

let folder = "";
let markerPath = "";
let fixture = "";
const stops: (() => Promise<number>)[] = [];
let printed: string[] = [];
const foreignServers: Server[] = [];

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), "cty1ng-serve-run-"));
  markerPath = join(folder, "marker");
  fixture = join(folder, "server.mjs");
  writeFileSync(fixture, FIXTURE);
  printed = [];
});

afterEach(async () => {
  await Promise.all(stops.splice(0).map((stop) => stop()));
  await Promise.all(
    foreignServers.splice(0).map(
      (server) =>
        new Promise((done) => {
          server.close(done);
          server.closeAllConnections();
        }),
    ),
  );
  rmSync(folder, { recursive: true, force: true });
});

function listenOn(port: number): Promise<Server> {
  return new Promise((done) => {
    const server = createServer((_request, response) => response.end("{}"));
    server.listen(port, "127.0.0.1", () => {
      done(server);
    });
  });
}

async function freePort(): Promise<number> {
  const server = await listenOn(0);
  const address = server.address();
  await new Promise((done) => {
    server.close(done);
  });
  if (address === null || typeof address === "string") throw new Error("no port");
  return address.port;
}

async function foreignServer(port: number): Promise<void> {
  foreignServers.push(await listenOn(port));
}

function server(port: number, env: Record<string, string> = {}): ServeServer {
  return {
    command: `node ${fixture}`,
    cwd: undefined,
    env: { ...process.env, PORT: String(port), ...env },
    port,
    timeoutMs: 10_000,
  };
}

function start(servers: ServeServer[]) {
  const serve = startServers({
    servers,
    markerPath,
    pid: process.pid,
    stopTimeoutMs: 2_000,
    print: (line) => printed.push(line),
  });
  stops.push(() => serve.stop("SIGTERM", 0));
  return serve;
}

async function waitUntil(condition: () => boolean | Promise<boolean>, ms = 10_000): Promise<void> {
  const deadline = Date.now() + ms;
  while (!(await condition())) {
    if (Date.now() >= deadline) throw new Error("the condition did not become true");
    await sleep(5);
  }
}

async function answers(port: number): Promise<boolean> {
  try {
    await fetch(`http://127.0.0.1:${String(port)}/`);
    return true;
  } catch {
    return false;
  }
}

// Looks at the marker throughout the run: a marker that exists for a moment is the bug.
async function markerSeenUntil(done: Promise<number>): Promise<boolean> {
  const state = { ended: false };
  void done.then(() => {
    state.ended = true;
  });
  let seen = false;
  while (!state.ended) {
    seen ||= serveIsRunning(markerPath);
    await sleep(2);
  }
  return seen || serveIsRunning(markerPath);
}

describe("listeningPort", () => {
  it("reads the port of a listening log line", () => {
    expect(
      listeningPort(
        '{"level":30,"time":"2026-11-04T00:00:00.000Z","host":"127.0.0.1","port":8100,"msg":"listening"}',
      ),
    ).toBe(8100);
  });

  it.each([
    "",
    "✓ built in 405ms",
    "null",
    "[]",
    "8100",
    '{"msg":"listening"}',
    '{"msg":"listening","port":"8100"}',
    '{"msg":"shutting down","port":8100}',
  ])("finds no port in %j", (line) => {
    expect(listeningPort(line)).toBeUndefined();
  });
});

describe("the marker while the servers start", () => {
  it("is never written while another server holds a port and ours starts", async () => {
    const [ours, taken] = [await freePort(), await freePort()];
    await foreignServer(taken);
    const serve = start([server(ours), server(taken, { DELAY_MS: "300" })]);
    expect(await markerSeenUntil(serve.done)).toBe(false);
    expect(await serve.done).toBe(1);
    expect(await answers(taken)).toBe(true);
    expect(groupAlive(serve.pids[0] ?? 0)).toBe(false);
  });

  it("is written only after the last server is listening", async () => {
    const [first, second] = [await freePort(), await freePort()];
    start([server(first), server(second, { DELAY_MS: "400" })]);
    await waitUntil(() => answers(first));
    expect(await answers(second)).toBe(false);
    expect(serveIsRunning(markerPath)).toBe(false);
    await waitUntil(() => serveIsRunning(markerPath));
    expect(readFileSync(markerPath, "utf8")).toBe(String(process.pid));
    expect(await answers(second)).toBe(true);
  });

  it("does not count a listening line for another port", async () => {
    const port = await freePort();
    start([server(port, { WRONG_PORT: "1" })]);
    await waitUntil(() => answers(port));
    await sleep(100);
    expect(serveIsRunning(markerPath)).toBe(false);
  });

  it("stops everything when a server does not report in time", async () => {
    const [good, silent] = [await freePort(), await freePort()];
    const serve = start([server(good), { ...server(silent, { SILENT: "1" }), timeoutMs: 300 }]);
    expect(await markerSeenUntil(serve.done)).toBe(false);
    expect(await serve.done).toBe(1);
    expect(serve.pids.map(groupAlive)).toEqual([false, false]);
  });

  it("stops without a marker when a stop comes during the start", async () => {
    const port = await freePort();
    const serve = start([server(port, { DELAY_MS: "5000" })]);
    await serve.stop("SIGTERM", 143);
    expect(await serve.done).toBe(143);
    expect(serveIsRunning(markerPath)).toBe(false);
  });

  it("writes no marker for a listening line that comes during the stop", async () => {
    const port = await freePort();
    const serve = start([server(port, { DELAY_MS: "5000", ON_STOP: "late-line" })]);
    await waitUntil(() => printed.includes("booted"));
    await serve.stop("SIGTERM", 143);
    expect(printed.map(listeningPort)).toContain(port);
    expect(serveIsRunning(markerPath)).toBe(false);
  });
});

describe("the marker while the servers run", () => {
  it("is gone before the servers finish stopping", async () => {
    const port = await freePort();
    const serve = start([server(port, { ON_STOP: "slow" })]);
    await waitUntil(() => serveIsRunning(markerPath));
    const stopped = serve.stop("SIGTERM", 143);
    expect(serveIsRunning(markerPath)).toBe(false);
    expect(groupAlive(serve.pids[0] ?? 0)).toBe(true);
    expect(await stopped).toBe(143);
    expect(groupAlive(serve.pids[0] ?? 0)).toBe(false);
  });

  it("is removed and the other servers stop when a server ends by itself", async () => {
    const [first, second] = [await freePort(), await freePort()];
    const serve = start([server(first), server(second)]);
    await waitUntil(() => serveIsRunning(markerPath));
    process.kill(-(serve.pids[0] ?? 0), "SIGKILL");
    expect(await serve.done).toBe(1);
    expect(serveIsRunning(markerPath)).toBe(false);
    expect(serve.pids.map(groupAlive)).toEqual([false, false]);
  });

  it("is kept when a second serve loses the ports and stops", async () => {
    const port = await freePort();
    await foreignServer(port);
    // The first serve's marker: this process runs, so it counts as a running serve.
    writeServeMarker({ path: markerPath, pid: process.pid });
    const serve = start([server(port)]);
    expect(await serve.done).toBe(1);
    expect(serveIsRunning(markerPath)).toBe(true);
  });
});

describe("the real servers", () => {
  it("the backend reports its port in the line the script reads", { timeout: 30_000 }, async () => {
    const port = await freePort();
    const serve = start([
      {
        command: "node src/app/main.ts",
        cwd: resolve(import.meta.dirname, "..", "..", "backend"),
        env: {
          ...process.env,
          PORT: String(port),
          DATA_DIR: join(folder, "data"),
          FAKE_MODEL: "1",
          APP_ENV: "dev",
          LOG_LEVEL: "info",
        },
        port,
        timeoutMs: 25_000,
      },
    ]);
    await waitUntil(() => serveIsRunning(markerPath), 25_000);
    expect(await answers(port)).toBe(true);
    await serve.stop("SIGTERM", 143);
    expect(serveIsRunning(markerPath)).toBe(false);
  });

  it("the config's servers report on their ports, at the level that prints the line", async () => {
    const savedDataDir = process.env.E2E_DATA_DIR;
    process.env.E2E_DATA_DIR = folder;
    const { default: config } = await import("../../frontend/playwright.config.ts");
    if (savedDataDir === undefined) Reflect.deleteProperty(process.env, "E2E_DATA_DIR");
    else process.env.E2E_DATA_DIR = savedDataDir;
    const servers = serveServers([config.webServer ?? []].flat());
    expect(servers.map((item) => item.port)).toEqual([8100, 8101]);
    expect(servers.map((item) => item.env.LOG_LEVEL)).toEqual(["info", "info"]);
    expect(servers.map((item) => item.timeoutMs)).toEqual([60_000, 60_000]);
  });
});
