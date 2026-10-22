import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EVENT_TYPES } from "@cty1ng/shared";
import { describe, expect, it } from "vitest";
import { checkEvents, documentedTypes, PENDING } from "./check-events";

describe("check:events (realtime-events.md §4)", () => {
  it("the real document equals shared/ plus PENDING", () => {
    const markdown = readFileSync(join(import.meta.dirname, "../docs/realtime-events.md"), "utf8");
    expect(
      checkEvents({ documented: documentedTypes(markdown), shared: EVENT_TYPES, pending: PENDING }),
    ).toEqual([]);
  });

  it("reads every name in a row, including `a` / `b` / `c` rows", () => {
    const markdown = [
      "## 4. Event types",
      "| Type | Persisted |",
      "| --- | --- |",
      "| `ready` | no |",
      "| `bot.created` / `bot.updated` | yes |",
      "## 5. Next",
      "| `not.here` | yes |",
    ].join("\n");
    expect(documentedTypes(markdown)).toEqual(["ready", "bot.created", "bot.updated"]);
  });

  it("fails for a documented type in neither list", () => {
    expect(checkEvents({ documented: ["a", "b"], shared: ["a"], pending: [] })).toEqual([
      "b is in realtime-events.md §4 but neither in shared/ nor in PENDING",
    ]);
  });

  it("fails for a type in both shared/ and PENDING", () => {
    expect(checkEvents({ documented: ["a"], shared: ["a"], pending: ["a"] })).toEqual([
      "a is in shared/ and still in PENDING; remove it from PENDING",
    ]);
  });

  it("fails for a shared or pending type the document does not list", () => {
    expect(checkEvents({ documented: [], shared: ["a"], pending: ["b"] })).toEqual([
      "a is in shared/ but not in realtime-events.md §4",
      "b is in PENDING but not in realtime-events.md §4",
    ]);
  });
});
