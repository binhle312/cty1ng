# M6: Workspace parity

Checkpoint: **plan** (security).

## Goal

Everything the Discord prototype could do with files works in the app: bots write to the
Library of their run (D52; no per-bot write folders), the owner attaches files and browses the
workspace, and handoffs with approval cards move work between bots. The `reference/` folder is
deleted at the end.

## Read first

`docs/porting-guide.md` (all); `docs/security.md` §2.2–2.4; `docs/conversation-rules.md` §5;
`docs/decisions/` D18, D19; `docs/domain-model.md` §9, §11; `docs/api.md` §5 (attachments,
files), §6; `docs/requirements/conversation.md` (UI-3.3 cards, 3.13, 3.16).

## In scope

- Full workspace port (git repo per project, or per conversation outside projects, D37; `write_file`, `view_file`,
  commit; memory is no longer a workspace file, D38), with the prototype's workspace tests passing.
- Attachments: upload endpoint, `attachments/<yyyy-mm-dd>-<conversation-slug>/` (D52), multimodal prompt building, binary stripping in
  history.
- Sensitive-data guard for text attachments (D39): UI-3.23.
- Files panel and viewer with safe headers.
- Handoffs: table, `propose_handoff` tool (D18 if accepted; otherwise ask), cards, decisions,
  stale detection, "Add <bot> and start", 24-hour limit.
- Conversation delete moves the workspace to `data/trash/`.
- Delete `reference/` and confirm every row of `porting-guide.md` §2 is done.

## Acceptance criteria

- Journey J3 passes in Playwright.
- UI-3.3 (handoff cards), 3.13, 3.16.
- All behaviours in `porting-guide.md` §3 have tests.
- Security tests in `security.md` §3 for the workspace, attachments and file viewer pass.
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
Before the plan starts, this brief gets the run worktrees, the save queue and file claims, the
overlap notice, the unsaved changes card, the delete and move approval card, the Library card
and page, and the `run_branches` migration.

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
- **Typed handoff brief.** `propose_handoff` gets fields (goal, done, assumed, open questions,
  ask, suggested skills) instead of `summary`; the card shows "Assumed" items apart, and warns
  when a suggested skill is not pinned to the target. Today the seed skill `hand-off-work`
  writes these sections as Markdown in `summary`.
- **Fork a handoff.** "Start in a new conversation" on the handoff card: the target starts in a
  new conversation in the same project; the first conversation continues.
- **Plan approval rates.** After M6, review how often plans are approved in their first version,
  before any discussion of an auto-approve setting (D48 does not change now).
