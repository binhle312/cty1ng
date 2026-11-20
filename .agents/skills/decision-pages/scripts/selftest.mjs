// Self-test of the text export: node scripts/selftest.mjs. Exit 1 on a failure.
import assert from "node:assert/strict";
import { pageText } from "./lib.mjs";

const content = {
  page: { title: "Pick a **plan**", date: "2026-01-02", storageKey: "k-1", subtitle: "One question." },
  overview: {
    heading: "One choice",
    lead: "Read it. Then answer.",
    blocks: [
      { type: "list", place: "left", title: "Facts", items: ["The `gen.mjs` step runs.", ["A nested item."]] },
      { type: "table", place: "right", title: "Counts", columns: ["Run", "Right"], rows: [["One", 3]], note: "A note." },
    ],
  },
  questions: [
    {
      topic: "Plan",
      title: "Which plan?",
      ask: "the plan for next week.",
      why: "It sets the work.",
      pick: { key: "A", reason: "It is small.", confidence: "clear", another: "you want more." },
      facts: ["**Fact:** one fact."],
      example: { title: "a week", steps: [{ when: "Monday", text: "Start the work." }] },
      options: [
        { key: "A", label: "Small plan", gets: "Fast.", costs: "Less scope.", risk: "low", riskText: "A gap." },
        { key: "B", label: "Big plan", gets: "More scope.", costs: "Slow.", risk: "high", riskText: "A delay.", details: { summary: "What B has", items: ["Two parts."] } },
      ],
    },
  ],
};

const expected = [
  "Pick a plan", "One question.", "One choice", "Read it.", "Then answer.",
  "Facts", "The gen.mjs step runs.", "A nested item.",
  "Counts", "Run, Right", "One, 3", "A note.",
  "Plan", "Which plan?", "the plan for next week.", "It sets the work.", "Fact: one fact.",
  "a week", "Start the work.", "It is small.", "you want more.",
  "Small plan", "Fast.", "Less scope.", "A gap.",
  "Big plan", "More scope.", "Slow.", "A delay.", "What B has", "Two parts.",
];
assert.deepEqual(pageText(content), expected);
const lines = pageText(content);
for (const mark of ["**", "`", "k-1", "2026-01-02", "Monday"]) {
  assert.ok(!lines.some((line) => line.includes(mark)), `the text has "${mark}"`);
}
for (const value of ["low", "high", "clear", "A", "B"]) {
  assert.ok(!lines.includes(value), `the text has the line "${value}"`);
}
console.log("selftest: ok (the text export gives the expected lines)");
