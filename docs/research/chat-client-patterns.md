# Research: patterns from established chat clients

Status: research notes, not a spec. Decisions on the proposals are in §4; the owning documents
were updated in the same PR. Behaviour only: no third-party code, assets or internal names are copied, and the products
studied are not named.

Date: 2026-10-21. Method: passive study of a widely used web chat client
(public pages and client behaviour). No actions were recorded.

Limits: no behaviour was confirmed at runtime; timings are as found, not measured.

## 1. Observations: the chat client

| # | Topic | Behaviour |
| --- | --- | --- |
| O1 | Send state | Every local message has a state: sending, sent, or send failed, matched to the server copy by a client nonce. |
| O2 | Failure keeps order | When one send fails, every queued send in that channel is marked failed too. Later messages never arrive before an earlier failed one. |
| O3 | "Thinking" has a deadline | A pending bot reply is shown as "thinking" and becomes "timed out" after 15 minutes. The client does not wait for ever. |
| O4 | Typing | "Typing" entries expire 10 s after the last ping; the client re-pings at most every 8 s and delays the first ping by 1.5 s. Sending a message clears it. |
| O5 | Reply ≠ mention | A reply records which message it answers; whether the author of that message is notified is a separate switch. |
| O6 | Edit keeps the ping choice | An edit never adds a notification that the first send did not have. |
| O7 | Edit is a local draft | The edit draft lives on the client; only the save goes to the server. |
| O8 | Reactions | One generic reaction model keyed by (emoji, type), applied optimistically. Poll votes reuse it. |
| O9 | Threads | A thread starts from one message. When some mentions cannot reach people, the message is still sent and the miss is flagged. |
| O10 | List items | The message list mixes message groups with time dividers and a "new messages" divider at the first unread message. |
| O11 | Bots taking turns | No client code coordinates several bots; that is left to the bots and to server rate limits. Our D3, D4 and D11 do it on the server. |
| O12 | Typing text | Names 1–3 typers, then a generic "several people" text (also when names do not fit). The text is in a polite live region. |

## 2. Observations: patterns in an AI-agent chat UI

Seen in an AI-agent chat client. Described as generic patterns.

| # | Topic | Pattern |
| --- | --- | --- |
| A1 | Working indicator | The indicator carries elapsed time and a short text, not only a spinner. Updates carry a sequence number per session; an older one is ignored, so late packets cannot move it backwards. |
| A2 | Long chats | Old context is summarised on the server, shown to the user as a "compacting" state; the user can also start it by hand. |
| A3 | Message while the agent works | Each user message gets a disposition: queued, folded into the running turn, restarting, or answered. Queued messages can be acted on; the running turn can be interrupted. |
| A4 | Side replies | A short acknowledgement answers one user message without starting a main turn. |
| A5 | Agent reactions | The agent can react to a user message (like our status reactions, UI-3.18). |
| A6 | Turn parts | Plans, to-dos and clarifying questions are structured cards, not free text. |
| A7 | Checkpoints | Project state is pinned after each turn; the user can restore an earlier one. |
| A8 | Secrets | Keys are asked for in a dedicated form, never through the chat text. |
| A9 | Usage | Token usage per turn and in total; cache hit share = cache reads ÷ (input + cache writes + cache reads). |
| A10 | Reconnect | Events that arrive before the history snapshot are buffered and applied after it. On disconnect, thinking/compacting/saving states are cleared so nothing spins for ever. |
| A11 | Errors | A failed turn appends a terminal error step with where it failed (connection, agent, build) and a code. |

## 3. Where our spec already matches

- Mentions as structured ids, not text (`../conversation-rules.md` §1).
- Optimistic human messages matched by `client_id` (`../realtime-events.md` §3), as in O1.
- Status reactions derived from run state (UI-3.18/19), as in O8 and A5.
- Turn-taking on the server (O11); secrets only from env, never in chat (A8).
- Usage per run (D21), as in A9.

## 4. Proposals and decisions

| # | Proposal | Decision | Where |
| --- | --- | --- | --- |
| P1 | Human message whose POST fails: "Not sent" with Retry/Delete; later unsent messages fail too (O2). | Accepted, plus server-side dedupe: a repeated `client_id` returns the original message. | UI-3.20, `../api.md`, `../domain-model.md` |
| P2 | Stall timeout for a run that makes no progress (O3). | Accepted, plus a read timeout per model request. | `../architecture.md` §4, §6 |
| P3 | Two live states: typing (deltas) and working: <step> (between deltas) (O4). | Accepted. | UI-3.4 |
| P4 | Reply to a specific message, separate from mentions (O5). | Deferred to after M5. | `../requirements/product-brief.md` |
| P5 | An edit routes only the mentions in the edited text (O6). | Accepted. | `../conversation-rules.md` §6 |
| P6 | Keep rejecting a message with an invalid mention (O9 is the alternative). | No change; recorded so it is not re-argued. | — |
| P7 | "New" divider at the first unread message (O10), using `last_read_seq`. | Accepted; also fills a gap (the read position had no column). | UI-3.10, `../domain-model.md` |
| P8 | Elapsed time on the working state (A1). | Accepted. | UI-3.5, UI-3.19 |
| P9 | Disposition on each human message, and Cancel for a queued run (A3). No "steer" (D11). | Accepted. | UI-3.21, `../api.md` |
| P10 | Summarisation shown as a state, startable by hand (A2). | Recorded for the summarisation milestone. | `../requirements/product-brief.md` |
| P11 | Structured question cards from bots (A6). | Later. | `../requirements/product-brief.md` |
| P12 | Clear live indicators on disconnect (A10). | Accepted. | `../realtime-events.md` §3 |
| P13 | Typing text for several bots (O12). | Not needed: D11 allows one running bot per conversation; queued bots are listed (UI-3.4). | — |

## 5. Not answered

- Runtime confirmation of the timings in O3/O4.
- The message grouping window (time before a new author header).
