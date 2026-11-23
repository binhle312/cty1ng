# State

As of: 2026-11-23
Main: aa11c16
Promoted through: 2026-11-19

This file holds only facts that `docs/status.md` does not hold. Check each one live before you
act on it.

## Open PRs

This file keeps no wait state of an open PR (owner, 2026-11-19, #139 fixes page Q6 A). Read what
each PR waits for in `docs/status.md` ("Next", "Waiting on the owner") and with
`gh pr list`. The table keeps only the facts that have no other home.

| PR | What | DQ range | Other fact |
| --- | --- | --- | --- |
| #139 | The chief's restore kit: the `decision-pages` skill, this memory, `pnpm check:memory`, the `AGENTS.md` words | DQ-878 to DQ-899, DQ-935 to DQ-952, DQ-1000 to DQ-1019 and DQ-1020 to DQ-1080 (it used DQ-876 and DQ-877 before the ranges); DQ-953 to DQ-959 are a reserve that only the chief gives | — |
| #107 | The redesign of the break runner (five gaps) | — | No leader runs now. |
| #140 | The `overnight` skill: owner-started night work with a night card | DQ-900 to DQ-934, DQ-960 to DQ-999 | — |
| #142 | The trigger first in the `consultants` and `arena` descriptions | — | — |

## The chief's queue

1. After #139 merges: the cutover. Copy the live files of the `tmp/` folder into `short-term/`,
   and give the owner the list of auto-memory notes that become pointers. Remove nothing before
   the owner's OK (R-014). Build `short-term/owner/`: one `.md` file for each day, with every word
   of the owner that a rule quotes, before the first chief merge of a memory PR (chief,
   2026-11-19, plan v3 Q2). Run `pnpm check:memory --local --fix` (the new folder path), and give
   the owner the filled cron line of rule R-037.
2. The final rules into this memory, then their install by the owner (owner, 2026-11-19, orders 110 to 112).
3. The chief's mistakes: a way to stop the rule breaks (order 121).
4. The token audit of the agent workflow (order 106).
5. The theme C files into the `decision-pages` skill (order 107).
6. The `chief` skill PR: the method and the tools, with an exam (owner, 2026-11-19, arena Q5 A).
7. The `overnight` skill (arena Q6 A and Q7 A): draft #140, with its own leader.
8. Then the order of `docs/status.md`, "Next".

## Parked

- The coding standard (owner, 2026-11-04): do not start it again until the owner asks.
- No qmd (owner, 2026-11-19, arena Q9 A): fixed ledger fields first.

## Next free ids

- DQ: the chief gives each open PR a range (the table "Open PRs"). A new range starts at
  DQ-1081. Check first: the highest id in `docs/delivery-quality*.md` and in the open PRs.
- Rule: R-038. Lesson: L-30. Owner order: 166 (check the log at the merge).
