import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");
const FIXTURE = join(ROOT, "backend/test/fixtures/bad-import");

function cruise(cwd: string, targets: string[]): { code: number; output: string } {
  try {
    const output = execFileSync(
      join(ROOT, "node_modules/.bin/depcruise"),
      [...targets, "--config", join(ROOT, ".dependency-cruiser.cjs"), "--output-type", "err"],
      { cwd, encoding: "utf8", stdio: "pipe" },
    );
    return { code: 0, output };
  } catch (error) {
    if (error !== null && typeof error === "object" && "status" in error && "stdout" in error) {
      return { code: Number(error.status), output: String(error.stdout) };
    }
    throw error;
  }
}

describe("AC6: import rules (architecture.md §4.1)", () => {
  const result = cruise(FIXTURE, ["backend/src"]);

  it("AC6: an import from core/ into an adapter fails", () => {
    expect(result.code).not.toBe(0);
    expect(result.output).toMatch(
      /core-imports-no-adapter: backend\/src\/core\/x\/uses-adapter\.ts/,
    );
  });

  it("AC6: an import between two adapters fails", () => {
    expect(result.output).toMatch(
      /adapters-import-no-other-adapter: backend\/src\/adapters\/sse\/uses-db\.ts/,
    );
  });

  it("core/ importing node:fs fails", () => {
    expect(result.output).toMatch(
      /core-imports-no-fs-or-processes: backend\/src\/core\/x\/uses-fs\.ts/,
    );
  });

  it("a rules file importing a non-rules file fails", () => {
    expect(result.output).toMatch(/rules-are-pure: backend\/src\/core\/routing\/decide\.rules\.ts/);
  });

  it("the real code passes", () => {
    const real = cruise(ROOT, ["backend/src", "shared/src"]);
    expect(real.output).toContain("no dependency violations");
    expect(real.code).toBe(0);
  });
});
