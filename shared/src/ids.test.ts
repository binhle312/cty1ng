import { describe, expect, it } from "vitest";
import { BotId, MessageId, SkillId, SkillVersionId } from "./ids.ts";

const SUFFIX = "01jb8x6p0afqz8r2m3k5t7v9wx";

describe("TypeID schemas (D36)", () => {
  it("accepts an id with its own prefix", () => {
    expect(BotId.safeParse(`bot_${SUFFIX}`).success).toBe(true);
  });

  it.each([
    ["another table's prefix", `msg_${SUFFIX}`],
    ["a longer prefix that starts the same", `skillv_${SUFFIX}`],
    ["no prefix", SUFFIX],
    ["a bare UUID", "0190b2a4-6f3c-7a1e-9b2d-3c4d5e6f7a8b"],
    ["25 characters", `bot_${SUFFIX.slice(1)}`],
    ["27 characters", `bot_${SUFFIX}0`],
    ["a letter outside the alphabet (u)", `bot_${SUFFIX.slice(0, 25)}u`],
    ["upper case", `bot_${SUFFIX.toUpperCase()}`],
    ["a first character above 7", `bot_8${SUFFIX.slice(1)}`],
  ])("rejects %s", (_label, value) => {
    expect(BotId.safeParse(value).success).toBe(false);
  });

  it("keeps prefixes that start the same apart", () => {
    expect(SkillId.safeParse(`skillv_${SUFFIX}`).success).toBe(false);
    expect(SkillVersionId.safeParse(`skillv_${SUFFIX}`).success).toBe(true);
    expect(MessageId.safeParse(`bot_${SUFFIX}`).success).toBe(false);
  });
});
