# http

The Hono app (`docs/api.md`). Handlers parse input, call one service and map the result
(`AGENTS.md` §5 rule 2).

| File | What it is for |
| --- | --- |
| `app.ts` | The app: middleware in request-path order, routes, the OpenAPI document |
| `middleware.ts` | Request id, access log, Host and Origin checks, security headers, CORS, body limit (`docs/security.md` §2.1) |
| `errors.ts` | `ApiFailure`, the one error shape, the generic error handler (no stack to the client) |
| `router.ts` | Makes every router, so all routes validate the same way (422 `validation_error`) |
| `context.ts` | The values every handler reads from the context: request id, logger |
| `routes/` | One file per route group |
| `routes/health.ts` | `GET /api/health` |
| `routes/stream.ts` | `GET /api/stream`: parses `Last-Event-ID`, the SSE adapter writes the body |
| `routes/test-events.ts` | `POST /api/_test/events` (APP_ENV=test only, not in the OpenAPI schema) |

Start here: `app.ts`. Do not: weaken a check in `middleware.ts` (`AGENTS.md` §7, §8).
