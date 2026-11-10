# Plans

This folder keeps every plan of a slice: what the owner and the builder agreed before the build
(owner, 2026-11-04). [The planning workflow](../workflows/planning.md#plan) says what a
plan holds and when the owner approves it.

A plan is a record, not spec. If a plan and an owning document differ, the owning document wins.

## Rules

1. Name the file `<slice>-<name>.md`, with the slice and name of its brief in `docs/tasks/`.
   A plan for one part uses the name of the part, for example `M3a-storage-and-queue.md`.
   A plan for one issue uses the id of the issue, for example `dq-180-clone-draft.md`.
2. Start the file with the title, then the lines `Brief:`, `Checkpoint:` and `Approval:`.
   `Approval:` says `waiting` until the owner approves the plan.
3. Commit the plan to the draft PR before any code. The first comment of the PR links to the file.
4. Commit each revision to the same file. Git history keeps the old revisions.
5. When the owner approves, write the date, the revision and the owner's decisions in the file.
   Do this before the first build commit.
6. If the owner approves a change after that, add a dated section to the file.
   A new plan in the same slice, such as a redesign after a review, gets its own file.
7. Put a change in behaviour in the owning document, in the same PR.
8. Add the file to the table below in the same commit. `pnpm check:index` fails if the table and
   the folder differ.

## Plans

Plans up to M2 started as PR comments or PR descriptions. The header of each file names its source.

| File | Slice | Approval record |
| --- | --- | --- |
| `M0-skeleton.md` | M0, first attempt | Superseded: the owner closed #10 on 2026-10-29 |
| `M0a-tooling-and-ci.md` | M0a | No approval line; owner's decision of 2026-10-30 |
| `M0b-backend-core.md` | M0b | Owner's review of 2026-10-30, revision 1 |
| `M0c-frontend-shell.md` | M0c | Summary only: decisions A-H as #49 records them |
| `M1-skill-hub.md` | M1a, M1b | Approved 2026-10-31 |
| `M1c-backend-maintenance.md` | M1c | No approval line; owner's review of 2026-10-31 |
| `M2-bots.md` | M2a, M2b, M2c | Approved 2026-11-01, revision 4 |
| `M2c-state-modules.md` | M2c, two plans made during the review | Summary only: owner-approved 2026-11-04, as #59 records it |
| `dq-180-clone-draft.md` | DQ-180, the Clone draft (before audit PR 6) | Approved 2026-11-10 |

If the task names a plan, open it. Otherwise, find the slice in [status.md](../status.md), then open its plan.
For current behaviour, read the owning documents.
