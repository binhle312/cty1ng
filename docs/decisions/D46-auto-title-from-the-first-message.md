# D46. The app writes a short title from the first message, one time only

Status: accepted (2026-10-23, owner). The owner must approve the M3 migration before it is written. Amended
2026-10-25 (owner): this amendment replaces the approval timing stated above. As of 2026-10-25, no
application data exists. The owner approves the M3 schema design in `../domain-model.md` before SQL
generation, then approves the generated SQL in the M3 PR (`../../AGENTS.md` §7). The conditional
backfill rule in `../domain-model.md` §5 still applies if the tables already contain data.
Decision: When the first human message of a conversation is sent, the app asks a model for a
short title, one time only. The title call is not a run.

- **Trigger.** The first human message that the server stores. A message that the server
  refuses (for example 422 `sensitive_data`) is not sent, so it does not count.
- **One time only.** The send transaction claims the attempt with a compare-and-set on
  `conversations.auto_title_status`. Later messages, edits and branches never start a new
  attempt. There is no retry.
- **Manual wins.** A title that the owner sets (rename, settings, `POST /conversations` with a
  title) sets `title_source = 'manual'`. The app writes an auto title only while
  `title_source = 'default'`. The write itself carries this check, so a rename during the call
  wins.
- **Failure keeps the default.** A timeout, an error, an empty answer or an answer that the guard
  flags leaves "New conversation". The app does not try again.
- **Sensitive data (D39).** If the guard found matches in the first message (the owner chose
  "Send anyway"), the app does not make the title call. It also checks the answer with the guard.
- **Caps (D20, D40, D42).** The app checks the same caps as a run, two times: in the send
  transaction and just before it sends the request. If the total cap or the provider cap is
  reached, the app does not make the call.
- **Parallel requests, hard cap.** Title requests for different conversations run in parallel,
  with no global queue. A title request never makes today's estimated spend pass a cap (owner,
  2026-10-23). Before dispatch, the app reserves the worst-case cost of the request (2500 input
  and 30 output tokens) and checks spend plus reservations against the caps in one write
  transaction. At the end, the real cost replaces the reservation. Runs keep D20 and D40: a
  running run can still pass a cap by one run.
- **Model.** The first available active member in this order: the mentioned bots in mention
  order, then the other members by join time. With no such bot, there is no title. The call uses
  the lowest effort of the model, at most 30 output tokens and a 20 s timeout.
- **Cost (D21).** The call is one `model_requests` row with `purpose = 'title'` and no run. It
  counts toward today's spend and the caps, and toward the conversation. It does not count
  toward any bot.

Example: The owner sends "@BA write user stories for the login page". The BA starts its run. At
the same time, the app asks the BA's model for a title and gets "Login page user stories". The
rail and the header change. The request costs approximately $0.002, and Settings shows it under "Conversation
titles".

Why: A list of chats with the name "New conversation" is hard to use. The owner wants names
without extra work. One cheap call per conversation is enough. Rules in the database make the
"one time" and "manual wins" promises true across tabs, retries and restarts.
Why the bot's model: The message goes to that provider for the reply anyway, so no new provider
sees the text. The provider has a key, so the call does not need new settings. A title call is
at most approximately 600 input tokens and 30 output tokens. The cost depends on the model: at
$3 / $15 per million input / output tokens it is approximately $0.002, at $15 / $75 approximately
$0.011.
Known limit: a first message stored with no available active bot (for example, only a member
that waits for the history choice) gets no title. The owner can rename the chat. A fallback model
setting would remove this limit, but it adds a setting for a rare case.
Not chosen:
- **The title call as a normal run.** A run holds the one running slot of the conversation
  (D11), so the title would delay the reply. It would also show status reactions and count
  toward the turn budget.
- **A separate title model in Settings.** It is cheaper per call, but it needs one more setting
  and a key. It can also send the text to a provider that the owner did not choose for the
  chat. It can come later if title costs are a problem.
- **Retry on failure, or a new attempt on the next message.** The owner asked for "one time
  only". The owner can rename the chat at any time.
- **A title without a model (the first words of the message).** It costs nothing, but the result
  is often poor ("@BA can you please…").
Consequences:
- Migration: `conversations` gets `title_source` and `auto_title_status`. In `model_requests`,
  `run_id` can be NULL, and the table gets `conversation_id`, `purpose` and
  `reserved_cost_usd`, with
  `CHECK (purpose IN ('run', 'title'))`. In M3 the tables are new, so there is no backfill. A
  later migration backfills as `../domain-model.md` §5 says.
- The conversation object in the API gets `title_source`.
- The today-spend query reads `model_requests`, so it includes title requests with no change.
  Per-bot views must filter on `purpose = 'run'`.
- A crash during the call leaves `pending`. At startup the app sets it to `failed`. The title
  stays "New conversation".
Implemented in: `../conversation-rules.md` §8, `../domain-model.md` §5, §7, §12 and §13,
`../api.md` §5, `../requirements/conversation.md` (CV-11, UI-3.24 to UI-3.26),
`../security.md` §2.2 and §2.13, `../testing.md` §2, task M3.
