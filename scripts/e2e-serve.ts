// `pnpm e2e:serve`: starts the end-to-end test servers from frontend/playwright.config.ts and
// keeps them running, so a local `pnpm e2e` reuses them and does not start them again for each
// run (docs/testing.md §3). The database lives until you stop this script; stop and start it
// again for a fresh one, and after a backend change. CI does not use it.
//
// Each server runs as its own process group. On a stop, the script stops every process of each
// group and waits for them, so no old server is left on the ports.
//
// `pnpm e2e` reuses the servers only while this script runs (./lib/e2e-serve-marker.ts).
import config from "../frontend/playwright.config.ts";
import {
  removeServeMarker,
  SERVE_MARKER_PATH,
  serveIsRunning,
  writeServeMarker,
} from "./lib/e2e-serve-marker.ts";
import { spawnGroup, stopGroup } from "./lib/process-group.ts";

const STOP_TIMEOUT_MS = Number(process.env.E2E_SERVE_STOP_MS ?? "10000");

// A second serve would fail on the ports, and its stop would take the first one's marker away.
if (serveIsRunning(SERVE_MARKER_PATH)) {
  console.error("e2e:serve: it already runs for this checkout; stop it first.");
  process.exit(1);
}
writeServeMarker({ path: SERVE_MARKER_PATH, pid: process.pid });

const servers = [config.webServer ?? []].flat();
const children = servers.map((server) =>
  spawnGroup(server.command, { cwd: server.cwd, env: { ...process.env, ...server.env } }),
);
for (const server of servers) console.log(`e2e:serve: waiting for ${server.url ?? "?"}`);

let stopping = false;
async function shutdown(signal: NodeJS.Signals, code: number): Promise<void> {
  if (stopping) return;
  stopping = true;
  const pids = children.flatMap((child) => (child.pid === undefined ? [] : [child.pid]));
  await Promise.all(pids.map((pid) => stopGroup(pid, { signal, timeoutMs: STOP_TIMEOUT_MS })));
  removeServeMarker(SERVE_MARKER_PATH);
  process.exit(code);
}

process.on("SIGINT", () => void shutdown("SIGINT", 130));
process.on("SIGTERM", () => void shutdown("SIGTERM", 143));
// A server that stops by itself is a failure: stop the others too.
for (const child of children) {
  child.on("exit", () => void shutdown("SIGTERM", 1));
}
