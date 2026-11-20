# PR #140 overnight cleanup

Brief: Leader brief 9, owner order 149, 2026-11-20.
Checkpoint: code design.
Approval: owner order 150, 2026-11-20, "A. Own leader folder (Rec.)".

## Decision

> At night, after a PR is MERGED and the worktree has no uncommitted changes, the leader removes its worktree, local branch and temp files; the remote branch is deleted too. Open PRs untouched.

Order 149 approves this exception and its exact text in the overnight skill. The CLI removes recorded temp files, then the worktree, the local branch and the remote head branch.

## Code design

Record the leader's cleanup paths at dispatch. Use a fixed journal outside the worktree, the temp folder and the chief's folder. Give each leader a fixed folder outside its worktree and the chief's folder. At dispatch, add this folder to a Codex leader's sandbox writable roots. Keep its journal and temp folder separate inside it. Check that the canonical cleanup paths and journal are separate from every other leader's paths. Use the existing location for assignments that lack cleanup paths. Those assignments can still merge and report.

Add `night.py clean`. The CLI reads the assigned worktree, its registered branch and the Git repository path that stays in place. Use the same night lock as the merge journal. Run from a path that survives worktree removal. Check the recorded merge result and read the exact PR from GitHub. For a squash merge, use the PR head for ref checks and the merge commit for the merge result check.

Before the first removal, check that the head branch does not also belong to an open PR. Exclude `main`, `master` and the default branch from local and remote removal. If a required check gives no definite result, record a refusal code.

| Step | Check before removal | Evidence |
| --- | --- | --- |
| Temp files | Use exact file records for this leader or its helpers. Check each path inside the assigned worktree or its recorded temp folder. Refuse tracked files, symlink traversal and changed file identity. | File path, byte size and content SHA |
| Worktree | Check the registered path, branch, repository and head. Check tracked, untracked and ignored files. The only permitted extra files are recorded temp files before their removal. Use normal Git worktree removal. | Worktree path, size and checkout SHA |
| Local branch | Check the exact local ref and PR head SHA. Check that another worktree does not use the branch. Pass the expected SHA to the ref delete. | Local ref, size if applicable and head SHA |
| Remote head branch | Check the exact same-repository PR head ref. Check for open PRs, default and protected branches, and a moved head. Pass the expected SHA to the Git push lease. | Remote ref, size if applicable and head SHA |

Write an intent before each removal and a result after it. Stop on the first coded refusal. The morning report shows each deletion under its own heading. It shows refusals and intents without results under **Needs you**. On retry, check the actual state of an interrupted item before any further deletion. Keep the journal. Use Git and GitHub argument lists.

The recommended design needs a separate leader folder at dispatch. It keeps the evidence in one place through merge, cleanup and report. An alternative copies the worktree journal to the chief before removal. That preserves the current dispatch paths and adds a chief handoff before each cleanup.

The design changes the CLI and journal in `night.py` and its adjacent modules. It updates `SKILL.md`, the night card and the morning report reference. The change needs no new dependencies or application schema changes.

## Test strategy

Use the public `night.py` CLI, real disposable local Git repositories and fake GitHub responses. Assert the result code, resource state and report after the CLI returns. Run the red tests before the implementation and run each break against a green control.

| Case | Expected result | Break |
| --- | --- | --- |
| GitHub reports a squash merge and the worktree is clean | Remove the four types of items in order. Keep the journal. | Control |
| A file has uncommitted changes | Stop before the first removal. | Ignore the changes. |
| The remote head moved | Keep the remote branch and report the refusal. | Skip the SHA check. |
| The PR is open | Keep the worktree, files and refs. | Allow `OPEN`. |
| A temp file has no path record | Keep the file. | Remove by name pattern. |
| The remote head is the default branch | Keep the branch. | Allow the default branch. |
| The chief runs the report after worktree removal | Show all deleted paths and refs and all coded refusals. | Drop the deletion list. |

Use the repository's delivery gates before the push. Git deletion commands in the tests use fixtures only.
