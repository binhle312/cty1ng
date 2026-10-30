import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

// Runs the real .dependency-cruiser.cjs on a small fake repository with deliberate bad imports
// (architecture.md §4.1, M0 AC6).
const REPO = resolve(import.meta.dirname, "..");
const DEPCRUISE = join(REPO, "node_modules/.bin/depcruise");

const Output = z.object({
  summary: z.object({
    violations: z.array(
      z.object({ from: z.string(), to: z.string(), rule: z.object({ name: z.string() }) }),
    ),
  }),
});

let root: string;

function write(path: string, text = "export {};\n"): void {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}

function violations(): { rule: string; from: string; to: string }[] {
  const run = spawnSync(
    DEPCRUISE,
    [
      "--config",
      join(REPO, ".dependency-cruiser.cjs"),
      "--output-type",
      "json",
      "backend",
      "frontend",
    ],
    { cwd: root, encoding: "utf8" },
  );
  return Output.parse(JSON.parse(run.stdout)).summary.violations.map((v) => ({
    rule: v.rule.name,
    from: v.from,
    to: v.to,
  }));
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "import-rules-"));
  copyFileSync(join(REPO, "tsconfig.base.json"), join(root, "tsconfig.base.json"));
  write("node_modules/hono/package.json", JSON.stringify({ name: "hono", main: "index.js" }));
  write("node_modules/hono/index.js", "module.exports = {};\n");
  write("backend/src/core/ports/queue.ts");
  write("backend/src/adapters/db/client.ts");
  write("frontend/src/main.ts");
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("import rules (AC6)", () => {
  it("passes allowed imports", () => {
    write("backend/src/core/runs/worker.service.ts", 'import "../ports/queue.ts";\n');
    write("backend/src/core/runs/decide.rules.ts", 'import "./budget.rules.ts";\n');
    write("backend/src/core/runs/budget.rules.ts");
    write("backend/src/adapters/sse/stream.ts", 'import "../../core/ports/queue.ts";\n');
    write(
      "backend/src/app/main.ts",
      'import "../adapters/db/client.ts";\nimport "../core/ports/queue.ts";\n',
    );
    expect(violations()).toEqual([]);
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
  ])("fails %s", (rule, file, source) => {
    write(file, `${source}\n`);
    expect(violations().map((v) => v.rule)).toContain(rule);
  });
});
