// `pnpm e2e:serve`: starts the end-to-end test servers from frontend/playwright.config.ts and
// keeps them running, so a local `pnpm e2e` reuses them and does not start them again for each
// run (docs/testing.md §3). The database lives until you stop this script; stop and start it
// again for a fresh one, and after a backend change. CI does not use it.
//
// Each server runs as its own process group. On a stop, the script stops every process of each
// group and waits for them, so no old server is left for Playwright to reuse.
import config from "../frontend/playwright.config.ts";
import { spawnGroup, stopGroup } from "./lib/process-group.ts";

const STOP_TIMEOUT_MS = Number(process.env.E2E_SERVE_STOP_MS ?? "10000");

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
  process.exit(code);
}

process.on("SIGINT", () => void shutdown("SIGINT", 130));
process.on("SIGTERM", () => void shutdown("SIGTERM", 143));
// A server that stops by itself is a failure: stop the others too.
for (const child of children) {
  child.on("exit", () => void shutdown("SIGTERM", 1));
}
