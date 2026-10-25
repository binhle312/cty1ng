# Project inbox and cross-conversation work

Draft (2026-10-25), from proposed decisions D58 and D59. Nothing here is built until the owner
accepts them. The UI design is not approved: the screen comes in a design round in the slice
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
- **PI-2.** As the owner, I want to know when a saved run used project memory that changed while
  it ran, so that I can check its work. Acceptance criteria: UI-14.5, UI-14.6. Slice: M6 (D59).
- **PI-3.** As the owner, I want to ask a bot what other conversations in the project decided,
  with links to the messages, so that I do not search them myself.
  Acceptance criteria: UI-14.7 to UI-14.10. Slice: M5b or the next slice after it (D58).
- **PI-4.** As the owner, I want to send information from one conversation to another, so that
  the bots there know it, without starting work. Acceptance criteria: UI-14.11 to UI-14.14.
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
- **UI-14.5** When an action run saves and no project memory item, instruction or goal changed
  after its plan's `decided_at`, no memory notice appears.
- **UI-14.6** When one or more changed, the save completes and a notice lists each item with its
  text, who changed it, the conversation and the time, with View item and View saved files. No
  model call is made.
- **UI-14.7** `search_project_conversations` returns hits only from other conversations of the
  same project, only from their active branch, and never from a conversation with "Don't use
  memory" on.
- **UI-14.8** It returns at most `cross_search_max_hits` hits (setting, default 10).
- **UI-14.9** A bot reply that uses a hit links the source message. The link opens that
  conversation at that message.
- **UI-14.10** No run calls the search unless the bot chose the tool. A test shows that a planning
  run with no such tool call reads no other conversation. A hit never creates a memory item.
- **UI-14.11** The owner can send a message to another conversation of the same project. The
  target shows an information card with the cited text, the source and a link back. No approval
  card appears.
- **UI-14.12** A bot's `propose_share` shows a card in the source conversation with Reject and
  Send. Nothing reaches the target before Send.
- **UI-14.13** An information card starts no run, in the target or the source.
- **UI-14.14** Bot proposals beyond `share_max_per_conversation_per_day` (setting, default 5)
  return a tool error that asks the bot to tell the owner.

## Open questions

- The UI design of the inbox, the information card and the memory notice (design round in each slice plan).
- Where the inbox lives: the project section of the left bar (beside Board, `../design/components/left-bar.md` §5) is the first candidate.
