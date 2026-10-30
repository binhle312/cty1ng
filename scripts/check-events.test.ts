import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EVENT_TYPES } from "@cty1ng/shared/events";
import { PENDING, checkEvents, documentedTypes } from "./lib/check-events.ts";

describe("event type lists", () => {
  it("the repository passes", () => {
    const doc = readFileSync("docs/realtime-events.md", "utf8");
    expect(checkEvents(documentedTypes(doc), EVENT_TYPES, PENDING)).toEqual([]);
  });

  it("reads every name of a row with several types", () => {
    const doc =
      "## 4. Event types\n| `bot.created` / `bot.updated` | yes | `{bot}` | x |\n## 5. Next";
    expect(documentedTypes(doc)).toEqual(["bot.created", "bot.updated"]);
  });

  it("fails when a documented type is neither built nor pending", () => {
    expect(checkEvents(["a.b", "c.d"], ["a.b"], [])).toEqual([
      "`c.d` is in realtime-events.md §4 but neither in shared/ nor in PENDING",
    ]);
  });

  it("fails when a built type is still pending", () => {
    expect(checkEvents(["a.b"], ["a.b"], ["a.b"])).toEqual([
      "`a.b` is built in shared/ and still in PENDING: remove it from PENDING",
    ]);
  });

  it("fails when shared/ or PENDING has a type the docs do not", () => {
    expect(checkEvents([], ["a.b"], ["c.d"])).toEqual([
      "`a.b` is in shared/ but not in realtime-events.md §4",
      "`c.d` is in PENDING but not in realtime-events.md §4",
    ]);
  });
});
