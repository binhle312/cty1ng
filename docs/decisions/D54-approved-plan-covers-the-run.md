# D54. The approved plan covers deletes and moves, and the app checks the run against the plan

Status: accepted (2026-10-25, owner). The owner chose this scope on a decision card in the review
thread "Evaluate parallel bot runs" (levels 2 and 3 of the automation levels). It amends D52
(delete and move approval) and D48 (what a plan lists). It is built in M6. The owner approved each review item of PR #27 on 2026-10-25.
Amends: D48, D52

Decision:

- **The plan lists deletes and moves.** A plan (D48) has four lists, as data, not only text:

  | List | Fields | Example |
  | --- | --- | --- |
  | `plan_steps` | number (1..n), text | 2, "Write the three tier rows" |
  | `plan_files` | path, change (`new` or `change`) | `pricing/tiers.md`, `new` |
  | `plan_file_ops` | op (`delete` or `move`), path, to_path (move only) | `delete`, `drafts/old-tiers.md` |
  | `plan_done_when` | number (1..n across all skills in the plan), text, skill_slug, skill_version (from the `## Done when` section of each skill that the plan uses) | 1, "Each tier has a monthly and a yearly price", `write-price-table`, 3 |

- **Approve covers the listed deletes and moves.** Approve is a permission, not an order. At the
  save (D52), the app applies only the deletes and moves that the run recorded **and** that match
  an entry in `plan_file_ops` exactly (same op, path and to_path). No card shows for them.
- **Claims cover deletes and moves.** When the action run starts, a planned delete claims its
  path, and a planned move claims its path and its to_path (D52 file claims). These claims
  conflict with writes and with other deletes and moves.
- **A delete or move that is not in the plan still needs a card.** D52's card (Approve, Reject
  for each item) stays, but it lists only the operations that are not in `plan_file_ops`.
- **The bot checks each Done-when item.** The action run gets one tool:
  `check_done({item, state: "met" | "not_met", note})`. `not_met` needs a note. The bot can call
  it in the same model turn as other tools, so it adds no model request. An `item` that is not in
  `plan_done_when` is a tool error (`{error: "not_in_plan", message}`). Changed by D57
  (2026-10-25): `met` needs `evidence: {path, quote}`, and the app checks that the quote is in
  that file.
- **The app checks the run at its end.** When the run ends (done, failed or stopped), the app
  writes `runs.plan_check` in the same transaction as the final run state. It describes what the
  run did on its own branch. It is fixed at run end and never recalculated. What was saved to the
  Library (for example after the owner rejects an unplanned delete, or after a failed run) shows on
  the D52 card and in its notices. Tracking the saved result in `plan_check` is out of scope.

  | Field | What it holds |
  | --- | --- |
  | `planned_not_written` | Paths in `plan_files` that the run did not write |
  | `not_in_plan` | Paths that the run wrote and that are not in `plan_files` (D52 "not in plan"). The to_path of a planned move counts as planned |
  | `ops_not_in_plan` | Deletes and moves that the run recorded and that are not in `plan_file_ops` (these go to the D52 card) |
  | `planned_ops_not_done` | Entries in `plan_file_ops` that the run did not record |
  | `done_when` | Each `plan_done_when` item with state `met`, `not_met` or `not_checked`, and the note. Changed by D57: also `evidence` {path, quote} and `verified` (true, false or null) |

  The rule that builds `plan_check` is one pure function in `core/` (`plan-check.rules.ts`). The
  `run.finished` event carries the run, so it carries `plan_check`. No new event type.
- **The plan card shows the check.** The result goes in the plan card block "Check after the
  run", for example "2 of 2 files written · 0 not in plan · Done when 2 of 3", with each `not_met`
  and `not_checked` item and each planned delete or move not done on its own line. The block says
  that it shows what happened on the run's branch, not what was saved. D57 (the progress
  card) sets the place and the look; D54 sets only the data.

Example: BA's approved plan lists `pricing/tiers.md` (new), delete `drafts/old-tiers.md` and two
Done-when items. The run writes `pricing/tiers.md`, deletes the draft and also writes
`pricing/README.md`. It calls `check_done` for item 1 (`met`) but not for item 2. At the end:

| Check | Result |
| --- | --- |
| Delete `drafts/old-tiers.md` | Saved with the run, no card (it is in the plan) |
| `pricing/README.md` | Saved, marked "not in plan" (D52) |
| Done when | 1 met, 1 not checked |

The owner clicks once (Approve on the plan), not twice.

Why:

- **The owner approves each delete twice today.** The plan names the task, then D52 asks again at
  the save. With the delete in the plan, the first approval is enough. Git keeps every version,
  so "Undo this run" is one revert.
- **The owner reads less after a run.** The check lists only what differs from the plan.
- **The file checks are exact.** The app compares the plan with the run's commits. Only the
  Done-when states come from the bot, so the card labels them as the bot's own check.

Not chosen:

- **No card for any delete or move** (also for those not in the plan). The owner cannot see an
  unplanned delete before it is saved.
- **A model call at run end to judge Done when, now.** One more request and one more cost for a
  check that the bot can make in the same turn as its last tool call. **Later, optional (owner,
  2026-10-25):** a setting "Verify Done when" (off by default) adds a separate judge call at run
  end. It is added only if M6 data shows that the bot's own `met` is not reliable. The measure:
  how often the owner finds a problem in an item marked `met`.
- **One plan that also covers a handoff and the next bot's plan** (level 4). The owner wants to
  see how bots do in real tasks first (owner, 2026-10-25). It waits for the plan approval rates
  that the M6 brief already parks.
- **Read-only parallel helpers in the run** (level 1). A separate proposal after M6.

Consequences:

- `domain-model.md`: plan versions get the four lists; `runs` gets `plan_check` (JSON). This
  needs a migration, so the owner approves it in the M6 plan.
- `design/components/plan-card.md`: the plan card shows the deletes and moves and the Done-when
  items, and the card shows the check (changed in the same PR as this entry; the block comes
  with D57).
- `conversation-rules.md`: the `check_done` tool and its errors; the D52 card lists only
  operations outside the plan.
- The progress card proposal (D57, `mark_step`, review thread "Show bot progress step by step")
  reuses `plan_steps` and shows `plan_check` in its finished state.
- Tests with the fake model: a planned delete saves with no card; an unplanned delete shows the
  card; a recorded delete that differs from the plan (other path) shows the card;
  `planned_not_written` lists a skipped file; `planned_ops_not_done` lists a skipped delete; a
  planned delete waits for a run that claimed the same path; `check_done` with an unknown item gives
  `not_in_plan`; an item with no call is `not_checked`.

Implemented in: `../tasks/M6-workspace-parity.md` (the documents above change before the M6
plan starts).
