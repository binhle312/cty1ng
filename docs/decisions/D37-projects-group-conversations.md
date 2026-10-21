# D37. Projects group conversations

Status: proposed (2026-10-21), from the owner's product-brief interview.
Decision: A new **Project** entity groups conversations about one piece of work. A project has a
name, a short description, its conversations and its project memory (D38). Later it is also
what an external folder attaches to (D23 attaches the folder to the project, not to each
conversation). A conversation belongs to at most one project. A 1:1 chat with one bot can sit
outside any project, and that is where bot memory is learned (D38).

- The rail groups conversations by project. Conversations outside any project form their own
  group. The owner can create a project, rename it, and move a conversation into or out of a
  project.
- Moving a conversation changes which project memory its bots read and write from then on.
  Memory already saved stays where it was saved.
- Deleting a project is soft, like bots: its conversations move out of the project and its
  memory stays recoverable for 30 days.

Why: The owner's BA and Designer work on projects that span several conversations. Without a
project there is no boundary for shared facts: either every conversation starts from nothing,
or facts leak between unrelated work.
Rejected:
- **Project = one conversation:** a project needs several threads of work (stories, design, a
  side question) without one endless chat.
- **Tags instead of projects:** a conversation could carry several tags, so it would be unclear
  which memory applies.
Open for the owner:
- **Workspace scope.** Today each conversation has its own workspace folder. Should
  conversations in one project share one workspace, so the Designer in one conversation sees
  the BA's files from another? Recommended: yes. One workspace per project, with 1:1 chats
  outside projects keeping their own. That changes `domain-model.md` §11 and M6.
- **When to build it.** Recommended: a slice after M5 (M5b), before the workspace work in M6,
  so M6 builds the workspace at the right scope.
Implemented in: `../requirements/projects-and-memory.md`, `../domain-model.md` §14 (proposed).
