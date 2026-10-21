# D14. Skill authorship and cloning

Status: accepted (2026-10-20)
Decision: Each skill has an author. Only the author can create versions or deprecate it.
Anyone can clone a skill into a new skill they own; a clone records its origin and is never
synced afterwards.
Why: Ownership is clear before multi-user arrives; retrofitting ownership is expensive.
Rejected: Shared editing; ownership only when multi-user arrives.
Implemented in: `../domain-model.md` §3.
