import { describe, expect, it } from "vitest";
import { uuidv7 } from "uuidv7";
import { decodeId, typeIdToUuid, uuidToTypeId } from "./typeid";

describe("TypeID ⇄ UUID, the one conversion point (D36)", () => {
  it("round-trips a UUIDv7", () => {
    const uuid = uuidv7();
    const id = uuidToTypeId("bot", uuid);
    expect(id).toMatch(/^bot_[0-7][0-9a-hjkmnp-tv-z]{25}$/);
    expect(typeIdToUuid(id)).toBe(uuid);
  });

  it("decodes both ways for the CLI", () => {
    const uuid = uuidv7();
    const id = uuidToTypeId("conv", uuid);
    expect(decodeId(id)).toEqual({ typeId: id, uuid });
    const fromUuid = decodeId(uuid);
    expect("typeIds" in fromUuid && fromUuid.typeIds).toContain(id);
  });
});
