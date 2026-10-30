import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { workspacePackages } from "./lib/workspace.ts";

// Runs the real gate, `pnpm lint:imports` (scripts/lint-imports.ts with .dependency-cruiser.cjs),
// in a small fake repository with deliberate bad imports (architecture.md §4.1, M0 AC6).
const REPO = resolve(import.meta.dirname, "..");
const TSX = join(REPO, "node_modules/.bin/tsx");
const GATE = join(REPO, "scripts/lint-imports.ts");

let root: string;

function write(path: string, text = "export {};\n"): void {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}

function gate(): { ok: boolean; output: string } {
  const run = spawnSync(TSX, [GATE], { cwd: root, encoding: "utf8" });
  return { ok: run.status === 0, output: `${run.stdout}${run.stderr}` };
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "import-rules-"));
  copyFileSync(join(REPO, "tsconfig.base.json"), join(root, "tsconfig.base.json"));
  copyFileSync(join(REPO, "pnpm-workspace.yaml"), join(root, "pnpm-workspace.yaml"));
  write("node_modules/hono/package.json", JSON.stringify({ name: "hono", main: "index.js" }));
  write("node_modules/hono/index.js", "module.exports = {};\n");
  write("shared/src/index.ts");
  write("backend/src/core/ports/queue.ts");
  write("backend/src/adapters/db/client.ts");
  write("frontend/src/main.ts");
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("import rules gate (AC6)", () => {
  it("passes allowed imports", () => {
    write("backend/src/core/runs/worker.service.ts", 'import "../ports/queue.ts";\n');
    write("backend/src/core/runs/decide.rules.ts", 'import "./budget.rules.ts";\n');
    write("backend/src/core/runs/budget.rules.ts");
    write("backend/src/adapters/sse/stream.ts", 'import "../../core/ports/queue.ts";\n');
    write(
      "backend/src/app/main.ts",
      'import "../adapters/db/client.ts";\nimport "../core/ports/queue.ts";\n',
    );
    const result = gate();
    expect(result.output).toContain("no dependency violations found");
    expect(result.ok).toBe(true);
  });

  it.each([
    [
      "core-not-to-adapters",
      "backend/src/core/runs/worker.service.ts",
      'import "../../adapters/db/client.ts";',
    ],
    [
      "adapters-not-to-each-other",
      "backend/src/adapters/sse/stream.ts",
      'import "../db/client.ts";',
    ],
    [
      "rules-only-rules-and-shared",
      "backend/src/core/runs/decide.rules.ts",
      'import "../ports/queue.ts";',
    ],
    ["core-not-to-adapter-libraries", "backend/src/core/runs/worker.service.ts", 'import "hono";'],
    ["core-not-to-fs-or-processes", "backend/src/core/runs/worker.service.ts", 'import "node:fs";'],
    [
      "frontend-not-to-backend",
      "frontend/src/main.ts",
      'import "../../backend/src/core/ports/queue.ts";',
    ],
    ["shared-not-to-packages", "shared/src/index.ts", 'import "../../frontend/src/main.ts";'],
  ])("fails %s", (rule, file, source) => {
    write(file, `${source}\n`);
    const result = gate();
    expect(result.ok).toBe(false);
    expect(result.output).toContain(rule);
  });
});

describe("workspace packages", () => {
  it("lists every package of pnpm-workspace.yaml that exists, and skips the rest", () => {
    rmSync(join(root, "frontend"), { recursive: true });
    expect(workspacePackages(root)).toEqual(["shared", "backend"]);
  });

  it("refuses a glob, so no package is skipped silently", () => {
    write("pnpm-workspace.yaml", "packages:\n  - packages/*\n");
    expect(() => workspacePackages(root)).toThrow(/not globs/);
  });

  it("the repository's gate covers every listed package", () => {
    expect(workspacePackages(REPO)).toContain("shared");
  });
});
