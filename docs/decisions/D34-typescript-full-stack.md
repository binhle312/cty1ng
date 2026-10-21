# D34. TypeScript on the backend and the frontend

Status: accepted (2026-10-21, owner). Supersedes D10.
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
Rest of the stack (owner, 2026-10-21):

| Concern | Choice | Considered |
| --- | --- | --- |
| Runtime | Node 24 LTS | Bun (fast, but less mature for native modules like `better-sqlite3`) |
| Database layer | Drizzle + drizzle-kit (SQL migrations, SQLite now and Postgres later, D29) | Prisma 7 (best migration tooling, heavier); Kysely (no migration generator) |
| Model calls | Vercel AI SDK (`ai`): many providers, streaming, tools, usage per request | Mastra (on top later if workflows are needed); single-vendor SDKs; LangGraph.js |
| Job queue | Rows in `runs` with leases in phase 1; pg-boss once on Postgres | Graphile Worker; BullMQ (needs Redis) |
| Frontend | D28 unchanged: React + Vite SPA, TanStack Router and Query, shadcn/ui on Base UI | Next.js and TanStack Start (server rendering the app does not need); SvelteKit, Solid |

Each library sits behind a port (D35), so a choice here can be replaced by one adapter.

Older decisions name Python tools; read them as their TypeScript equivalents. Their decisions
stand; only the tool changes:

| In D17, D21, D22, D29 | Now |
| --- | --- |
| Pydantic, `extra="forbid"` | Zod, `.strict()` |
| Pydantic AI (`RequestUsage`, provider-neutral messages) | AI SDK usage per step and its message format, behind the model port |
| `genai-prices` (Python) | `@pydantic/genai-prices` (npm, early 0.x; the `config/models.yaml` override covers gaps) |
| SQLAlchemy, Alembic `render_as_batch=True` | Drizzle, drizzle-kit (rebuilds SQLite tables when needed) |
| `uuid.uuid7()` | `uuidv7` package behind the ids port |
| pytest, ruff, pyright, pip-audit | Vitest, ESLint + Prettier, `tsc`, `pnpm audit` |
| Python time bucketing | TypeScript bucketing with Node's time zone data |

Implemented in: `../architecture.md`, `../../AGENTS.md` §4 and §10, `../testing.md`, `../tasks/M0-skeleton.md`.
