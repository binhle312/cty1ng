# D6. Skill versions are pinned per bot (Go-modules style)

Status: accepted (2026-10-20). Supersedes an earlier draft where edits applied to every bot.
Decision: Skill versions are immutable integers (v1, v2, …). Each bot pins one version per
skill. Editing a skill creates a new version and never moves a pin. Upgrading or downgrading is
an explicit action per bot. After saving, the author is offered "also upgrade these bots",
unchecked by default.
Why: A bot's behaviour must not change because a skill was edited, exactly as a Go module does
not change until the consumer runs `go get`.
Rejected: Floating "latest" (silent behaviour change); semantic versioning (prose has no
machine-checkable compatibility, so major/minor/patch is guesswork).
Consequences: Fixing a skill needs an explicit upgrade per bot; the save dialog reduces this.
Implemented in: `../domain-model.md` §3, `../requirements/bots.md` (UI-6), `../requirements/skill-hub.md`.
