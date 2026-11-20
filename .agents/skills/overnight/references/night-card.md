# Night card

Read this when you prepare a night, record the owner's go, or add an item. Apply the [night rule](../SKILL.md#night-rule).

## Card and read-back

Record the exact owner words, run ID, goal, acceptance criteria, task dependencies, worktrees, chief, leaders, review policy, and stop time with offset. Record the project merge bar, rehearsal, allowed writes and their conditions, and the two settings in the [night review rule](../SKILL.md#night-review-and-merge).

Put the frozen item rows in one `night-items` block. Use exact names. The example shows format only.

```night-items
CI rerun | night
Release | owner
Merge PR 12 | merge | github.com/example/app#12 | main | squash | leader
```

Use `night.py items`, then show the owner its rows, review cap, bonus per merge of main and stop time with offset. End with the exact harness command `/goal <goal and finish condition>`. Record the exception for a harness without it. See [Start](../SKILL.md#start).

Give each task acceptance criteria, exact owned file paths and a class. Use `owner` for any task that needs approval under project rules, including AGENTS.md §7. Put it under **Needs you**. Use `night` only for approved night work. For merge targets, pass the specs to `go --tasks <file>` as a JSON object keyed by canonical PR target. Each value has `class`, `criteria` and `owned`. Both lists must contain at least one entry. Use repository-relative owned paths.

At go, record the chief label and approved reviewer policy. Pass `--consultants` only if the owner allows them. Pass `--review-cap` and `--merge-main-bonus` with the values from the read-back. Include the allowed pair and each named role's resolved provider, model, effort and role. Keep the card's read-back with the owner's exact go. After go, only the exact owner amendment path changes the allowed rows.

## Dispatch paths

Use the chief's canonical night folder outside each leader worktree and sandbox writable root. Resolve all paths and compare with the actual writable roots at dispatch. Give each leader the canonical chief path, original run ID and its own worktree path. Keep reviewer assignments, plan checks, review records and grants in the chief's journal. Keep attempts and outcomes in a separate run and PR journal in the leader worktree. Both use the stable, read-only lock file in the chief folder.

Record the passed daytime lock and sandbox checks. If the lock fails or the location is uncertain, hold merges. A chief label is a workflow field. It does not prove who wrote a record.

## Timers

At the heartbeat interval, schedule this prompt with the run ID. “Read the status and check the night. Log alive. If stop has passed, close. Otherwise continue the work list.” Schedule a single stop wake after the stop time. Record each timer ID with the run when you make or replace it.

## Review files

Use a separate clean detached Git checkout under `reviews/` in the chief's night folder. Verify that both the pushed head and live base are present in the checkout. Use absolute paths for the checkout and both reports. Give the reviewers read access to the checkout and a way to return their reports to the chief. Limit writes to the chief's folder with the harness. If the leader can write there, hold the merge workflow.

Use a fresh night folder with format 3. Use the earlier tool revision to read historical journals.
