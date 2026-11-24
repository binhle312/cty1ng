## What

One paragraph.

## Why

Link to the brief and decisions.

## Acceptance criteria

| AC | Evidence |
| --- | --- |
| | |

A claim with "all" or "no" needs a check that covers each item. With a search or a reading as proof,
say what the proof shows and add `Not claimed: …` (`docs/workflows/pull-request.md`).

## Edge cases (one table for each changed screen, `testing.md` §3)

| Case | Test, or why the row does not apply |
| --- | --- |
| | |

## Differences from the plan

- Each difference between the approved plan and the build, with the reason (or "none")

## Needs human review

- (or "none")

## Docs updated

- (or "none")

## Folder indexes

- README.md tables updated for every added, removed, renamed or repurposed file, and the
  descriptions still match what the files do (or "no file changes")

## Records

Ledger rows DQ-… to DQ-… and the round rows of this PR in `docs/delivery-quality.md` §6.
The PR register row is in `docs/delivery-quality-register.md` §3.
`pnpm records:counts` passes (CI). This description holds no state,
count, fix commit or round result: the rows hold them.

## Defect and review fixes (when a review found something)

List the ledger row of each defect that this PR repairs and of each review fix. The row holds the
general rule, the fix, the test, and `Same cause: yes|no (search: `<pattern>`: <hits>)`
([bug fix, step 2](https://github.com/binhle312/cty1ng/blob/main/docs/workflows/bug-fix.md);
`AGENTS.md` §9). Search `docs/delivery-quality-prevention.md` and the lessons for earlier fixes.

| Row | Finding |
| --- | --- |
| | |

## Follow-ups (not done here)

- ...
