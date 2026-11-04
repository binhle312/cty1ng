import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";

// A fresh `pnpm e2e` writes test data into the server it waits for, so that server must be its
// own. Playwright takes any answer on the port as "up" (testing.md §3), so these tests run the real
// Playwright against another server that takes the port at the worst moment.

const REPO = resolve(import.meta.dirname, "..");
const CONFIG = join(REPO, "scripts/fixtures/e2e-fresh-run/playwright.config.ts");
const CLI = join(REPO, "node_modules/.bin/playwright");

let folder = "";
const servers: Server[] = [];

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), "cty1ng-fresh-run-"));
});

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise((done) => {
          server.close(done);
          server.closeAllConnections();
        }),
    ),
  );
  rmSync(folder, { recursive: true, force: true });
});

function listen(server: Server, port: number): Promise<number> {
  servers.push(server);
  return new Promise((done) => {
    server.listen(port, "127.0.0.1", () => {
      const address = server.address();
      done(typeof address === "object" && address !== null ? address.port : 0);
    });
  });
}

// A free port, released at once for the run to use.
async function freePort(): Promise<number> {
  const server = createServer();
  const port = await listen(server, 0);
  servers.pop();
  await new Promise((done) => server.close(done));
  return port;
}

// Another server: it answers everything and records what it gets.
function foreignServer(): { server: Server; requests: string[] } {
  const requests: string[] = [];
  const server = createServer((request, response) => {
    requests.push(`${String(request.method)} ${String(request.url)}`);
    response.end("{}");
  });
  return { server, requests };
}

function runPlaywright(
  env: Record<string, string>,
): Promise<{ code: number | null; output: string }> {
  return new Promise((done, fail) => {
    const child = spawn(CLI, ["test", "-c", CONFIG], {
      cwd: REPO,
      env: { ...process.env, FIXTURE_OUTPUT: folder, ...env },
    });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.on("error", fail);
    child.on("close", (code) => {
      done({ code, output });
    });
  });
}

it("runs the tests against its own server", { timeout: 60_000 }, async () => {
  const port = await freePort();
  const run = await runPlaywright({ FIXTURE_PORT: String(port) });
  expect(run.output).toContain("1 passed");
  expect(run.code).toBe(0);
});

it(
  "stops when another server takes the port after its own process started",
  { timeout: 60_000 },
  async () => {
    const port = await freePort();
    const foreign = foreignServer();
    // The stand-in calls this before it binds: the other server takes the port first.
    const control = createServer((_request, response) => {
      void listen(foreign.server, port).then(() => {
        response.end("{}");
      });
    });
    const controlPort = await listen(control, 0);
    const run = await runPlaywright({
      FIXTURE_PORT: String(port),
      BEFORE_BIND_URL: `http://127.0.0.1:${String(controlPort)}/`,
    });
    expect(foreign.requests.filter((request) => request.startsWith("POST"))).toEqual([]);
    expect(run.output).not.toContain("1 passed");
    expect(run.code).not.toBe(0);
  },
);

it("stops when another server already holds the port", { timeout: 60_000 }, async () => {
  const foreign = foreignServer();
  const port = await listen(foreign.server, 0);
  const run = await runPlaywright({ FIXTURE_PORT: String(port) });
  expect(foreign.requests.filter((request) => request.startsWith("POST"))).toEqual([]);
  expect(run.output).not.toContain("1 passed");
  expect(run.code).not.toBe(0);
});
