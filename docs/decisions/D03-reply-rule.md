# D3. Reply rule

Status: accepted (2026-10-20)
Decision: Mentioned bots reply. If a conversation has exactly one active bot, it replies to
every human message. With two or more bots and no mention, nobody replies.
Why: Predictable cost and no noise.
Rejected: All bots reply to every message (N× cost, chaotic threads).
Implemented in: `../conversation-rules.md` §1.
