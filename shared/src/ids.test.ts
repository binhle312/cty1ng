import { describe, expect, it } from "vitest";
import { BotId, ConversationId, isId, parseId } from "./ids";

const SUFFIX = "01jb8x6p0afqz8r2m3k5t7v9wx";

describe("TypeID schemas (D36)", () => {
  it("accept their own prefix", () => {
    expect(BotId.safeParse(`bot_${SUFFIX}`).success).toBe(true);
    expect(parseId("conv", `conv_${SUFFIX}`)).toBe(`conv_${SUFFIX}`);
  });

  it.each([
    ["wrong prefix", `msg_${SUFFIX}`],
    ["no prefix", SUFFIX],
    ["uppercase", `bot_${SUFFIX.toUpperCase()}`],
    ["too short", "bot_01jb8x"],
    ["first char above 7 (overflow)", `bot_8${SUFFIX.slice(1)}`],
    ["letters outside Crockford base32", `bot_01jb8x6p0afqz8r2m3k5t7v9wu`],
    ["a UUID", "01a1615e-fcc3-7c2d-8d2a-398ff92a850f"],
  ])("reject %s", (_label, value) => {
    expect(BotId.safeParse(value).success).toBe(false);
    expect(isId("bot", value)).toBe(false);
  });

  it("parseId throws on a mix-up", () => {
    expect(() => parseId("bot", `conv_${SUFFIX}`)).toThrow("expected a bot_… id");
    expect(ConversationId.safeParse(`bot_${SUFFIX}`).success).toBe(false);
  });
});
