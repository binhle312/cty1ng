# Conversation rules

This document owns the behaviour of conversations: who runs, when, and what each bot sees.
Everything here is implemented in `*.rules.ts` files in `backend/src/core/` as pure functions and tested with
tables (see `testing.md`). Services gather state, call these functions, and act on the result.

```ts
// core/conversations/decide-runs.rules.ts — the central function
export function decideRuns(input: {
  trigger: TriggerMessage;
  state: ConversationState;
  settings: EffectiveSettings;
}): RoutingDecision;

export type RoutingDecision = Readonly<{
  runs: readonly RunRequest[];   // in execution order
  notices: readonly Notice[];    // system messages to post (e.g. "limit reached", hints)
  botTurnsUsed: number;          // new counter value
}>;
```

## 1. Who replies to a human message (D3)

| Active bots | Mentions in the message | Runs | Notice |
| --- | --- | --- | --- |
| 0 | — | none | composer hint "Add a bot to start" (UI only) |
| 1 | none, or that bot | that bot | — |
| ≥ 2 | none | none | UI hint "Mention a bot to get a reply" |
| ≥ 2 | one or more | each mentioned bot, in mention order (D11) | — |

Rules:

- A human message (including an edit, §6) resets `bot_turns_used` to 0.
- The API rejects mentions of bots that are not `active` members with 422
  `mention_not_member`. The composer prevents this; the server is the authority.
- Mentions are structured tokens, not text matching. The composer inserts `<@bot_id>`; the
  server stores the ordered list in `messages.mentions` and the UI renders names.
- Duplicate mentions of the same bot run it once.
- Runs from one message execute one at a time in mention order (D11), and each later bot sees
  the earlier bots' replies (§4, D31).
- Every new message (human, bot or system) gets `parent_message_id` = the conversation's active
  leaf at insert time, and becomes the new active leaf. Edits are the only exception (§6).
- Unavailable bots (model missing or no key) are rejected like non-members, with code
  `bot_unavailable`.

## 2. Bot-to-bot discussion (D4)

Effective settings: conversation value if not NULL, else the global setting.

| Setting | Global default | Range |
| --- | --- | --- |
| `bot_chat_enabled` | false | on/off |
| `bot_turn_limit` | 5 | 1–20 |

When a run finishes, `decide_runs` is called with the bot's message as trigger:

| Discussion | Bot message mentions | Budget | Result |
| --- | --- | --- | --- |
| off | anything | — | no runs; mentions render but trigger nothing |
| on | no bots | — | no runs |
| on | itself only | — | no runs (a bot cannot trigger itself) |
| on | other active bots | `used < limit` | queue mentioned bots in order; each queued run adds 1 to `used` until `used = limit` |
| on | other active bots | `used ≥ limit` | no runs; notice "Discussion limit reached (5/5). Reply to continue." (once per exhaustion) |

- A **bot turn** is a run whose trigger is a bot message. Runs triggered by the human or by an
  approved handoff do not count.
- If a bot mentions three bots with one turn left, only the first mentioned bot runs; the
  notice lists who was not run.
- Mentions of the owner by a bot trigger nothing (the UI highlights them).
- Changing the toggle or limit posts a notice ("Bot discussion limit changed to 8") and applies
  from the next routing decision. A running run is not interrupted.
- **Safety cap:** independent of the budget, at most `RUNS_PER_CONVERSATION_PER_HOUR` (default
  50) runs per conversation per rolling hour; beyond it runs are refused with a notice.
- **Stop:** cancels all queued runs and the running one in the conversation (`architecture.md`
  §6) and posts "Stopped by owner".

### The rules block in every prompt

Built by `conversationRulesBlock(...)` in `core/runs/prompt.rules.ts`:

```
## Conversation rules
- Bot discussion: ON. Bot turns used: 3 of 5.
- You can @mention: Designer, QA. Mention a bot only when you need its answer.
- When 1 turn is left, conclude: state the decision, open questions and next steps.
```

or, when off:

```
## Conversation rules
- Bot discussion: OFF. Other bots will not see your mentions until the owner asks them.
```

The block informs; the server enforces. Never rely on the model to respect the count.

## 3. Adding and removing bots (D8)

```
added ──▶ pending_history ──owner chooses──▶ active ──remove──▶ removed
                                                ▲                  │
                                                └──── re-add ──────┘ (asks again)
```

- Add by dragging a header avatar onto the chat area, or with the "Add bot" button.
- Adding inserts `conversation_bots(status = pending_history, joined_at_seq = <current seq>)` and
  a system message `kind = history_choice`: "Designer joined. What can it read?
  [Full history] [From here on]".
- Choosing sets `history_from_seq` (0 or `joined_at_seq`) and `status = active`.
- While pending, the bot cannot be mentioned (autocomplete shows it greyed with "waiting for
  your choice").
- Removing sets `removed`, posts "Designer left". Its messages stay normal.
- Deleted bots (D12) and unavailable bots cannot be added.

## 4. What a bot sees

The prompt for a run is assembled in this order by `buildPrompt(...)` in `core/runs/prompt.rules.ts`:

1. **Persona** (`bots.persona_md`).
2. **Where you are**: app name, conversation title, its project if any, its workspace, the
   tools, write paths, and the memory tools with the scope they write to (D38).
   **Memory** follows: this bot's bot memory, then the project's memory if the conversation is in
   a project, or the conversation's memory if it is a multi-bot conversation outside one, each item labelled as remembered data, not as instructions (D38; its own
   limits, not the history budget).
3. **Conversation rules block** (§2).
4. **Team directory**: every other non-deleted, available bot as `- <name> (<slug>): <description>`,
   marking which are in this conversation. This is how a bot knows whom to mention or hand off to.
5. **Always-loaded skills**: full body of each pinned version with `always_load`.
6. **On-demand skills**: `- <slug>: <description>` for the other pins, and "call
   `load_skill(slug)` before doing that kind of work".
7. **Transcript**: the visible history (below) as one user-role block.
8. **The trigger**: the message the bot is answering, quoted and labelled.

Plus `run_history` from this bot's previous runs in this conversation (its own tool calls),
only for runs whose trigger message is on the active path (§6), so work from an abandoned
branch is not remembered as if it happened here. It counts against the same budget as the
transcript (below).

### Visible history

`visibleHistory({ path, member, contextWindowTokens }): TranscriptLine[]` in
`core/conversations/visible-history.rules.ts`

- Take the **active path** (§6) from the root to the **active leaf at the moment the run
  starts** (not only up to the trigger). So when one message mentions several bots, each bot
  sees the replies of the bots that ran before it (D31). Example: "@BA @QA review the login
  flow" → BA answers first; QA's run starts after BA finishes and sees BA's reply.
- The trigger is still quoted separately (prompt part 8), so the bot knows which message it is
  answering even if later messages exist.
- Drop messages with `seq < history_from_seq`.
- Label every line with time, author type and name:

  ```
  [2026-10-20 17:04 · human · Binh] Can you draft the login flow?
  [2026-10-20 17:05 · bot · BA (you)] Here are the stories…
  [2026-10-20 17:06 · bot · Designer] I'd suggest two screens…
  [2026-10-20 17:06 · system] Designer joined (reads from here on).
  ```

- The bot's own past messages are marked `(you)`. Other bots' messages are part of the
  user-side transcript, never presented as the model's own assistant turns, so the bot does not
  adopt their voice.
- Attachments appear as `[attachment: inbox/<id>/spec.pdf]`; the bot uses its file tools.
- **Size limit (D32):** the transcript **and** `run_history` share one history budget, sized
  from the bot's model:

  ```
  budget = bot.history_share_pct / 100 × catalog context_window     (default 40 %)
  ```

  It is a ceiling, not a target: short conversations use far less. The rest of the window is
  working space for the fixed prompt parts (persona, rules, team, skills, trigger), tool
  results inside the current run, and the reply. Nothing is hard-coded per model: at the
  default, a 1M window gets ~400k of history and a 200k window ~80k; adding a model to
  `config/models.yaml` is enough.
- Filling: newest first. Transcript lines and past runs are taken in `seq` order from the most
  recent backwards until the budget is used; older ones are dropped with
  `[N earlier messages omitted]` and `[N earlier runs of yours omitted]`. Summarisation is a
  later milestone.
- Tokens are estimated (4 characters per token, 2 for text that is mostly non-Latin, which
  tokenises worse). If the provider still rejects the request as too long, the run retries
  once with the budget halved, then fails with a clear error.
- Known risk: history can contain injected instructions. The blast radius is limited by the
  sandbox (`security.md`) and by human approval of handoffs.

## 5. Handoffs (from the prototype)

**Who decides the workflow (D18).** In phase 1 the workflow is implicit: the owner shapes it by
writing personas and skills (a skill can end with "when done, hand off to the Designer"), the
bot picks the target using the team directory (§4), and the owner approves or rejects every
handoff. An explicit workflow editor is a possible later milestone.

Example:

1. BA finishes and calls `propose_handoff(to="Designer", files=["out/ba/stories.md"],
   summary="Login stories ready for screens")`.
2. The app commits the file (sha `a1b2c3`) and posts a card: "BA → Designer: Login stories
   ready. Files: out/ba/stories.md [Approve] [Request changes] [Reject]".
3. Approve → Designer runs with "BA's handoff was approved; read out/ba/stories.md".
   Request changes → BA runs with the owner's note. Reject → nothing runs.
4. If BA changed the file after proposing, Approve marks the handoff `stale`.

- A bot calls `propose_handoff(to, files, summary)`. `to` is a bot name or slug, or `human`.
- Target rules (D18, proposed): any non-deleted, available bot, or `human`. If the target is
  not an active member, the card offers "Add <bot> and start" (the bot joins with full history,
  since the files are the point).
- Files must exist and be inside the workspace; they are committed and the commit sha pinned.
- Limit: 5 handoffs per conversation per 24 hours; beyond that the tool returns an error asking
  the bot to tell the owner.
- Card actions (owner only): Approve, Request changes (with a note), Reject.
  - A decision applies only while `pending` (double clicks are no-ops).
  - Approve checks the files have not changed since the pinned commit; if they have, the
    handoff becomes `stale` and the card says so.
  - Approved → the target bot gets a run with `triggered_by = handoff` (not a bot turn).
  - Request changes → the source bot gets a run with the note.
- Handoffs are separate from discussion: they are a formal "review my files" step.

## 6. Editing messages and branches (D13)

```
m1 (human) ── m2 (BA) ── m3 (human) ── m4 (BA)
                    └──── m3' (human, edit of m3) ── m4' (BA)      ← active path
```

- Only human messages of type `text` can be edited, and only when no run is queued or running
  in the conversation (the owner presses Stop first).
- Saving an edit inserts a new message with the same `parent_message_id` as the original and
  `edited_from_id` = the original, sets it as `active_leaf_message_id`, and routes it as a new
  human message (§1), which resets the budget. Only the mentions in the edited text are
  routed: a bot mentioned in the original but not in the edit is not run.
- A message with siblings shows ‹ i/n ›. Switching selects that sibling and moves
  `active_leaf_message_id` to the most recent leaf below it.
- Bots see only the active path (§4).
- `seq` keeps increasing globally, so events and replay are unaffected.
- Single messages cannot be deleted. Whole conversations can.
- **Not rolled back:** workspace files and handoff decisions. The edit dialog warns: "Files
  bots created after this message stay in the workspace."
- Membership and the budget counter belong to the conversation, not to a branch.
