# D19. Bot slug fixed at creation

Status: accepted (2026-10-21)
Decision: Each bot gets a `slug` derived from its name at creation (`Business Analyst` →
`business-analyst`, de-duplicated with a numeric suffix). The slug never changes, even when the
name does. Workspace paths (`out/<slug>/`, `memory/<slug>.md`) use the slug.
Why: Names are editable, but paths in existing workspaces must stay stable.
Implemented in: `../domain-model.md` §2.
