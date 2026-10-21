# D4. Bot-to-bot discussion with a server-enforced turn budget

Status: accepted (2026-10-20)
Decision: Bot discussion is a toggle (global default, per-conversation override) with a turn
limit (default 5, range 1–20). The server counts and enforces it. Bots are told the budget in
their prompt so they can plan and conclude.
Why: Models cannot be trusted to count; the prompt makes them plan, the server makes it safe.
Rejected: Prompt-only limits; unlimited bot chat.
Implemented in: `../conversation-rules.md` §2.
