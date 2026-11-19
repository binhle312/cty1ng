# .agents/chief/scripts/lib

The code behind the chief's scripts. A file that says "pure" in its first lines gets its inputs
(file texts, gh answers) from the caller.

| File | What it is for |
| --- | --- |
| `check-memory.ts` | The checks of `pnpm check:memory`: the chief memory fields, the Check first form, the `AGENTS.md` §7 list in the rules and in the list file, rules index, privacy, sizes, the --local owner quotes (pure) |
| `check-memory-local.ts` | The machine part of `pnpm check:memory`: the git file lists of the memory (`-z`), the exclude lines (`--local --fix`), the owner record, and a read that allows a missing file |
| `merge-list.ts` | The list of PRs that no standing permission covers (`AGENTS.md` §7): item texts, path rules, Not-checked items (pure) |
| `merge-check.ts` | The judgment of `pnpm merge:check`: a code, mixed or memory PR, and the memory gate (pure) |
| `merge-check-gh.ts` | The gh reads of `pnpm merge:check`, with an injected command runner |
| `owner-quotes.ts` | The owner-quote check of order 109: rule quotes against the owner record (pure) |

Start here: the script in `../` that calls the file. Do not: read files, run git or gh in a file
that says "pure"; its caller passes those inputs.
