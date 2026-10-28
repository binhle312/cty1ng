# M6: Workspace parity

Checkpoint: **plan** (security).

## Goal

Everything the Discord prototype could do with files works in the app: bots write to the
Library of their run (D52; no per-bot write folders), the owner attaches files and browses the
workspace, and handoffs with approval cards move work between bots. The `reference/` folder is
deleted at the end.

## Read first

`docs/porting-guide.md` (all); `docs/security.md` §2.2–2.4; `docs/conversation-rules.md` §5;
`docs/decisions/` D18, D19, D52, D54, D61; `docs/domain-model.md` §9, §11; `docs/api.md` §5 (attachments), §5d (Library), §6; `docs/requirements/conversation.md` (UI-3.3 cards, 3.13, 3.16); the round 17 UI design:
`docs/design/components/library-page.md` and `library-cards.md`.

## In scope

- Full workspace port (git repo per project, plus one Home Library for all conversations outside projects, D52 amendment 2026-10-25; `write_file`, `view_file`,
  commit; memory is no longer a workspace file, D38), with the prototype's workspace tests passing.
- Attachments: upload endpoint, `attachments/<yyyy-mm-dd>-<conversation-slug>/` (D52), multimodal prompt building, binary stripping in
  history.
- Sensitive-data guard for text attachments (D39): UI-3.23.
- The Library page and its viewer with safe headers (`design/components/library-page.md`; it
  replaces the Files side panel, UI-3.16), and the Library parts in a conversation
  (`design/components/library-cards.md`).
- Handoffs: table, `propose_handoff` tool (D18 if accepted; otherwise ask), cards, decisions,
  stale detection, "Add <bot> and start", 24-hour limit.
- Conversation delete (D60): saved files stay in the Library; unsaved changes go to Trash with the
  conversation and are discarded at purge. Test: a delete and a restore leave the Library unchanged.
- Move to project, file step (D61): M5b built the move itself. M6 adds the file list with
  ticked boxes and pinned versions, the copy save, and the check for a save in progress or
  unsaved changes (also checked by the server before the move).
- Unsaved changes discard (D52, `architecture.md` §6.1): the Trash purge job also discards each
  unsaved run branch at `discard_on` (the run's end + `trash_days`, or the purge of its
  conversation or project, whichever comes first). Database step first, then the disk step;
  `run_branches.state` gets `saving` (schema design approval in the M6 plan). Tests: a branch one
  day past the date is discarded, a branch one day before it stays; a conversation in Trash does
  not keep the changes past their own date; a crash after the database step leaves no worktree
  after the next pass; Save and the discard racing on one row give one winner; a second pass
  changes nothing; a failed try and its Retry keep two separate unsaved rows, and discarding one
  leaves the other.
- `openFolder(place)` on the workspace port (`security.md` §2.15); the contract suite covers it.
- Delete `reference/` and confirm every row of `porting-guide.md` §2 is done.

## Acceptance criteria

- Journey J3 passes in Playwright.
- UI-3.3 (handoff cards), 3.13, 3.16.
- All behaviours in `porting-guide.md` §3 have tests.
- Security tests in `security.md` §3 for the workspace, attachments and file viewer pass.
- Isolation (D61, invariant 23), each with a test: a run in Project A cannot list, read or write
  a file of Project B or of the Home Library; a Home run cannot reach a project Library;
  `propose_copy` gives the bot the place names only, never their files; nothing is copied
  without Approve (a pending, rejected or cancelled proposal leaves the destination Library with
  no new commit and no new file); Approve copies the pinned
  version, also when a newer version exists; a copy starts no run; the copy record holds the
  source place, path, commit and approval; a project conversation cannot move (API returns an
  error), and a Home conversation moves only into a project; the move copies the newest saved
  version at dialog open (test: two Home conversations save `notes.md`, the first moves, and the
  copy is the second save, with the other conversation named on the row) and is refused when a run is queued or running, a save is in progress or unsaved changes exist,
  also when the run starts after the dialog opens; `copy_proposals_max_per_conversation_24h`
  counts pending, approved, rejected and cancelled proposals, not blocked attempts, and not the
  owner's own Copy to.
- An image attached in turn 1 is not resent to the model in turn 3 (agent test inspects the
  request).

## Tests

Ported workspace, attachment and orchestrator tests; new API tests for files and handoffs;
Playwright for J3 and for attaching a file.

## Needs human review

The UI design in the plan (layout, components, states), approved before UI code is written
(`docs/workflow.md` §2; sketches in `docs/design/` are not specs).

The sandbox port, file-serving headers, upload handling.

## Open questions

Is D18 (implicit workflow, handoff to any bot, team directory) accepted? Decide before starting.

D52 is accepted (each run writes on its own branch and saves to the Library when it ends).
The UI design is agreed in round 17 (2026-10-27): the overlap notice, the unsaved changes card,
the save card for a delete or move outside the plan, the Library page for a project and for
Home, the plan card mark for a file from another conversation (D52 amendment 2026-10-25), and
for D61 Copy to, Add from Home Library, the copy card with the pinned version and the New tag
(`design/components/library-page.md`, `library-cards.md`, API `api.md` §5d). Before the plan
starts, this brief still gets the run worktrees, the save queue and file claims, the
`library_copies` schema design, the `copy_proposals_max_per_conversation_24h` setting, the
`run_branches` schema design (initial schema for M6) and the `library.*` events in
`realtime-events.md`.

For the D61 copy work (agreed; the source of each item is in brackets):

- `propose_copy` names the destination by the place id. The bot sees each place as id and name,
  because project names need not be unique (owner, 2026-10-26 13:36).
- The copy suffix `-from-<place-slug>` (D61) gets a number when that name is taken too:
  `notes-from-trip-ideas-2.md` (round 17, `design/components/library-page.md` §6; owner,
  2026-10-28).
- The file step of the Move dialog (`design/components/conversation-page.md` §2.1a) is drawn
  with its M6 tag; M6 builds it on `POST /conversations/{id}/move` (`files`: path and pinned commit)
  (round 15 board; `api.md` §5, PR #41 review).

Parked for this brief (owner, 2026-10-24; notes in the agent checklist, pstack and handoff
reviews). Each needs the owner's choice before the plan starts:

- **The approved plan covers the run (D54, accepted 2026-10-25).** The plan lists deletes and
  moves, and Approve covers them; the D52 card shows only operations outside the plan. At run end
  the app writes `runs.plan_check`: planned files not written, planned deletes and moves not done,
  files not in the plan, and the skills' `## Done when` items (the bot marks them with
  `check_done`). The plan card shows the `## Steps` and `## Done when` sections of each skill that
  the plan uses (`requirements/skill-hub.md`, "Suggested skill layout"). This brief builds D54.
- **Read-only helpers in a run** (a `delegate` tool, parallel research inside one run). A
  separate proposal after M6. **One plan for a chain of bots** (a handoff and the next bot's plan
  in one approval) waits for the plan approval rates below (owner, 2026-10-25).
- **Memory saves in a failed action run: decided in D56 (2026-10-25).** The memory saves stay;
  the unsaved changes card lists them with Undo (UI-13.18). Action runs save only the memory
  items on the approved plan (UI-13.17).
- **Progress in the plan card: decided in D57 (2026-10-25).** After Approve, the plan card shows
  each step as done, current or not started, with the tool calls of the current step; the bot
  marks steps with `mark_step`. Built with the plan card (`design/components/plan-card.md` §6).
- **Cross-check by a second model (owner, 2026-10-25 03:58).** An optional reviewer that checks
  a finished action run, later, off by default. It is the "Verify Done when" judge call that D54
  parks. Rules: a different model family from the worker; it sees only the plan, the run's diff
  and the Done-when items, not the worker's reasoning; read-only, and its verdict shows as a label
  ("reviewer says"); it checks only risky items ("bot says", "not verified", deletes and moves).
  Decide after M6 with the measured rate of `met` marks that the owner found wrong. A Reviewer bot
  (pstack review, L4) is the same check as a normal bot with a handoff.
- **Typed handoff brief.** `propose_handoff` gets fields (goal, done, assumed, open questions,
  ask, suggested skills) instead of `summary`; the card shows "Assumed" items apart, and warns
  when a suggested skill is not pinned to the target. Today the seed skill `hand-off-work`
  writes these sections as Markdown in `summary`.
- **Fork a handoff.** "Start in a new conversation" on the handoff card: the target starts in a
  new conversation in the same project; the first conversation continues.
- **Plan approval rates.** After M6, review how often plans are approved in their first version,
  before any discussion of an auto-approve setting (D48 does not change now).
