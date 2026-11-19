import { describe, expect, it } from "vitest";
import { checkOwnerQuotes, ownerQuotes } from "./owner-quotes.ts";

// The owner record is synthetic (principle-safe-test-data).
const RULE = "scripts/fixtures/R-040-docs-merges.md";
const RECORD = [
  "## Order 120 (2026-11-20 09:00)\n",
  'Exact text: "you may merge each docs PR\n    when the checks are green"\n',
];

function rule(...quotes: string[]): string {
  return [
    "---",
    "id: R-040",
    "---",
    "Rule: Merge each docs PR at the bar.",
    ...quotes.map((quote) => `Owner said: "${quote}" (2026-11-20)`),
    "How to apply:",
    "",
  ].join("\n");
}

const check = (text: string, record: readonly string[] | undefined = RECORD) =>
  checkOwnerQuotes({ rules: [{ path: RULE, text }], record, minWords: 4 });

describe("ownerQuotes", () => {
  it("reads each quote of each Owner said line", () => {
    const text = `${rule("one two three four")}Owner said: "five six" and "seven" (2026-11-20)\n`;
    expect(ownerQuotes(text), "three quotes").toEqual(["one two three four", "five six", "seven"]);
  });
});

describe("checkOwnerQuotes", () => {
  it("passes a quote that is in the record", () => {
    expect(check(rule("you may merge each docs PR")).problems, "in record").toEqual([]);
  });

  it("passes a quote that a line break splits in the record", () => {
    const text = rule("each docs PR when the checks are green");
    expect(check(text).problems, "across a line break").toEqual([]);
  });

  it("names a quote that is not in the record", () => {
    expect(check(rule("you may merge each code PR")).problems, "not in record").toEqual([
      `${RULE}: the quote "you may merge each code PR" is not in the owner record; a rule counts only with the owner's own words (order 109)`,
    ]);
  });

  it("names a quote with fewer words than quote_min_words", () => {
    expect(check(rule("each docs PR")).problems, "short quote").toEqual([
      `${RULE}: the quote "each docs PR" has 3 words; a quote that the check compares needs 4 or more (setting quote_min_words)`,
    ]);
  });

  it("needs the same case and punctuation", () => {
    expect(check(rule("You may merge each docs PR")).problems, "case").toHaveLength(1);
  });

  it("reports no record when the record is missing or empty", () => {
    for (const record of [undefined, [], ["  \n"]]) {
      const text = rule("you may merge each docs PR");
      const result = checkOwnerQuotes({ rules: [{ path: RULE, text }], record, minWords: 4 });
      expect(result.noRecord, `record ${JSON.stringify(record)}`).toBe(true);
      expect(result.problems, `record ${JSON.stringify(record)}`).toEqual([]);
    }
  });

  it("names a rule with no quote", () => {
    expect(check("---\nid: R-040\n---\nRule: Merge.\n").problems, "no quote").toEqual([
      `${RULE}: no "Owner said:" quote, so the rule has no words of the owner to compare`,
    ]);
  });

  it("does not join two record files into one quote", () => {
    const rules = [{ path: "R-040.md", text: 'Owner said: "the chief may merge" (2026-11-20)\n' }];
    const result = checkOwnerQuotes({
      rules,
      record: ["I said: the chief may", "merge nothing tonight"],
      minWords: 4,
    });
    expect(result.problems.length, "joined records").toBe(1);
  });

  it("keeps a floor of 4 words whatever the setting says", () => {
    const rules = [{ path: "R-040.md", text: 'Owner said: "" (2026-11-20)\n' }];
    const result = checkOwnerQuotes({ rules, record: ["any text"], minWords: 0 });
    expect(result.problems.length, "floor").toBe(1);
  });
});
