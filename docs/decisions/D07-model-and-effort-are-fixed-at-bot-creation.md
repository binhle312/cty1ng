# D7. Model and effort are fixed at bot creation

Status: accepted (2026-10-20)
Decision: `model_id` and `effort` cannot be changed after a bot is created. To change them, the
owner clones the bot. A bot whose model is retired becomes "unavailable" and offers "Clone with
another model".
Why: Stable behaviour; a bot's history was produced by one model.
Rejected: Editable model (a bot silently changes character mid-conversation).
Implemented in: `../domain-model.md` §2 and §4, `../requirements/bots.md`.
