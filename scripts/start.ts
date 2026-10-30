// `pnpm start` (or `make start`): the production build in one command. It builds the frontend,
// then runs the backend with NODE_ENV=production, which serves the built app and the API on one
// address (architecture.md §1.2). Other settings come from .env as usual.
import { spawn, spawnSync } from "node:child_process";
import { resolve } from "node:path";

const REPO = resolve(import.meta.dirname, "..");

const build = spawnSync("pnpm", ["--filter", "@cty1ng/frontend", "build"], {
  cwd: REPO,
  stdio: "inherit",
});
if (build.status !== 0) process.exit(build.status ?? 1);

const backend = spawn(process.execPath, ["--env-file-if-exists=../.env", "src/app/main.ts"], {
  cwd: resolve(REPO, "backend"),
  stdio: "inherit",
  // APP_ENV=test cannot run in a production build (architecture.md §8).
  env: { ...process.env, NODE_ENV: "production", APP_ENV: process.env.APP_ENV ?? "prod" },
});
const port = process.env.PORT ?? "8000";
console.log(`cty1ng: open http://127.0.0.1:${port}`);
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    backend.kill(signal);
  });
}
backend.on("exit", (code) => {
  process.exit(code ?? 0);
});
