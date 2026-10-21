# D34. TypeScript on the backend and the frontend

Status: accepted (2026-10-21, owner). Supersedes D10. Framework choices pending (below).
Decision: The backend is written in TypeScript on Node, like the frontend. The project starts
from scratch, so nothing from the Python prototype is ported as code; behaviour is ported
(`../porting-guide.md`).
Why: One language and one schema system (Zod, D33) across both halves, so API and event
types are defined once. The owner asked for the choice that holds up at VPS scale; at that
scale throughput is bound by model providers and the database, not the language, so the
deciding factor is one toolchain for people and agents.
Rejected: Python (D10; its advantage was reusing prototype code, which no longer applies); Go
(strong for services, but a second language and weaker LLM SDK support).
Open, recommended to the owner on 2026-10-21: HTTP framework Hono (alternative Fastify);
database layer Drizzle (alternative Prisma); model calls through the Vercel AI SDK; jobs on
pg-boss once on Postgres. Frontend D28 unchanged. The chosen set is recorded here when the
owner confirms it, and the Python references in the docs switch in the same PR.
Implemented in: pending (`../architecture.md` after the framework choice).
