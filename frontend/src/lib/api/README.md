# api

The typed API client (AGENTS.md §5 rule 4). `pnpm gen:api` (`scripts/gen-api.ts`) writes
`generated/` from the backend's OpenAPI document with Hey API: types, Zod schemas that check
every response, and TanStack Query options (`useQuery(getHealthOptions())`).

| File | What it is for |
| --- | --- |
| `client.ts` | Points the generated client at relative `/api` URLs |

Start here: `generated/@tanstack/react-query.gen.ts`. Do not: edit `generated/` by hand, or
call `fetch` for an API endpoint.
