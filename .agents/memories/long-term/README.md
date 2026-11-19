# long-term

The chief memory that git keeps. It is public, and only a PR changes it (`../README.md`,
"Promote"). The read order at start is in `../README.md`.

| File | What it is for |
| --- | --- |
| `identity.md` | Who the chief is, the owner, the values, the short Simple English rules, the "Never" list |
| `settings.md` | The values that the method reads, each with its source |
| `environment.md` | Facts of this repository and its tools; commands that fail, and the fix |
| `rules/` | The owner's standing rules, one in each file, and their generated index |
| `lessons.md` | Traps and their fixes, one line each |
| `state.md` | The state at the last promotion: open PRs, waits, the chief's queue, the next free ids |
| `restore.md` | Restore on a new computer, a clone, a crash; what a restore cannot give |
| `restore-drill.md` | The questions that prove a restore, with their answers; the drill runs without this file |
| `log.md` | Each promotion, lint, drill and migration |

Start here: `../README.md`. Do not: edit `rules/README.md` by hand (`pnpm check:memory --write`
makes it), or write a private fact here (`../README.md`, "Privacy").
