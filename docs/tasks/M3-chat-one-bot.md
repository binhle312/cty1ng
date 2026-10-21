# M3: Chat with one bot

Checkpoint: **plan** (events, worker). This is the largest slice; split into M3a (backend:
tables, worker, agent port, streaming) and M3b (frontend: rail, conversation page) if the plan
shows it is too big for one review.

## Goal

The owner creates conversations from the rail, adds one bot (via the "Add bot" button for now),
chats with it, sees replies stream in with skill provenance chips, and can stop a run. The
event log keeps the UI exact across reloads.

## Read first

`docs/architecture.md` §6, §7, §11; `docs/domain-model.md` §3.6–3.7, §5–8; `docs/conversation-rules.md`
§1 (one-bot rows), §3 (simplified: see below), §4; `docs/realtime-events.md` (all); `docs/domain-model.md` §3.8;
`docs/api.md` §5; `docs/requirements/app-shell.md` (UI-1), `docs/requirements/conversation.md`; `docs/porting-guide.md` §2–3 (agent, db, service rows);
`docs/testing.md` §2–3.

## In scope

- Tables `conversations`, `conversation_bots`, `messages`, `runs`, `run_history`, `run_skills`,
  `run_steps` (every tool call recorded with its `run.step` event, D26).
- Worker with leases, attempts, one running run per conversation, `MAX_CONCURRENT_RUNS`, Stop.
- Agent port: prompt builder (`conversation-rules.md` §4, without the discussion rules block
  values beyond "OFF"), tools `load_skill` (pinned version, records `run_skills`) and
  `list_files`/`read_file` against an empty workspace folder (the full sandbox port is M6, but
  all paths must already go through the ported `Workspace.resolve()`).
- Streaming via `message.delta`, partial saves, retry reuses the message.
- Run status reactions on the trigger message (UI-3.18, 3.19), placeholder emojis until the
  design review picks them.
- Send states for human messages with idempotent `client_id` (UI-3.20), message disposition
  and cancelling one queued run (UI-3.21), typing/working states with elapsed time (UI-3.4,
  3.5), the stall timeout (`architecture.md` §6), clearing live indicators on disconnect
  (`realtime-events.md` §3), and `last_read_seq` with the "New" divider (UI-3.10).
- `domain.decide_runs` for the one-bot rows; `visible_history` with full history.
- Rail (UI-1.1–1.6 except presets), conversation page (UI-3.1–3.7, 3.10, 3.14–3.15 without
  discussion controls, 3.17), "Add bot" button that adds with full history directly (the
  history card arrives in M4).
- Unread dots and `POST /read`.
- Usage recording per model request (`model_requests`, raw `usage_details`, cost via
  genai-prices with catalog override, D21) and run totals;
  message usage tooltip (UI-3.6b), bot usage panel (UI-6.8, fixed to "Last 7 days" until the
  shared time range picker arrives in M7), `GET /usage`.
- Bot detail UI-6.7, 6.8 now filled.
- Sensitive-data guard for message text (D39): UI-3.22 and the server check.

## Out of scope

Drag-to-add, history card, mentions autocomplete (M4); discussion (M5); attachments, file
panel, handoffs (M6); editing and branches (M4).

## Acceptance criteria

- Journey J1 steps 1–3 pass in Playwright with the fake model (adding by button).
- UI-1.1–1.6 (icons from avatars), UI-3.1–3.7, 3.10, 3.14, 3.15 (partial), 3.17.
- Invariants 7, 8, 9, 11, 14, 15.
- Killing the backend mid-stream and restarting: the run is retried after the lease, no
  duplicate message, the UI recovers on reconnect.
- Stop during streaming → message `stopped` with partial text, run `stopped`.
- `load_skill` returns the pinned version even when a newer version exists.
- Invariant 13: changing a price override in `models.yaml` does not change finished requests' cost.
- A run with three tool-call rounds stores three `model_requests` rows whose sum equals the run totals.
- Every race in `architecture.md` §11 that M3 touches has a parallel test with exactly one
  winner (invariants 8 and 15).

## Tests

Worker tests (claim exclusivity per conversation, lease expiry, max attempts); agent tests with
the fake model (prompt contents, provenance, cancel); race tests from `architecture.md` §11
(two workers claiming one run, a second run racing into a conversation, a stale worker
writing after a reclaim, Stop racing finish, duplicate `client_id` sends in parallel), with the
claim cases in the queue contract suite; API tests for messages and stream replay;
Vitest for the reducer and message rendering (XSS corpus from `security.md` §3); Playwright as
above.

## Needs human review

The UI design in the plan (layout, components, states), approved before UI code is written
(`docs/workflow.md` §2; sketches in `docs/design/` are not specs).

Migrations; event emission points; worker concurrency; Markdown renderer configuration.

## Open questions

None.
