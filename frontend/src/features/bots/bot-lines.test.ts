import { describe, expect, it } from "vitest";
import { countText } from "./bot-lines.ts";

// The count words of a card on the Bots page (bots-page.md §2).
describe("countText", () => {
  it("names one thing in the singular", () => {
    expect(countText(1, "skill")).toBe("1 skill");
  });

  it("names zero or more than one thing in the plural", () => {
    expect(countText(0, "project")).toBe("0 projects");
    expect(countText(2, "conversation")).toBe("2 conversations");
  });
});
