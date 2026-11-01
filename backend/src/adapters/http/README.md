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
| `static.ts` | The built frontend in a production build: files, and `index.html` for page paths; never for `/api/*` |
| `routes/` | One file per route group |
| `routes/catalog.ts` | `GET /api/models` and `GET /api/tools` |
| `routes/health.ts` | `GET /api/health` |
| `routes/settings.ts` | `GET` and `PATCH /api/settings` |
| `routes/skills.ts` | Every `/api/skills` route (`docs/api.md` §2), the zip upload limit, `POST /skills/{id}/bots` |
| `routes/bots.ts` | Every `/api/bots` route (`docs/api.md` §4): list, create with `Idempotency-Key`, get, patch, delete, pinned order, clone template, pins |
| `routes/avatars.ts` | `GET /avatars/limits`, `POST /avatars` (with its body limit), `GET /avatars/{sha}.webp` with long cache headers |
| `uploads/` | Checks and readers for uploaded files |
| `uploads/avatar-image.ts` | Avatar images with `sharp` (`docs/security.md` §2.4): only the PNG, JPEG and WebP loaders, magic bytes, the pixel limit, a 256×256 WebP |
| `uploads/skill-zip.ts` | Reads a skill zip with the size, entry and path checks (`docs/security.md` §2.4); writes the export zip |
| `uploads/skill-zip.test.ts` | The zip checks: entries, sizes, zip slip, a SKILL.md over 1 MB |
| `routes/stream.ts` | `GET /api/stream`: parses `Last-Event-ID`, the SSE adapter writes the body |
| `routes/test-events.ts` | `POST /api/_test/events` (APP_ENV=test only, not in the OpenAPI schema) |
| `routes/api-docs.ts` | `GET /api/docs`: the OpenAPI docs page (APP_ENV=dev only), Swagger UI with no inline script |

Start here: `app.ts`. Do not: weaken a check in `middleware.ts` (`AGENTS.md` §7, §8).
