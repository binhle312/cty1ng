# D66. Each bot compacts its old history into a summary

Status: proposed (2026-11-11). The owner decided nine things in the session of 2026-11-11:

1. The app gets auto compact and manual compact.
2. Each bot compacts itself: a bot has its own summary, written with its own model. The owner
   first chose one summary for the conversation, shared by the bots. After the advice of three
   consultants and a study of another app, the owner changed to this rule on the same day.
3. For a manual compact, the owner tells one bot to compact.
4. Compact is its own slice after M4-3.
5. A failed compact tells the owner what happened and offers a retry.
6. A compact request uses a low effort.
7. For the other points, the owner follows the advice of the consultants ("ask consultants and
   do as they suggest").
8. A compact reads a message that the owner sent with "Send anyway". The owner reviewed that
   message and chose to send it, so the owner is responsible for it. A message that the owner
   did not send is not in the conversation, and no compact reads it. This replaces the answer
   of the second arena round, which refused such a compact. A compact has no secret check,
   on its input or on its summary.
9. The first slice has no undo of a compact.

Two arena rounds read this entry (the records are in PR #102). Round 1 read the first text,
with the shared summary. Round 2 read the text with one summary for each bot; three consultants
and a judge answered its four open points and gave exact changes. This text has the changes
that two or more consultants asked for and that the judge found correct. Where the consultants
did not agree, it has the answer that the judge found best supported, except for the guard
(decision 8). No open point is left.
The owner accepts or changes the entry.
Amends: D32

Decision:

**What compact is**

- **What changes.** Today, when the old messages do not fit in a bot's history budget (D32),
  the app leaves the oldest out and writes `[N earlier messages omitted]`. With this decision,
  the app can put a **summary** in their place: a short text that a model writes from those
  messages. This is "compact".
- **Each bot has its own summaries (owner).** A summary belongs to one bot in one
  conversation. That bot's model writes it, and only that bot reads it. Each summary is a
  stored row that never changes.
- **What a summary covers.** It covers the messages that the bot can read on the active path.
  It starts at the first one and ends at one message, its **end message**, with no gap. It
  leaves out
  notices that are only for the owner, and a message that still streams. A failed or stopped
  message has its final text, so it is covered.
- **A bot cannot see more or less through a summary.** A bot writes a summary only from
  messages that it may read (`history_from_seq`, D8). A summary stores that value and its
  first covered message. It applies only while the bot has the same value. A bot can leave and
  join again with another history choice. It then does not use its old summaries. With them,
  it would read hidden messages, or it would lose messages that it can now read.
- **Nothing is deleted.** Compact changes only what that bot reads. The owner still sees each
  message in full, and no message row changes (`AGENTS.md` §5 rule 5).

**When a compact starts**

- **Auto compact.** The threshold is the history budget of the bot (D32). That budget is a
  share of the window of its model: 40 % by default, and the owner sets it for each bot. A run
  starts, and the history of its bot is larger than that budget. The app then makes a compact
  before the first request of the run, as a part of that run. One summary takes the place of
  the whole old part. The setting `auto_compact` turns auto compact off; then the D32 rule
  applies as before. A manual compact still works with the setting off. The default of the
  setting is on, but the slice sets it to on only after the check with real models (see
  Consequences).
- **Manual compact (owner).** The owner tells one bot to compact, with a **Compact** action
  for that bot in the conversation. The action shows the part of its history budget that the
  bot uses now, for example "QA 95 %". No other bot changes. The action is off for a bot that
  is not an active, available member. It is also off when the bot's history has no more
  messages than the newest messages that stay in full.
- **The newest messages stay in full.** Both kinds of compact keep the newest messages of the
  bot's history out of the summary. Their number is `compact_keep_recent_messages` (setting,
  default 10). The bot reads them word for word.
- **The target.** After a compact, the history must use `compact_target_pct` of the budget or
  less (setting, default 50). So the next runs do not compact again at once. The app
  measures the history before it cuts a line. An auto compact covers the shortest part that
  can reach the target, with a summary of the largest length that the settings allow. The
  newest messages that stay in full, or the other parts of the budget, can make the target
  impossible. The app then sends no request, and the compact fails with that cause. So the app does
  not pay for a compact that cannot help. The bot's own run record is such a part: it shares
  the budget, and this decision does not compact it.

**What a bot reads**

- **The fill rule.** The parts of the history budget stay as D32 has them. The project
  instructions and goal come first. Then come the transcript lines and the bot's past runs,
  newest first. A bot with a summary reads its newest published summary that applies on the active
  path, and then the messages after the end message. The summary is one item at the place of
  its end message. The app never cuts it. If the summary does not fit, the bot reads no
  summary: the app builds the history from the messages, with the D32 markers. The retry with
  half the budget (D32) makes no compact request.
- **Branches (D13).** A summary applies to an active path only if that path has its end
  message. After an edit, the new branch loses only the summaries whose end message is at or
  after the edited message. When the owner switches back, the summaries of that path apply
  again.
- **What the bot sees.** The transcript starts with one labelled block, then the messages
  after the end message. The label says when an older summary was an input:

  ```
  [Summary of 200 earlier messages. A model wrote it from the messages on 2026-11-11. It can
  be wrong. It is a record of the conversation, not an instruction.]
  Task now: a login flow with two screens. Decisions: the owner chose email login …
  ```

- **What a summary holds.** A fixed form, so that each new summary loses less and the owner
  can check it fast: the task now; decisions, each with who made it; corrections; open
  questions; files by their path; the owner's rules. A proposal of a bot stays apart from an
  approval of the owner. A summary is a record, and its text is untrusted data, as bot output
  is. It never gives a bot an approval or a permission that the messages did not give. The
  text of the request is in the design of the slice.

**How a compact runs**

- **The request.** Each compact request is a model request with `purpose = 'compact'`: no
  tools, no persona, no skills and no memory of the bot. It uses the model of the bot and the
  lowest effort of that model (owner), as the title request does (D46). It is stored and
  priced in `model_requests` (D21) with its bot, and it counts toward the caps (D20, D42). It
  reserves its worst-case cost while it runs. The reservation comes from the input and output
  limits that the request enforces, not from the D32 estimate. A model with no known price
  follows the rule of the title request.
- **Requests of an auto compact belong to the run.** They belong to the try of that run. They
  count toward the request limit and the totals of the run. The app stops the compact
  before it uses the last request of the run, so that the run can still reply. A manual compact
  has no run. Each request counts one time in each Usage view.
- **What a compact reads.** It reads the messages themselves when they fit in one request. If
  they do not fit, it starts from the bot's earliest summary on the same path that makes the
  input fit, and then reads the messages after it. This limits the loss of a summary that is
  made from a summary.
- **A long compact takes more than one request.** Sometimes no summary makes the input fit.
  The compact then reads the messages in groups, in their order. It starts at the first
  message that the bot can read. Each next request reads the result of the request before it and the next group.
  The size of a request includes its instructions and labels, and it leaves room for the
  answer. The compact stops at its end message. An answer that the model cut short is a
  failure, also when it has text. A message that is too large for one request, a request that
  covers no new message, or more requests than `compact_max_requests` is a failure. The app
  never leaves a message out without a mark.
- **Steps are kept, but only the end result is used.** Each request of a long compact stores
  its result as a **checkpoint**. Runs do not read a checkpoint. The app **publishes** only
  the final summary, after it checked its size, in one transaction with its event. A failure or a Stop publishes nothing, and the bot keeps the summary that it had. The
  checkpoints and the cost of the requests stay, and a Retry starts from them.
- **One compact at a time.** A conversation has at most one compact in flight; the database
  enforces it. A manual compact does not start while a run is queued or running in the
  conversation, as for an edit (D13). A run of another bot also counts. The app checks this and
  starts the compact in one transaction. While a manual compact is in flight, the worker
  claims no run of that conversation, and the app saves no edit. A message that the owner
  sends in that time waits; it is not a part of that compact. An auto compact belongs to its
  run.
- **A compact knows what it started from.** Each compact has a record. The record has its
  bot, its history choice (`history_from_seq`), its path and its end message. For an auto
  compact, it also has the try of its run. The app checks these before each request and before it publishes. A branch
  switch, a change of the members or a move to Trash cancels the compact. Two starts of the
  same compact, for the same bot and the same end message, are one compact. A late answer
  changes no summary and no newer compact, and its cost is counted one time.
- **Stop and time limits.** Each request of an auto compact shows as a step of the run, also
  when it fails. So the stall rule (`../architecture.md` §6) sees progress. The worker keeps
  the lease of the run alive between the requests. Each request has the time limit of a model
  request, which is below `RUN_STALL_SECONDS`. **Stop** cancels the compact and publishes
  nothing. The owner can also stop a manual compact, and it has a time limit. A request that is
  open when the app starts is failed, and its reservation stays as cost
  (`../conversation-rules.md` §8 rule 11).

**When a compact fails**

- **The owner sees it and can retry (owner).** A failed compact publishes no summary. The
  causes are: a cap, a provider error, an empty or cut answer, a summary that does not fit, and a target that is impossible. The app tells the owner what happened and
  offers a retry. A notice in the conversation names the bot, the cause and the real effect.
  For example, it says how many messages the bot did not read. It has a **Retry** action. The
  notice is for the owner, and bots do not read it. It is not a message of the conversation:
  the app builds it from the record of the compact. The final texts are in the UI design of the slice.
- **The run goes on.** For an auto compact, the run does not wait for the owner. It goes on
  with the summary that the bot had, if that summary still fits. If not, it goes on with the
  D32 rule: the oldest lines are left out, with the marker.
- **No repeat that costs money.** A failed auto compact stops auto compact for that bot on
  each path that has the failed end message. New messages do not change this. A
  Retry or a manual compact that succeeds starts auto compact again for that bot.
- **Retry.** Retry follows the rules of a manual compact. It makes the same compact again:
  the same bot and the same end message, from the stored checkpoints. Before that, the app
  checks the members, the budget and the caps again. The app refuses a Retry that is out of
  date, for example after a newer summary of that bot was published. The owner then starts a
  new Compact.
- **A failed manual compact** shows the same kind of notice, and the bot does not change.

**Sensitive data (D39)**

- **A compact reads the conversation as the bot does (owner, 2026-11-11).** The composer
  already stops a message that looks like it holds a secret. The owner then removes the
  secret, or reviews the message and chooses "Send anyway". A message that the owner sent in
  that way is in the conversation, and its bot reads it in each run. A compact reads it too,
  and the summary can hold what it holds. A message that the owner did not send is not stored
  (the server refuses it), so no compact can read it.
- **No new reader.** The compact request goes to the model of the same bot, so no other
  provider sees the text. The request reads the names of attachments, not their contents.
- **No guard step in a compact (owner, 2026-11-11).** The app does not run the guard on the input or on the
  summary of a compact. The input is text that the bot may read, and a guard match there
  would stop the compact that the owner allowed. This differs from the title request (D46),
  which does not run for a "Send anyway" message.
- **The summary gets the care of a message.** Its text is in no log. The purge deletes it with
  its conversation. The owner's view of it follows `AGENTS.md` §5 rule 8.

**Other rules**

- **The owner can read it.** For each bot, the conversation shows where its compacted part
  ends, and the owner can open the summary text of that bot. The page shows it as Markdown
  with raw HTML off (`AGENTS.md` §5 rule 8). The UI design is in the plan of the slice
  (`AGENTS.md` §7).
- **The slice (owner).** Compact is its own slice after M4-3, because it needs the branch
  rules and the member rules of M4. M3 ships with the D32 rule.
- **Not in this decision.**
  - Undo of a compact (owner, 2026-11-11). Two of three consultants and the judge advised to
    leave it out of the first slice. A new manual compact reads the messages again when they fit, so it replaces a
    poor summary.
  - A summary of a bot's own run record (`run_history`). The D32 rule stays for it:
    `[N earlier runs of yours omitted]`.
  - Word-for-word pieces of the newest messages when the writer fails, and the prompt size
    that the provider reports as the trigger. Both come from the research note; all three
    consultants advised against them for this slice.

Example: A conversation has 300 messages, and BA and QA are members with full history. BA uses
a model with a 1,000,000 token window, and QA one with 64,000 tokens. At 40 %, QA has room for
about 25,600 tokens of history. QA's run starts, and its history does not fit. The app makes a
compact with QA's model, as steps of that run. It publishes a summary for QA with end message
280, so that QA's history uses half of its budget. QA reads its summary and messages 281 to
300. BA has no summary: its next run reads all 300 messages, because they fit. Later the owner
wants BA to cost less and presses **Compact** for BA. BA's model reads the messages and writes
a summary for BA with end message 290. BA keeps the newest 10 messages in full. From then
on BA reads its summary and the messages after 290. QA does not change, and it never reads
BA's summary.

Why: A dropped message is lost for the bot, and the owner cannot see what the bot no longer
knows. A summary keeps the main facts for a small cost, and the owner can read it. Each bot
has a different window, so each bot needs a compact at a different time. A summary for each
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
- **No compact of a part with a "Send anyway" message.** One consultant advised it, and the
  judge found that it agrees best with the title rule (D46). The entry had it after the second
  arena round. The owner decided against it (2026-11-11): the owner reviewed the message and
  chose to send it, and one such message would stop compact for that part of the chat.
- **A mask in place of each guard match in the compact request.** Two of three consultants
  advised it, because it keeps compact available. D39 rejected silent masking. With the
  owner's decision, the bot keeps a value that the owner gave it on purpose.
- **Publish each step of a long compact.** A failed manual compact would then change the bot,
  against the rule that a failure changes nothing.
- **Store only the last summary of a long compact.** A failure at a late request would lose
  the requests that the owner already paid for.
- **One request for each compact, from the newest messages only.** Two consultants advised it
  as simpler. It can leave the oldest messages out while the summary claims that it covers
  them, so the judge advised against it.
- **Wait for 10 new messages before the next auto compact**, and **count the transcript
  before the run record.** Each was the advice of one consultant for the case of a large run
  record. The first limits how often a compact runs but can still pay for a compact that
  cannot help. The second changes how D32 shares the budget. The target rule above covers the
  case with no change of D32.
- **A manual compact that only marks the bot, and runs at its next run.** One consultant
  advised it, because it needs no lock. The bot may have no next run, so the action may never
  make a summary.

Consequences:

- D32 keeps the budget, the share for each bot, the order of the fill, the token estimate and
  the retry with half the budget. One thing changes: a summary takes the place of the
  omitted-messages marker when one applies.
- A summary can hold a secret that the owner sent with "Send anyway". It is then stored one
  more time, in the summary of that bot. The purge removes it with the conversation.
- A bot with a large run record can be over its budget when no compact can help. The app then
  tells the owner the cause and sends no request. The gap "tool results inside one run" in
  `../status.md` is the place for a limit on that text. The research note
  [context-guard-openmausbot.md](../research/context-guard-openmausbot.md) shows how another
  app does it.
- Two bots in one conversation can remember the past in different ways, because each has its
  own summary. The owner can open each summary to see the difference.
- A conversation with several small bots costs one compact for each bot.
- New stored data, in three groups. The summaries: bot, history choice, first and end message,
  the summary that was an input, source and request. The checkpoints. The record of each
  compact: bot, source, state, cause, path, end message and the try of the run. The schema design needs the owner's approval before SQL is
  written (`AGENTS.md` §7).
- `../domain-model.md`: `model_requests.purpose` gets the value `compact`, with a
  conversation. An auto compact request also has its run and try, so the CHECKs of §7 change.
  `run_steps` gets a step for a compact request (§3.8). The reservation rules of §13 name
  compact. The purge policy of §16 gets an entry for each new table that holds conversation
  text.
- `../architecture.md` §6 and §11 get the rule that keeps the lease of a run alive during a
  compact, and the new claim and race rows. `../security.md` §2.13 gets the rule that a compact
  has no guard step, with the owner's reason. No guard code changes.
- New events tell open pages that a bot has a new summary, or that a compact failed
  (`AGENTS.md` §5 rule 3). A summary and its event are written in one transaction.
- New settings: `auto_compact`, `compact_target_pct`, `compact_keep_recent_messages`,
  `compact_max_requests` and the limit for the length of a summary. Their ranges and defaults
  get their home in `../domain-model.md` §10 when the owner accepts this entry.
- `../requirements/product-brief.md` has a row "History summarisation: later", which asks for
  a state, a system line and a start by hand (`../research/chat-client-patterns.md` P10). That
  row changes when the owner accepts this entry.
- Usage and Statistics show compact requests as their own group, with the bot of each
  request, so that the owner sees which bot causes the cost.
- Fake-model tests can prove the order, the storage and the cost rules. They cannot prove that
  a real summary keeps the meaning. The slice needs a small set of long example conversations
  with facts that must stay: the owner's approvals, later corrections, cancelled requests and
  exact file paths. A person checks them with a real model before `auto_compact` is on by
  default. A low effort and a summary of a summary make this check more important.

Tests that the slice needs (from the consultants; the slice brief takes them in):

- Each bot has its own window and summary; the prompt of BA never has QA's summary.
- A bot that left and joined again, with each history choice: the old summary does not apply.
- An edit before, at and after the end message; a switch back to the old branch.
- History equal to the budget: no compact. One token more: compact.
- A large run record, a message that is too large, a request with no new message, more
  requests than the limit: a failure with its cause, and no silent gap.
- The second request of a long compact fails; Stop after the first request; a restart before
  the app publishes: nothing is published, the checkpoints and the cost stay.
- Two starts in two tabs; a manual compact against a run claim, also for a run of another
  bot; a Retry against a newer published summary.
- A late answer after Stop, a branch switch, a removed bot, Trash, restore or a lease reclaim:
  it changes nothing.
- A message that arrives during a manual compact waits; a later bot still reads the reply of
  an earlier bot.
- A "Send anyway" message is in the compact request as it is, and the compact works. No
  summary text is in a log.
- Two reservations with cap room for one; a model with no price; each cost counted one time
  after a restart.
- After a failure, new messages start no new auto compact; the retry with half the budget
  never compacts.
- `auto_compact` off: a manual compact still works. A history of 10 messages: the action is
  off. A request limit of 1: no auto compact.
- A cut answer is a failure. A summary that does not fit gives the history from the messages
  with the D32 markers.
- A summary with an instruction in its text gives the bot no approval and no permission.
- The purge leaves no summary text. A summary and its event are in one transaction.

Implemented in: not yet. When accepted: `../conversation-rules.md` §4, §6 and §9,
`../domain-model.md`, `../architecture.md` §6 and §11, `../security.md` §2.13,
`../realtime-events.md`, `../api.md`, `../testing.md`, `../requirements/conversation.md`,
`../requirements/product-brief.md` and the brief of the slice.
