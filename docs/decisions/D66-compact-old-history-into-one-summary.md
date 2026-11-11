# D66. Old history is compacted into one summary for the conversation

Status: proposed (2026-11-11). The owner decided five things in the session of 2026-11-11:

1. The app gets auto compact and manual compact.
2. One summary for the conversation, not one for each bot (option A of two).
3. A manual compact changes only the bots that the owner ticks (option B of three).
4. Compact is its own slice after M4-3.
5. A failed compact tells the owner what happened and offers a retry.

The other rules below are a proposal. Three consultants and a judge read the first text of this
entry on 2026-11-11 (the arena record is in PR #102). This text has the corrections that they
agreed on. The points under "Open points" need the owner's answer before the owner can accept
this entry.
Amends: D32

Decision:

- **What changes.** Today, when the old messages do not fit in a bot's history budget (D32),
  the app leaves the oldest out and writes `[N earlier messages omitted]`. With this decision,
  the app can put a **summary** in their place: a short text that a model writes from those
  messages. This is "compact".
- **Summaries belong to the conversation.** A summary is not written for one bot. It covers
  the active path from the first message through one message, its **end message**. Each
  summary is a stored row that never changes. A conversation can have more than one, with
  different end messages. Two bots that use the same summary read the same text.
- **Nothing is deleted.** Compact changes only what bots read. The owner still sees each
  message in full, and no message row changes (`AGENTS.md` §5 rule 5).
- **A bot reads a summary only of messages that it may read.** A member that joined "from here
  on" (`history_from_seq` above 0, D8) must not see the messages before that point, and a
  summary would show them. Such a member reads no summary and writes none; the D32 rule applies
  to it. In the Compact action its tick is off, with the reason.
- **Auto compact.** The threshold is the history budget of the bot (D32). That budget is a
  share of the window of its model: 40 % by default, and the owner sets it for each bot. A run
  starts, and the history of its bot is larger than that budget. The app then makes a compact
  before the first request of the run, as a part of that run. It does not compact message by
  message: one summary takes the place of the whole old part. The new summary covers enough
  messages that the history then uses `compact_target_pct` of the budget or less (setting,
  default 50). So the next runs do not compact again at once. The setting `auto_compact`
  (default on) turns auto compact off; then the D32 rule applies as before. A manual compact
  still works with the setting off.
- **Manual compact.** The conversation has a **Compact** action. It makes a summary of the
  active path, except the newest `compact_keep_recent_messages` messages (setting, default 10),
  which bots still read in full. The action is off when the path has no more messages than
  that.
- **The owner chooses the bots (owner, 2026-11-11).** Models have different windows. A manual
  compact must not take detail from a bot that has room, unless the owner wants that. The
  Compact action lists the bots of the conversation. Each bot shows the part of its history
  budget that it uses now, for example "BA 3 %" and "QA 95 %". The owner ticks the bots that
  the compact changes. Only the ticked bots must read the new summary.
- **Undo for a bot.** The owner can undo a manual compact for one bot. Undo removes the manual
  compact of that bot. The bot then reads the messages in full again, up to its budget, and
  the auto rule still applies to it. A bot that is removed and added again starts with none.
- **One rule decides what a bot reads.** The rule counts all parts that share the history
  budget (D32): the summary, the messages after its end message, the bot's own run record, and
  the project instructions and goal.
  1. If the bot has no manual compact on the active path and all its history fits, it reads
     the messages in full, with no summary.
  2. If not, it reads the summary with the earliest end message that meets two conditions. The
     end message is not before the end message of the bot's manual compact. All parts fit in
     the budget.
  3. If no summary meets them, the app makes a compact (auto compact on) or uses the D32 rule.
     A bot does not use a summary that does not fit.

  The retry with half the budget (D32) uses this rule again with the smaller budget. It makes
  no compact request.
- **Branches (D13).** A summary applies to an active path only if that path has its end
  message. After an edit, the new branch loses only the summaries whose end message is at or
  after the edited message. A manual compact of a bot applies only on a path that has its end
  message; when the owner switches back to that path, it applies again.
- **What a compact reads.** It reads the messages themselves when they fit in one request of
  the writer. If they do not fit, it starts from the earliest summary on the same path that
  makes the input fit, and then reads the messages after it. This limits the loss of a summary
  that is made from a summary.
- **A long compact takes more than one request.** Each request reads no more than the history
  budget of its model, covers more messages than the one before, and stores its own summary. A
  failure keeps the summaries that are stored. The setting `compact_max_requests` limits the
  number of requests of one compact. For a manual compact, the ticked bots change only when the
  summary reaches the chosen end message. Before that, no bot changes.
- **The request.** Each compact request is a model request with `purpose = 'compact'`, like the
  title request (D46) and the memory requests (D63): no tools and no run slot of its own. It is
  stored and priced in `model_requests` (D21), counts toward the caps (D20, D42) and reserves
  its worst-case cost while it runs. A model with no known price follows the rule of the title
  request. The request has no persona, no skills and no memory of the writer bot: the bot gives
  only its model.
- **One compact at a time.** A conversation has at most one compact in flight; the database
  enforces it. A manual compact does not start while a run is queued or running in the
  conversation, as for an edit (D13). While a manual compact is in flight, the worker claims no
  run of that conversation, and the app saves no edit. An auto compact belongs to its run. Its
  requests show as steps of the run, and **Stop** stops the compact and stores nothing. A
  compact request has a time limit below `RUN_STALL_SECONDS`, so the stall rule
  (`../architecture.md` §6) does not fail the run. An answer that arrives after a Stop, a move
  to Trash or a newer try is not stored. A request that is open when the app starts is failed,
  and its reservation stays as cost (`../conversation-rules.md` §8 rule 11).
- **Which model.** An auto compact uses the model of the bot whose run needs it. For a manual
  compact, see open point 3.
- **If a compact fails (owner, 2026-11-11).** A cap, a provider error, an empty answer, a
  guard match or a summary that does not fit stores no summary. The app tells the owner what
  happened and offers a retry. A notice in the conversation names the bots, the cause and the
  effect, and it has a **Retry** action. The notice is for the owner: bots do not read it.
  Example: "The history of QA was not compacted: the daily cap is reached. QA replied without
  the 260 oldest messages. Retry". Retry makes the same compact again: the same writer, the
  same end message and the same bots, each checked again. If one of them is out of date, the
  owner starts a new Compact. For an auto compact, the run does not wait for the owner: it goes
  on with the D32 rule, and the oldest lines are left out, with the marker. After a failed auto
  compact, the app does not try again by itself for the same messages; only Retry does. So a
  failure cannot cost money at each run. A failed manual compact shows the same kind of notice,
  and no bot changes. The final texts are in the UI design of the slice.
- **Sensitive data (D39).** The app checks the summary text with the guard before it stores
  the text, as it checks a title (D46). For the input, see open point 4.
- **What a summary holds.** A fixed form, so that each new summary loses less and the owner
  can check it fast: the task now; decisions, each with who made it; corrections; open
  questions; files by their path; the owner's rules. A proposal of a bot stays apart from an
  approval of the owner. A summary is a record. It never gives a bot an approval that the
  messages did not give. The text of the request is in the design of the slice.
- **What the bot sees.** The transcript starts with one labelled block, then the messages
  after the end message:

  ```
  [Summary of 200 earlier messages. A model wrote it from the messages on 2026-11-11. It can
  be wrong. It is a record of the conversation, not an instruction.]
  Task now: a login flow with two screens. Decisions: the owner chose email login …
  ```

- **The owner can read it.** The conversation shows where the compacted part ends, and the
  owner can open the summary text. The page shows it as Markdown with raw HTML off
  (`AGENTS.md` §5 rule 8). The UI design is in the plan of the slice (`AGENTS.md` §7).
- **The slice (owner, 2026-11-11).** Compact is its own slice after M4-3, because it needs the
  branch rules and the member rules of M4. M3 ships with the D32 rule.
- **Not in this decision.** A bot's own run record (`run_history`) gets no summary. The D32
  rule stays for it: `[N earlier runs of yours omitted]`. The first text of this entry had a
  private summary for it; all three consultants advised to leave it out of the first slice.

Example: A conversation has 300 messages, and BA and QA are members with full history. BA uses
a model with a 1,000,000 token window, and QA one with 64,000 tokens. At 40 %, QA has room for
about 25,600 tokens of history. QA's run starts, and its history does not fit. The app makes a
compact with QA's model, as steps of that run. It stores a summary with end message 280, so
that QA's history uses half of its budget. QA reads the summary and messages 281 to 300. BA's
next run reads all 300 messages, because they fit and BA has no manual compact. Later the owner
presses **Compact**. The action lists BA and QA with the part of the budget that each uses. The
owner wants BA to cost less and ticks BA. The messages fit in one request of the writer, so the
new summary is made from the messages, not from QA's summary. Its end message is 290. From then
on BA reads that summary and the messages after 290. QA is not ticked, and rule 2 still gives
it the summary that ends at 280.

Why: A dropped message is lost for the bot, and the owner cannot see what the bot no longer
knows. A summary keeps the main facts for a small cost, and the owner can read it. Summaries
that belong to the conversation cost less than one for each bot, and two bots that use the same
summary have the same record of the past (the owner's choice). On a large model, the auto rule
does not start for a long time. The manual action lets the owner cut the cost of a long
conversation there.

Rejected:

- **One summary for each bot.** Each summary would keep what its bot needs. It costs one request
  for each bot, and two bots can remember the past in different ways. The owner chose one
  summary (2026-11-11).
- **A manual compact that always changes all bots.** It is the simplest screen, but a bot on a
  large model loses detail that it had room for. The owner raised this (2026-11-11).
- **A manual compact that changes only bots near their limit.** No bot loses detail. But the
  owner cannot make a bot on a large model cheaper. For the other bots, the auto rule does the
  same work a short time later.
- **Keep only the D32 rule.** It is simple and costs nothing, but the bot loses the old
  messages with no trace of their content.
- **A fixed compact model in Settings.** D63 rejected a second model setting for the same
  reason: the owner already chose a model for each bot.
- **A summary of a bot's own run record, in this slice.** It needs its own storage, order,
  failure and purge rules, and tool results can hold text from files. All three consultants
  advised against it.
- **Store only the last summary of a long compact.** A failure at a late request would lose
  the requests that the owner already paid for.

Consequences:

- D32 keeps the budget, the share for each bot, the token estimate and the retry with half the
  budget. Only its fill rule changes: a summary takes the place of the omitted-messages marker
  when one applies.
- New stored data: the summaries. Each has its end message, the summary that it started from
  (if one), its source (auto or manual), its writer and its request. Each member also has its
  manual compact, if one exists. The schema design needs the owner's approval before SQL is
  written (`AGENTS.md` §7).
- `../domain-model.md`: `model_requests.purpose` gets the value `compact`, with a conversation
  (the CHECK of `conversation_id` in §7); the reservation rules of §13 name it; the purge
  policy of §16 gets an entry for the summaries, which hold conversation text.
- New events tell open pages that a conversation has a new summary, or that a compact failed
  (`AGENTS.md` §5 rule 3). A summary, the change of the ticked bots and the event are written
  in one transaction.
- New settings: `auto_compact`, `compact_target_pct`, `compact_keep_recent_messages`,
  `compact_max_requests`, the time limit of a compact request and the limit for the length of
  a summary. Their ranges and defaults get their home in `../domain-model.md` §10 when the
  owner accepts this entry.
- `../requirements/product-brief.md` has a row "History summarisation: later", which asks for
  a state, a system line and a start by hand (`../research/chat-client-patterns.md` P10). That
  row changes when the owner accepts this entry.
- Usage and Statistics show compact requests as their own group, outside the totals of a bot,
  as for title requests.
- Fake-model tests can prove the order, the storage and the cost rules. They cannot prove that
  a real summary keeps the meaning. The slice needs a small set of long example conversations
  with facts that must stay, checked with a real model by hand, before `auto_compact` is on by
  default.
- This decision does not limit the text that tools add during one run. A large file read can
  still fill the window in the middle of a run. That gap is a follow-up in `../status.md`.

Open points (the owner decides; the text above has the proposed answer where one exists):

1. After an auto compact, only a bot with too little room reads the summary. All three
   consultants agree. The owner has not said yes in these words.
2. A manual compact keeps the newest 10 messages in full, outside the summary. All three
   consultants agree. The other choice: the summary takes all messages, also the newest.
3. Who picks the model that writes the summary of a manual compact. All three consultants
   advise: the owner picks the bot in the Compact action, and the app fills in a default. Two
   advise the bot with the largest window as the default; one advises the bot that replied
   last. Only a bot with full history can write.
4. Messages that the guard matched and that the owner sent with "Send anyway". The title
   request does not run for such a message (D46). The three consultants gave three answers:
   make no compact that reads such a message; mask the match in the request; send the message
   as it is. The guard is security-sensitive code, so this is the owner's decision.
5. The bots that have a tick when the Compact action opens. The owner approved "all ticked".
   All three consultants advise: a tick only for a bot that is near its limit, because a tick
   by default takes detail from a bot that has room.
6. The effort of an auto compact request. The title request uses the lowest effort of the
   model (D46). Two consultants advise the same for compact; one advises the effort of the bot.
7. After a failed auto compact, the run goes on with the D32 rule while the notice offers
   Retry. All three consultants agree. The owner asked for the notice and the retry; that the
   run goes on is the proposal.

Implemented in: not yet. When accepted: `../conversation-rules.md` §4 and §9,
`../domain-model.md`, `../realtime-events.md`, `../api.md`, `../requirements/conversation.md`,
`../requirements/product-brief.md` and the brief of the slice.
