# scripts

Repository scripts: the checks that CI runs, the code generators, the e2e servers and the
evidence tools. Each script runs with `tsx`; `package.json` gives the `pnpm` name. The shared
code is in `lib/`.

| File | What it is for |
| --- | --- |
| `check-index.ts` | `pnpm check:index`: folder indexes and docs metadata (`docs/architecture.md` §4.2) |
| `check-events.ts` | `pnpm check:events`: the event table of `docs/realtime-events.md` §4 matches `shared/` |
| `check-status.ts` | `pnpm check:status`: checks Done rows and rejects typed measures in `docs/status.md` |
| `records-counts.ts` | `pnpm records:counts`: check the counts in [delivery-quality-register.md](../docs/delivery-quality-register.md) against the ledger rows. `--write` updates them. |
| `check-bundle.ts` | `pnpm check:bundle`: the first-load bundle budget, after `pnpm build` |
| `check-breaks.ts` | `pnpm check:breaks <list>`: runs the break list of a PR (`docs/testing.md` §5); run by hand |
| `check-breaks-static.ts` | `pnpm check:breaks:static <list>`: the break-list rules that need no test run; CI runs it |
| `db-check.ts` | `pnpm db:check`: the Drizzle schema and the committed migrations agree |
| `lint-imports.ts` | `pnpm lint:imports`: the import rules of `docs/architecture.md` §4.1 on each package |
| `gen-api.ts` | `pnpm gen:api`: the typed API client in `frontend/src/lib/api/generated/` |
| `gen-case-folding.ts` | `pnpm gen:case-folding <CaseFolding.txt>`: the Unicode case folding table in `shared/` |
| `e2e-serve.ts` | `pnpm e2e:serve`: starts the e2e servers and keeps them running (`docs/testing.md` §3) |
| `start.ts` | `pnpm start`: the production build in one command |
| `guard-compare.ts` | Evidence for a guard change: the old guard against the checked-out guard; run by hand |
| `guard-mutations.ts` | Evidence for a guard change: proves that tests hold the guard and import rules; run by hand |
| `lib/` | The code behind the scripts (its own index) |
| `breaks/` | The break list of each PR, `pr-<n>.json` (`docs/testing.md` §5); data, no index |
| `fixtures/` | Inputs of `guard-mutations.ts`, the break runner trial and the e2e fresh-run tests |

Tests of the repository rules also live here, with no script of their own: `check-design`,
`dev-proxy`, `e2e-config`, `e2e-fresh-run`, `e2e-server-reuse`, `import-rules`, `lint-rules` and
`one-clock` (each `*.test.ts` file names its rule in its first lines).

Start here: `package.json` "scripts" for the command, then the script. Do not: put a new check
only in CI; give it a `pnpm` name and a row here.
