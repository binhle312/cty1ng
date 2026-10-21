# Workflow: building with Claude Code and Codex

This document describes how the owner and two coding agents build the app together. The aim is
the simplest process that keeps quality high: one agent builds, a different agent reviews, the
owner approves the decisions that matter.

## 1. Roles

| Who | Does | Does not |
| --- | --- | --- |
| **Owner (human)** | Chooses the next slice; approves plans for checkpointed slices; reviews `Needs human review` items; merges; accepts or rejects proposed decisions | Write most of the code |
| **Builder agent** (Claude Code or Codex) | Plans the slice, implements, runs every check, writes the PR description with evidence, updates docs | Merge; change accepted decisions; widen scope |
| **Reviewer agent** (the *other* one) | Reviews the PR against the brief and the docs; checks evidence; tries to break it | Push to the builder's branch (it comments; the builder fixes) |

**Why two different agents.** Different models make different mistakes, so cross-review catches
more than self-review, and it is cheap. Alternate who builds (for example Claude Code builds
M1, Codex reviews; Codex builds M2, Claude Code reviews) so both learn the codebase and you
can compare them.

**Why not more agents.** Parallel builders on one small codebase mostly create merge conflicts
and inconsistent patterns. Use parallelism only for clearly independent work (§5).

## 2. Lifecycle of a slice

```
brief ready ──▶ plan ──(owner approves, if checkpointed)──▶ build ──▶ self-check ──▶ PR
   ▲                                                                                 │
   │                                         merge ◀── owner review ◀── cross-review ◀┘
   └──────────── next slice ◀────────────────┘
```

1. **Brief.** `docs/tasks/<slice>.md` exists and its open questions are answered.
2. **Plan.** The builder reads the brief and the documents it lists, then writes a short plan
   (files to touch, migrations, tests to add, risks) as the first comment of a draft PR.
   For slices marked *checkpoint* in `development-plan.md`, the owner approves the plan before
   building. This is the cheapest place to catch a wrong direction.
   **UI design checkpoint.** If the slice adds or changes a screen, the plan has a "UI design"
   section: proposed layout, components and states, based on (not copied from) the sketches in
   `docs/design/`. The owner discusses and approves it before any UI code, in every slice,
   checkpointed or not. The approved design then replaces the sketch (`docs/design/README.md`).
3. **Build.** Small commits. Tests alongside code, not at the end.
4. **Self-check.** Every command in `AGENTS.md` §4 passes. The builder fills the PR template
   (§6).
5. **Cross-review.** The other agent reviews (prompt in §4). Findings become PR comments; the
   builder fixes or answers each.
6. **Owner review.** Focus on `Needs human review` items, migrations, the evidence table, and
   one run of the app. Merge when satisfied.
7. **Docs.** If something diverged from the docs, the PR already updated them. If a decision
   changed, `decisions/` has a new file the owner accepts or rejects.

## 3. Starting a session (builder prompt)

Start a **fresh session per slice** so context is not polluted by earlier work. Paste:

```
You are the builder for slice <M#> of this repository.
1. Read AGENTS.md, docs/README.md, and docs/tasks/<M#>-<name>.md, then every document the
   brief lists under "Read first".
2. Write a plan as described in docs/workflow.md §2 step 2. Open a draft PR with the plan.
   Stop and wait for my approval if the brief says "checkpoint: plan".
3. Build the slice on branch <m#-name>. Keep to the brief's scope; list anything else you
   notice under "Follow-ups" in the PR instead of doing it.
4. Run every check in AGENTS.md §4 and fill the PR description per docs/workflow.md §6.
If the docs and the code disagree, or the brief is ambiguous, stop and ask.
```

## 4. Review prompt (reviewer agent)

```
You are reviewing PR <url> for slice <M#>. You did not write it.
Read AGENTS.md, docs/tasks/<M#>-<name>.md, and the documents it lists.
Check, in order:
1. Every acceptance criterion: is it implemented, and does the cited test really prove it?
   Run the tests yourself.
2. Architecture rules in AGENTS.md §5 (domain purity, events in the same transaction,
   generated client only, immutability rules, sandbox use, Markdown rendering).
3. Security: anything touching docs/security.md controls.
4. Invariants in docs/domain-model.md §12 that this slice touches.
5. Docs: does the PR update the owning document for every behaviour change?
6. Simplicity: code that could be removed or made plainer.
Report findings as PR comments, most severe first, each with the file, line, and why it
matters. Do not push commits. Say explicitly if you found nothing serious.
```

## 5. Parallel work (only when independent)

Allowed in parallel, in separate git worktrees and branches:

- Frontend and backend of the same slice **after** the API shape for that slice is merged or
  agreed in the plan (the generated client is the contract).
- Documentation-only changes.

Not in parallel: two slices that touch the same tables or migrations (Alembic revisions would
conflict), or anything in `domain/` at the same time.

## 6. PR description template

```markdown
## What
One paragraph.

## Why
Link to the brief and decisions.

## Acceptance criteria
| AC | Evidence |
| --- | --- |
| UI-2.4 | `e2e/header-drag.spec.ts` "drop adds bot" + screenshot |
| conversation-rules §1 table | `tests/domain/test_routing.py::test_human_message[...]` |

## Needs human review
- Migration `0003_skill_versions` (new tables, no data change)
- (or "none")

## Docs updated
- docs/domain-model.md §3 (added changelog column)

## Follow-ups (not done here)
- ...
```

## 7. Human checkpoints (summary)

The owner approves, in every slice:

- the plan, for slices marked *checkpoint: plan*;
- the UI design, for any slice that adds or changes a screen;
- every database migration;
- security-sensitive code (`security.md` areas);
- new dependencies;
- new or changed decisions;
- the merge.

The agents may, without asking: implement inside the brief, write and run tests, refactor
inside a module, update docs to match code, and fix review findings.

## 8. When things go wrong

| Situation | What to do |
| --- | --- |
| Agent wants to change a decision | It adds a `proposed` file in `decisions/` and stops for the owner |
| Brief is ambiguous | Builder asks; owner answers in the brief (so the answer is kept) |
| CI red on main | Fix main first; no slice merges onto a red main |
| Agents disagree in review | Owner decides; if it is a design question, record it in `decisions/` |
| Slice too big | Split the brief into parts (M3a, M3b), each mergeable |
| Docs drift found later | Fix the doc or code in a small PR; note it in the next slice's plan |
