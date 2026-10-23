# Status

Where the project is right now. This is the only file that tracks progress; the plan
([development-plan.md](development-plan.md)) says what and in which order, and never carries
status.

**Who updates it:** the builder agent, in the same PR that finishes a step (part of the
definition of done in `AGENTS.md` §9). The owner updates it for owner-only steps (reviews,
approvals). Keep it short: link to PRs and briefs instead of describing work.

Last updated: 2026-10-23

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
panel, left bar (rail and bar 2), Memory pane, New project page (layout A), Project settings page
with the memory check card and Delete project, plan card. D43–D45 accepted
(memory precedence, right pane holds Flow or Memory, project goal and instructions). D47 (delete
sends the whole project to Trash; memory check choices) and D48 (bots plan first) accepted. Still
in review: Trash page (with the Remember button and the "changed in another tab" cards), Library
page content, Flow pane. D46 accepted: a one-time auto title from the first message (M3).
The M3 migration waits for the owner's approval. Project Board is a later slice (M8c).

## Next

1. Start M0 locally in Claude Code with the builder prompt in `workflow.md` §3.

## Waiting on the owner

| Item | Needed by |
| --- | --- |
| Approve the M3 migration for D46 (auto title) before it is written | M3 plan |
| Export Flow view mockup screenshots into `design/assets/` | M8 plan |
| Approve the M2 migration: `bots.header_position`. Claude Code stops for this approval before it writes the migration | M2 plan |
| Approve the M5b migrations: `projects.instructions_md`, `projects.pinned_position`, goal ≤ 500 chars. Claude Code stops for this approval before it writes them | M5b plan |
| Write the M5b brief: projects, memory (D37, D38, D43), goal and instructions (D45), pinning, the API contracts that D43 and D45 list as not written yet | M5b start |

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
| M5b | not written | | Projects and memory (D37, D38, D43, D45); left bar pinning; side pane shared with Memory (D44) |
| M5c | not written | | Skills drafted by bots (D41) |
| M8 | not started | | |
| M8b | not written | | Board map in the Flow pane (D30) |
| M8c | proposed | | Project-wide Board, read-only, after M8b (`design/components/left-bar.md` §5) |
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
