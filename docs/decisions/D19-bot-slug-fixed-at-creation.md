# D19. Bot slug fixed at creation

Status: accepted (2026-10-21)
Decision: Each bot gets a `slug` derived from its name at creation (`Business Analyst` →
`business-analyst`, de-duplicated with a numeric suffix). The slug never changes, even when the
name does. Workspace paths (`out/<slug>/`, `memory/<slug>.md`) use the slug.
Why: Names are editable, but paths in existing workspaces must stay stable.
Implemented in: `../domain-model.md` §2.

**Amended 2026-10-27 (round 17, path follow-up).** Workspace paths no longer use the slug. D52
dropped `out/<slug>/`: Library folders are by topic, not by bot. D38 moved memory into the
database, so `memory/<slug>.md` is gone too. The slug stays fixed and unique; it names the bot
in the app, for example in run records and links.
