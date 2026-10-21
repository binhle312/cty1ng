# Status

Where the project is right now. This is the only file that tracks progress; the plan
([development-plan.md](development-plan.md)) says what and in which order, and never carries
status.

**Who updates it:** the builder agent, in the same PR that finishes a step (part of the
definition of done in `AGENTS.md` §9). The owner updates it for owner-only steps (reviews,
approvals). Keep it short: link to PRs and briefs instead of describing work.

Last updated: 2026-10-21

## Now

Specification in the repository. Owner accepted TypeScript for the backend (D34, replaces D10).
Backend and frontend framework picks are with the owner; the docs still describe the Python
stack until they are chosen, then switch in one pass. D22 (ids) is being re-examined.

## Next

1. Owner picks the TypeScript frameworks (D34) and decides D22 (comparisons posted in the
   project chat). Then the docs switch from Python to TypeScript in one pass.
2. Owner confirms the Problem and Success measures in
   [product-brief.md](requirements/product-brief.md) (marked draft).
3. Owner answers D30 (themes): accept, Board in the Flow pane, which theme first.
4. Start M0 with the builder prompt in `workflow.md` §3.

## Waiting on the owner

| Item | Needed by |
| --- | --- |
| D34: confirm Drizzle, Vercel AI SDK, pg-boss, and keeping D28 (Hono chosen) | M0 |
| D22: id format | M0 |
| Product brief: Problem and Success measures | M0 |
| Accept or change D30 (themes); answer its two open questions (`design/themes.md`) | M0 plan |
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
| M8 | not started | | |
| M9 | not written | | VPS milestone |

States: `not started` → `planning` → `UI design review` → `building` → `in review` → `merged`.
A slice can also be `blocked` (say on what in Notes).

## Done

| Date | What |
| --- | --- |
| 2026-10-21 | Specification: requirements, design sketches, decisions D1–D29, briefs M0–M8 |
| 2026-10-21 | Repository created; spec merged (PRs #1–#5): send states and research notes, security checklist, frontend conventions, `ui-ux-pro-max` skill; D31, D32 accepted |
| 2026-10-21 | Owner review: D6, D11, D13, D33 accepted; D9 accepted with a replaceable transport; D21 accepted with price overrides |
