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

**Amended 2026-11-01 (owner, M2 spec gap pass).** The slug rule is exact now: accents removed,
"đ" → "d", lower case `a–z`, `0–9` and "-"; an empty result becomes `bot`; at most 40 characters
with the suffix; `new` is reserved; a slug held by any bot row, a purged one too, is never
reused. The full rule is in `../domain-model.md` §2 Slug.
