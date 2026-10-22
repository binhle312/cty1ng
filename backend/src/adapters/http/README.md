# adapters/http

Hono routes and middleware (architecture.md §3). Handlers parse, call one service, map the
result. Security-sensitive: changes need the owner's review (AGENTS.md §7).

| File | What it is for |
| --- | --- |
| `app.ts` | Builds the Hono app: middleware order, error handler, routes |
| `routes.ts` | OpenAPI route definitions and response schemas |
| `security.ts` | Security headers, Host check, Origin check, CORS, body limit (security.md §2.1, §2.7) |
| `request-context.ts` | Request id and per-request logger |
| `errors.ts` | The error shape (api.md §1) and validation errors |
| `context.ts` | Types of the per-request values |

Start here: `app.ts`. Do not: put business rules or SQL in a handler.
