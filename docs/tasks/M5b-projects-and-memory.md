# M5b: Projects, memory and Trash

Checkpoint: **plan** (schema, UI design). The UI design is agreed (round 12 for the
conversation menu and the project pages, round 15 for the Memory page, Trash page, Move dialog
and Tidy). The schema design and the generated SQL need the owner's approval (`AGENTS.md` §7).

## Goal

Projects group conversations, and bots remember: bot memory, project memory and conversation
memory, with a Memory page where the owner controls what bots remember. Every delete goes to
one Trash page, where the owner restores items or deletes them for good. A Home conversation
can move into a project and take its conversation memory with it.

## Read first

- Decisions: D37, D38, D43, D44, D45, D47, D49, D50, D56, D60, D61, D62, D63 (and their
  "Changed by" entries in `docs/decisions/README.md`).
- `docs/requirements/projects-and-memory.md` (UI-13), `docs/requirements/app-shell.md`
  (UI-1.6, UI-1.14 to UI-1.19), `docs/requirements/settings.md` (UI-8.6, UI-8.9, UI-9.5, UI-9.6).
- `docs/domain-model.md` §7 (`model_requests`), §10 (settings), §14, §16; `docs/api.md` §5,
  §5a, §5b, §5c; `docs/realtime-events.md` §4; `docs/conversation-rules.md` (D43 rules).
- Design: `docs/design/components/memory-page.md`, `trash-page.md`, `memory-pane.md`,
  `conversation-page.md` §2.1 and §2.1a, `left-bar.md`, `new-project-page.md`,
  `project-settings-page.md`, `user-panel.md` §2, `bot-page.md` (Memory tab),
  `settings-page.md` §4.8, §4.9.

## In scope

- **Projects** (D37, D45): create, rename, goal and instructions, colour, pin and reorder in the
  rail, rail grouping, delete to Trash with the check card (D47). New project page and project
  settings page as designed.
- **Memory** (D38, D43): the three scopes, the memory tools (`remember`, `update_memory`, `forget`,
  `restore_memory`, `propose_memory_tidy`), the "Remembered" lines with Undo, the exact
  duplicate check (UI-13.16), the sensitive-data guard, the limits `memory_item_max_chars` and `memory_items_max`,
  history versions per bot, project and Home conversation, the global switch and "Don't use
  memory". Memory goes into the prompt in the D43 order.
- **Memory page and pane** (`memory-page.md`, `memory-pane.md`): places list, item rows, edit,
  add, earlier versions, delete to Trash, search, conflict and Decide, limits, memory off, the
  bot page Memory tab, and Tidy (D63).
- **Memory check** after an instruction save (D43, D63): one model request, the check card,
  open conflicts, "Memory check failed" with **Check again**.
- **Conversation menu items** Memory, Move to project and Delete (round 12), with the Delete
  dialog (D60) and the Move dialog without its file part (`conversation-page.md` §2.1a).
- **Trash** (D62): the Trash page, Restore and Delete per row and for several rows, the restore
  dialogs for a skill and a bot, `place_in_trash`, the Undo toast held for `undo_seconds`, Trash
  in the user panel menu with its count. Remove the temporary CLI commands `skills trash` and
  `skills restore` that M1 added (`api.md` §2), with their tests and the `api.md` lines; the
  Trash page replaces them (owner, 2026-10-30). The skill delete toast's **Trash** becomes a
  link (`skills-page.md` §11).
- **Purge job** (D49, D50, D60, D62): at start and every `PURGE_INTERVAL_HOURS` (default 24),
  each item where `deleted_at + trash_days` is at or before now (clock port), one item per
  transaction, idempotent. Conversation purge by the §16 policy. The M1 purge job (skills)
  becomes this job.

## Out of scope

- The file part of Move to project and Copy to (M6, D61).
- Cross-conversation reading and Send to conversation (D58): the next slice (owner 2026-10-26).
- A relevance filter for memory in the prompt (owner 2026-10-26 13:28: only with data, later).

## Acceptance criteria

- UI-13.1 to UI-13.21.
- UI-1.6, UI-1.14 to UI-1.19.
- UI-8.6, UI-8.9, UI-9.5, UI-9.6.
- Invariants from `domain-model.md` §14: a project memory item is never in the prompt of a run
  outside that project; a conversation memory item never outside its conversation; no memory
  text matches the sensitive-data guard.
- Invariant 24 (purge policy) holds for every table that this slice adds; `memory_proposals`
  has its §16 entry.
- Move: a test moves a multi-bot Home conversation with 2 conversation memory items, 1 ticked,
  into a project, and checks one transaction: the conversation's `project_id`, one project item,
  one item in Trash as a project item, the system line and the events. A second test starts a
  run between the dialog and the move and gets 409 `run_in_progress` with nothing changed.
- Tidy: a fake-model test returns a merge, a rewrite, a delete and a flag; Apply with two
  indexes changes two items and nothing else; an item changed between the request and Apply is
  skipped and returned (UI-13.20).
- Trash: a service test restores a project and a conversation of it in one call and gets both
  back (places first); a conversation alone while its project is in Trash returns
  `place_in_trash`. A purge test with a fake clock purges an item at `deleted_at + trash_days`
  and not one second before, and a second run purges nothing.
- Caps: a title request and a Tidy request in flight at the same time near the cap; the second
  reservation sees the first, and neither passes the cap (D63, `conversation-rules.md` §8 rule 6).
- Unknown price (D42 amendment 2026-10-27): a Tidy and a memory check request on a fake model
  with no price return 429 `price_unknown` while the total cap is on, and also while only that
  model's provider cap is on; a cap of another provider does not refuse it; with no cap that
  applies, the request is allowed and its cost shows "cost unknown".
- Tidy texts: a fake model proposes a rewrite with a secret and one over
  `memory_item_max_chars`; both rows are off with their reason, and Apply saves neither.
- Decide: a check finds a conflict with line 4, the owner saves new instructions, then Decide on
  the old conflict returns 409 `instructions_changed` and changes nothing.
- Seen: open a place, restart the app, and the New tags stay gone; a GET changes nothing.
- Rail keyboard (`left-bar.md` §1.2): with three pinned projects, Alt+↓ on the first moves it to
  place 2, saves with `PUT /projects/{id}/pin`, keeps focus on it, and the live region says
  "{name}, pinned, 2 of 3"; Alt+↑ on the first does nothing. Shift+F10 on a pinned tile opens
  Move up (off on the first), Move down, Unpin, Project settings; on an unpinned tile, Pin to top
  and Project settings. Pin to top from the menu pins the project, as the badge does.
- Rail touch (`left-bar.md` §1.2): in a touch-emulated e2e run, tap a pinned project, then Move
  down in the bar 2 header ⋯ menu moves it one place with no drag; a long press on a pinned
  tile starts the drag.
- Memory upkeep requests appear in `GET /usage?group_by=bot` as "Memory upkeep" and count toward
  the daily caps (D63).

## Tests

Service tests for each memory scope and the scope choice; fake-model agent tests for the memory
tools, the duplicate check, the D43 question, Tidy and the check request; API tests for every
endpoint in `api.md` §5a to §5c, including the error codes; the purge job with a fake clock;
Playwright for the Memory page (edit, delete, restore from Trash), the Trash page multi-select
with Undo, and the Move dialog.

Watch the memory token count per run: log the memory characters and tokens that each prompt
adds, so a later relevance filter can be decided on data (owner 2026-10-26 13:28).

## Needs human review

- The schema design (`domain-model.md` §14): `projects.instructions_md`, `instructions_version`,
  `colour`, `memory_items.seen_at`,
  `pinned_position`, the goal limit, `memory_proposals`, and `model_requests` with two new
  purposes and a NULL-able `conversation_id` (§7, D63). Claude Code stops for this approval
  before it writes them. The generated SQL is approved in the M5b PR.
- The purge policy entries for the new tables (`domain-model.md` §16).
- The sensitive-data guard on memory text (`security.md`).

## Open questions

None. Decided in the PR #37 review (owner, 2026-10-26 14:34):

- D58 (cross-conversation reading, FTS5 search entries) is the next slice after M5b, to keep M5b
  smaller.
- D38's limits are settings: `memory_item_max_chars` (default 300, 100–1,000) and `memory_items_max`
  (default 50, 10–200; owner 2026-10-26 14:56), on Settings › Memory (`domain-model.md` §10).
