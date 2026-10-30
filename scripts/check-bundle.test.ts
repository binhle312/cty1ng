import { randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkBundle } from "./lib/check-bundle.ts";

// A fixture build: a Vite manifest plus chunks of random bytes. Random bytes do not compress,
// so a chunk's gzipped size is about its raw size.
let dist: string;

function chunk(file: string, kb: number): void {
  writeFileSync(join(dist, file), randomBytes(kb * 1000));
}

function manifest(
  entries: Record<string, { file: string; isEntry?: boolean; imports?: string[] }>,
): void {
  writeFileSync(join(dist, ".vite/manifest.json"), JSON.stringify(entries));
}

beforeEach(() => {
  dist = mkdtempSync(join(tmpdir(), "check-bundle-"));
  mkdirSync(join(dist, ".vite"));
  mkdirSync(join(dist, "assets"));
});
afterEach(() => {
  rmSync(dist, { recursive: true, force: true });
});

describe("bundle budget (AC9)", () => {
  it("passes a build under the budget", () => {
    chunk("assets/index.js", 100);
    chunk("assets/vendor.js", 100);
    manifest({
      "index.html": { file: "assets/index.js", isEntry: true, imports: ["_vendor"] },
      _vendor: { file: "assets/vendor.js" },
    });
    const result = checkBundle(dist);
    expect(result.problems).toEqual([]);
    expect(result.firstLoadKb).toBeGreaterThan(195);
  });

  it("fails an oversized build, counting static imports but not lazy chunks", () => {
    chunk("assets/index.js", 150);
    chunk("assets/vendor.js", 150);
    chunk("assets/stats.js", 200);
    manifest({
      "index.html": { file: "assets/index.js", isEntry: true, imports: ["_vendor"] },
      _vendor: { file: "assets/vendor.js" },
      "src/routes/stats.tsx": { file: "assets/stats.js" },
    });
    const result = checkBundle(dist);
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]).toMatch(/over the 250 KB budget/);
    expect(result.firstLoadKb).toBeLessThan(320);
  });

  it("warns, without failing, about a lazy chunk over its limit", () => {
    chunk("assets/index.js", 10);
    chunk("assets/editor.js", 320);
    manifest({
      "index.html": { file: "assets/index.js", isEntry: true },
      "src/routes/editor.tsx": { file: "assets/editor.js" },
    });
    const result = checkBundle(dist);
    expect(result.problems).toEqual([]);
    expect(result.warnings).toHaveLength(1);
  });
});
