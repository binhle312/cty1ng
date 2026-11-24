# Coordinate project work

These workflows describe how the owner, a lead agent and its workers build the app together. The
aim is the simplest process that keeps quality high: one agent builds, a different agent reviews,
the owner approves the decisions that matter. The owner starts the lead agent with `/leader`; the
skills [`leader`](../../.agents/skills/leader/SKILL.md) and
[`codex-workers`](../../.agents/skills/codex-workers/SKILL.md) hold its steps.

Use this workflow for role assignment, parallel work, or escalation. The Roles table below is the
one home of who does each kind of work; the other workflow documents say what to do and point
here (owner, 2026-11-24).
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
| **Owner (human)** | Chooses the next slice; approves plans for checkpointed slices; reviews `Needs human review` items; merges; accepts or rejects proposed decisions; updates `docs/status.md` for the owner's own steps (reviews, approvals) | Write most of the code |
| **Lead agent** (the Claude Code conversation that the owner starts) | Talks with the owner; does the spec gap pass; writes the plan, the UI and code designs and the test strategy; runs the risk probes or gives them to a worker; writes the briefs; makes the small code changes that step 1 of the `codex-workers` skill allows, and runs the checks of its own change; checks each report against the diff; sends review findings to the builder; keeps the records (`docs/status.md` except the owner's own steps, `docs/delivery-quality.md`, the round rows of a review) and the PR description, and corrects their claims after a review; asks the owner when a severity is in dispute | Merge, unless the owner asks for that PR; give an approval in the owner's place; review its own changes |
| **Builder** (a Codex worker that the lead agent starts) | Gives back the plan in its own words; after the lead agent accepts it, builds test first; does the spec walk and the order checks; fixes the code findings of a review; runs every check; pushes; reports with evidence | Talk with the owner; change accepted decisions; widen scope |
| **Reviewer** (a different agent: a new session that did not build the code) | Reviews the PR against the brief and the docs; checks evidence; tries to break it; before the build, tries to break a code design that it did not write; tries to break each changed screen with forced orders | Push to the builder's branch (it reports findings to the lead agent; the builder fixes) |

**Why a different reviewer.** A session that did not build the code sees mistakes that the
builder does not see. It often runs on a different model. So cross-review catches more than
self-review. The
lead agent reads each report and checks it against the diff, so no claim reaches the owner
unchecked.

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
| Brief is ambiguous | The builder asks the lead agent; the lead agent asks the owner; the answer goes in the brief (so the answer is kept) |
| A required check is red on main ([testing.md §4](../testing.md#4-ci-gates)) | Fix main first; no slice merges onto a red main |
| Agents disagree in review | Owner decides; if it is a design question, record it in `docs/decisions/` |
| Owner sees a problem in how a slice was built (slow, too many questions, surprises) | Record project evidence in `docs/lessons-learned/` and quality evidence in `docs/delivery-quality.md`; link or update the reusable principle and its project application |
| Slice too big | Split the brief into parts (M3a, M3b), each mergeable; UI and infrastructure go in different parts ([slice size](planning.md#slice-size)) |
| Docs drift found later | Fix the doc or code in a small PR; note it in the next slice's plan |
