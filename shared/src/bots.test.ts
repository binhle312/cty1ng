import { describe, expect, it } from "vitest";
import {
  botFieldProblem,
  botNameKey,
  botSlugBase,
  botSlugCandidate,
  cloneNameCandidate,
  isReservedBotSlug,
  normaliseBotName,
} from "./bots.ts";

describe("botNameKey (domain-model.md §2 Name key)", () => {
  it.each([
    ["BÁ", "bá"],
    ["BÁ", "bá".toUpperCase()],
    [" BA ", "BA"],
    ["B  A", "b a"],
    ["ＢＡ", "ba"],
    ["ẞ", "ß"],
    ["ß", "SS"],
    ["SS", "ss"],
    ["ΟΔΟΣ", "οδοσ"],
    ["οδος", "ΟΔΟΣ"],
    ["ﬁx", "FIX"],
    ["\u0085BA\u0085", "ba"],
    ["B A", "b a"],
  ])("%j collides with %j", (a, b) => {
    expect(botNameKey(a)).toBe(botNameKey(b));
  });

  it.each([
    ["BA", "B A"],
    ["İ", "i"],
    ["ı", "i"],
    ["﻿BA", "BA"],
  ])("%j does not collide with %j", (a, b) => {
    expect(botNameKey(a)).not.toBe(botNameKey(b));
  });

  it("is stable: the key of a key is the key, for every code point (decision 5)", () => {
    const unstable: string[] = [];
    for (let code = 0; code <= 0x10ffff; code += 1) {
      if (code >= 0xd800 && code <= 0xdfff) continue;
      const text = `A${String.fromCodePoint(code)}`;
      const key = botNameKey(text);
      if (botNameKey(key) !== key) unstable.push(code.toString(16));
    }
    expect(unstable).toEqual([]);
  });

  it("never starts or ends with white space after the last NFKC", () => {
    expect(botNameKey("A ´")).toBe(botNameKey("A ´").trim());
    expect(botNameKey("´A").startsWith(" ")).toBe(false);
  });
});

describe("normaliseBotName", () => {
  it("trims and collapses Unicode white space, and keeps case", () => {
    expect(normaliseBotName("\u0085 Bá\t\n  Bot 　")).toBe("Bá Bot");
  });
});

describe("bot slugs (D19, domain-model.md §2 Slug)", () => {
  it.each([
    ["Thiết kế", "thiet-ke"],
    ["Đặt lịch", "dat-lich"],
    ["BA", "ba"],
    ["🤖✨", "bot"],
    ["--Hello,  World!--", "hello-world"],
    ["ＢＡ", "ba"],
  ])("%j → %j", (name, slug) => {
    expect(botSlugCandidate(botSlugBase(name), 1)).toBe(slug);
  });

  it("reserves new, so the name New gets new-2", () => {
    expect(isReservedBotSlug(botSlugCandidate(botSlugBase("New"), 1))).toBe(true);
    expect(botSlugCandidate(botSlugBase("New"), 2)).toBe("new-2");
  });

  it("keeps a long slug with its suffix at most 40, with no hyphen at the cut", () => {
    const base = botSlugBase("A very long bot name that keeps going and going on");
    expect(botSlugCandidate(base, 1)).toHaveLength(40);
    const second = botSlugCandidate(base, 12);
    expect(second.length).toBeLessThanOrEqual(40);
    expect(second.endsWith("-12")).toBe(true);
    expect(second).not.toContain("--");
    expect(botSlugCandidate("abcdefghij-abcdefghij-abcdefghij-abcdefgh", 2)).toBe(
      "abcdefghij-abcdefghij-abcdefghij-abcde-2",
    );
    expect(botSlugCandidate("abcdefghij-abcdefghij-abcdefghij-abcde-x", 2)).toBe(
      "abcdefghij-abcdefghij-abcdefghij-abcde-2",
    );
    expect(botSlugCandidate("abcdefghij-abcdefghij-abcdefghij-abcd-xyz", 2)).toBe(
      "abcdefghij-abcdefghij-abcdefghij-abcd-2",
    );
  });
});

describe("clone names (domain-model.md §2 Clone name)", () => {
  it("adds (copy) and fits the limit", () => {
    expect(cloneNameCandidate("BA", 1, 32)).toBe("BA (copy)");
    const thirty = "A".repeat(30);
    const name = cloneNameCandidate(thirty, 1, 32);
    expect(name).toBe(`${"A".repeat(25)} (copy)`);
    expect(name.length).toBeLessThanOrEqual(32);
    expect(cloneNameCandidate(thirty, 2, 32)).toBe(`${"A".repeat(23)} (copy 2)`);
  });

  it("never cuts inside a grapheme and drops the space before the suffix", () => {
    const name = cloneNameCandidate(`${"A".repeat(23)} 👨‍👩‍👧`, 1, 32);
    expect(name).toBe(`${"A".repeat(23)} (copy)`);
    expect(name.length).toBeLessThanOrEqual(32);
  });
});

describe("botFieldProblem (create-bot-page.md §5)", () => {
  const limits = { nameMax: 32, descriptionMax: 160, personaMax: 8000 };
  it("asks for empty fields", () => {
    expect(botFieldProblem("name", "   ", limits)).toBe("Type a name.");
    expect(botFieldProblem("persona_md", "", limits)).toBe(
      "Write a persona. The bot needs it to work.",
    );
  });

  it("measures the stored name and says how much is too long", () => {
    expect(botFieldProblem("name", `  ${"a".repeat(32)}  `, limits)).toBeNull();
    expect(botFieldProblem("name", "a".repeat(33), limits)).toBe(
      "The name has 33 characters. The limit is 32. Make it shorter.",
    );
    expect(botFieldProblem("persona_md", "a".repeat(8002), limits)).toBe(
      "Too long by 2 characters. Move long procedures into a skill.",
    );
  });

  it("keeps the description on one line (domain-model.md §2, D18)", () => {
    for (const lineBreak of ["\n", "\r", "\u0085", "\u2028", "\u2029"]) {
      expect(botFieldProblem("description", `first${lineBreak}second`, limits)).toBe(
        "Write the description on one line.",
      );
    }
    expect(botFieldProblem("description", "Turns stories\tinto screens", limits)).toBeNull();
    // The persona is Markdown: line breaks stay allowed.
    expect(botFieldProblem("persona_md", "# Role\nYou are a BA.", limits)).toBeNull();
  });
});
