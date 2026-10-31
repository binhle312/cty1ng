# Development plan

The order in which the app is built, and why. Progress lives in [status.md](status.md), not here;
this file changes only when the plan changes.

Nine vertical slices. Each ends with a working, tested app and is merged before the next
starts (except the parallel cases in `workflow.md` §5). One brief per slice; hand the brief to
the builder agent with the prompt in `workflow.md` §3.

| Slice | Brief | Delivers | Checkpoint | Depends on |
| --- | --- | --- | --- | --- |
| M0 | [M0-skeleton.md](tasks/M0-skeleton.md) | Repo, tooling, CI, app shell, security middleware, event log + SSE skeleton, in three parts: M0a tooling and CI, M0b backend core, M0c frontend shell | **plan** + merge | — |
| M1 | [M1-skill-hub.md](tasks/M1-skill-hub.md) | Skills: versions, authorship, clone, deprecate, import/export, in two parts: M1a backend, M1b Skills page | **plan** (schema) | M0 |
| M1c | [M1c-backend-maintenance.md](tasks/M1c-backend-maintenance.md) | Backend maintenance: daily event pruning (30 days by default) and a guard against a second SQLite writer in one process. No UI | **plan** (short) | M1b; before M2 |
| M2 | [M2-bots.md](tasks/M2-bots.md) | Model catalog, bots CRUD, clone, avatars, pins, header bar | **plan** (schema, uploads) | M1, M1c |
| M3 | [M3-chat-one-bot.md](tasks/M3-chat-one-bot.md) | Conversations, rail, messages, worker, agent port, streaming, Stop, provenance | **plan** (events, worker) | M2 |
| M4 | [M4-multi-bot.md](tasks/M4-multi-bot.md) | Drag-to-add, history choice, mentions, routing, branches, conversation menu (Rename; Delete to Trash is M5b) | **plan** (routing) | M3 |
| M5 | [M5-bot-discussion.md](tasks/M5-bot-discussion.md) | Discussion toggle, turn budget, caps | merge | M4 |
| M5b | [M5b-projects-and-memory.md](tasks/M5b-projects-and-memory.md) | Projects and memory (D37, D38): project entity, rail grouping, bot and project memory, Memory page. Conversation menu items Memory, Move to project (the move itself, D61; the file step is M6) and Delete (D60): Delete endpoint, Trash page with Restore and Delete for every kind (D62), purge job and its service test (`domain-model.md` §16), `conversations.deleted_at` and `purged_at`. Cross-conversation reading (D58) in the next slice (owner 2026-10-26) | **plan** (schema, UI design) | M5; before M6 (workspaces are per project) |
| M5c | not written | Skills drafted by bots (D41): `propose_skill`, draft card with diff, approve, then a float card to assign or upgrade the bots (D64); no target bot, only the owner assigns (D65) | **plan** (schema, UI design) | M3 |
| M5d | not written | Bots improve their skills from the owner's feedback (D51): signal count, "Improve" in the bot's ⋯ menu, signal dialog, Improve run, draft card in the bot's 1:1 conversation, optional blind probe with a task count, saved test cases for each skill with two scores (D51 amendment 2026-10-27) | **plan** (schema, UI design, cost) | M5c and the plan card (D48) |
| M6 | [M6-workspace-parity.md](tasks/M6-workspace-parity.md) | Workspace sandbox, file tools, file panel, attachments, handoffs, Libraries (D52), Copy to and the file step of Move to project (D61) | **plan** (security) | M5b (projects define the Libraries) |
| Inbox | not written | Project inbox (D58, D59; `requirements/project-inbox.md`): states, waits, notices, Send to conversation. No model calls | **plan** (schema, UI design) | M6 (needs D48 cards and D52 notices) |
| M7 | [M7-statistics.md](tasks/M7-statistics.md) | Statistics page: models, bots, skills | merge (new chart dependency) | M5 (needs usage, provenance, discussion data) |
| M8 | [M8-flow-view.md](tasks/M8-flow-view.md) | Flow pane: animated Timeline map, swappable renderer | **plan** (renderer contract, performance) | M7 (needs run steps from M3, discussion and handoffs from M5–M6) |
| M8b | not written | Board: third map in the Flow pane (D30, `design/themes.md` §4) | **plan** (UI design) | M8 |
| M8c | not written | Project-wide Board, read-only (`design/components/left-bar.md` §5); same project data as the inbox | **plan** (UI design) | M8b |
| T2 | not written | Material theme: one token file plus the documented structural differences (D30) | merge (UI design, visual snapshots) | M0; any time, owner decides |
| M9 | not written | VPS: auth, Docker, TLS, backups | separate milestone | M8 |
| later | not written | Scheduled bots and web access (Researcher, Reminder; then Trip planner); web through provider web tools only (D53) | separate milestone | after phase 1 |
| later | not written | External project folders (D23: documents first, write-capable design) | separate milestone | M9 or earlier, owner decides |
| later | not written | Desktop app (Windows, Linux) and coding agents from the app (idea only: [ideas/desktop-app-and-cli-agents.md](ideas/desktop-app-and-cli-agents.md)) | separate milestone | M9 and external project folders (D23) |

"Checkpoint: plan" means the builder stops after writing the plan and waits for the owner's
approval (`workflow.md` §2). Every slice also needs the owner's review of migrations and
`Needs human review` items before merge.

Every slice with a screen (M0–M5, M6 file panel, M7, M8, M8b, T2) also has a **UI design checkpoint**:
the plan proposes the actual UI and the owner approves it before UI code is written. Sketches
and mockups in `docs/design/` are starting points for that discussion, never specs.

## Brief format

Briefs live in [tasks/](tasks/). Every brief has the same sections so agents know where to look:

- **Goal**: one paragraph.
- **Read first**: the documents (and sections) the builder must read.
- **In scope / Out of scope**.
- **Deliverables**: files, endpoints, pages.
- **Acceptance criteria**: references to `UI-x.y` ids in `requirements/`, `conversation-rules.md` sections,
  invariants, plus slice-specific checks.
- **Tests**: what must exist by the end.
- **Needs human review**: known items.
- **Open questions**: must be empty before building starts.
