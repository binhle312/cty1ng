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
  Acceptance criteria: UI-3.11, UI-3.12, UI-3.14.
- **CV-5.** As the owner, I want to attach files and browse the conversation's workspace, so that bots and I work on the same documents.  
  Acceptance criteria: UI-3.13, UI-3.16.
- **CV-6.** As the owner, I want a conversation header with members, discussion status and a Stop button, so that I stay in control.  
  Acceptance criteria: UI-3.15.
- **CV-7.** As the owner, I want the page to recover exactly after a reload or network drop, so that I never see duplicates or gaps.  
  Acceptance criteria: UI-3.17.
- **CV-8.** As the owner, I want each bot to acknowledge my message with a status reaction that changes as it works, so that I know it received the message, when it started, and when it finished.  
  Acceptance criteria: UI-3.18, UI-3.19.
- **CV-9.** As the owner, I want to see what happened to each message I send, including when it failed or is waiting for a bot, so that nothing I write gets lost or stuck silently.  
  Acceptance criteria: UI-3.20, UI-3.21.

## Acceptance criteria

Shared rules for every story: `README.md` §Applies to every story. Layouts referenced below are sketches in `../design/`, not final designs.

## Conversation page (UI-3)

Layout sketch: see `../design/screens.md` §3 (not final).

Messages

- UI-3.1: Messages render Markdown with raw HTML disabled (`../security.md`), code blocks with
  syntax highlighting, author avatar, name and time.
- UI-3.2: Deleted bots' avatar and name render grey (D12), with tooltip "Deleted bot".
- UI-3.3: System messages are visually distinct (centred, muted). Cards (history choice,
  handoff) show their current state and disable their buttons once decided.
- UI-3.4: Bot replies stream in. The running bot shows one of two live states, both derived
  from existing events: **typing** while `message.delta` events arrive (it expires 10 s after
  the last delta), and **working: <latest step>** between deltas (for example during a long
  tool call). Queued bots are listed under the composer ("Queued: Designer, QA"). The live
  text sits in a polite live region.
- UI-3.5: The latest `run.step` shows as a subtle line under the streaming message
  ("Loading skill write-user-stories…") with the elapsed time since the run started and since
  the last progress ("1:42 · last step 0:12 ago").
- UI-3.6: Under each completed bot message, chips list `skills_used` as `<slug> v<version>`,
  always-loaded ones marked "always" (D15). Clicking a chip opens a side sheet with that exact
  version's content. No chips when none.
- UI-3.6b: Hovering the time of a bot message shows its usage: tokens (input / output / cache)
  and estimated cost (D21).
- UI-3.7: Failed messages show the error summary and a "Retry" button (re-queues the run).
  Stopped messages show "Stopped" and keep partial text.
- UI-3.8: Human messages show "Edit" on hover. Editing opens inline; saving creates a branch
  (`../conversation-rules.md` §6). The dialog warns that workspace files are not rolled back.
  Edit is disabled with a tooltip while runs are active.
- UI-3.9: Messages with siblings show ‹ i/n › to switch branches.
- UI-3.18: Run status reactions. Every message that triggers runs (from the owner, a bot, or
  an approved handoff) shows one reaction per triggered bot: the bot's small avatar plus a
  status emoji. The emoji follows the run (`realtime-events.md` `run.*` events):
  **received** (`run.queued`) → **working** (`run.started`) → **done** (`run.finished`,
  complete). The emoji is replaced in place, never stacked. A failed run (including one that timed
  out) shows a **failed** state and a stopped run a **stopped** state. A run refused by a limit shows no reaction (the
  notice explains why). The five emojis are chosen in the frontend design phase; until then
  the spec names the states only.
- UI-3.19: Hovering or focusing a status reaction shows "<Bot>: received 17:04:02 · started
  17:04:05 · done 17:04:41"; while working it adds the time since the last progress (P2 stall
  timeout, `../architecture.md` §4). Reactions survive reload (they are derived from run state, not
  stored separately) and are announced to screen readers when they change.
- UI-3.20: A human message whose POST fails shows "Not sent" with Retry and Delete (Delete is
  local only). Any later unsent message in the same conversation is marked "Not sent" too, so
  messages never arrive out of order. Retry reuses the same `client_id`, so a send that did
  reach the server is not duplicated.
- UI-3.21: Under each human message, a small line says what happened to it: "Queued for
  Designer" (with Cancel while the run has not started), "Nobody mentioned", or nothing once
  the bots have started (the status reactions take over, UI-3.18). Messages sent while a bot
  works are never merged into the running turn (D11).
- UI-3.10: Scrolling up loads older messages (pagination by `before_seq`); new messages
  auto-scroll only when the view is already at the bottom; otherwise a "New messages" pill
  appears. A "New" divider sits above the first message after the owner's read position
  (`last_read_seq`); it stays until the conversation is left.

Composer

- UI-3.11: Typing `@` opens an autocomplete listing only **active** members; pending members
  appear greyed with "waiting for your choice"; selection inserts a mention token rendered as a
  chip with the bot name.
- UI-3.12: With 0 bots the composer shows "Add a bot to start" and Send is disabled. With ≥ 2
  bots and no mention, a hint appears under the composer before sending: "No bot is mentioned;
  nobody will reply."
- UI-3.13: Attachments by button or dropping files on the composer; limits 10 files, 10 MB
  each, listed types (`../security.md`); rejected files show why.
- UI-3.14: Enter sends, Shift+Enter inserts a newline.

Header and side panel

- UI-3.15: Conversation header: title (click to rename), member avatars (click → menu with
  "Remove from conversation"), "Add bot" button (opens a picker of non-member available bots),
  discussion status ("Discussion: on · 3/5 used" or "off"), Stop button while any run is queued
  or running, settings button.
- UI-3.16: Files side panel (collapsible) lists workspace files as a tree; clicking opens a
  read-only viewer for text (with Markdown preview), images and PDF.
- UI-3.17: Reload or network drop restores the exact state with no duplicate or missing
  messages (event replay).
