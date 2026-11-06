# Write a PR description

Use this template when you prepare an authorized draft PR. Before a protected action, check [AGENTS.md §7](../../AGENTS.md#7-what-needs-the-humans-approval-stop-and-ask-or-flag-it-clearly-in-the-pr).

```markdown
## What
One paragraph.

## Why
Link to the brief and decisions.

## Acceptance criteria
| AC | Evidence |
| --- | --- |
| UI-2.4 | `e2e/header-drag.spec.ts` "drop adds bot": expects the bot chip in the header after the drop; + screenshot |
| conversation-rules §1 table | `decide-runs.rules.test.ts` "human message: …" rows: one row per table line |

## Edge cases (one table for each changed screen, `testing.md` §3)
| Case | Test, or why the row does not apply |
| --- | --- |
| The same action twice | `bots.spec` "a second Clone …" |
| Keyboard only | Does not apply: this PR adds no control |

## Needs human review
- Migration `0003_skill_versions` (new tables, no data change)
- (or "none")

## Docs updated
- docs/domain-model.md §3 (added changelog column)

## Folder indexes
- README.md tables updated for every added, removed, renamed or repurposed file, and the
  descriptions still match what the files do (or "no file changes")

## Review fixes (when a review found something)
| Finding | Cause (the rule broken) | Same cause checked in | Same cause as an earlier fix? | Fix | Test |
| --- | --- | --- | --- | --- | --- |
| A late Profile answer brings back an old pin | An answer writes fields it does not own | Save answers, pin answers, dialog answers | No | Answers write an allowlist | `bot-edit-form.test` "takes from a save answer only …" |
| A late dialog answer brings back an old pin | An answer writes fields it does not own | Every answer that writes the form | Yes, the row above. Owner's decision: redesign, with one owner for the form state | The form state has one owner | `bot-edit-form.test` "takes from a dialog answer only …" |

## Follow-ups (not done here)
- ...
```
