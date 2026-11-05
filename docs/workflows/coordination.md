# Coordinate project work

These workflows describe how the owner and two coding agents build the app together. The aim is
the simplest process that keeps quality high: one agent builds, a different agent reviews, the
owner approves the decisions that matter.

Use this workflow for role assignment, parallel work, or escalation.
For task-specific steps, use [the workflow index](README.md).

## Lifecycle

```
brief ready ──▶ plan + test strategy ──(owner approves, if checkpointed)──▶ build ──▶ self-check ──▶ PR
   ▲                                                                                               │
   │                                                       merge ◀── owner review ◀── cross-review ◀┘
   └──────────── next slice ◀────────────────┘
```

## Roles

| Who | Does | Does not |
| --- | --- | --- |
| **Owner (human)** | Chooses the next slice; approves plans for checkpointed slices; reviews `Needs human review` items; merges; accepts or rejects proposed decisions | Write most of the code |
| **Builder agent** (Claude Code or Codex) | Plans the slice, implements, runs every check, writes the PR description with evidence, updates docs | Merge; change accepted decisions; widen scope |
| **Reviewer agent** (the *other* one) | Reviews the PR against the brief and the docs; checks evidence; tries to break it | Push to the builder's branch (it reports findings; the builder fixes) |

**Why two different agents.** Different models make different mistakes, so cross-review catches
more than self-review, and it is cheap. Alternate who builds (for example Claude Code builds
M1, Codex reviews; Codex builds M2, Claude Code reviews) so both learn the codebase and you
can compare them.

**Why not more agents.** Parallel builders on one small codebase mostly create merge conflicts
and inconsistent patterns. Use parallelism only for clearly independent work ([parallel work](#parallel-work)).

## Parallel work

Allowed in parallel, in separate git worktrees and branches:

- Frontend and backend of the same slice **after** the API shape for that slice is merged or
  agreed in the plan (the generated client is the contract).
- Documentation-only changes.

Not in parallel: two slices that touch the same tables or migrations (drizzle-kit migrations
would conflict), or anything in the same `*.rules.ts` file at the same time.

## When things go wrong

| Situation | What to do |
| --- | --- |
| Agent wants to change a decision | It adds a `proposed` file in `docs/decisions/` and stops for the owner |
| Brief is ambiguous | Builder asks; owner answers in the brief (so the answer is kept) |
| CI red on main | Fix main first; no slice merges onto a red main |
| Agents disagree in review | Owner decides; if it is a design question, record it in `docs/decisions/` |
| Owner sees a problem in how a slice was built (slow, too many questions, surprises) | Record project evidence in `docs/lessons-learned/` and quality evidence in `docs/delivery-quality.md`; link or update the reusable principle and its project application |
| Slice too big | Split the brief into parts (M3a, M3b), each mergeable; UI and infrastructure go in different parts ([slice size](planning.md#slice-size)) |
| Docs drift found later | Fix the doc or code in a small PR; note it in the next slice's plan |
