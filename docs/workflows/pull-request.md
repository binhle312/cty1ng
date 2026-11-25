# Write a PR description

The template is [`.github/pull_request_template.md`](../../.github/pull_request_template.md). GitHub
puts it into each new PR, and it is the one home of the sections and their order (DQ-753, by the
rule [one home for each fact](#one-home-for-each-fact); owner review pending). This file holds the
rules for what goes into them.
Before a protected action, check [AGENTS.md §7](../../AGENTS.md#7-what-needs-the-humans-approval-stop-and-ask-or-flag-it-clearly-in-the-pr).

## Examples of filled rows

The template has empty rows. These rows show the level of detail:

| Section | Example row |
| --- | --- |
| Acceptance criteria | `UI-2.4` → `e2e/header-drag.spec.ts` "drop adds bot": expects the bot chip in the header after the drop; + screenshot |
| Acceptance criteria | `conversation-rules §1 table` → `decide-runs.rules.test.ts` "human message: …" rows: one row per table line |
| Acceptance criteria, a claim with no test | "Each default has one home" → the search script in the description and its output on `abc1234`; the 21 places that it printed now point to the home. **Not claimed:** that no copy stays |
| Edge cases | "The same action twice" → `bots.spec` "a second Clone …"; "Keyboard only" → "Does not apply: this PR adds no control" |
| Differences from the plan | Test strategy T1 became two tests in `purge-due.test.ts`. Reason: one claim per test name |
| Needs human review | Migration `0003_skill_versions` (new tables, no data change) |
| Docs updated | `docs/domain-model.md` §3 (added changelog column) |
| Defect and review fixes | `DQ-a` → "A late Profile answer brings back an old pin"; `DQ-b` → "A late dialog answer brings back an old pin" (the row names DQ-a and the owner's decision) |

## A claim fits its proof

A claim with "all", "each", "every", "no" or "none" needs a check that covers each item. A test,
a lint rule or a script over a closed list is such a check. A search or a reading shows what it
found; it does not show that nothing else is there. With such a proof, say what you did and what
the proof shows, and add `Not claimed: …` (owner, 2026-11-11;
[lesson](../lessons-learned/claim-bigger-than-its-proof.md)). The reviewer tests these claims
first ([review guide §3](../review-guide.md#3-verify-what-the-evidence-proves)).

In a ledger row, "Same cause as an earlier fix?" covers earlier PRs too.
Name the search of the [prevention actions](../delivery-quality-prevention.md#prevention-actions)
and the [lessons](../lessons-learned/README.md) in the answer.

## One home for each fact

Each fact has one home, and other records link to it (decided by the builder at the owner's request, 2026-11-09, DQ-152). The PR body
states no state, count or result that a file or a tool owns:

- The issue state, fix commit and test live in the issue row of the ledger or its archive.
  The state of a prevention action lives in its row in `docs/delivery-quality-prevention.md`.
  The PR body names the id in its `Records` section
  and in the `Defect and review fixes` table; it does not repeat them (owner, 2026-11-18, q4 Q3 A).
  A PR with no milestone follows [ledger §7 step 2](../delivery-quality.md#7-update-and-assess)
  for its review findings.
- The result of a review round lives where [ledger §7 step 2](../delivery-quality.md#7-update-and-assess) says to record it.
- `pnpm records:counts --write` writes the counts for the Audit row and each `Ledger` row in the
  [register](../delivery-quality-register.md). CI checks them. Nobody types them in the register or in the body.
- The "Same cause as an earlier fix?" answer and its search live in the "Fix and verification"
  cell of the ledger row (`AGENTS.md` §9). The `Defect and review fixes` section of the body names
  the rows (a PR with no milestone: ledger §7 step 2). The form (owner, 2026-11-19, morning Q4 A):
  `` Same cause: no (search: `<pattern>`: <hits>) `` or
  `` Same cause: yes (search: `<pattern>`: <hits>; §9: <step>) ``.
  - Write one pattern. Use `\|` for `|` in the table. Search with
    `grep -n -i -E '<pattern>' docs/delivery-quality.md docs/delivery-quality-archive.md docs/delivery-quality-register.md docs/delivery-quality-prevention.md docs/lessons-learned/*.md`.
    The checker matches each line with a case-insensitive JavaScript regular expression.
    It rejects empty or blank patterns, backticks, backslashes before ASCII letters or digits,
    `[[`, `(?`, and patterns that JavaScript cannot compile. The
    [search fixture](../../scripts/records-counts.test.ts) compares the hit lines for its sample
    patterns.
  - Each `Same cause:` marker outside a single-backtick span needs a complete answer. Put
    nonblank hits inside the answer. Cite whole ids on matching lines other than the source row,
    or write `none`. Hits can contain balanced parentheses and ordinary semicolons. Only
    `; §9: ` at the outer level starts a step. The checker rejects a colon continuation after the
    closing parenthesis. Move any such note before the answer.
  - A yes needs one §9 step. A no takes none. Use one of these steps for a yes.
    - `owner, YYYY-MM-DD, <page> <question> <answer>` for the owner's decision. Use the exact
      spacing and a Gregorian date in years 0001–9999. The page uses groups of ASCII letters or
      digits joined by hyphens, or `#` followed by a positive number. The question is `Q`
      followed by a positive number. Use decimal digits without leading zeros for both numbers.
      The answer is one uppercase ASCII letter.
    - `proposal DQ-<n>` for the ledger row of the redesign proposal. A row can name itself
      when its trimmed fix cell starts with `Proposal:`.
    - `fixed answer (AGENTS.md §9, owner 2026-11-11)` for a claim bigger than its proof.
  - `pnpm records:counts` applies the marker rules above to each row from DQ-853 on that is not
    `withdrawn`. For DQ-751 to DQ-777, it checks only that the cell holds one
    `Same cause: yes|no (search: <command or places>: <hits>)` text, as on `main`. It does not check
    the choice of the words (the reviewer does), that `none` or a no is true, or that a decision
    named in a step exists.
- A `docs/status.md` line of a PR has its state, its date and its link. It has no list of files, no
  count and no claim that a test or a row owns.
  `pnpm check:status` fails on a typed measure. Its units are in `scripts/lib/check-status.ts`.
- The results of a script live in its output. The PR body pastes the output unchanged, with the
  commit that it names. It does not retype numbers from it. `pnpm check:breaks --report <file>`
  writes such a report.
- What a test does lives in the test. The PR body names the test or the break id.
- The plan does not repeat build facts: the red runs, the test names and counts as built, the
  proof logs and commands, and each difference from the plan
  ([plans rule 6](../plans/README.md#rules)). The PR description holds or pastes them, as the
  bullets above say; the differences go under `Differences from the plan`.

A new ledger row is short: one sentence for the finding and its cause, and a fix of a commit
plus a test or a break id. The whole row has 600 bytes or less (step 7 of the check below; owner, 2026-11-11).
The detail of a finding lives in the PR description, the test or the review record.

## Before each push: check the records

The records are the PR description and the rows that the PR adds or changes in
`docs/delivery-quality.md`, `docs/status.md` and other docs. Before each push, also after a
review fix, check them against the commit that you push (owner, 2026-11-08, DQ-125):

1. Read each claim in the records, and compare it with that commit. Each claim has its
   evidence, as [testing.md §5](../testing.md#5-evidence-in-prs) says: a run with its command
   and commit, `file:line` for a claim from the code, or "not run".
2. If a claim says that X fixes a failure, run it again without X. Write down that the run fails.
3. If a claim says that X causes a failure, run it again without X. Write down that the failure
   stops.
4. If you cannot show step 2 or 3, write that, and do not call X the fix or the cause.
5. If you correct a claim, search for its old text in all the records, and correct each copy.
6. Run `gh pr list --state all`. Correct the state of each PR that `docs/status.md` or the active
   audit file names. A PR cannot record its own merge, so the next push does it (owner, 2026-11-10).
   `pnpm check:status` lists each merged PR with no Done row, and gives the row to add; CI runs it.
   Merge `origin/main` into the branch first: the local run reads the merges of `origin/main` but
   the branch's own `docs/status.md`, so on an older branch it asks for rows that `main` already has.
   Follow [ledger §7 step 2](../delivery-quality.md#7-update-and-assess) for where to record a later review.
7. Measure each ledger row with an id above DQ-202. This command must print nothing:
   `LC_ALL=C awk -F'|' '/^\| DQ-/ { id = substr($2, 5) + 0; if (id > 202 && length($0) > 600) print "DQ-" id, length($0) }' docs/delivery-quality.md`.
   `LC_ALL=C` makes it count bytes, so each machine gives the same result. Make each row that it
   prints shorter, also when the PR only adds a fix to the row. A row up to DQ-202 can stay as it
   is (owner, 2026-11-10).
8. After the merge of `origin/main`, run `pnpm records:counts --write`, and commit what it
   writes. CI runs `pnpm records:counts` and fails when a count is stale.
9. Run `wc -c < docs/delivery-quality.md`. If the result is larger than the limit in
   [§7 step 6 of the ledger](../delivery-quality.md#7-update-and-assess), write under Follow-ups
   of the PR description that a move of the closed rows is due. The move is a PR of its own.
10. Before each push that edits issue rows, save the output of `pnpm records:removed-words <base> <head>`.
    Use the PR merge base and the commit you will push. The reviewer reads the report.

Before you say that a PR is ready: the description has no state line that is older than the head,
and `docs/status.md` names the PR.
