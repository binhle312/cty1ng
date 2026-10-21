# D8. History choice when a bot joins

Status: accepted (2026-10-20)
Decision: When a bot is added, the app posts a system card asking the owner what the bot may
read: full history or from here on. The bot cannot run until the owner chooses. The bot reads
history with every line labelled by speaker.
Why: The owner decides what context (and cost) a new bot gets. A system card is deterministic
and costs no tokens.
Rejected: Always full history; always from join point; the bot asking in its own words.
Implemented in: `../conversation-rules.md` §3–4.
