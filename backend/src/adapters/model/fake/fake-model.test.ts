import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createFakeModel, loadFakeScripts } from "./fake-model";

const FAKE_SCRIPTS_DIR = join(import.meta.dirname, "../../../../test/fixtures/fake-scripts");

describe("fake model plumbing (testing.md §2)", () => {
  it("loads the committed fixture scripts by bot slug", () => {
    const fake = createFakeModel({ scriptsDir: FAKE_SCRIPTS_DIR });
    expect(fake.catalog).toEqual([
      { id: "fake:scripted", label: "Fake (scripted)", available: true, efforts: [] },
    ]);
    expect(fake.scripts.ba?.[0]).toMatchObject({ when_contains: "login" });
    expect(fake.scripts.designer).toHaveLength(1);
  });

  it("rejects a script with an unknown field, naming the file", () => {
    const dir = mkdtempSync(join(tmpdir(), "cty1ng-fake-"));
    try {
      writeFileSync(join(dir, "bad.yaml"), "ba:\n  - reply: hi\n    replay: typo\n");
      expect(() => loadFakeScripts(dir)).toThrow("bad.yaml");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
