import { describe, expect, it } from "vitest";
import { cn } from "./cn.ts";

// cn() lets a later class of the same kind win, so it must know our tokens and utilities.
describe("cn", () => {
  it("keeps the dashed slot with a border colour (M2b: the pin pill had no border)", () => {
    expect(cn("rounded-pill border-dashed-slot", "border-outline-strong")).toBe(
      "rounded-pill border-dashed-slot border-outline-strong",
    );
  });

  it("lets a later token of the same kind win", () => {
    expect(cn("rounded-control", "rounded-card")).toBe("rounded-card");
    expect(cn("border-outline", "border-primary")).toBe("border-primary");
    expect(cn("size-avatar", "size-avatar-list")).toBe("size-avatar-list");
    expect(cn("text-badge", "text-xs")).toBe("text-xs");
  });

  it("keeps a text size and a text colour", () => {
    expect(cn("text-badge text-danger")).toBe("text-badge text-danger");
  });
});
