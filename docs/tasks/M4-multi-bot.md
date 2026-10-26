# M4: Multi-bot conversations

Checkpoint: **plan** (routing).

## Goal

Several bots in one conversation: drag from the header to add, the owner chooses what each new
bot may read, `@mention` limited to members, reply rules applied, deleted bots greyed, message
editing with branches, and the conversation menu with Delete to Trash. There is no conversation
settings page and there are no preset icons (round 12).

## Read first

`docs/conversation-rules.md` §1, §3, §4, §6; `docs/decisions/` D3, D8, D11, D12, D13;
`docs/decisions/` D60; `docs/domain-model.md` §5–6, §16, invariants 10 and 24; `docs/api.md` §5; `docs/requirements/app-shell.md` (UI-1.3, 1.6, 2.4–2.5),
`docs/requirements/conversation.md` (UI-3.8, 3.9, 3.11, 3.12, 3.15), `docs/requirements/settings.md` (UI-9);
`docs/design/components/conversation-page.md` §2 (round 12 design); `docs/testing.md` §3 (domain).

## In scope

- `decideRuns` complete for human triggers (all rows of `conversation-rules.md` §1), mention
  validation (`mention_not_member`, `bot_unavailable`), mention tokens in the composer.
- Several bots in one message: sequential runs where each later bot sees earlier replies (D31),
  one queued reaction per waiting bot (UI-3.18).
- Member lifecycle with the history card (`pending_history` → `active` → `removed`), re-add asks
  again; `visibleHistory` honours `history_from_seq`.
- Drag-to-add with dnd-kit (UI-2.4, 2.5) and the drop rules.
- Editing and branches: edit endpoint, sibling navigation, active path for listing and for
  bots, edit blocked while runs are active.
- Conversation menu on the bar 2 row and in the header (UI-9.7): Rename, Memory, Move to
  project, Delete. Delete moves the conversation to Trash (D60; the restore and the Trash page
  are M5b). After `trash_days` the purge job (M1) purges the conversation by the policy in
  `domain-model.md` §16. Members picker, Remove rules and the empty picker (`conversation-page.md` §2.2).
- Deleted bot rendering (UI-3.2).

## Out of scope

Bot-to-bot discussion (M5).

## Acceptance criteria

- Every row of `conversation-rules.md` §1 has a passing table test.
- UI-1.3 (derived icons), UI-1.6, UI-2.4, 2.5, UI-3.2, 3.8, 3.9, 3.11, 3.12, 3.15, UI-9.1, 9.4,
  9.5, 9.7.
- Invariant 10.
- Invariant 24: the purge schema test (`domain-model.md` §16) fails for a table with no entry,
  for a covered table whose policy column names do not match its schema columns exactly (test
  case: add `runs.private_prompt` with no entry), and for an "other scope" table with a foreign
  key to `conversations`, `messages`, `runs` or a cleared table. The policy map has no wildcard
  or default.
- A bot added "from here on" does not see earlier messages in its prompt (agent test).
- "@BA @QA …": QA's prompt contains BA's reply; both show the clock reaction at first, BA's goes
  away when BA starts, QA's when QA starts (D31, UI-3.18).
- Editing a message mid-conversation: bots answer on the new branch; switching back shows the
  old branch intact; the bot's next prompt contains only the active path.
- Journey J6 and e2e steps 2, 6, 8 from `testing.md` §3 pass.

## Tests

Table tests for routing; service tests for member lifecycle and branches; race tests from `architecture.md` §11 (two
sends in parallel chain instead of forking, the bot turn counter at its limit, two settings
PATCHes with the same `row_version`); Vitest for icon
composition (0, 1, 2, 4, 7 bots, deleted, pending) and the mention autocomplete; Playwright as
above (dnd-kit drag works with Playwright's mouse API; also test the keyboard alternative).
Purge: the schema test from invariant 24 (reads the Drizzle schema, so it covers every table
that later slices add), and a service test that purges a conversation and checks that the run
costs stay and no cleared column holds text. M5b adds to that test a bot memory item learned in
the conversation, which must stay.

## Needs human review

The UI design in the plan (layout, components, states), approved before UI code is written
(`docs/workflow.md` §2; sketches in `docs/design/` are not specs).

Routing tests (read the table); the branch columns and `conversations.purged_at` in the initial
schema of this slice (D60).

## Open questions

None.
