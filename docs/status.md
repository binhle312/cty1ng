# Status

Where the project is right now. This is the only file that tracks progress; the plan
([development-plan.md](development-plan.md)) says what and in which order, and never carries
status.

**Who updates it:** the builder agent, in the same PR that finishes a step (part of the
definition of done in `AGENTS.md` §9). The owner updates it for owner-only steps (reviews,
approvals). Keep it short: link to PRs and briefs instead of describing work.

Last updated: 2026-10-21

## Now

Specification complete. Waiting for the owner to review the foundational decisions, then M0.

## Next

1. Owner reviews the decisions that are hard to undo: D6, D9, D10, D11, D13, D21, D22
   ([index](decisions/README.md)).
2. Owner confirms the Problem and Success measures in
   [product-brief.md](requirements/product-brief.md) (marked draft).
3. Create the GitHub repository and commit this specification.
4. Start M0 with the builder prompt in `workflow.md` §3.

## Waiting on the owner

| Item | Needed by |
| --- | --- |
| Foundational decision review (above) | M0 |
| Product brief: Problem and Success measures | M0 |
| Accept or change D30 (themes); answer its two open questions (`design/themes.md`) | M0 plan |
| Approve or change D33 (Zod as the frontend schema library) | M0 |
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
