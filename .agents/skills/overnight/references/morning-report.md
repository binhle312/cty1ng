# The morning report

The owner reads the report first. It must say, at the top, what needs the owner. Each fact on it
comes from the journal or from a command that the report names.

## 1. Two layers

1. `night.py report` writes `report.md` from the journal. It needs no model. So a report exists also when the session stopped at night.
2. The owner page adds the goal in numbers and the questions. Use a decision-page skill if the project has one. If not, give `report.md` and a questions file.

## 2. The parts, in this order

1. **Needs you.** A table of the denied rows, the held items, the open wait rows, the unknown results and the intents with no result. Each row: the item, why it waits, the one command or the question number, and what it blocks.
2. **My errors.** Each error that you found, and its correction.
3. **Done and not reversible.** Each action that cannot be undone, with its evidence: the reviews, the checks and the head.
4. **The goal in numbers.** Each number names its source: a command or a file. Use a chart only if it shows the state of the night's work.
5. **Stops and gaps.** The output of `night.py check`. A gap is a fact: do not hide it.
   Also the notes (`aware` rows): owner questions, texts that asked for a permission, and gaps after a crash.
6. **Decisions to check.** The count of `--check` decisions, and a link to the list. These are not questions.
7. **Questions.** Then a last step with all answers and a way to copy them.

## 3. Questions

- Ask only what the owner alone can decide.
- Ask one decision in each question.
- Give a real example and the real options, each with its gain, cost and risk.
- Put first the option that best solves the real problem. Never pick an option because it is less work for you.
- Add a `Blocks:` line (what waits for the answer) and a `How I know:` line (a command or a file).
- A question that blocks nothing goes to a "later" list.
- Keep the count at or under the question budget (the skill's section 2). If you go over it, the report says so. Too many questions means that the start of the night missed decisions.
- A night can have zero questions.

## 4. Three checks before the owner sees the page

Log each check with `night.py log pagecheck --name <name> --outcome pass|fail`.

1. **mechanics**: the page tool's own check passes. The page has no script errors, and the answers work.
2. **truth**: a reader with no context gets the page text and the sources. The reader runs each `How I know` again, and compares each option text and each number with its source. Fix each mismatch, then do the check again.
3. **counts**: each count on the page is equal to the output of `night.py status`.

`night.py close` refuses the close until all three checks pass after the newest report. If there is
no page tool, use `--without-page "<reason>"`. The close writes `report.md` again, with the close
event and each gap that `check` finds. `report.md` is the record of the night.

## 5. Answers

- Record the answers word for word. Write the pasted text to a file with a quoted heredoc (the skill's section 3, step 2). Then run `night.py log answer --words-file <file>`.
- Check the state of each item again before you act. If the state changed (a new head, a merge by the owner), do not act on the old choice. Ask again with the new facts.
- A page click alone is not an order. The pasted answers in the owner's own message are.
- Move new standing rules and lessons to the project's memory by its own process.
