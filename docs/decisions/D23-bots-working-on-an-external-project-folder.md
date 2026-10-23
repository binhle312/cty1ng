# D23. Bots working on an external project folder

Status: accepted in principle (2026-10-21); built in a later milestone after phase 1. Amended by D52: each run writes on its own branch, which saves into `bots/<conversation-slug>`
Decision: A conversation can **attach a project folder** elsewhere on the machine. Bots in that
conversation then work *in that project*, following its rules:
- the project's `AGENTS.md` (or `CLAUDE.md` if there is no `AGENTS.md`) is added to every bot's
  prompt, after the persona and before the bot's own skills, and it wins over the bot's general
  habits where they conflict (the persona still defines the role);
- `SKILL.md` folders under `.agents/skills/` and `.claude/skills/` appear as **project skills**
  next to the bot's pinned skills; their version is the project's git commit, recorded in
  provenance;
- a deny-list hides secrets (`.env*`, `*.pem`, `*.key`, `id_*`, `.git/` internals, and
  git-ignored paths), because anything a bot reads is sent to the model provider.
First use (owner's choice): **documents only**, meaning bots read the project and write
documents (for example into `docs/` of that project). The design must not assume read-only:
later, bots may create, edit, move and delete files there. To keep that safe when it comes:
- writes are limited to paths the owner allows per attached project;
- every bot change lands on a dedicated git branch (`bots/<conversation-slug>`) as commits by
  the bot, never on the owner's current branch; the owner reviews and merges;
- deletes and moves need the owner's approval card, like handoffs;
- no shell or code execution through this feature: running builds or tests is handed to a coding
  agent (Claude Code, Codex), not grown inside the app.
Why: The owner wants bots to respect each project's own conventions, and to keep the door open
for richer file work without redesigning.
Rejected: Copying project files into the conversation workspace (stale copies, rules lost);
direct writes to the owner's working tree (no review, conflicts with the owner's own edits).
Implemented in: a future milestone brief; `../security.md` must be extended before it starts.
