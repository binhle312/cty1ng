# D11. One run at a time per conversation

Status: accepted (2026-10-20)
Decision: Runs in a conversation execute one at a time. Mentioned bots run in mention order.
Why: Each bot sees the previous bot's reply; order is deterministic and testable.
Rejected: Parallel runs (faster, but bots answer the same snapshot and contradict each other).
Implemented in: `../conversation-rules.md` §1, `../architecture.md` §6.
