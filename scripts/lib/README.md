# scripts/lib

The code behind the repository scripts. The tests sit next to the files. A file that says
"pure" in its first lines gets its inputs (file texts, git output) from the caller.

| File | What it is for |
| --- | --- |
| `check-index.ts` | The checks of `pnpm check:index`: folder indexes, story ranges, decisions metadata |
| `check-design.ts` | The design snapshot colours against the token file (called by `check-index.ts`) |
| `check-memory.ts` | The checks of `pnpm check:memory`: the chief memory fields, rules index, privacy, sizes |
| `check-events.ts` | The checks of `pnpm check:events` |
| `check-status.ts` | The checks of `pnpm check:status` (pure) |
| `check-status-git.ts` | Reads the first-parent git history for `pnpm check:status` |
| `records-counts.ts` | The counts of `pnpm records:counts`: the ledger rows give the Audit row and the register cells |
| `check-bundle.ts` | The bundle budget, measured on a production build |
| `breaks.ts` | The break list of a PR: claims, breaks, links, coverage (pure) |
| `breaks-static.ts` | The break-list rules that need no test run (the runner and the CI job) |
| `breaks-apply.ts` | The copy step of `pnpm check:breaks`: puts the local changes into the copy of HEAD |
| `db-schema.ts` | The schema of a SQLite database as `db:check` compares it |
| `e2e-data-dir.ts` | The data folder of one e2e run |
| `e2e-serve-marker.ts` | The mark that the e2e servers on the ports belong to this checkout |
| `e2e-serve-run.ts` | Starts the e2e servers and owns the marker (`pnpm e2e:serve`) |
| `e2e-server-ready.ts` | How Playwright decides that a server it started is up |
| `process-group.ts` | Shell commands as their own process group, so a stop reaches the whole tree |
| `report.ts` | Prints the problems of a check and sets the exit code |
| `workspace.ts` | The package folders of `pnpm-workspace.yaml` |

Start here: the script in `../` that calls the file. Do not: read files, run git or use the clock
in a file that says "pure"; its caller passes those inputs.
