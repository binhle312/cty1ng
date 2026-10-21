# D24. Statistics page

Status: accepted (2026-10-21)
Decision: A `/stats` page with charts and tables for models, bots and skills over a chosen
period, built on the usage data from D21 and provenance from D15. Includes a "pinned but never
loaded" list for skills.
Why: The owner wants to see where money goes and which bots and skills do the work. The data is
already captured, so the cost is queries and UI.
Rejected: An external analytics stack (Grafana, Metabase): more moving parts for one user;
possible in the VPS phase by pointing it at the database.
Consequences: Needs a charting library (new dependency, owner approves in the M7 plan). Recharts is the
default candidate (React-native, widely used); the builder may propose another in the plan.
Implemented in: `../requirements/statistics.md`, `../domain-model.md` §13.1, `../api.md` §7, `../tasks/M7-statistics.md`.
