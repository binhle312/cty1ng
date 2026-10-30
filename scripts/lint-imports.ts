// `pnpm lint:imports`: the import rules of architecture.md §4.1 (.dependency-cruiser.cjs) on
// every workspace package that exists, so a new package is checked from its first file.
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { workspacePackages } from "./lib/workspace.ts";

const repo = resolve(import.meta.dirname, "..");
const packages = workspacePackages(process.cwd());
const run = spawnSync(
  join(repo, "node_modules/.bin/depcruise"),
  ["--config", join(repo, ".dependency-cruiser.cjs"), ...packages],
  { stdio: "inherit" },
);
process.exitCode = run.status ?? 1;
