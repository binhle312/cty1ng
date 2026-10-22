# D37. Projects group conversations

Status: accepted (2026-10-21, owner), from the owner's product-brief interview. Amended by D45 (goal and instructions) and D47 (delete sends the whole project to Trash).
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
Resolved with the recommended answers (2026-10-21; the owner can still override):
- **Workspace scope.** Conversations in one project share **one workspace** (one folder and
  git repo), so the Designer in one conversation sees the BA's files from another. A
  conversation outside any project keeps its own workspace. Moving a conversation into a project
  does not move files; earlier files stay in the conversation's own workspace, which stays
  readable from it. The per-repo lock serialises git commits from runs in different
  conversations of the project. See `domain-model.md` §11.
- **When to build it.** Slice M5b, after M5 and before M6, so M6 builds the workspace at the
  right scope.
Implemented in: `../requirements/projects-and-memory.md`, `../domain-model.md` §11, §14.
