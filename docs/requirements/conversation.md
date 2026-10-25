# Conversation

Chatting with one or more bots: messages, streaming, mentions, edits and branches, skill chips, attachments and the files panel. Behaviour rules (who replies, budgets, history) are in `../conversation-rules.md`.

## Stories

- **CV-1.** As the owner, I want bot replies to stream in with clear authorship and status, so that I can follow the work as it happens.  
  Acceptance criteria: UI-3.1 to UI-3.5, UI-3.7, UI-3.10.
- **CV-2.** As the owner, I want to see which skills and versions a bot used, and what a reply cost, so that I can trust and tune my bots.  
  Acceptance criteria: UI-3.6, UI-3.6b.
- **CV-3.** As the owner, I want to edit my earlier message and switch between versions, so that I can change direction without losing the old path.  
  Acceptance criteria: UI-3.8, UI-3.9.
- **CV-4.** As the owner, I want @mention to offer only bots in this conversation, so that I never address someone who cannot answer.  
  Acceptance criteria: UI-3.11, UI-3.12, UI-3.14, UI-3.14b.
- **CV-5.** As the owner, I want to attach files and browse the conversation's workspace, so that bots and I work on the same documents.  
  Acceptance criteria: UI-3.13, UI-3.16.
- **CV-6.** As the owner, I want a conversation header with the members, a way to add a bot and the discussion status, and a Stop button in the composer, so that I stay in control.  
  Acceptance criteria: UI-3.15.
- **CV-7.** As the owner, I want the page to recover exactly after a reload or network drop, so that I never see duplicates or gaps.  
  Acceptance criteria: UI-3.17.
- **CV-8.** As the owner, I want each bot that waits to start on my message to show a reaction on it, so that I know the message was received and I can cancel a run that has not started. The reply shows the later states.  
  Acceptance criteria: UI-3.18, UI-3.19.
- **CV-9.** As the owner, I want to see what happened to each message I send, including when it failed or is waiting for a bot, so that nothing I write gets lost or stuck silently.  
  Acceptance criteria: UI-3.20, UI-3.21.
- **CV-10.** *(D39.)* As the owner, I want to be warned before a password, API key or card number in my message or file is sent to a model, so that I don't leak secrets by accident.  
  Acceptance criteria: UI-3.22, UI-3.23.
- **CV-11.** *(D46.)* As the owner, I want each new conversation to get a short title from my first message, so that I can find it again without the work of a rename.  
  Acceptance criteria: UI-3.24 to UI-3.26.

## Acceptance criteria

Shared rules for every story: `README.md` §Applies to every story. Layouts referenced below are sketches in `../design/`, not final designs.

## Conversation page (UI-3)

Agreed design (round 10): `../design/components/conversation-page.md`, `composer.md` and
`conversation-cards.md`.

Messages

- UI-3.1: Messages render Markdown with raw HTML disabled (`../security.md`), code blocks with
  syntax highlighting, author avatar, name and time.
- UI-3.2: Deleted bots' avatar and name render grey (D12), with tooltip "Deleted bot".
- UI-3.3: System messages are a small centred pill, muted, and red only for a problem. Cards
  (history choice, plan, handoff) show their current state and have no buttons once decided. A
  plan or handoff card sits inside the reply of the bot that made it and folds to one line after
  the decision. A stale handoff card does not fold.
- UI-3.4: Bot replies stream in. The running bot shows one of two live states, both derived
  from existing events: **typing** while `message.delta` events arrive (it expires 10 s after
  the last delta), and **working: <latest step>** between deltas (for example during a long
  tool call). Queued bots are listed under the composer ("Queued: Designer, QA"). The live
  text sits in a polite live region.
- UI-3.5: The latest `run.step` shows as a subtle line under the streaming message
  ("Loading skill write-user-stories…") with the elapsed time since the run started and since
  the last progress ("1:42 · last step 0:12 ago"). While a plan card shows progress (UI-3.29),
  the line shows only the times, because the card names the step.
- UI-3.6: Under each completed bot message, chips list `skills_used` as `<slug> v<version>`,
  always-loaded ones marked "always" (D15). Clicking a chip opens a side sheet with that exact
  version's content. No chips when none.
- UI-3.6b: Hovering the time of a bot message shows its usage: tokens (input / output / cache)
  and estimated cost (D21).
- UI-3.7: Failed messages show "Failed" with a short reason in plain words (never the raw
  error) and a "Retry" button (re-queues the run). Stopped messages show "Stopped by you" and
  keep partial text, with no Retry.
- UI-3.8: Human messages show an Edit button under the message, at the far right, on hover or
  focus. Editing opens inline; saving creates a branch (`../conversation-rules.md` §6). A note
  under the edit box says that workspace files are not rolled back. Edit is disabled with a
  tooltip while runs are active.
- UI-3.9: Messages with siblings show ‹ i/n › under the message, left of Edit, to switch
  branches.
- UI-3.18: Run status reactions. Every message that triggers runs (from the owner, a bot, or
  an approved handoff) shows one reaction per **queued** bot: the bot's small avatar plus a
  clock line icon (`run.queued`). The reaction goes away when that run starts (`run.started`)
  or is cancelled. The reply shows the later states: typing and working (UI-3.4), failed and
  stopped (UI-3.7). A run refused by a limit shows no reaction (the notice explains why).
- UI-3.19: Hovering or focusing a status reaction shows "<Bot>: queued 17:04:02" and a × that
  cancels that queued run. Reactions survive reload (they are derived from run state, not
  stored separately) and are announced to screen readers when they change.
- UI-3.20: A human message whose POST fails shows "Not sent" with Retry and Delete (Delete is
  local only). Any later unsent message in the same conversation is marked "Not sent" too, so
  messages never arrive out of order. Retry reuses the same `client_id`, so a send that did
  reach the server is not duplicated.
- UI-3.21: A human message that starts no run has a small line under it: "Nobody mentioned · no
  bot replies". A queued run shows as its reaction (UI-3.18), with Cancel on hover, and under the
  composer ("Queued: Designer"). Messages sent while a bot works are never merged into the
  running turn (D11).
- UI-3.22 *(D39)*: Before sending, the composer checks the text for likely secrets.
  If any are found, a red panel above the composer lists them masked ("API key ending …9f2a",
  "card number ending 4242") with Remove and "Send anyway". The message is not sent until every
  match is removed or the owner clicks "Send anyway". Without "Send anyway" the server refuses the message with 422
  `sensitive_data`. Matched text is never logged.
- UI-3.23 *(D39)*: Text attachments get the same check at upload. When an image or
  PDF is attached, the composer notes "Images and PDFs are not checked for secrets".
- UI-3.10: Scrolling up loads older messages (pagination by `before_seq`); new messages
  auto-scroll only when the view is already at the bottom; otherwise a "New messages" pill
  appears. An amber "New" divider sits above the first message after the owner's read position
  (`last_read_seq`); it stays until the conversation is left.

Composer

- UI-3.11: Typing `@` opens an autocomplete listing only **active** members; pending members
  appear greyed with "waiting for your choice"; selection inserts a mention token rendered as a
  chip with the bot name.
- UI-3.12: With 0 bots the composer shows "Add a bot to start" and Send is disabled; the
  composer has no Add bot button (the add slot in the header adds bots, UI-3.15). With ≥ 2
  bots and no mention, a hint appears under the composer before sending: "No bot is mentioned,
  so nobody will reply. Type @ to mention a bot."
- UI-3.13: Attachments by button or dropping files on the composer; limits 10 files, 10 MB
  each, listed types (`../security.md`); a rejected file stays as a red chip that says why
  ("Type not allowed", "Over 10 MB", "11th file").
- UI-3.14: Enter sends. Shift+Enter or Alt+Enter inserts a newline (the same keys in every
  message and note box).
- UI-3.14b: Every Markdown box supports Markdown keys (Ctrl+B bold, Ctrl+I italic, Ctrl+Shift+X
  strike, Ctrl+E inline code, Ctrl+K link, and keys for code block, lists and quote; Cmd on
  Mac). Selected text shows a small format bar with the five inline actions; each button's
  tooltip names its key (`../design/components/composer.md` §5).

Header and side panel

- UI-3.15: Conversation header: title (click to rename); the add slot (+), always first before
  the member avatars (click opens a picker of non-member available bots; a header avatar dropped
  on it or on the conversation adds that bot); member avatars (click → menu with each member's
  model and effort and "Remove"); Flow; ⋯ with Rename, Conversation settings and Delete;
  discussion status ("Discussion: on · 3/5 used" or "off", from slice M5). The Stop button sits
  inside the composer at the left while any run is queued or running.
- UI-3.16: Files side panel (collapsible) lists workspace files as a tree; clicking opens a
  read-only viewer for text (with Markdown preview), images and PDF.
- UI-3.17: Reload or network drop restores the exact state with no duplicate or missing
  messages (event replay).

Title (D46, rules in `../conversation-rules.md` §8)

- UI-3.24: After the server stores the first human message of a conversation, the app asks a
  model for a short title (the model is asked for 2 to 6 words; the app keeps 60 characters or
  less). The app needs an available active bot for this, because it uses that bot's model. A
  first message stored with no such bot gets no title (`../conversation-rules.md` §8 rule 3). The title shows in the
  header, the rail tooltip and the conversation lists when `conversation.updated` arrives. The send
  and the bot reply do not wait for it. The app makes this request one time per conversation.
  Later messages and edits do not change the title.
- UI-3.25: A title that the owner sets (rename in the header, the rail menu or conversation
  settings) always wins. The app never replaces it, also when the rename happens during the
  title request.
- UI-3.26: If the request fails, times out, or gives an empty or flagged answer, the title
  stays "New conversation", with no error in the conversation. The app does not make the request when
  the first message needed "Send anyway" (D39), when a daily cap is reached (D20, D42), or when
  the owner named the conversation first. Titles are plain text, never Markdown.

Feedback (D51, used by Improve in slice M5d)

- UI-3.27: Under each complete bot message, on hover or focus, the owner sees two buttons:
  Good answer and Bad answer. A click saves the rating at once. Bad answer also opens a short
  note box ("What was wrong?", optional, Markdown, 2,000 characters or less, same keys as the
  composer). The selected button stays visible. A second click on it removes the rating. The
  note passes the sensitive-data check (UI-3.22). They are thumbs up and thumbs down icons at
  the right of the skill chip row (`../design/components/conversation-page.md` §3.2).
- UI-3.28: A tooltip on the buttons says "Your ratings help <bot> improve its skills".
  Ratings never change the message and never start a run.

Plan progress (D57)

- UI-3.29: After Approve, the plan card stays open and shows each approved step as done, current
  or not started (and skipped, with the bot's note), each started step with its start time and
  duration ("11:12:04 · 0:18"), with the pill "Running · step n of total".
  The tool calls of the current step show as small lines under it. Each planned file shows
  "written" or "not yet". The state comes from `run_steps`, so a reload shows the same card
  (`../design/components/plan-card.md` §6).
- UI-3.29b: An approved run that waits for a file claim (D52) shows "Queued · waits for
  {conversation}" with the clock icon, in grey, until it starts.
- UI-3.30: When the run ends with every step done (none skipped) and nothing open in the run-end
  check (D54), the card folds to "Plan [Done] … · Show". Otherwise it stays open: "Not marked
  done" on each step with no done or skipped mark, a skipped step with its note ("Done · 3 of 4 ·
  1 skipped"), and the block "Check after the run". A Done-when item `met` whose quote the app
  did not find is open. A stopped or failed run keeps the
  card open with "Stopped · n of total" or "Failed · n of total".
- UI-3.30b: Before the run ends, the app reminds the bot once (setting `plan_mark_reminders`)
  about steps and Done-when items with no mark. Each mark shows its source: "checked by app",
  "bot says" or "not verified"; a step done with no tool call that succeeded shows "no action
  recorded". A mark on a done or skipped step gives the error `step_closed`.
- UI-3.31: Show opens a folded plan card, Hide folds it, at any time. A card hidden while the
  run works shows "Running · step n of total" on its line, updated live. A reply with no plan
  has no progress card.
