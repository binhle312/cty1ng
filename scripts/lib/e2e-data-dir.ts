import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The data folder of one `pnpm e2e` or `pnpm e2e:serve`. Workers get it through the environment.
// The process that made the folder removes it as its last step: Playwright and `pnpm e2e:serve`
// have stopped their servers by then, so nothing still has the database open (docs/testing.md §3).
// A failure here must not change the run's result, and the next hard kill leaves a folder anyway.
export function e2eDataDir(): string {
  const given = process.env.E2E_DATA_DIR;
  if (given !== undefined) return given;
  const made = mkdtempSync(join(tmpdir(), "cty1ng-e2e-"));
  process.env.E2E_DATA_DIR = made;
  process.on("exit", () => {
    try {
      rmSync(made, { recursive: true, force: true });
    } catch (error) {
      console.error(`e2e: could not remove ${made}: ${String(error)}`);
    }
  });
  return made;
}
