# Merge bar

Builders and reviewers use this bar. Read it when you give a finding a severity, decide what a
finding blocks, write a state table or order test, or set the limits of a pattern rule.

Only P1 and P2 findings block a merge (owner, 2026-11-04). Fix each of them at once, in the PR that has it.
A P3 finding does not block a merge. Fix it at the end of the milestone, before the next milestone starts (owner, 2026-11-10).
This bar applies the [when review ends principle](../../.agents/skills/principle-when-review-ends/SKILL.md).

## Severity

Read the table from the top, and use the first row that fits.

| Severity | Meaning | Action |
| --- | --- | --- |
| P1 | Data loss, a security failure, or a normal action that cannot complete | Blocks the merge |
| P2 | A broken required acceptance criterion or its missing proof, or a wrong result in the scope below with harm that is not small and recoverable | Blocks the merge |
| P3 | A small, recoverable wrong result, a case outside the scope below, or a code quality point | Record it in one place: its row in the ledger of `docs/delivery-quality.md`, or, for an item with no DQ id, the follow-up list in `docs/status.md` |

Harm is small and recoverable when all of these are true:

- Saved data stays correct.
- The owner's unsaved text stays.
- The owner can see if an action failed.
- The app's own refresh or the owner's next action shows the truth.

At each milestone close, before the next milestone starts, each open P3 (ledger rows and follow-ups) is fixed, or the owner drops it (owner, 2026-11-10).

If the builder and the reviewer disagree about a severity, ask the owner.
This bar does not change `AGENTS.md` §7, §8 or §9.

## Pattern rules

A pattern rule guesses from the shape of text, so it cannot be right for all text. Before the build, the plan names:

- the examples that must keep their answer;
- real text with no secret, and a limit for how much of it the rule can refuse;
- where possible, seeded test values, and a limit for how many the rule can miss.

A finding on a pattern rule blocks the merge only if a named example gets the opposite answer, or a limit fails. Any other text is P3 (owner, 2026-11-06).

The examples, limits and owner rules of the sensitive data guard are in [security.md §2.13](../security.md#213-sensitive-data-guard-d39).

## Failure scope

The scope is one human on `127.0.0.1`, until the VPS phase (M9).

- **In scope:** actions while a request waits, a second tab, a move to another page, failed requests and refreshes, and live events.
- **Out of scope:** several humans, and an answer lost on the network, except the case that Q4 decided (`docs/design/components/bot-page.md` §4.2).

An owner decision about a named case stays in force, even when the scope leaves out similar cases.

Check the bar and the scope again before the VPS phase.
