# Status

Where the project is right now. This is the only file that tracks progress; the plan
([development-plan.md](development-plan.md)) says what and in which order, and never carries
status.

**Who updates it:** the builder agent, in the same PR that finishes a step (part of the
definition of done in `AGENTS.md` §9). The owner updates it for owner-only steps (reviews,
approvals). Keep it short: link to PRs and briefs instead of describing work.

Last updated: 2026-10-22

## Now

Specification in the repository, now for a TypeScript stack: Hono, Drizzle, Vercel AI SDK,
React + Vite (D34, replaces D10), with libraries behind ports (D35) and a `README.md` index per
code folder for agents (`architecture.md` §4.2). Ids are UUIDv7 stored, TypeIDs outside the
database (D22, D36). Themes accepted (D30): Command ships in M0, Material later (T2), and the
Board is the Flow pane's third map (M8b). Loading rules, first open and reopening specified (app-shell.md SH-4, SH-5). Product brief
expanded after the owner's interview (use cases, phases, non-goals, trust
failures); D37–D40 accepted (projects, memory, sensitive-data guard, cost alerts); D42 adds optional per-provider caps under the total cap. D41
accepted: bots draft skills when asked, the owner approves and is the author (slice M5c).
UI design review in progress: header bot order (Recent activity / Custom, deferred
reordering) specified for M2. Agreed so far and saved in `design/components/` with previews: bot
avatar (Flat, Jelly, Pixel; Flat only until the final product), top header, bot card, user
panel. Left bar still in review (project first).

## Next

1. Owner merges the skill drafts PR (docs only).
2. Start M0 locally in Claude Code with the builder prompt in `workflow.md` §3.

## Waiting on the owner

| Item | Needed by |
| --- | --- |
| Merge the skill drafts PR (D41) | M0 |
| Review and merge the header bot order PR (docs only) | M2 plan |
| Export Flow view mockup screenshots into `design/assets/` | M8 plan |

## Slices

| Slice | State | PR | Notes |
| --- | --- | --- | --- |
| M0 | not started | | |
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
