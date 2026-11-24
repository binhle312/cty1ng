// Self-test of content lint and text output. Exit 1 on a failure.
import assert from "node:assert/strict";
import { copyLines, lint, pageText, questionText, stripMarkup } from "./lib.mjs";

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
const expectedQuestion = [
  "Which plan?", "The decision", "Decide: the plan for next week.", "It sets the work.",
  "Only this depends on you: Choose the scope for next week.",
  "Why you decide: The team gives you final approval.", "Already decided (no answer needed):", "Work starts on Monday.",
  "Facts", "First task: fix the cache.", "Second task: test the cache.", "Days per plan", "Plan, Days", "A, 1", "B, 2",
  "Example", "a week", "Monday: Start the work.", "Tuesday: Check the work.",
  "My pick: A. Small plan", "It is small.", "Confidence: clear.", "Pick another if: you want more.",
  "A. Small plan", "Risk: low", "Does: Fix the cache.", "Gets: Fast.", "Costs: Less scope.", "Risk: A gap.",
  "B. Big plan", "Risk: high", "Does: Fix and test the cache.", "Gets: More scope.", "Costs: Slow.", "Risk: A delay.",
];
assert.deepEqual(questionText(q), expectedQuestion);

const answers = { Q1: "A" }, notes = { Q1: " A note.\nSecond line. " };
const copied = "Pick a plan, 2026-01-02: my answers (1 of 1)\nQ1: A Small plan\n  Note: A note. Second line.";
assert.equal(copyLines(content, answers, notes), `${copied}\nPage clear: (no answer)`);
assert.equal(copyLines(content, answers, notes, { clear: "yes", missing: " \n " }), `${copied}\nPage clear: yes`);
assert.equal(copyLines(content, answers, notes, { clear: "no", missing: " The scope.\n The date. " }), `${copied}\nPage clear: no\n  Missing: The scope. The date.`);
assert.equal(copyLines(content, answers, notes, { missing: "More context." }), `${copied}\nPage clear: (no answer)\n  Missing: More context.`);

assert.equal(stripMarkup("**Formula:** `x ** 2` and `**`."), "Formula: x ** 2 and **.");
assert.equal(stripMarkup("Keep `open and **bold**."), "Keep `open and bold.");
assert.equal(stripMarkup("Keep **before `code` after**."), "Keep **before code after**.");
const literalOption = { ...q.options[0], label: "`**`", does: "Use `x ** 2` and `x. Y`. Keep `**`." };
const literalQuestion = { ...q, options: [literalOption, q.options[1]] };
const literalContent = { ...content, questions: [literalQuestion] };
const literalLines = ["Use x ** 2 and x. Y.", "Keep **."];
assert.ok(pageText(literalContent).includes("**"));
assert.ok(literalLines.every((line) => pageText(literalContent).includes(line)));
assert.ok(questionText(literalQuestion).includes("A. **"));
assert.ok(questionText(literalQuestion).includes(`Does: ${literalLines[0]}`));
assert.ok(questionText(literalQuestion).includes(literalLines[1]));
assert.equal(copyLines(literalContent, answers, {}), "Pick a plan, 2026-01-02: my answers (1 of 1)\nQ1: A **\nPage clear: (no answer)");
const emptyLabel = { ...literalQuestion, options: [{ ...literalOption, label: "``" }, q.options[1]] };
assert.equal(copyLines({ ...content, questions: [emptyLabel] }, answers, {}), "Pick a plan, 2026-01-02: my answers (1 of 1)\nQ1: A \nPage clear: (no answer)");
assert.equal(copyLines(literalContent, { Q1: "Z" }, {}), "Pick a plan, 2026-01-02: my answers (0 of 1)\nQ1: (no answer)\nPage clear: (no answer)");

const lintQuestion = (question) => lint({ ...content, questions: [question] });
const words = (n) => Array(n).fill("word").join(" ");
const boundaryOptions = ["A", "B", "C", "D"].map((key) => ({
  key, label: "Cache plan", does: words(8), gets: words(8), costs: words(8), risk: "low", riskText: words(8),
}));
const atOptionLimit = lintQuestion({ ...q, options: boundaryOptions });
assert.equal(atOptionLimit.stats[0].choiceWords, 160);
assert.ok(!atOptionLimit.errors.some((error) => error.includes("visible option words")));
const overOptionLimit = lintQuestion({ ...q, options: [{ ...boundaryOptions[0], does: words(9) }, ...boundaryOptions.slice(1)] });
assert.equal(overOptionLimit.stats[0].choiceWords, 161);
assert.ok(overOptionLimit.errors.some((error) => error.includes("161 visible option words > 160")));

const votes = [
  { role: "lead agent", name: "Alex" },
  { role: "worker", name: "Sam" },
  { role: "consultant", name: "GPT-6.2 Astra high" },
  { role: "advisor", name: "Jo" },
];
const withVotes = { ...q, options: [{ ...q.options[0], votes }, { ...q.options[1], votes: [] }] };
const voteContent = { ...content, questions: [withVotes] };
assert.deepEqual(lint(voteContent).errors.filter((error) => error.includes("votes")), []);
for (const [actual, baseline, a, b] of [
  [pageText(voteContent), expected, "Small plan", "Big plan"],
  [questionText(withVotes), expectedQuestion, "Risk: low", "Risk: high"],
]) {
  const want = [...baseline];
  want.splice(want.indexOf(a) + 1, 0, "Lead agent: Alex", "Worker: Sam", "Consultant: GPT-6.2 Astra high", "Advisor: Jo");
  want.splice(want.indexOf(b) + 1, 0, "No votes");
  assert.deepEqual(actual, want);
}
assert.equal(copyLines(voteContent, { Q1: "A" }, {}), [
  "Pick a plan, 2026-01-02: my answers (1 of 1)", "Q1: A Small plan", "  Lead agent: Alex", "  Worker: Sam",
  "  Consultant: GPT-6.2 Astra high", "  Advisor: Jo", "Page clear: (no answer)",
].join("\n"));
assert.equal(copyLines(voteContent, { Q1: "B" }, {}), "Pick a plan, 2026-01-02: my answers (1 of 1)\nQ1: B Big plan\n  No votes\nPage clear: (no answer)");
const emptyVotes = { ...q, options: [{ ...q.options[0], votes: [] }, q.options[1]] };
assert.deepEqual(questionText(emptyVotes), questionText(q));
assert.equal(lintQuestion(emptyVotes).stats[0].choiceWords, lintQuestion(q).stats[0].choiceWords);
for (const bad of [null, "Alex", [null], [{ role: "chief", name: "Alex" }], [{ role: "worker", name: " " }]]) {
  const invalid = { ...q, options: [{ ...q.options[0], votes: bad }, q.options[1]] };
  assert.ok(lintQuestion(invalid).errors.some((error) => error.startsWith("questions[0].options[0].votes")));
}
const extraVoteKey = { ...q, options: [{ ...q.options[0], votes: [{ ...votes[0], score: 1 }] }, q.options[1]] };
assert.ok(lintQuestion(extraVoteKey).errors.includes("questions[0].options[0].votes[0] has unexpected keys: score"));
const voteBoundary = [
  { ...boundaryOptions[0], does: words(1), gets: words(7), votes: [votes[1]] }, ...boundaryOptions.slice(1),
];
const atVoteLimit = lintQuestion({ ...q, options: voteBoundary });
assert.equal(atVoteLimit.stats[0].choiceWords, 160);
assert.ok(!atVoteLimit.errors.some((error) => error.includes("visible option words")));
voteBoundary[0].votes = [{ ...votes[1], name: "李 明" }];
const overVoteLimit = lintQuestion({ ...q, options: voteBoundary });
assert.equal(overVoteLimit.stats[0].choiceWords, 161);
assert.ok(overVoteLimit.errors.some((error) => error.includes("161 visible option words > 160")));

const atBoldLimit = { ...q, table: { ...q.table, rows: [...q.table.rows, [words(39), words(36)]] } };
const atBold = lintQuestion(atBoldLimit);
assert.equal(atBold.stats[0].contextWords, 170);
assert.equal(atBold.stats[0].boldPercent, 10);
assert.deepEqual(atBold.errors, []);
assert.deepEqual(lintQuestion({ ...atBoldLimit, options: literalQuestion.options }).warnings, []);
const overBold = lintQuestion({ ...atBoldLimit, decides: "Choose the scope for Monday." });
assert.equal(overBold.stats[0].boldPercent, 10.1);
assert.ok(overBold.errors.some((error) => error.includes("bold is 10.1%")));
for (const field of ["decides", "owner", "settled", "does"]) {
  const draft = structuredClone(content);
  const question = draft.questions[0];
  const parent = field === "does" ? question.options[0] : question;
  delete parent[field];
  const path = field === "does" ? "questions[0].options[0].does" : `questions[0].${field}`;
  assert.ok(lint(draft).errors.some((error) => error.startsWith(`${path} is required`) && error.includes("R8.1 scope fields")), `lint names the missing ${path} and its rule`);
}
const emptySettled = { ...atBoldLimit, settled: [] };
assert.deepEqual(lintQuestion(emptySettled).errors, []);
assert.equal(lintQuestion(emptySettled).stats[0].boldPercent, 7.5);
assert.ok(!questionText(emptySettled).includes("Already decided (no answer needed):"));
for (const [question, field] of [
  [{ ...q, decides: words(21) }, "decides:"],
  [{ ...q, owner: `${words(20)}. Six more words in this sentence.` }, "owner:"],
  [{ ...q, settled: [words(21)] }, "settled[0]:"],
  [{ ...q, settled: ["One", "Two", "Three", "Four"] }, "settled:"],
  [{ ...q, removed: [words(26)] }, "removed[0]:"],
  [{ ...q, options: [{ ...q.options[0], does: words(13) }, q.options[1]] }, "does:"],
]) assert.ok(lintQuestion(question).errors.some((error) => error.includes(field) && error.includes("R8.1 scope fields")), `lint enforces the ${field} limit and names its rule`);

const stats = lintQuestion(q).stats[0];
assert.equal(lintQuestion({ ...q, decides: "Choose now." }).stats[0].contextWords, stats.contextWords - 4);
assert.equal(lintQuestion({ ...q, removed: [] }).stats[0].contextWords, stats.contextWords);
assert.equal(lintQuestion({ ...q, options: [{ ...q.options[0], does: "Fix it." }, q.options[1]] }).stats[0].choiceWords, stats.choiceWords - 1);

console.log("selftest: ok (scope and vote lint, page and question text, and copied feedback)");
