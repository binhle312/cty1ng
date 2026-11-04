// `pnpm e2e:serve`: starts the end-to-end test servers from frontend/playwright.config.ts and
// keeps them running, so a local `pnpm e2e` reuses them and does not start them again for each
// run (docs/testing.md §3). The database lives until you stop this script; stop and start it
// again for a fresh one, and after a backend change. CI does not use it.
//
// Each server runs as its own process group. On a stop, the script stops every process of each
// group and waits for them, so no old server is left on the ports.
//
// `pnpm e2e` reuses the servers only while this script's own servers hold the ports
// (./lib/e2e-serve-run.ts).
import config from "../frontend/playwright.config.ts";
import { SERVE_MARKER_PATH, serveIsRunning } from "./lib/e2e-serve-marker.ts";
import { serveServers, startServers } from "./lib/e2e-serve-run.ts";

const STOP_TIMEOUT_MS = Number(process.env.E2E_SERVE_STOP_MS ?? "10000");

// A second serve would fail on the ports.
if (serveIsRunning(SERVE_MARKER_PATH)) {
  console.error("e2e:serve: it already runs for this checkout; stop it first.");
  process.exit(1);
}

const servers = serveServers([config.webServer ?? []].flat());
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
process.exit(await serve.done);
