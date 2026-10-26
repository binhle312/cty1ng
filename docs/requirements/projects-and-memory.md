# Projects and memory

D37, D38. How conversations group into projects, and how bots remember things across
conversations. Technical design: `../domain-model.md` §11, §14.

## Stories

- **PM-1.** As the owner, I want to group conversations about one piece of work into a project,
  so that the bots working on it share what they learn and nothing leaks into unrelated work.
  Acceptance criteria: UI-13.1 to UI-13.3.
- **PM-2.** As the owner, I want a bot I talk with one-to-one to remember how I like it to work,
  and use that everywhere, so that I don't repeat my preferences in every conversation.
  Acceptance criteria: UI-13.4, UI-13.5.
- **PM-3.** As the owner, I want bots in a project to remember facts about the work, shared by
  every bot in the project, so that a new conversation in the project starts with context.
  Acceptance criteria: UI-13.4, UI-13.6, UI-13.16.
- **PM-4.** As the owner, I want to see, edit, delete and recover what bots remember, so that
  nothing becomes permanent without my knowing. Acceptance criteria: UI-13.7 to UI-13.10,
  UI-13.13 to UI-13.15, UI-13.17 to UI-13.21.
- **PM-5.** As the owner, I want bots in a multi-bot conversation outside any project to remember facts
  about that conversation's topic, so that a quick team conversation keeps its context without needing a
  project. Acceptance criteria: UI-13.4, UI-13.11, UI-13.12.

## When a bot may save memory

This table is a summary of D38, D43, D48, D53 and D56, in one place. It adds no rule. If it and a decision
differ, the decision wins; fix the table. In every row that saves, the conversation shows the
"Remembered" line with Undo (UI-13.4).

| Situation | Can the bot save, change or forget memory? | Approval | Source |
| --- | --- | --- | --- |
| The owner says "remember X" or "forget X" | Yes, at once, in the current scope | The owner's request | D38, D48 |
| Plain answer (no plan) | Only when the owner clicks **Remember** on the bot's offer | The click | D48 |
| Planning run | No. Its tools are read-only. It lists memory changes on the plan card | — | D48 |
| Action run, the item is in the approved plan | Yes | The plan approval | D48 |
| Action run, the item is not in the plan | No. The tool returns `memory_not_in_plan`; the bot can offer a **Remember** button | The click | D56 |
| An action run saved memory, then failed or stopped | The items stay saved. The unsaved changes card lists them, each with Undo | The plan approval | D56, D52 |
| A run that read the web | Only items in the approved plan, or the **Remember** button | Plan or click | D53 |
| Memory is off (in Settings, or "Don't use memory" in the conversation) | No. The memory tools are not offered | — | D38 |
| Tidy memory | Only the changes the owner applies on the proposal card | The owner applies | D38, D63 |
| A new project memory item disagrees with the project instructions | Not at once. The bot asks the owner; it saves the item only if the owner agrees | The owner's answer | D43 |

## Acceptance criteria (UI-13)

- UI-13.1: The rail groups conversations by project, with conversations outside any project
  in their own group. "+" offers "New conversation" in the current project or outside one.
- UI-13.2: The owner can create a project (name, one-line description), rename it, and move a
  Home conversation into a project from the conversation's menu. A project conversation never
  leaves its project (D61). The move dialog lists the conversation's saved files with ticked
  boxes and the pinned version of each, and shows which memory and Library the bots will use
  from then on. Move is unavailable while the conversation has a queued or running run, a save
  in progress, or unsaved changes; the server checks again before the move (D61). One dialog
  holds the project, the conversation memory and the files
  (`../design/components/conversation-page.md` §2.1a). The file part is M6.
- UI-13.3: Deleting a project asks for confirmation. The dialog says: "To keep something from
  this project, ask a bot to write it to a file, then use Copy to." (D61). The project goes to
  Trash as one item, with its conversations, memory and Library files. The owner can restore the whole project,
  not one conversation, for `trash_days` (D47, D49).
- UI-13.4: When a bot saves, changes or forgets a memory, the conversation shows a system line
  ("BA remembered: target users are clinic staff · Project memory") with Undo. Undo reverts that
  change, even when memory history is off.
- UI-13.5: Bot memory is saved only in 1:1 conversations with that bot outside any project, and
  is read by that bot in every conversation.
- UI-13.6: Project memory is saved only in conversations inside the project, and is read only by
  bots in that project's conversations. A test proves a bot outside the project never receives
  it.
- UI-13.7: A Memory page lists memory by scope (each bot; each project; each multi-bot
  conversation outside a project), with search. Each item
  shows its text, who saved it, where, and when. A bot, project or conversation in Trash is not
  listed. Design: `../design/components/memory-page.md`.
- UI-13.8: The owner can edit or delete any item. When memory history is on, an item shows its
  earlier versions and the owner can restore one (UI-13.9).
- UI-13.9: "Keep memory history" is a setting on bot detail (per bot), on the project (per
  project), and at the top of the Memory pane of a multi-bot conversation outside a project
  (`../design/components/memory-pane.md` §1.1). It is off when a
  bot is created and on (5 versions) for projects and those conversations, because several bots
  write to them. Turning it on sets 5 versions per item,
  adjustable from 1 to 20. Lowering the number asks for confirmation before deleting the
  older versions.
- UI-13.10: A memory write that contains likely secrets is refused (D39). The bot is told why,
  and nothing is saved.
- UI-13.11: In a conversation with several bots outside any project, bot saves go to that
  conversation's memory ("Remembered · Conversation memory"), read only by the bots in that
  conversation. Each bot still reads its own bot memory there.
- UI-13.12: Moving such a conversation into a project lists its conversation memory with
  checkboxes (all ticked) to merge into the project memory. Unticked items go to Trash as
  memory items of the project, for `trash_days` (D62). When the project has no room for the
  ticked items (100), nothing moves and the dialog says how many to untick.
- UI-13.13: When the owner says "remember …" or "forget …", the bot saves or removes it in the
  current scope, and the "Remembered" or "Forgot" line appears. A fake-model test checks this.
- UI-13.14: With memory off, globally (UI-8.6) or for the conversation (UI-9.6), the bot's prompt
  has no memory and it is not offered the memory tools. A test checks both.
- UI-13.15: "Tidy" on a scope of the Memory page, or asking a bot to tidy its memory, produces a
  proposal card: each merge, rewrite or delete with a checkbox and before/after text. Nothing
  changes until the owner presses Apply. Applied changes can be undone like any other memory
  change. On the Memory page, Tidy is one model request with the model of the bot the owner
  picks (D63); it counts toward the daily caps and shows its cost on the card. A test with the
  fake model checks that the card changes nothing before Apply.
- UI-13.16: When a bot saves an item whose text is the same as an item in the same scope, the
  memory tool saves nothing and returns "already saved", and the conversation shows no second
  "Remembered" line. Example: "@BA @Designer remember: prices are in USD and EUR." gives one
  item. The check compares the text exactly (after trimming spaces); a similar text is a new
  item. A fake-model test checks this.
- UI-13.17: In an action run, a memory tool call for an item that is not on the approved plan's
  Memory list saves nothing and returns `memory_not_in_plan`. A fake-model test proves it (D56).
- UI-13.18: When an action run fails or stops after it saved memory, the unsaved changes card
  lists each saved item with Undo, next to the unsaved files (D52, D56).
- UI-13.19: Delete on a memory item moves it to Trash at once, with the toast "The item is in
  Trash." and no Undo. Restore puts it back in its place with its versions (D62). A restore into
  a place with 100 items is refused with 409 `memory_full`.
- UI-13.20: A Tidy row whose item changed after the request read it is off and not ticked.
  Apply checks each item's `row_version` again, applies the rows that still match, and returns
  the rows it skipped. A service test changes an item between the request and Apply.
- UI-13.21: Stop on a Tidy in flight cancels the request and stores no card. A Tidy request that
  was in flight when the app stopped is marked failed at the next start.
