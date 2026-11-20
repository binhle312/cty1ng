# Night card

Read this when you prepare a night, record the owner's go, or add an item. Apply the [night rule](../SKILL.md#night-rule).

## Card and read-back

Record the exact owner words, run ID, goal, acceptance criteria, task dependencies, worktrees, chief, leaders, review policy, and stop time with offset. Record the project merge bar, rehearsal, allowed writes and their conditions, and the review cap from the work loop.

Put the frozen item rows in one `night-items` block. Use exact names. The example shows format only.

```night-items
CI rerun | night
Release | owner
Merge PR 12 | merge | github.com/example/app#12 | main | squash | leader
```

Use `night.py items`, then show the owner its rows, review cap and stop time with offset. End with the exact harness command `/goal <goal and finish condition>`. Record the exception for a harness without it. See [Start](../SKILL.md#start).

At go, record the chief label and the approved reviewer policy. Include the allowed pair and each named role's resolved provider, model, effort and role. Keep the card's read-back with the owner's exact go. After go, only the exact owner amendment path changes the allowed rows.

## Dispatch paths

Use the chief's canonical night folder outside each leader worktree and sandbox writable root. Resolve all paths and compare with the actual writable roots at dispatch. Give each leader the canonical chief path, original run ID and its own worktree path. Keep reviewer assignments and grants in the chief's journal. Keep attempts and outcomes in a separate run and PR journal in the leader worktree. Both use the stable, read-only lock file in the chief folder.

Record the passed daytime lock and sandbox checks. If the lock fails or the location is uncertain, hold merges. A chief label is a workflow field. It does not prove who wrote a record.

## Timers

At the heartbeat interval, schedule this prompt with the run ID. “Read the status and check the night. Log alive. If stop has passed, close. Otherwise continue the work list.” Schedule a single stop wake after the stop time. Record each timer ID with the run when you make or replace it.
