# .agents/chief/scripts

The chief's scripts (owner, 2026-11-19, order 123). Each runs with `tsx`; `package.json` gives the
`pnpm` name. The shared code is in `lib/`. The tests sit next to the files.

| File | What it is for |
| --- | --- |
| `check-memory.ts` | `pnpm check:memory`: the chief memory in `../memories/` (fields, Check first form, `AGENTS.md` §7 list, index, privacy, sizes); `--write`, `--local` (private words, owner quotes) |
| `merge-check.ts` | `pnpm merge:check <PR>`: may the chief merge this PR? Two GitHub snapshots around the git diff at their commit ids; the merge line, or why not; run from a clean checkout of `origin/main` |
| `lib/` | The code behind the two scripts (its own index) |

Start here: `package.json` "scripts" for the command, then the script. Do not: change a file here in
a memory PR: this code is on the `AGENTS.md` §7 list, so the owner merges a change of it.
