// `pnpm e2e:serve`: starts the end-to-end test servers from frontend/playwright.config.ts and
// keeps them running, so a local `pnpm e2e` reuses them and does not start them again for each
// run (docs/testing.md §3). The database lives until you stop this script; stop and start it
// again for a fresh one, and after a backend change. CI does not use it.
import { spawn } from "node:child_process";
import config from "../frontend/playwright.config.ts";

const servers = [config.webServer ?? []].flat();
const children = servers.map((server) =>
  spawn(server.command, {
    cwd: server.cwd,
    shell: true,
    stdio: "inherit",
    env: { ...process.env, ...server.env },
  }),
);
for (const server of servers) console.log(`e2e:serve: waiting for ${server.url ?? "?"}`);

const stop = (signal: NodeJS.Signals) => {
  for (const child of children) child.kill(signal);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const child of children) {
  child.on("exit", (code) => {
    stop("SIGTERM");
    process.exit(code ?? 0);
  });
}
