# Merge bar

Builders and reviewers use this bar. Read it when you give a finding a severity, decide what a
finding blocks, or write a state table or order test.

Only P1 and P2 findings block a merge (owner, 2026-11-04).
This bar applies the [when review ends principle](../../.agents/skills/principle-when-review-ends/SKILL.md).

## Severity

Read the table from the top, and use the first row that fits.

| Severity | Meaning | Action |
| --- | --- | --- |
| P1 | Data loss, a security failure, or a normal action that cannot complete | Blocks the merge |
| P2 | A broken required acceptance criterion or its missing proof, or a wrong result in the scope below with harm that is not small and recoverable | Blocks the merge |
| P3 | A small, recoverable wrong result, a case outside the scope below, or a code quality point | Add it to the follow-up list in `docs/status.md` |

Harm is small and recoverable when all of these are true:

- Saved data stays correct.
- The owner's unsaved text stays.
- The owner can see if an action failed.
- The app's own refresh or the owner's next action shows the truth.

At each milestone close, the owner reviews the P3 follow-ups, and either fixes or drops each item.

If the builder and the reviewer disagree about a severity, ask the owner.
This bar does not change `AGENTS.md` §7, §8 or §9.

## Failure scope

The scope is one human on `127.0.0.1`, until the VPS phase (M9).

- **In scope:** actions while a request waits, a second tab, a move to another page, failed requests and refreshes, and live events.
- **Out of scope:** several humans, and an answer lost on the network, except the case that Q4 decided (`docs/design/components/bot-page.md` §4.2).

An owner decision about a named case stays in force, even when the scope leaves out similar cases.

Check the bar and the scope again before the VPS phase.
