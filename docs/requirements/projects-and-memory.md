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
  Acceptance criteria: UI-13.4, UI-13.6.
- **PM-4.** As the owner, I want to see, edit, delete and recover what bots remember, so that
  nothing becomes permanent without my knowing. Acceptance criteria: UI-13.7 to UI-13.10,
  UI-13.13 to UI-13.15.
- **PM-5.** As the owner, I want bots in a multi-bot conversation outside any project to remember facts
  about that conversation's topic, so that a quick team conversation keeps its context without needing a
  project. Acceptance criteria: UI-13.4, UI-13.11, UI-13.12.

## Acceptance criteria (UI-13)

- UI-13.1: The rail groups conversations by project, with conversations outside any project
  in their own group. "+" offers "New conversation" in the current project or outside one.
- UI-13.2: The owner can create a project (name, one-line description), rename it, and move a
  conversation into or out of a project from the conversation's menu. Moving shows which memory
  the bots will use from then on.
- UI-13.3: Deleting a project asks for confirmation. Its conversations move out of the project,
  and its memory is recoverable for 30 days from the Memory page.
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
  shows its text, who saved it, where, and when.
- UI-13.8: The owner can edit or delete any item. When memory history is on, an item shows its
  earlier versions and the owner can restore one (UI-13.9).
- UI-13.9: "Keep memory history" is a setting on bot detail (per bot), on the project (per
  project), and in the settings of a multi-bot conversation outside a project. It is off when a
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
  checkboxes (all ticked) to merge into the project memory. Unticked items stay recoverable on
  the Memory page for 30 days.
- UI-13.13: When the owner says "remember …" or "forget …", the bot saves or removes it in the
  current scope, and the "Remembered" or "Forgot" line appears. A fake-model test checks this.
- UI-13.14: With memory off, globally (UI-8.6) or for the conversation (UI-9.6), the bot's prompt
  has no memory and it is not offered the memory tools. A test checks both.
- UI-13.15: "Tidy" on a scope of the Memory page, or asking a bot to tidy its memory, produces a
  proposal card: each merge, rewrite or delete with a checkbox and before/after text. Nothing
  changes until the owner presses Apply. Applied changes can be undone like any other memory
  change.

