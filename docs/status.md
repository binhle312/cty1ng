# Status

Where the project is right now. This is the only file that tracks progress; the plan
([development-plan.md](development-plan.md)) says what and in which order, and never carries
status.

**Who updates it:** the builder agent, in the same PR that finishes a step (part of the
definition of done in `AGENTS.md` §9). The owner updates it for owner-only steps (reviews,
approvals). Keep it short: link to PRs and briefs instead of describing work.

Last updated: 2026-10-26

## Now

Specification in the repository, now for a TypeScript stack: Hono, Drizzle, Vercel AI SDK,
React + Vite (D34, replaces D10), with libraries behind ports (D35) and a `README.md` index per
code folder for agents (`architecture.md` §4.2). Ids are UUIDv7 stored, TypeIDs outside the
database (D22, D36). Themes accepted (D30): Command ships in M0, Material later (T2), and the
Board is the Flow pane's next map (M8b). Loading rules, first open and reopening specified (app-shell.md SH-4, SH-5). Product brief
expanded after the owner's interview (use cases, phases, non-goals, trust
failures); D37–D40 accepted (projects, memory, sensitive-data guard, cost alerts); D42 adds optional per-provider caps under the total cap. D41
accepted: bots draft skills when asked, the owner approves and is the author (slice M5c).
UI design review in progress: header bot order (Recent activity / Custom, deferred
reordering) specified for M2. Agreed so far and saved in `design/components/` with previews: bot
avatar (Flat, Jelly, Pixel; Flat only until the final product), top header, bot card, user
panel, left bar (rail and bar 2), Memory pane, New project page (layout A), Project settings page
with the memory check card and Delete project, plan card, Skills page (round 8) and the button
and check box standard (`buttons.md`). D43–D45 accepted
(memory precedence, right pane holds Flow or Memory, project goal and instructions). D47 (delete
sends the whole project to Trash; memory check choices) and D48 (bots plan first) accepted. Still
in review: Trash page (with the Remember button and the "changed in another tab" cards), Library
page content. Flow pane: M8 ships only the Timeline (D26 amendment 2026-10-25, Timeline in
`design/components/flow-timeline.md`); the Team map is parked until bots work together without
the owner. D46 accepted: a one-time auto title from the first message (M3).
The M3 schema design (D46) waits for the owner's approval. Project Board is a later slice (M8c).
D49 accepted: deleted skills go to Trash, a `trash_days` setting (default 30), Undo only for a
permanent delete. D51 accepted: bots improve their skills from the owner's feedback (slice
M5d, after M5c); M3 starts to store reply ratings. M2 Bots design round 9: the Bots page grid,
the Create bot page and the standards for pin, bot status, dashed slot, time format and sort are
agreed and saved in `design/components/`. The bot page (`bot-page.md`: edit layout, Profile,
Skills and Activity tabs, colour band), Clone and the avatar colour rules (any colour, Custom,
Random, upload with crop) are agreed too. The Usage tab design is agreed; its data (task verdict, setup change
record, targets) is not specified yet. The Memory tab comes with M5b. D50 (bots to Trash) and D55 (provider tools first, tool switches; code execution only for small
analysis scripts in the provider's sandbox; MCP locked) are accepted, and the owner approved the M2
migration and API changes in PR #20 (2026-10-24). M3 conversation design round 10 is agreed and
saved in `design/components/` (`conversation-page.md`, `composer.md`, `conversation-cards.md`):
the add slot (+) first in the header, Stop in the composer, reactions only while a run is queued,
cards inside the reply that fold after a decision, and the requirement edits that follow. M5 global settings design round 14 is agreed and saved in
`design/components/settings-page.md` and `conversation-page.md` §2.4: one short page per Settings
item, one setting row that says what the owner notices, the discussion popover, and the ranges of
every setting in `domain-model.md` §10. M5b design round 15 is agreed and saved in
`design/components/memory-page.md`, `trash-page.md` and `conversation-page.md` §2.1a: the Memory
page with Tidy, one Trash page for every deleted item with multi-select, and the Move to project
dialog. D62 (one Trash page, memory items included) and D63 (Tidy and the memory check are model
requests) are accepted, and the memory limits are settings (D38 amendment). D58 moves to the
next slice after M5b. The M5b brief is written. M5c design round 16 (skill draft card) is in
review: `design/components/skill-draft-card.md` and the Skills page in the bot page layout
(`skills-page.md`, Skill, Bots and History tabs); D64 is proposed.

## Next

1. Start M0 locally in Claude Code with the builder prompt in `workflow.md` §3.

## Waiting on the owner

| Item | Needed by |
| --- | --- |
| D52 accepted (each run writes on its own branch and saves to the Library): update the M6 brief and the documents D52 lists; approve the `run_branches` schema design (initial schema for M6). The generated SQL is approved in the slice PR | M6 plan |
| D54 accepted (the approved plan covers deletes and moves; run-end plan check): add the plan lists and `runs.plan_check` to `domain-model.md`, the `check_done` tool, and approve the schema design (initial schema for M6). The generated SQL is approved in the slice PR | M6 plan |
| D57 accepted (the plan card shows the run's progress; `mark_step`, one reminder, mark sources, `check_done` evidence): build it with the plan card | Plan card slice (M5b, M5c or M6) |
| D58 and D59 accepted (cross-conversation reading on request, Send to conversation, save notice when project memory changed): approve the FTS5 schema design (initial schema for the slice after M5b, owner 2026-10-26), and the instructions/goal change time and D59 snapshot schema design (initial schema for M6). The generated SQL is approved in each slice PR; UI design of the inbox, information card and memory notice in the slice plans | Next slice plan, M6 plan, Inbox plan |
| D64 proposed (the skill draft card is for the skill only; a float card for the bots after Approve; slug auto-suffix; drafts marked stale at once): accept it, and approve the API changes (decision body without `pin` and `always_load`, `POST /skills/{id}/bots`) and the Skills page layout change for M1 | M5c plan, M1 build |
| D53 accepted (web through provider web tools): check the default limits and approve the schema design for the bot setting and the run flag (initial schema for that milestone). The generated SQL is approved in the slice PR | Web access milestone plan |
| Approve the M3 schema design for D46 (auto title) before it is written. The generated SQL is approved in the slice PR | M3 plan |
| Specify the data of the bot Usage tab (`design/components/bot-page.md` §9.6): task verdict on runs, setup change record, tile targets, Group by, run timings. Needs a schema design approval (initial schema for M3 and M7). The generated SQL is approved in the slice PR | M3 and M7 plans |
| Approve the M5b schema design: `projects.instructions_md`, `instructions_version`, `colour`, `pinned_position`, goal ≤ 500 chars, `memory_items.seen_at`, `memory_proposals` and the `model_requests` change (D63) (initial schema for M5b, `domain-model.md` §14). Claude Code stops for this approval before it writes them. The generated SQL is approved in the M5b PR | M5b plan |

## Slices

| Slice | State | PR | Notes |
| --- | --- | --- | --- |
| M0 | not started | | |
| M1 | not started | | Design approved: `design/components/skills-page.md` (round 8); D49 accepted. Round 16 moves the page to the bot page layout (in review) |
| M2 | UI design review | [#20](https://github.com/binhle312/cty1ng/pull/20) (spec) | Agreed: `design/components/bots-page.md`, `create-bot-page.md` (with Clone), `bot-page.md` and the standards (round 9). Usage tab design agreed, its data open |
| M3 | UI design agreed | [#26](https://github.com/binhle312/cty1ng/pull/26) (spec) | Round 10: `design/components/conversation-page.md`, `composer.md`, `conversation-cards.md` |
| M4 | not started | | |
| M5 | UI design agreed | [#35](https://github.com/binhle312/cty1ng/pull/35) (spec) | Round 14: `design/components/settings-page.md`, `conversation-page.md` §2.4; key `bot_discussion_enabled` |
| M6 | not started | | |
| M7 | not started | | |
| M5b | UI design agreed | [#37](https://github.com/binhle312/cty1ng/pull/37) (spec) | Brief: `tasks/M5b-projects-and-memory.md`. Round 15: `design/components/memory-page.md`, `trash-page.md`, `conversation-page.md` §2.1a; D62, D63 accepted |
| M5c | UI design review | (this PR, round 16 spec) | Skills drafted by bots (D41, D64 proposed). Round 16: `design/components/skill-draft-card.md`, `skills-page.md` §2a, §13, §17. Brief not written |
| M5d | not written | | Bots improve their skills from the owner's feedback (D51) |
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
| 2026-10-26 | M5b design round 15: Memory page with Tidy, Trash page with multi-select, Move to project dialog; D62, D63 accepted; M5b brief and API contracts written |
| 2026-10-27 | M5c design round 16: skill draft card, float card for the bots after Approve, Edit on the Skills page, Skills page in the bot page layout; D64 proposed |
