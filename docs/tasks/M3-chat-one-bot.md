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
`docs/testing.md` §2–3; `docs/conversation-rules.md` §8 and D46 (auto title).

## In scope

- Tables `conversations`, `conversation_bots`, `messages`, `runs`, `run_history`, `run_skills`,
  `run_steps` (every tool call recorded with its `run.step` event, D26).
- Worker with leases, attempts, one running run per conversation, `MAX_CONCURRENT_RUNS`, Stop.
- Agent port: prompt builder (`conversation-rules.md` §4, without the discussion rules block
  values beyond "OFF"), tools `load_skill` (pinned version, records `run_skills`) and
  `list_files`/`read_file` against an empty workspace folder (the full sandbox port is M6, but
  all paths must already go through the ported `Workspace.resolve()`).
- Tool results, empty results and tool errors (`conversation-rules.md` §4, "Tool results"):
  every tool returns errors as `{error, message}` and never ends the run; the prompt line about
  errors and no data; `force` in the fake model script (`testing.md` §2).
- Streaming via `message.delta`, partial saves, retry reuses the message.
- Run status reactions on the trigger message (UI-3.18, 3.19), placeholder emojis until the
  design review picks them.
- Send states for human messages with idempotent `client_id` (UI-3.20), message disposition
  and cancelling one queued run (UI-3.21), typing/working states with elapsed time (UI-3.4,
  3.5), the stall timeout (`architecture.md` §6), clearing live indicators on disconnect
  (`realtime-events.md` §3), and `last_read_seq` with the "New" divider (UI-3.10).
- `decideRuns` for the one-bot rows; `visibleHistory` with full history.
- Rail (UI-1.1–1.6 except presets), conversation page (UI-3.1–3.7, 3.10, 3.14–3.15 without
  discussion controls, 3.17), "Add bot" button that adds with full history directly (the
  history card arrives in M4).
- Unread dots and `POST /read`.
- Usage recording per model request (`model_requests`, raw `usage_details`, cost via
  genai-prices with catalog override, D21) and run totals;
  message usage tooltip (UI-3.6b), bot usage panel (UI-6.8; the agreed design is `design/components/bot-page.md` §9, its data is open in §9.6; fixed to "Last 7 days" until the
  shared time range picker arrives in M7), `GET /usage`.
- Bot detail UI-6.7, 6.8 now filled.
- Sensitive-data guard for message text (D39): UI-3.22 and the server check.
- Virtualised message list (`frontend-conventions.md` §4).
- Auto title from the first message (D46, `conversation-rules.md` §8, UI-3.24 to UI-3.26):
  the columns `title_source` and `auto_title_status`, the `model_requests` change (`purpose`,
  `conversation_id`, `run_id` NULL for titles), `decideAutoTitle` and `cleanTitle` in
  `core/conversations/auto-title.rules.ts`, the claim in the send transaction, the background
  call through the model port, the `pending` → `failed` step at startup, and `title_source` in
  the API.
- The cap check as one pure rule for runs and titles (`domain-model.md` §13). M3 uses it only for
  the title call. M5 adds the Settings UI, the alerts and the check at run claim, and reuses the
  rule. Until M5, tests write `daily_cap_usd` and `provider_caps_usd` into `settings` directly.
- Reply feedback (D51): the `reply_feedback` table (`domain-model.md` §15), `PUT` and
  `DELETE /messages/{id}/feedback`, the `message.feedback` event, and the Good answer and Bad
  answer buttons with the note box (UI-3.27, UI-3.28). Nothing reads the ratings until M5d;
  M3 only stores them. If M3 is too big, this item can move to M4.
- First open and reopening: the Get started checklist with `GET /setup` and
  `POST /setup/examples` (UI-1.7 to UI-1.9), last conversation, scroll to the "New" divider and
  drafts (UI-1.10 to UI-1.12).

## Out of scope

Drag-to-add, history card, mentions autocomplete (M4); discussion (M5); attachments, file
panel, handoffs (M6); editing and branches (M4).

## Acceptance criteria

- Journey J1 steps 1–3 pass in Playwright with the fake model (adding by button).
- UI-1.1–1.6 (icons from avatars), UI-3.1–3.7, 3.10, 3.14, 3.15 (partial), 3.17.
- Invariants 7, 8, 9, 11, 14, 15, 17, 18, 22.
- Killing the backend mid-stream and restarting: the run is retried after the lease, no
  duplicate message, the UI recovers on reconnect.
- Stop during streaming → message `stopped` with partial text, run `stopped`.
- `load_skill` returns the pinned version even when a newer version exists.
- Every fault case in `testing.md` §3 (Agent, "Faults") passes: tool error, empty result,
  invalid arguments, unknown tool, no stack trace, prompt line, `request_limit` stop.
- Invariant 13: changing a price override in `models.yaml` does not change finished requests' cost.
- A run with three tool-call rounds stores three `model_requests` rows whose sum equals the run totals.
- Every race in `architecture.md` §11 that M3 touches has a parallel test with exactly one
  winner (invariants 8 and 15).
- Auto title (D46), each with a named test (`UI-3.24: …`):
  - The first sent message gives the fake title. The header and the rail tooltip show it after
    one `conversation.updated` event. `title_source` is `auto`.
  - The send returns 201 before the title call ends, and the bot run starts without a wait
    for it (fake title with `delay_ms`).
  - A second message, an edit of the first message, and a resend with the same `client_id` make
    no new title call (invariant 18).
  - Two first messages sent in parallel in the same conversation make exactly one title call.
  - A message refused with 422 `sensitive_data` does not use the attempt. The next clean
    message gets the title.
  - A first message sent with "Send anyway" (`confirm_sensitive: true`, guard matches) makes no
    title call. The status is `skipped` and the title stays "New conversation".
  - A fake title that contains a secret pattern is not saved. The status is `failed` and the
    logs hold only the kinds found.
  - A rename before the first message, and `POST /conversations` with a title, make no title
    call. A rename during the call (fake `delay_ms`) wins: the title stays manual, the status
    is `skipped`, and the app emits no `conversation.updated` for the title (invariant 17).
  - The auto title write does not change `row_version`: a PATCH with the version read before the
    title arrived gets 200, not 409.
  - Fake `timeout`, `error` and `empty` keep "New conversation", show no error in the chat, and
    make no second call. A restart with `pending` sets `failed` and makes no call.
  - With the total cap reached, and again with only the title model's provider cap reached
    (D42), the app makes no title call, the status is `skipped`, and the chat gets no extra
    notice. A model with no known price still gets a title.
  - Near the cap: five conversations send their first message at the same moment, with fake
    prices and a cap that leaves room for exactly two worst-case reservations. Delay the title
    calls (the fake counts in-flight calls). Exactly two are in flight and three are `skipped`
    with no call. After they finish, today's spend is at or below the cap, and no
    `reserved_cost_usd` is left.
  - A run claimed while a title reservation is in flight sees the reservation in today's spend.
  - A restart with a title row in flight keeps the reservation as its cost.
  - For both the total cap and the provider cap, a title passes the send-transaction check.
    Another request then finishes and brings recorded spend to the cap before that title's
    dispatch check. The title is `skipped`, with no call or extra notice.
  - Model choice: a message that mentions an unavailable Designer and then BA uses BA's model. A
    first message with only a `pending_history` member, or with only bots with no key, makes no
    call, and the status is `skipped`.
  - A `model_requests` insert with `purpose = 'other'`, or with `purpose = 'title'` and a
    `run_id`, fails on the CHECK constraints.
  - The title request is one `model_requests` row with `purpose = 'title'`, `run_id` NULL and
    its cost. Today's spend and the conversation total include it. The bot usage panel (UI-6.8)
    does not. `GET /usage?group_by=bot` shows it as "Conversation titles".
  - A title such as `<img src=x onerror=alert(1)>` or `**bold**` renders as literal text in the
    header and the rail tooltip (Vitest).
  - Journey J1 step 3 in Playwright: after the send, the rail tooltip shows the fake title.

- Reply feedback (D51), each with a named test: a rating on a complete bot message is stored
  with the message's `run_id` and `bot_id` and emits `message.feedback`; a second PUT replaces
  it; DELETE removes it; a rating on a human, streaming, failed or stopped message returns 409
  `feedback_not_allowed`; a note with a secret returns 422 `sensitive_data`; the message text
  and its `message.completed` payload do not change (invariant 22); a note with
  `<img src=x onerror=alert(1)>` renders as text (Vitest).

## Tests

Worker tests (claim exclusivity per conversation, lease expiry, max attempts); agent tests with
the fake model (prompt contents, provenance, cancel, tool faults); race tests from `architecture.md` §11
(two workers claiming one run, a second run racing into a conversation, a stale worker
writing after a reclaim, Stop racing finish, duplicate `client_id` sends in parallel), with the
claim cases in the queue contract suite; API tests for messages and stream replay;
auto title (D46): table tests for `decideAutoTitle` (every skip reason, mention order, the
earliest available active member, an unavailable first mention, a `pending_history` member,
lowest effort) and `cleanTitle` (quotes, Markdown
marks, two lines, control characters, 60-character cut at a word, empty), service and API tests
with the fake `_titles` script for each criterion above, and parallel tests for the claim and
for rename against the auto write;
Vitest for the reducer and message rendering (XSS corpus from `security.md` §3); Playwright as
above.

## Needs human review

The UI design in the plan (layout, components, states), approved before UI code is written
(`docs/workflow.md` §2; sketches in `docs/design/` are not specs).

Migrations; event emission points; worker concurrency; Markdown renderer configuration.

Reply feedback (D51): the `reply_feedback` table and its migration, the two
endpoints, the event, and the UI design of the buttons.

Auto title (D46, proposed): the new columns on `conversations` and the `model_requests` change
(`run_id` nullable, `purpose`, `conversation_id`); `title_source` in the conversation API; the
new variable `TITLE_REQUEST_TIMEOUT_SECONDS`.

## Open questions

None.
