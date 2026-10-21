# D13. Editing a message creates a branch

Status: accepted (2026-10-20)
Decision: Editing a human message creates a sibling message and a new branch, like ChatGPT and
Claude.ai. Earlier versions stay reachable with ‹ n/m ›. Bots see only the active path.
Individual messages cannot be deleted. Workspace files and handoffs are not rolled back.
Why: Nothing a bot saw is rewritten in place, so history and runs stay auditable.
Rejected: Editing in place (bots' replies would answer text that no longer exists); no editing.
Implemented in: `../conversation-rules.md` §6.
