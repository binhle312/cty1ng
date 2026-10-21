# D16. "Always load" per pinned skill

Status: accepted (2026-10-20)
Decision: Each bot–skill pin has an `always_load` flag, off by default. On: the skill body is in
the prompt every run. Off: the prompt lists name and description, and the bot calls
`load_skill`.
Why: Shared rules (writing style, security rules) must apply to every reply and would never be
looked up on demand; most playbooks are only needed sometimes.
Rejected: On-demand only.
Implemented in: `../domain-model.md` §3, `../conversation-rules.md` §4.
