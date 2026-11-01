import { describe, expect, it } from "vitest";
import { CASE_FOLDING_UNICODE_VERSION } from "@cty1ng/shared/case-folding";

// The name key uses Node's NFKC and the generated case folding table (domain-model.md §2 Name
// key). Both must be the same Unicode version. When this fails after a Node upgrade, run
// `pnpm gen:case-folding` with that version's CaseFolding.txt and recompute the stored
// `bots.name_key` values in a migration (M2 plan §8).
describe("the case folding table", () => {
  it("has the Unicode version of Node's ICU", () => {
    const major = (version: string) => version.split(".").slice(0, 2).join(".");
    expect(major(CASE_FOLDING_UNICODE_VERSION)).toBe(major(process.versions.unicode ?? ""));
  });
});
