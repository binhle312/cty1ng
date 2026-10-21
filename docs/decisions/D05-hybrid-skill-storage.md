# D5. Hybrid skill storage

Status: accepted (2026-10-20)
Decision: The database is the source of truth for bots and skills. The Web UI is the everyday
editor. "Import from folder" (UI and CLI) brings `SKILL.md` folders in one way, with a preview;
export writes them out.
Why: The UI is the main editor, so files-as-truth would mean two-way sync (file watcher,
conflicts, invalid files) and would not work on a VPS where the owner has no local folder.
Import still lets the owner author skills in an editor or with an AI agent.
Rejected: Files + git as source of truth; database with zip import only.
Implemented in: `../domain-model.md` §3.
