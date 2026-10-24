# Bot status

> **Status: agreed in the M2 Bots UI design review, round 9 (2026-10-23), step 2f.** Preview:
> `../previews/command-dark/bot-status.png` (and `.html`). Standard: every place that shows a bot
> state uses this table: the avatar badge (`bot-avatar.md` §3), the header bot card
> (`bot-card.md` §2), the Bots page card (`bots-page.md`), the bot list and the Flow pane.

## 1. Colour rule

- **Amber (`primary`) means "you must act".** Only *Waiting for you* uses it.
- **Red (`danger`) means a problem:** last run failed, paused at the cap, cannot run.
- **Running** uses the normal text colour with a spinner in the bot colour. Work goes on, and
  the owner has nothing to do.
- **Grey (`on-surface-muted`)** is quiet: idle, queued, waiting for another bot.

## 2. States

| State | Words | Icon (badge) | Colour | A click opens |
| --- | --- | --- | --- | --- |
| Waiting for you | Waiting for you · {conversation} | Amber "?" | `primary` | The conversation at the question |
| Last run failed | Last run failed · {conversation} | Red "!" | `danger` | The message that explains the failure |
| Paused at the cap | Paused · daily cap | Red square | `danger` | Settings → Limits (D20, D40) |
| Running | Running · {conversation} | Spinner, bot colour | `on-surface` | The conversation |
| Queued | Queued · {conversation} | Clock | `on-surface-muted` | The conversation (D11) |
| Waiting for a bot | Waiting for {bot} · {conversation} | Hourglass | `on-surface-muted` | The conversation where it waits for the handoff answer |
| Idle | Idle · last active {time} / Idle · no activity yet | Grey dot (no badge on the avatar) | `on-surface-muted` | Nothing |

{time} follows `time-format.md`. A status that names a conversation is a link to it. Failure
text is a short reason, never the raw error.

**Cannot run** is not a run state. It is a health line above the status, in `danger`, with a red
"!" badge: "Cannot run: no API key" or "Cannot run: model removed" (`bots-page.md` §4).

## 3. A bot in more than one conversation

A bot runs one at a time in each conversation (D11), but it can run in several conversations at
the same time. Each place shows **one** status: the most urgent one, in this order:

1. Waiting for you
2. Last run failed
3. Paused · daily cap
4. Running
5. Queued
6. Waiting for a bot

The avatar badge follows the same order.

| Case | Status line |
| --- | --- |
| Running in 3 conversations, nothing more urgent | "Running in 3 conversations" |
| Waiting for you in A, running in B and C | "Waiting for you · A", then "Also running in 2 more conversations" |

A click on the status opens a small card that lists every conversation with its state and
project. A click on a row opens that conversation. The header shows the state in the **open**
conversation only (`top-header.md` state 6).
