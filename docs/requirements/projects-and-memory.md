# Projects and memory

D37, D38. How conversations group into projects, and how bots remember things across
conversations. Technical design: `../domain-model.md` §11, §14.

## Stories

- **PM-1.** As the owner, I want to group conversations about one piece of work into a project,
  so that the bots working on it share what they learn and nothing leaks into unrelated work.
  Acceptance criteria: UI-13.1 to UI-13.3.
- **PM-2.** As the owner, I want a bot I chat with one-to-one to remember how I like it to work,
  and use that everywhere, so that I don't repeat my preferences in every conversation.
  Acceptance criteria: UI-13.4, UI-13.5.
- **PM-3.** As the owner, I want bots in a project to remember facts about the work, shared by
  every bot in the project, so that a new conversation in the project starts with context.
  Acceptance criteria: UI-13.4, UI-13.6.
- **PM-4.** As the owner, I want to see, edit, delete and recover what bots remember, so that
  nothing becomes permanent without my knowing. Acceptance criteria: UI-13.7 to UI-13.10.

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
- UI-13.7: A Memory page lists memory by scope (each bot; each project), with search. Each item
  shows its text, who saved it, where, and when.
- UI-13.8: The owner can edit or delete any item. When memory history is on, an item shows its
  earlier versions and the owner can restore one (UI-13.9).
- UI-13.9: "Keep memory history" is a setting on bot detail (per bot) and on the project
  (per project). It is off when a bot is created and on (5 versions) when a project is created,
  because several bots write to project memory. Turning it on sets 5 versions per item,
  adjustable from 1 to 20. Lowering the number asks for confirmation before deleting the
  older versions.
- UI-13.10: A memory write that contains likely secrets is refused (D39). The bot is told why,
  and nothing is saved.
