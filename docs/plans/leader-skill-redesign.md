# The redesign of the `leader` skill after review round 2

Brief: no brief file. The plan of the slice is [leader-skill.md](leader-skill.md); this file is the
redesign that `AGENTS.md` §9 asks for after review rounds 1 and 2 of #149 and #150.
Checkpoint: plan. The owner approves a redesign under `AGENTS.md` §9.
Approval: owner, 2026-11-24 (the decision page of review round 2: "Q1: A Approve the plan as
written", "Q2: A One home: the Roles table").

## Design

`AGENTS.md` §9: review rounds 1 and 2 found fixes with the same cause as earlier fixes. The owner
approved this redesign on 2026-11-24 (see "The owner's answers"). Its commits get their own review rounds 1 and 2
(`docs/workflows/merge-bar.md`, step 2).

**R1. The lead agent's own work (item 6 of the slice plan).** The rule, its limit and its count have one home: step
1 of `codex-workers`. `leader`, its `GUIDE.md` and `docs/workflows/coordination.md` point to it.
The rule gets these cases:

- **Clean start.** Before its own code change, the lead agent checks that the worktree has no
  other change (`git status --porcelain` gives nothing). If it has one, the change goes to a
  worker. Then the count (`git add -N` for new files, then `git diff --numstat HEAD`) counts only
  the lead agent's change. If the change grows to 5 lines or more, it goes to a worker.
- **Order of one-at-a-time commands.** Before each message that lets a worker build or run checks
  (a start or a resume), the lead agent compares it with the work of each other worker that has
  not ended. If two need a command that only one agent can run at a time, it gives the order.
- **The review route.** Before the lead agent decides who builds or who reviews, it reads
  `codex-workers`. So a review-only task also reads the models, the sandbox and the stop rule.
- **The report of a push.** The worker template asks for the pushed commit only if the worker
  pushed.

**R2. Who does each kind of work (one home).** The Roles table of
`docs/workflows/coordination.md` names who does each kind of work: the plan, the risk probes,
the test strategy, the briefs, the build, the checks, the fixes, the records and the PR
description. The other workflow documents (`planning.md`, `implementation.md`, `merge-bar.md`,
`review.md`, `pull-request.md`, `review-guide.md`, `development-plan.md`, `status.md`) say what
to do, give no role a duty by name, and point to the Roles table. The lead agent prompt in
`planning.md` builds as `codex-workers` says, and leaves the records to the Roles table.

## Test strategy

| Behaviour | Check |
| --- | --- |
| The limit has one home | `grep -rn -E 'fewer than 5\|5 changed\|5 lines' .agents/skills docs/workflows`: only step 1 of `codex-workers` |
| The lead agent makes a small change on a clean tree | A `claude -p "/leader <task>"` run with `git` allowed: a 2-line task on a clean worktree. The lead agent makes the change, runs the count, and names the review |
| A worktree with other changes | The same task with an unrelated change that is not committed: the change goes to a worker |
| A review-only task | A run with `/leader review <change>`: the answer follows `codex-workers` (the reviewer row, a `read-only` sandbox). With only `leader`, the run stops and names the missing file |
| Two workers and one fixed port | A run where two workers need the same test on fixed ports, and one of them has ended its plan turn: the answer gives the order before the build messages |
| No workflow document gives a role a duty | `grep -n -i -E 'builder\|lead agent'` over the documents of R2: only the name and the text of the lead agent prompt, and the line of `development-plan.md` that says how to start it |
| The links work | `pnpm lint` and `pnpm check:index` |

The runs use Claude Opus 5.5, in scratch Git projects outside the repository.

## The owner's answers (2026-11-24)

After review round 2: Q1 A, "Approve the plan as written" (R1); Q2 A, "One home: the Roles
table" (R2); Q3 A, "Record the flags in #149" (the security scan of `codex-workers`).

## Open questions

None.
