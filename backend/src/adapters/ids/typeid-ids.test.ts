import { describe, expect, it } from "vitest";
import { typeIdIds } from "./typeid-ids";

describe("ids adapter (D22, D36)", () => {
  it("makes a TypeID whose UUID is version 7", () => {
    const id = typeIdIds.newId("bot");
    expect(id).toMatch(/^bot_[0-7][0-9a-hjkmnp-tv-z]{25}$/);
  });

  it("new ids sort by creation time", () => {
    const ids = Array.from({ length: 20 }, () => typeIdIds.newId("msg"));
    expect([...ids].sort()).toEqual(ids);
  });
});
