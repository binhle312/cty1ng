// Self-test of content lint and text output. Exit 1 on a failure.
import assert from "node:assert/strict";
import { copyLines, lint, pageText, questionText } from "./lib.mjs";

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
      decides: "Choose the scope for next week.",
      owner: "The team gives you final approval.",
      settled: ["Work starts on Monday."],
      pick: { key: "A", reason: "It is small.", confidence: "clear", another: "you want more." },
      facts: ["**First task:** fix the cache.", "**Second task:** test the cache."],
      table: { title: "Days per plan", columns: ["Plan", "Days"], rows: [["A", 1], ["B", 2]] },
      example: { title: "a week", steps: [{ when: "Monday", text: "Start the work." }, { when: "Tuesday", text: "Check the work." }] },
      options: [
        { key: "A", label: "Small plan", does: "Fix the cache.", gets: "Fast.", costs: "Less scope.", risk: "low", riskText: "A gap." },
        { key: "B", label: "Big plan", does: "Fix and test the cache.", gets: "More scope.", costs: "Slow.", risk: "high", riskText: "A delay.", details: { summary: "What B has", items: ["Two parts."] } },
      ],
      details: { summary: "How we set the scope", items: ["The team has time next week."] },
      removed: ["A month is outside the scope."],
    },
  ],
};

const expected = [
  "Pick a plan", "One question.", "One choice", "Read it.", "Then answer.",
  "Facts", "The gen.mjs step runs.", "A nested item.",
  "Counts", "Run, Right", "One, 3", "A note.",
  "Plan", "Which plan?", "the plan for next week.", "It sets the work.",
  "Choose the scope for next week.", "The team gives you final approval.", "Work starts on Monday.",
  "First task: fix the cache.", "Second task: test the cache.", "Days per plan", "Plan, Days", "A, 1", "B, 2",
  "a week", "Start the work.", "Check the work.",
  "How we set the scope", "The team has time next week.", "Option removed: A month is outside the scope.",
  "It is small.", "you want more.",
  "Small plan", "Fix the cache.", "Fast.", "Less scope.", "A gap.",
  "Big plan", "Fix and test the cache.", "More scope.", "Slow.", "A delay.", "What B has", "Two parts.",
];
assert.deepEqual(pageText(content), expected);
const lines = pageText(content);
for (const mark of ["**", "`", "k-1", "2026-01-02"]) {
  assert.ok(!lines.some((line) => line.includes(mark)), `the text has "${mark}"`);
}
for (const value of ["low", "high", "clear", "A", "B", "Monday", "Tuesday"]) {
  assert.ok(!lines.includes(value), `the text has the line "${value}"`);
}
const q = content.questions[0];
assert.deepEqual(questionText(q), [
  "Which plan?", "Decide: the plan for next week.", "It sets the work.",
  "Only this depends on you: Choose the scope for next week.",
  "Why you decide: The team gives you final approval.", "Already decided (no answer needed):", "Work starts on Monday.",
  "First task: fix the cache.", "Second task: test the cache.", "Days per plan", "Plan, Days", "A, 1", "B, 2",
  "Example: a week", "Monday: Start the work.", "Tuesday: Check the work.",
  "My pick: A. Small plan", "It is small.", "Confidence: clear.", "Pick another if: you want more.",
  "A. Small plan", "Risk: low", "Does: Fix the cache.", "Gets: Fast.", "Costs: Less scope.", "Risk: A gap.",
  "B. Big plan", "Risk: high", "Does: Fix and test the cache.", "Gets: More scope.", "Costs: Slow.", "Risk: A delay.",
]);

const answers = { Q1: "A" }, notes = { Q1: " A note.\nSecond line. " };
const copied = "Pick a plan, 2026-01-02: my answers (1 of 1)\nQ1: A Small plan\n  Note: A note. Second line.";
assert.equal(copyLines(content, answers, notes), `${copied}\nPage clear: (no answer)`);
assert.equal(copyLines(content, answers, notes, { clear: "yes", missing: " \n " }), `${copied}\nPage clear: yes`);
assert.equal(copyLines(content, answers, notes, { clear: "no", missing: " The scope.\n The date. " }), `${copied}\nPage clear: no\n  Missing: The scope. The date.`);
assert.equal(copyLines(content, answers, notes, { missing: "More context." }), `${copied}\nPage clear: (no answer)\n  Missing: More context.`);

assert.deepEqual(lint(content).errors, []);
for (const field of ["decides", "owner", "settled", "does"]) {
  const draft = structuredClone(content);
  const question = draft.questions[0];
  const parent = field === "does" ? question.options[0] : question;
  delete parent[field];
  const path = field === "does" ? "questions[0].options[0].does" : `questions[0].${field}`;
  assert.ok(lint(draft).errors.some((error) => error.startsWith(`${path} is required`)), `lint names the missing ${path}`);
}
const emptySettled = { ...q, settled: [] };
const lintQuestion = (question) => lint({ ...content, questions: [question] });
assert.deepEqual(lintQuestion(emptySettled).errors, []);
assert.ok(!questionText(emptySettled).includes("Already decided (no answer needed):"));
const words = (n) => Array(n).fill("word").join(" ");
for (const [question, field] of [
  [{ ...q, decides: words(21) }, "decides:"],
  [{ ...q, owner: `${words(20)}. Six more words in this sentence.` }, "owner:"],
  [{ ...q, settled: [words(21)] }, "settled[0]:"],
  [{ ...q, settled: ["One", "Two", "Three", "Four"] }, "settled:"],
  [{ ...q, removed: [words(26)] }, "removed[0]:"],
  [{ ...q, options: [{ ...q.options[0], does: words(13) }, q.options[1]] }, "does:"],
]) assert.ok(lintQuestion(question).errors.some((error) => error.includes(field)), `lint enforces the ${field} limit`);

const stats = lintQuestion(q).stats[0];
assert.equal(lintQuestion({ ...q, decides: "Choose now." }).stats[0].contextWords, stats.contextWords - 4);
assert.equal(lintQuestion({ ...q, removed: [] }).stats[0].contextWords, stats.contextWords);
assert.equal(lintQuestion({ ...q, options: [{ ...q.options[0], does: "Fix it." }, q.options[1]] }).stats[0].choiceWords, stats.choiceWords - 1);

console.log("selftest: ok (scope lint, page and question text, and copied feedback)");
