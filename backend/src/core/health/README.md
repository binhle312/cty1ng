# health

`GET /api/health` (`docs/api.md` §7, `docs/architecture.md` §9).

| File | What it is for |
| --- | --- |
| `health.service.ts` | Database reachability, worker state (`not_started` until M3) and catalog counts |

Start here: `health.service.ts`.
