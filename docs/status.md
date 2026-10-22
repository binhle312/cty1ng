# Status

Where the project is right now. This is the only file that tracks progress; the plan
([development-plan.md](development-plan.md)) says what and in which order, and never carries
status.

**Who updates it:** the builder agent, in the same PR that finishes a step (part of the
definition of done in `AGENTS.md` §9). The owner updates it for owner-only steps (reviews,
approvals). Keep it short: link to PRs and briefs instead of describing work.

Last updated: 2026-10-22 (M0a built)

## Now

M0 split into M0a (backend, tooling, CI) and M0b (frontend) by the owner (PR #10). M0a is
built on `m0-skeleton` and waits for the owner's review: initial migration, security
middleware, port interfaces, the security review workflow. M0b waits for the UI design review.

Specification: TypeScript stack (D34, D35), TypeID ids (D22, D36), themes (D30), projects and
memory (D37, D38), sensitive-data guard (D39), cost alerts (D40), bot-drafted skills (D41).

## Next

1. Owner reviews and merges M0a (PR #10).
2. Owner reviews the M0b UI design (shell, Command theme, `Skeleton`); then M0b is built on its
   own branch.

## Waiting on the owner

| Item | Needed by |
| --- | --- |
| Review M0a's `Needs human review` items in PR #10 | M0a merge |
| Add the `ANTHROPIC_API_KEY` repository secret (dedicated, low spend limit) | Security review workflow |
| UI design review for M0b | M0b build |
| Export Flow view mockup screenshots into `design/assets/` | M8 plan |

## Slices

| Slice | State | PR | Notes |
| --- | --- | --- | --- |
| M0a | in review | [#10](https://github.com/binhle312/cty1ng/pull/10) | Plan approved; build done, waits for owner review |
| M0b | planning | | UI design waits for the owner's review |
| M1 | not started | | |
| M2 | not started | | |
| M3 | not started | | |
| M4 | not started | | |
| M5 | not started | | |
| M6 | not started | | |
| M7 | not started | | |
| M5b | not written | | Projects and memory (D37, D38) |
| M5c | not written | | Skills drafted by bots (D41) |
| M8 | not started | | |
| M8b | not written | | Board map in the Flow pane (D30) |
| T2 | not written | | Material theme (D30) |
| M9 | not written | | VPS milestone |

States: `not started` → `planning` → `UI design review` → `building` → `in review` → `merged`.
A slice can also be `blocked` (say on what in Notes).

## Done

| Date | What |
| --- | --- |
| 2026-10-21 | Specification: requirements, design sketches, decisions D1–D29, briefs M0–M8 |
| 2026-10-21 | Repository created; spec merged (PRs #1–#5): send states and research notes, security checklist, frontend conventions, `ui-ux-pro-max` skill; D31, D32 accepted |
| 2026-10-21 | Owner review: D6, D11, D13, D33 accepted; D9 accepted with a replaceable transport; D21 accepted with price overrides |
