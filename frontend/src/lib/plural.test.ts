import { describe, expect, it } from "vitest";
import { plural } from "./plural.ts";

describe("plural", () => {
  it("uses the singular word for one", () => {
    expect(plural(1, "new skill")).toBe("1 new skill");
  });

  it("adds an s for zero or more than one", () => {
    expect(plural(0, "new skill")).toBe("0 new skills");
    expect(plural(2, "new version")).toBe("2 new versions");
  });
});
