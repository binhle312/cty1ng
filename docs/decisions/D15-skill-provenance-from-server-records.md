# D15. Skill provenance from server records

Status: accepted (2026-10-20)
Decision: Each bot message shows the skills and versions its run loaded (always-loaded skills
plus every `load_skill` call), recorded by the server.
Why: Costs no tokens and is always accurate, because the server executes `load_skill` itself.
Rejected: Asking the bot to list its skills (costs tokens, can be wrong).
Consequences: Shows what was *loaded*, not proof the bot followed it.
Implemented in: `../domain-model.md` §3, `../requirements/conversation.md`.
