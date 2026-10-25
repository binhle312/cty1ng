# Project inbox and cross-conversation work

From D58 and D59 (accepted 2026-10-25). The UI design is not approved: the screen comes in a design round in the slice
plan (`../development-plan.md`). Related: D37, D38, D48, D52.

The idea: the inbox tells the owner what is happening in the project. A bot helps, on request,
to explain if the conversations agree. Code does all that it can; a model is used only for reading
and summaries.

| Job | Done by |
| --- | --- |
| Conversation states, things that wait for the owner, failed and stopped runs | App (no model) |
| Files that wait for another run, saves with overlaps, unsaved changes (D52) | App (no model) |
| Project memory that changed after an approval (D59) | App (no model) |
| Send a message to another conversation (D58) | Owner, or a bot with the owner's approval |
| Find and summarise what other conversations decided (D58) | A bot, when the owner asks |
| Say if two decisions contradict | A bot, best effort, and the owner decides |

## Stories

- **PI-1.** As the owner, I want one list per project of everything that waits for me and every
  run that failed, so that I do not open each conversation to find them.
  Acceptance criteria: UI-14.1 to UI-14.4. Slice: Project inbox (after M6).
- **PI-2.** As the owner, I want to know when project context (memory, instructions or goal)
  changed after a plan was approved and before its files were saved, so that I can check the work.
  Acceptance criteria: UI-14.5 to UI-14.8. Slice: M6 (D59).
- **PI-3.** As the owner, I want to ask a bot what other conversations in the project decided,
  with links to the messages, so that I do not search them myself.
  Acceptance criteria: UI-14.9 to UI-14.12. Slice: M5b or the next slice after it (D58).
- **PI-4.** As the owner, I want to send information from one conversation to another, so that
  the bots there know it, without starting work. Acceptance criteria: UI-14.13 to UI-14.16.
  Slice: Project inbox (after M6).

## Inbox states

| State | Comes from | Shown when |
| --- | --- | --- |
| Waiting for you | A pending plan card, handoff card, memory check, skill draft or share proposal | Until the owner decides |
| Failed / stopped | A run with status `failed` or `stopped` | Until the owner opens it |
| Waiting for file | D52 file claim: the run waits for another conversation's run | While it waits |
| Saved with overlap | D52 overlap notice (merged, or this version saved) | Until the owner opens it |
| Unsaved changes | D52 card after a failed or stopped run | Until Discard or Save to Library |
| Memory changed | D59 notice | Until the owner opens it |

There is no "overlap found, waits for you" state. D52 saves and then shows a notice.

## Acceptance criteria (UI-14)

- **UI-14.1** The project inbox lists every item in the states table for the project's
  conversations, newest first, with the conversation name and the time (time rule: under 1 day
  "x ago", otherwise exact local time).
- **UI-14.2** Each item opens its conversation at the message or card it comes from.
- **UI-14.3** An item leaves the list when its condition ends (decided, discarded, opened). The
  list updates live from the event stream, with no reload.
- **UI-14.4** The inbox makes no model call. A test with the fake model shows zero model
  requests for any inbox load.
- **UI-14.5** When a Library save of an action run happens (from the save queue or from "Save to
  Library" on unsaved changes) and no project memory item, instruction or goal changed after the
  plan's `decided_at`, no memory notice appears.
- **UI-14.6** When one or more changed, the save completes and a notice lists each change with its
  text, who changed it and the source, with the link for its kind (D59 table): a memory item shows
  the bot and conversation (with "requested by you" when the change comes from an owner message),
  or "You · Memory page", and View item; instructions or goal show "You · Project settings" and View
  instructions or View goal. Every notice has View saved files. No model call is made.
- **UI-14.7** A memory item whose latest change is a step of the saving run is left out. A change
  made on the owner's request in the same conversation is not left out.
- **UI-14.8** The notice shows the snapshot recorded at the save: it is the same after a reload,
  also when the item changed again or was deleted later. View item opens the current item and its
  history. With history off for the project, it shows the snapshot and "History is off for this
  project". The plan card's "Check after the run" and its P3 state do not change because of this notice.
- **UI-14.9** `search_project_conversations` returns hits only from other conversations of the
  same project, only from their active branch, and never from a conversation with "Don't use
  memory" on.
- **UI-14.10** It returns at most `cross_search_max_hits` hits (setting, default 10).
- **UI-14.11** A bot reply that uses a hit links the source message. The link opens that
  conversation at that message.
- **UI-14.12** No run calls the search unless the bot chose the tool. A test shows that a planning
  run with no such tool call reads no other conversation. A hit never creates a memory item.
- **UI-14.13** The owner can send a message to another conversation of the same project. The
  target shows an information card with the cited text, the source, a link back and the line
  "Information only. No bot starts. Bots can read this on a later run." No approval card appears.
- **UI-14.14** A bot's `propose_share` shows a card in the source conversation with Reject and
  Send. Nothing reaches the target before Send.
- **UI-14.15** An information card starts no run, in the target or the source.
- **UI-14.16** Share proposal limit (D58, amendment 2026-10-25), with
  `share_max_per_conversation_24h` set to 5 in the test:
  - Proposals 1 to 5 from one source conversation in a rolling 24 hours each create a normal
    proposal card. Pending, approved and rejected proposals all count; owner sends do not.
  - The 6th returns `share_limit_reached`, creates no proposal card, and the app shows one notice
    in the source conversation. The 7th and later return the same error and create no new notice.
  - When the oldest proposal is more than 24 hours old, a 6th proposal creates a normal card. The
    next blocked attempt after that shows a new notice.
  - While the limit is reached, the owner can still send to another conversation, and no run starts.
  - The `share_limit_reached` error message offers the bot an optional copyable summary (source and
    intended conversation). A test with the fake model shows the run makes no extra model request
    for it, and the notice shows whether the bot writes the summary or not.

## Open questions

- The UI design of the inbox, the information card and the memory notice (design round in each slice plan).
- Where the inbox lives: the project section of the left bar (beside Board, `../design/components/left-bar.md` §5) is the first candidate.
