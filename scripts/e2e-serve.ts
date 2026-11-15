// `pnpm e2e:serve`: starts the end-to-end test servers from frontend/playwright.config.ts and
// keeps them running, so a local `pnpm e2e` reuses them and does not start them again for each
// run (docs/testing.md §3). The database lives until you stop this script; stop and start it
// again for a fresh one, and after a backend change. CI does not use it.
//
// Each server runs as its own process group. On a stop (Ctrl+C, SIGTERM, SIGHUP, or an error that
// nothing catches), the script stops every process of each group and waits for them, so no old
// server is left on the ports.
//
// `pnpm e2e` reuses the servers only while this script's own servers hold the ports
// (./lib/e2e-serve-run.ts).
import { readFileSync } from "node:fs";
import { z } from "zod";
import { SERVE_MARKER_PATH, serveIsRunning } from "./lib/e2e-serve-marker.ts";
import { serveServers, startServers } from "./lib/e2e-serve-run.ts";

// A test gives its own servers on free ports (scripts/e2e-serve.test.ts): a JSON file with the
// shape of Playwright's `webServer` list.
const WebServers = z.array(
  z.object({
    command: z.string(),
    cwd: z.string().optional(),
    env: z.record(z.string(), z.string()).optional(),
    timeout: z.number().optional(),
  }),
);

async function webServers() {
  const given = process.env.E2E_SERVE_SERVERS;
  if (given !== undefined) return WebServers.parse(JSON.parse(readFileSync(given, "utf8")));
  const { default: config } = await import("../frontend/playwright.config.ts");
  return [config.webServer ?? []].flat();
}

const STOP_TIMEOUT_MS = Number(process.env.E2E_SERVE_STOP_MS ?? "10000");

// A second serve would fail on the ports.
if (serveIsRunning(SERVE_MARKER_PATH)) {
  console.error("e2e:serve: it already runs for this checkout; stop it first.");
  process.exit(1);
}

const servers = serveServers(await webServers());
for (const server of servers) console.log(`e2e:serve: waiting for port ${String(server.port)}`);
const serve = startServers({
  servers,
  markerPath: SERVE_MARKER_PATH,
  pid: process.pid,
  stopTimeoutMs: STOP_TIMEOUT_MS,
  print: (line) => {
    console.log(line);
  },
});

process.on("SIGINT", () => void serve.stop("SIGINT", 130));
process.on("SIGTERM", () => void serve.stop("SIGTERM", 143));
// A closed terminal sends SIGHUP; Node's default would exit and leave the servers on the ports.
process.on("SIGHUP", () => void serve.stop("SIGTERM", 129));
// An error that nothing catches, for example a line printed after the terminal that read the
// output is gone (EPIPE), would exit the same way. The stop runs once; a later error waits for it.
// SIGKILL cannot be caught: it leaves the servers (docs/testing.md §3).
let reported = false;
function failed(error: unknown): void {
  if (!reported) {
    reported = true;
    try {
      process.stderr.write(`e2e:serve: stopping after an error: ${String(error)}\n`);
    } catch {
      // The error output can be gone too.
    }
  }
  void serve.stop("SIGTERM", 1);
}
process.on("uncaughtException", failed);
process.on("unhandledRejection", failed);
process.exit(await serve.done);
