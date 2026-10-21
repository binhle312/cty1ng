# D1. Single human, no login, localhost only

Status: accepted (2026-10-20)
Decision: Phase 1 has one human (the owner) and no authentication. The server binds to
`127.0.0.1` only. Every row that records an actor still stores `author_id` / `created_by`.
Why: Auth is real work and real risk; there is no second user yet. Keeping actor ids makes the
multi-user phase an addition, not a migration of meaning.
Rejected: Auth from day one (cost without a user who needs it).
Consequences: Must defend against other websites calling localhost (see `../security.md`).
Implemented in: `../security.md`, `../domain-model.md`.
