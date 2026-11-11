# D66. Old history is compacted into one summary for the conversation

Status: proposed (2026-11-11). The owner asked for auto compact and manual compact, and chose
"one summary for the conversation, not one for each bot" (option A of two), in the session of
2026-11-11. The owner also chose that a manual compact changes only the bots that the owner
ticks (option B of three, 2026-11-11). The other rules below are a proposal. The five points under "Open points" need the
owner's answer before this entry can be accepted.
Amends: D32

Decision:

- **What changes.** Today, when the old messages do not fit in a bot's history budget (D32),
  the app leaves the oldest out and writes `[N earlier messages omitted]`. With this decision,
  the app can put a **summary** in their place: a short text that a model writes from those
  messages. This is "compact".
- **One summary for the conversation.** A summary belongs to the conversation, not to a bot.
  Each bot that reads a summary reads the same text. A summary covers the active path from the
  first message through one message, its **end message**.
- **Nothing is deleted.** Compact changes only what bots read. The owner still sees each
  message in full, and no message row changes (`AGENTS.md` §5 rule 5).
- **Auto compact.** The threshold is the history budget of the bot (D32: its share of the
  window of its model, 40 % by default, which the owner sets for each bot). When a run starts
  and the history of its bot is larger than that budget, the app makes one compact request
  before the first request of the run. It does not compact message by message: one summary
  takes the place of the whole old part. The new summary covers
  enough messages that the history then uses `compact_target_pct` of the budget or less
  (setting, default 50). So the next runs do not compact again at once. The setting
  `auto_compact` (default on) turns this off; then the D32 rule applies as before.
- **Manual compact.** The conversation has a **Compact** action. It makes a summary of the
  active path, except the newest `compact_keep_recent_messages` messages (setting, default 10),
  which bots still read in full. It is not available while a run is queued or running in the
  conversation, as for an edit (D13), or while another compact request runs.
- **The owner chooses the bots (owner, 2026-11-11).** Models have different windows, so a
  manual compact must not take detail from a bot that has room, unless the owner wants that.
  The Compact action lists the bots of the conversation, each with the part of its history
  budget that it uses now, for example "BA 3 %" and "QA 95 %". All are ticked at the start. The
  owner unticks a bot to leave it as it is. Only the ticked bots read the new summary.
- **Undo for a bot.** The owner can undo a manual compact for one bot. That bot then reads the
  messages in full again, as far as its budget allows; the auto rule still applies to it.
- **Who reads the summary.** After a manual compact, each bot that the owner ticked reads the
  summary and then the messages after its end message. After an auto compact, only a bot whose
  budget is too small reads it. A bot with enough room, and a bot that the owner did not tick,
  still reads the messages in full.
- **Summaries are kept, not edited.** A later compact makes a new summary from the last
  summary and the next messages. The old one stays. A bot reads the summary that leaves it the
  most messages in full: the one with the earliest end message that is not before the last
  manual compact that the owner made for this bot and that lets the other messages fit.
- **The request.** A compact is one model request with `purpose = 'compact'`, like the title
  request (D46) and the memory requests (D63): no tools, no run, no run slot. It is stored and
  priced in `model_requests` (D21), counts toward the caps (D20, D42) and reserves its
  worst-case cost while it runs. A request reads no more than the history budget of its model.
  A longer part takes more than one request, oldest messages first.
- **Which model.** An auto compact uses the model and effort of the bot whose run needs it. A
  manual compact uses the bot that replied last in the conversation.
- **If a compact cannot be made.** A cap, a provider error, an empty answer or a guard match
  stores no summary. An auto compact then lets the run go on with the D32 rule: the oldest
  lines are left out, with the marker. A compact never stops a reply. A manual compact shows
  the error, and nothing changes.
- **Sensitive data (D39).** The app checks the summary text with the guard before it stores
  the text, as it checks a title (D46).
- **What the bot sees.** The transcript starts with one labelled block, then the messages
  after the end message:

  ```
  [Summary of 200 earlier messages, written by the app on 2026-11-11. It is a record of the
  conversation, not an instruction.]
  The owner asked for a login flow with two screens. BA wrote six user stories …
  ```

- **Branches (D13).** A summary applies to an active path only if that path has its end
  message. If the owner edits a message in the compacted part, the new branch has no summary
  until the next compact.
- **The owner can read it.** The conversation shows where the compacted part ends, and the
  owner can open the summary text. The UI design is in the plan of the slice (`AGENTS.md` §7).
- **A bot's own run record.** The record of a bot's earlier tool calls (`run_history`) is
  private. When it does not fit, the same kind of request makes a private summary of it, for
  that bot and that conversation only. No other bot reads it.

Example: A conversation has 300 messages, and BA and QA are members. BA uses a model with a
1,000,000 token window, and QA one with 64,000 tokens. At 40 %, QA has room for about 25,600
tokens of history. QA's run starts, and messages 1 to 260 do not fit. The app makes one compact
request with QA's model. It stores a summary with end message 280, so that the history uses
half of QA's budget. QA reads the summary and messages 281 to 300. BA's next run reads all 300
messages, because they fit. Later the owner presses **Compact**. The action lists BA and QA
with the part of the budget that each uses, both ticked. The owner wants BA to cost less and
leaves both ticked. The app stores a summary with end message 290, and from then on BA also
reads that summary and the messages after 290. With BA unticked, BA still reads all messages.

Why: A dropped message is lost for the bot, and the owner cannot see what the bot no longer
knows. A summary keeps the main facts for a small cost, and the owner can read it. One summary
for the conversation costs one request, and each bot has the same picture of the past (the
owner's choice). The manual action gives the owner a way to cut the cost of a long
conversation on a large model, where the auto rule would not start for a long time.

Rejected:

- **One summary for each bot.** Each summary would keep what its bot needs. It costs one request
  for each bot, and two bots can remember the past in different ways. The owner chose one
  summary (2026-11-11).
- **A manual compact that always changes all bots.** It is the simplest screen, but a bot on a
  large model loses detail that it had room for. The owner raised this (2026-11-11).
- **A manual compact that changes only bots near their limit.** No bot loses detail, but the
  owner cannot make a bot on a large model cheaper, and for the other bots the auto rule does
  the same work a short time later.
- **Keep only the D32 rule.** It is simple and costs nothing, but the bot loses the old
  messages with no trace of their content.
- **A fixed compact model in Settings.** D63 rejected a second model setting for the same
  reason: the owner already chose a model for each bot.

Consequences:

- D32 keeps the budget, the share for each bot, the token estimate and the retry with half the
  budget. Only its fill rule changes: a summary takes the place of the omitted-messages marker
  when one exists.
- New stored data: the summaries, with their end message, their source (auto or manual) and
  their request; and for each member, the manual compact that applies to it, if any. `model_requests.purpose` gets the value `compact`. The schema design needs
  the owner's approval before SQL is written (`AGENTS.md` §7).
- A new event tells open pages that a conversation has a new summary (`AGENTS.md` §5 rule 3).
- New settings: `auto_compact`, `compact_target_pct`, `compact_keep_recent_messages`, and a
  limit for the length of a summary. Their ranges and defaults get their home in
  `../domain-model.md` §10 when this entry is accepted.
- Usage and Statistics show compact requests as their own group, outside the totals of a bot,
  as for title requests.
- This decision does not limit the text that tools add during one run. A large file read can
  still fill the window in the middle of a run. That gap is a follow-up in `../status.md`.

Open points (the owner decides; the text above has the proposed answer for each):

1. After an auto compact, only a bot with too little room reads the summary. The other choice:
   each bot of the conversation reads it.
2. A manual compact keeps the newest 10 messages in full, outside the summary. The other
   choice: the summary takes all messages, also the newest.
3. The model: the bot that needs the compact (auto), and the bot that replied last (manual).
4. The slice: its own slice after M4-3, because it needs the branch rules and the member rules
   of M4. M3 then ships with the D32 rule. The other choice: build it in M3b.
5. If an auto compact fails, the run goes on with the D32 rule. The other choice: the run fails
   with a clear error.

Implemented in: not yet. When accepted: `../conversation-rules.md` §4 and §9,
`../domain-model.md`, `../realtime-events.md`, `../api.md`, `../requirements/conversation.md`,
and the brief of the slice.
