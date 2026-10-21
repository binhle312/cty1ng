# D34. TypeScript on the backend and the frontend

Status: accepted (2026-10-21, owner). Supersedes D10. Hono chosen; other framework choices pending (below).
Decision: The backend is written in TypeScript on Node, like the frontend. The project starts
from scratch, so nothing from the Python prototype is ported as code; behaviour is ported
(`../porting-guide.md`).
Why: One language and one schema system (Zod, D33) across both halves, so API and event
types are defined once. The owner asked for the choice that holds up at VPS scale; at that
scale throughput is bound by model providers and the database, not the language, so the
deciding factor is one toolchain for people and agents.
Rejected: Python (D10; its advantage was reusing prototype code, which no longer applies); Go
(strong for services, but a second language and weaker LLM SDK support).
HTTP framework (owner, 2026-10-21): Hono on Node. Validation is Zod-native, and
`@hono/zod-openapi` generates the OpenAPI schema the frontend client is built from, so API
types are written once. Built-in middleware covers multipart uploads, `bodyLimit`,
`secureHeaders` and CORS. Logging is Pino, added as middleware. Rate limiting
(`hono-rate-limiter`) is added only at M9, for the VPS deployment. The built-in multipart parser
buffers uploads in memory; that is fine for our small upload caps (`../security.md`), but a
streaming parser is needed if large files are ever allowed.
Considered: Fastify with `fastify-type-provider-zod` (more mature plugin system, but Zod
comes through an adapter, and its JSON Schema-first design would mean two schema systems).
Still open, recommended to the owner on 2026-10-21: database layer Drizzle (alternative
Prisma); model calls through the Vercel AI SDK; jobs on pg-boss once on Postgres; frontend D28
unchanged. They are recorded here when the owner confirms them, and the Python references in
the docs switch in the same PR.
Implemented in: pending (`../architecture.md` after the framework choice).
