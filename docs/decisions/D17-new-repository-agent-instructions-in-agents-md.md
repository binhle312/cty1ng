# D17. New repository; agent instructions in AGENTS.md

Status: accepted (2026-10-20)
Decision: The app lives in a new standalone repository. Code from the Discord prototype is
ported module by module (`../porting-guide.md`), not copied wholesale. Agent rules live in
`AGENTS.md`; `CLAUDE.md` contains only `@AGENTS.md`.
Why: The owner builds with both Claude Code and Codex. Codex reads `AGENTS.md`; Claude Code
reads `CLAUDE.md` (it can fall back to `AGENTS.md` in recent versions, but not on every
platform), so the import line makes one file authoritative for both.
Implemented in: `AGENTS.md`, `../workflow.md`.
