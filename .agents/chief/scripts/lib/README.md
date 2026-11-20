# .agents/chief/scripts/lib

The code behind the chief's scripts. A file that says "pure" in its first lines gets its inputs
(file texts, gh answers) from the caller.

| File | What it is for |
| --- | --- |
| `check-memory.ts` | The checks of `pnpm check:memory`: the chief memory fields, the Check first form, the `AGENTS.md` §7 list in the rules and in the list file, rules index, privacy, sizes, the --local owner quotes (pure) |
| `check-memory-local.ts` | The machine part of `pnpm check:memory`: the git file lists of the memory (`-z`), the exclude lines (`--local --fix`), the owner record, and a read that allows a missing file |
| `merge-list.ts` | The list of PRs that no standing permission covers (`AGENTS.md` §7): item texts, path rules, Not-checked items (pure) |
| `merge-check.ts` | The judgment of `pnpm merge:check`: a code, mixed or memory PR, and the memory gate (pure) |
| `merge-check-snapshot.ts` | The one GitHub read of `pnpm merge:check`: a GraphQL snapshot of the PR (state, head, base tip, author, checks with app and workflow file), with an injected command runner |
| `merge-check-diff.ts` | The file facts of `pnpm merge:check` from local git at the snapshot commit ids: one merge base, `--no-renames`, modes, blob texts, paths that main changed after the split |
| `merge-check-fixtures.ts` | Synthetic GraphQL answers for the merge-check tests (tests only) |
| `owner-quotes.ts` | The owner-quote check of order 109: rule quotes against the owner record (pure) |

Start here: the script in `../` that calls the file. Do not: read files, run git or gh in a file
that says "pure"; its caller passes those inputs.
