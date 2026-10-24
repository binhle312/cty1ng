# D29. SQLite now; switch to PostgreSQL on defined triggers

Status: accepted (2026-10-21). Confirms the database part of D10 and adds switch rules.
Amends: D10
Decision: Phase 1 stays on SQLite (WAL). The project moves to plain PostgreSQL when any of these
happens: (1) more than one human uses the app (M9); (2) more than one process writes to the
database; (3) p99 wait on `database is locked` exceeds 100 ms (logged metric); (4) a statistics
query over a year of data takes over 1 s after optimising Python bucketing. TimescaleDB and other
extensions are not used unless a later decision shows a workload that needs them.
Why: Scored against PostgreSQL, embedded PostgreSQL, Turso/libSQL, DuckDB and MongoDB, SQLite
won narrowly (4.25 vs 4.15) because local runs and tests need no setup, and the single writer
gives the event log its ordering for free. PostgreSQL is better on concurrency, time zone
bucketing and schema changes, which matter only from M9.
Rejected: PostgreSQL now (Docker for every local run and test, no phase 1 benefit); embedded
PostgreSQL via pgserver (0.1.x, fork chain); Turso (MVCC experimental); TimescaleDB (built for
millions of rows a day; ours is thousands a month, and its best features are under the Timescale
License, unavailable on some managed PostgreSQL services).
Consequences: Five guardrails from M0, listed in `../architecture.md` §10: no SQLite-only SQL;
portable UUID and UTC timestamp types; Alembic with `render_as_batch=True`; time bucketing behind
one function in the statistics service; from M9, tests also run on PostgreSQL and the event log
handles out-of-order commits.
Implemented in: `../architecture.md` §9, §10; `../domain-model.md` §13.1.
