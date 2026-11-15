import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, get } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { groupAlive } from "./lib/process-group.ts";

// `pnpm e2e:serve` itself, as a process (docs/testing.md §3): it starts its servers, and each way
// that it stops also stops them. The servers here are small fixtures on free ports, never the e2e
// ports of frontend/playwright.config.ts, so this test can run while `pnpm e2e` runs.
//
// The test runs the script with `node`, not through pnpm and tsx.
//
// Laptop safety: the test signals only the script that it started (`child.pid`) and the process
// groups that the fixtures print, each checked as a positive integer that is not the group of
// this test. It never finds a process by its name.

const SCRIPT = resolve(import.meta.dirname, "e2e-serve.ts");

// Prints the backend's "listening" line with its process group (Linux: field 5 of /proc/self/stat),
// and one line for each request, so that the test can make the script print.
const FIXTURE = `
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
const port = Number(process.env.PORT);
const group = Number(readFileSync("/proc/self/stat", "utf8").split(") ")[1].split(" ")[2]);
process.on("SIGTERM", () => process.exit(0));
createServer((_request, response) => {
  console.log("request");
  response.end("{}");
}).listen(port, "127.0.0.1", () => {
  console.log(JSON.stringify({ level: 30, port, group, msg: "listening" }));
});
`;

const OWN_GROUP = Number(readFileSync("/proc/self/stat", "utf8").split(") ")[1]?.split(" ")[2]);

let folder = "";
let started: ChildProcess[] = [];
let groups: number[] = [];

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), "cty1ng-e2e-serve-"));
  writeFileSync(join(folder, "server.mjs"), FIXTURE);
  started = [];
  groups = [];
});

function safePid(pid: number | undefined): pid is number {
  return pid !== undefined && Number.isInteger(pid) && pid > 1 && pid !== OWN_GROUP;
}

afterEach(() => {
  for (const child of started) {
    if (safePid(child.pid) && child.exitCode === null && child.signalCode === null) {
      process.kill(child.pid, "SIGKILL");
    }
  }
  for (const group of groups) {
    if (safePid(group) && groupAlive(group)) process.kill(-group, "SIGKILL");
  }
  rmSync(folder, { recursive: true, force: true });
});

// Two ports that are free now; both servers stay open until each has its port.
async function twoFreePorts(): Promise<number[]> {
  const servers = [createServer(), createServer()];
  const ports = await Promise.all(
    servers.map(
      (server) =>
        new Promise<number>((done) => {
          server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            done(typeof address === "object" && address !== null ? address.port : 0);
          });
        }),
    ),
  );
  await Promise.all(servers.map((server) => new Promise((done) => server.close(done))));
  return ports;
}

function portFree(port: number): Promise<boolean> {
  return new Promise((done) => {
    const server = createServer();
    server.once("error", () => {
      done(false);
    });
    server.listen(port, "127.0.0.1", () => {
      server.close(() => {
        done(true);
      });
    });
  });
}

interface Serve {
  child: ChildProcess;
  marker: string;
  ports: number[];
  output: () => string;
  exited: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
}

async function startServe(): Promise<Serve> {
  const ports = await twoFreePorts();
  const servers = join(folder, "servers.json");
  writeFileSync(
    servers,
    JSON.stringify(
      ports.map((port) => ({
        command: `"${process.execPath}" server.mjs`,
        cwd: folder,
        env: { PORT: String(port) },
        timeout: 10_000,
      })),
    ),
  );
  const marker = join(folder, "marker");
  const child = spawn(process.execPath, [SCRIPT], {
    env: {
      ...process.env,
      E2E_SERVE_SERVERS: servers,
      E2E_SERVE_MARKER: marker,
      E2E_SERVE_STOP_MS: "3000",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  started.push(child);
  let text = "";
  child.stdout.on("data", (chunk: Buffer) => {
    text += chunk.toString();
    for (const match of text.matchAll(/"group":(\d+)/g)) {
      const group = Number(match[1]);
      if (!groups.includes(group)) groups.push(group);
    }
  });
  child.stderr.on("data", (chunk: Buffer) => {
    text += chunk.toString();
  });
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((done) => {
    child.on("exit", (code, signal) => {
      done({ code, signal });
    });
  });
  return { child, marker, ports, output: () => text, exited };
}

// Each wait has its own deadline and label, and one test's waits add up to less than its 20 s
// limit, so a slow run fails with the name of what it waited for (review round 1 of #120, R1-8).
async function waitFor(check: () => boolean, label: string): Promise<void> {
  const deadline = Date.now() + 8_000;
  while (!check()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
    await sleep(50);
  }
}

async function within<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<never>((_done, fail) => {
    timer = setTimeout(() => {
      fail(new Error(`timed out waiting for ${label}`));
    }, 4_000);
  });
  try {
    return await Promise.race([promise, late]);
  } finally {
    clearTimeout(timer);
  }
}

async function ready(serve: Serve): Promise<void> {
  await waitFor(
    () => serve.output().includes("e2e:serve: ready") && groups.length === 2,
    "e2e:serve: ready and two server groups",
  );
}

function signal(serve: Serve, name: NodeJS.Signals): void {
  if (!safePid(serve.child.pid)) throw new Error("no pid for the script");
  process.kill(serve.child.pid, name);
}

describe("pnpm e2e:serve", () => {
  it("marks its own pid once both servers listen", { timeout: 20_000 }, async () => {
    const serve = await startServe();
    await ready(serve);
    expect(readFileSync(serve.marker, "utf8")).toBe(String(serve.child.pid));
    signal(serve, "SIGTERM");
    await within(serve.exited, "the exit");
  });

  it("on SIGTERM, stops both servers and frees the ports", { timeout: 20_000 }, async () => {
    const serve = await startServe();
    await ready(serve);
    signal(serve, "SIGTERM");
    expect((await within(serve.exited, "the exit")).code).toBe(143);
    expect(existsSync(serve.marker)).toBe(false);
    expect(groups.map(groupAlive)).toEqual([false, false]);
    expect(await Promise.all(serve.ports.map(portFree))).toEqual([true, true]);
  });

  it("on SIGHUP, stops both servers", { timeout: 20_000 }, async () => {
    const serve = await startServe();
    await ready(serve);
    signal(serve, "SIGHUP");
    await within(serve.exited, "the exit");
    const afterHangUp = groups.map(groupAlive);
    expect(afterHangUp).toEqual([false, false]);
  });

  it("when its output is closed, stops both servers", { timeout: 20_000 }, async () => {
    const serve = await startServe();
    await ready(serve);
    // The terminal that read the output is gone: the next line that the script prints fails.
    // Each request makes a fixture print a line; ask until the script has stopped.
    serve.child.stdout?.destroy();
    const runs = () => serve.child.exitCode === null && serve.child.signalCode === null;
    for (let tries = 0; runs() && tries < 40; tries += 1) {
      get(`http://127.0.0.1:${String(serve.ports[0])}/`).on("error", () => undefined);
      await sleep(100);
    }
    await within(serve.exited, "the exit");
    const afterClosedOutput = groups.map(groupAlive);
    expect(afterClosedOutput).toEqual([false, false]);
  });

  it("does not start a second time for the same marker", { timeout: 20_000 }, async () => {
    const first = await startServe();
    await ready(first);
    // The same fixture servers: if the marker check ever failed, they would only meet busy free
    // ports, never start the servers of the Playwright config (review round 1 of #120, R1-4).
    const second = spawn(process.execPath, [SCRIPT], {
      env: {
        ...process.env,
        E2E_SERVE_SERVERS: join(folder, "servers.json"),
        E2E_SERVE_MARKER: first.marker,
      },
      stdio: ["ignore", "ignore", "pipe"],
    });
    started.push(second);
    let errors = "";
    second.stderr.on("data", (chunk: Buffer) => {
      errors += chunk.toString();
    });
    const code = await within(
      new Promise<number | null>((done) => second.on("exit", done)),
      "the exit of the second start",
    );
    expect(errors).toContain("e2e:serve: it already runs for this checkout");
    expect(code).toBe(1);
    expect(readFileSync(first.marker, "utf8")).toBe(String(first.child.pid));
    signal(first, "SIGTERM");
    await within(first.exited, "the exit of the first");
  });
});
