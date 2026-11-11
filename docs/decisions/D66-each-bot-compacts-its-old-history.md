# D66. Each bot compacts its old history into a summary

Status: proposed (2026-11-11). The owner decided six things in the session of 2026-11-11:

1. The app gets auto compact and manual compact.
2. Each bot compacts itself: a bot has its own summary, written with its own model. The owner
   first chose one summary for the conversation, shared by the bots. After the advice of three
   consultants and a study of another app, the owner changed to this rule on the same day.
3. For a manual compact, the owner tells one bot to compact.
4. Compact is its own slice after M4-3.
5. A failed compact tells the owner what happened and offers a retry.
6. A compact request uses a low effort.

The other rules below are a proposal. Three consultants and a judge read the first text of this
entry, which had the shared summary (the arena record is in PR #102). The rules here keep their
advice where it still applies. No consultant has read this text. The points under "Open
points" need the owner's answer before the owner can accept this entry.
Amends: D32

Decision:

- **What changes.** Today, when the old messages do not fit in a bot's history budget (D32),
  the app leaves the oldest out and writes `[N earlier messages omitted]`. With this decision,
  the app can put a **summary** in their place: a short text that a model writes from those
  messages. This is "compact".
- **Each bot has its own summaries (owner, 2026-11-11).** A summary belongs to one bot in one
  conversation. That bot's model writes it, and only that bot reads it. It covers the messages
  that the bot can read on the active path, from the first one through one message, its **end
  message**. Each summary is a stored row that never changes.
- **A bot cannot see more through a summary.** A bot writes a summary only from messages that
  it may read (`history_from_seq`, D8). A summary applies only while the bot may read each
  message that it covers. So a bot that left and joined again "from here on" does not use its
  old summaries.
- **Nothing is deleted.** Compact changes only what that bot reads. The owner still sees each
  message in full, and no message row changes (`AGENTS.md` §5 rule 5).
- **Auto compact.** The threshold is the history budget of the bot (D32). That budget is a
  share of the window of its model: 40 % by default, and the owner sets it for each bot. A run
  starts, and the history of its bot is larger than that budget. The app then makes a compact
  before the first request of the run, as a part of that run. One summary takes the place of
  the whole old part. The new summary covers enough messages that the history then uses
  `compact_target_pct` of the budget or less (setting, default 50). So the next runs do not
  compact again at once. The setting `auto_compact` (default on) turns auto compact off; then
  the D32 rule applies as before. A manual compact still works with the setting off.
- **Manual compact (owner, 2026-11-11).** The owner tells one bot to compact, with a
  **Compact** action for that bot in the conversation. The action shows the part of its history
  budget that the bot uses now, for example "QA 95 %". It makes a summary of that bot's
  history, except the newest `compact_keep_recent_messages` messages (setting, default 10),
  which the bot still reads in full. The action is off when the bot has no more messages than
  that. No other bot changes.
- **What a bot reads.** A bot with no summary reads the messages, as today. A bot with a
  summary reads its newest summary that applies on the active path, and then the messages
  after the end message. The check counts all parts that share the history budget (D32): the
  summary, those messages, the bot's own run record, and the project instructions and goal. If
  they do not fit, the app makes a new compact (auto compact on) or uses the D32 rule. A bot
  does not use a summary that does not fit. The retry with half the budget (D32) makes no
  compact request.
- **Undo.** The owner can undo the compact of a bot. The bot then does not use the summaries
  that it has at that time. It reads the messages in full again, up to its budget, and the
  auto rule still applies to it.
- **Branches (D13).** A summary applies to an active path only if that path has its end
  message. After an edit, the new branch loses only the summaries whose end message is at or
  after the edited message. When the owner switches back, the summaries of that path apply
  again.
- **What a compact reads.** It reads the messages themselves when they fit in one request. If
  they do not fit, it starts from the bot's earliest summary on the same path that makes the
  input fit, and then reads the messages after it. This limits the loss of a summary that is
  made from a summary.
- **A long compact takes more than one request.** Each request reads no more than the history
  budget of the model, covers more messages than the one before, and stores its own summary. A
  failure keeps the summaries that are stored. The setting `compact_max_requests` limits the
  number of requests of one compact.
- **The request.** Each compact request is a model request with `purpose = 'compact'`, like the
  title request (D46) and the memory requests (D63): no tools and no run slot of its own. It
  uses the model of the bot and the lowest effort of that model (owner, 2026-11-11), as the
  title request does. It has no persona, no skills and no memory of the bot. It is stored and
  priced in `model_requests` (D21), counts toward the caps (D20, D42) and reserves its
  worst-case cost while it runs. A model with no known price follows the rule of the title
  request.
- **One compact at a time.** A conversation has at most one compact in flight; the database
  enforces it. A manual compact does not start while a run is queued or running in the
  conversation, as for an edit (D13). While a manual compact is in flight, the worker claims no
  run of that conversation, and the app saves no edit. An auto compact belongs to its run. Its
  requests show as steps of the run, and **Stop** stops the compact and stores nothing. A
  compact request has a time limit below `RUN_STALL_SECONDS`, so the stall rule
  (`../architecture.md` §6) does not fail the run. An answer that arrives after a Stop, a move
  to Trash or a newer try is not stored. A request that is open when the app starts is failed,
  and its reservation stays as cost (`../conversation-rules.md` §8 rule 11).
- **If a compact fails (owner, 2026-11-11).** A cap, a provider error, an empty answer, a
  guard match or a summary that does not fit stores no summary. The app tells the owner what
  happened and offers a retry. A notice in the conversation names the bot, the cause and the
  effect, and it has a **Retry** action. The notice is for the owner: bots do not read it.
  Example: "The history of QA was not compacted: the daily cap is reached. QA replied without
  the 260 oldest messages. Retry". Retry makes the same compact again for that bot. For an auto
  compact, the run does not wait for the owner: it goes on with the D32 rule, and the oldest
  lines are left out, with the marker. After a failed auto compact, the app does not try again
  by itself for the same messages; only Retry does. So a failure cannot cost money at each
  run. A failed manual compact shows the same kind of notice, and the bot does not change. The
  final texts are in the UI design of the slice.
- **Sensitive data (D39).** The app checks the summary text with the guard before it stores
  the text, as it checks a title (D46). For the input, see open point 2.
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

- **The owner can read it.** For each bot, the conversation shows where its compacted part
  ends, and the owner can open the summary text of that bot. The page shows it as Markdown
  with raw HTML off (`AGENTS.md` §5 rule 8). The UI design is in the plan of the slice
  (`AGENTS.md` §7).
- **The slice (owner, 2026-11-11).** Compact is its own slice after M4-3, because it needs the
  branch rules and the member rules of M4. M3 ships with the D32 rule.
- **Not in this decision.** A bot's own run record (`run_history`) gets no summary. The D32
  rule stays for it: `[N earlier runs of yours omitted]`. All three consultants advised to
  leave it out of the first slice.

Example: A conversation has 300 messages, and BA and QA are members with full history. BA uses
a model with a 1,000,000 token window, and QA one with 64,000 tokens. At 40 %, QA has room for
about 25,600 tokens of history. QA's run starts, and its history does not fit. The app makes a
compact with QA's model, as steps of that run. It stores a summary for QA with end message 280,
so that QA's history uses half of its budget. QA reads its summary and messages 281 to 300. BA
has no summary: its next run reads all 300 messages, because they fit. Later the owner wants
BA to cost less and presses **Compact** for BA. BA's model reads the messages and writes a
summary for BA with end message 290. From then on BA reads its summary and the messages after
290. QA does not change, and it never reads BA's summary.

Why: A dropped message is lost for the bot, and the owner cannot see what the bot no longer
knows. A summary keeps the main facts for a small cost, and the owner can read it. Each bot
has a different window, so each bot needs a compact at a different time; a summary for each
bot follows that with few rules. A bot can only put into its summary what it may read, so a
summary cannot show a bot hidden messages. On a large model, the auto rule does not start for
a long time. The manual action lets the owner cut the cost of a long conversation there.

Rejected:

- **One summary for the conversation, shared by the bots.** The owner chose it first
  (2026-11-11): one request, and one text to read. Three consultants then found that it needs
  many more rules: which bot reads which summary, which bot writes it, a tick for each bot in a
  manual compact, and a rule that keeps a "from here on" bot away from the text. A weak model
  could also write the text that all bots share. The app that the research note describes has
  no shared summary. The owner changed to one summary for each bot on the same day.
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
- Two bots in one conversation can remember the past in different ways, because each has its
  own summary. The owner can open each summary to see the difference.
- A conversation with several small bots costs one compact for each bot.
- New stored data: the summaries. Each has its bot, its end message, the summary that it
  started from (if one), its source (auto or manual) and its request. The schema design needs
  the owner's approval before SQL is written (`AGENTS.md` §7).
- `../domain-model.md`: `model_requests.purpose` gets the value `compact`, with a conversation
  (the CHECK of `conversation_id` in §7); the reservation rules of §13 name it; the purge
  policy of §16 gets an entry for the summaries, which hold conversation text.
- New events tell open pages that a bot has a new summary, or that a compact failed
  (`AGENTS.md` §5 rule 3). A summary and its event are written in one transaction.
- New settings: `auto_compact`, `compact_target_pct`, `compact_keep_recent_messages`,
  `compact_max_requests`, the time limit of a compact request and the limit for the length of
  a summary. Their ranges and defaults get their home in `../domain-model.md` §10 when the
  owner accepts this entry.
- `../requirements/product-brief.md` has a row "History summarisation: later", which asks for
  a state, a system line and a start by hand (`../research/chat-client-patterns.md` P10). That
  row changes when the owner accepts this entry.
- Usage and Statistics show compact requests as their own group, with the bot of each
  request, so that the owner sees which bot causes the cost.
- Fake-model tests can prove the order, the storage and the cost rules. They cannot prove that
  a real summary keeps the meaning. The slice needs a small set of long example conversations
  with facts that must stay, checked with a real model by hand, before `auto_compact` is on by
  default.
- This decision does not limit the text that tools add during one run. A large file read can
  still fill the window in the middle of a run. That gap is a follow-up in `../status.md`; the
  research note [context-guard-openmausbot.md](../research/context-guard-openmausbot.md) shows
  how another app closes it.

Open points (the owner decides; the text above has the proposed answer where one exists):

1. A manual compact keeps the newest 10 messages in full, outside the summary. All three
   consultants agree. The other choice: the summary takes all messages, also the newest.
2. Messages that the guard matched and that the owner sent with "Send anyway". The title
   request does not run for such a message (D46). Proposed: the app makes no compact of a part
   that has such a message, tells the owner why, and uses the D32 rule. The guard is
   security-sensitive code, so this is the owner's decision.
3. After a failed auto compact, the run goes on with the D32 rule while the notice offers
   Retry. All three consultants agree. The owner asked for the notice and the retry; that the
   run goes on is the proposal.
4. Two ideas from the research note that are not in the rules above. When the writer fails,
   the other app stores word-for-word pieces of the newest messages in place of a summary.
   It also uses the prompt size that the provider reports, not an estimate, to decide when to
   compact.

Implemented in: not yet. When accepted: `../conversation-rules.md` §4 and §9,
`../domain-model.md`, `../realtime-events.md`, `../api.md`, `../requirements/conversation.md`,
`../requirements/product-brief.md` and the brief of the slice.
