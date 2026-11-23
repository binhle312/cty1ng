# short-term

The chief's memory on this computer only, and the current source of truth (owner, 2026-11-19,
order 72). Git ignores each file here except this README: `.gitignore` has the lines, and
`pnpm check:memory --local --fix` adds them to `.git/info/exclude` too. There is no backup
(owner, 2026-11-19, arena Q4 A): a fact that is not promoted is lost with the computer.

| File | What it holds | Format |
| --- | --- | --- |
| `now.md` | The live state: work in flight, running agents, waits, the next step | Rewrite it after each event. First line: `As of: YYYY-MM-DD HH:MM +ZZZZ` |
| `inbox.md` | New facts that are not on `main` yet | `- YYYY-MM-DD (source): fact` |
| `log.md` | What happened, in order | `- YYYY-MM-DD HH:MM +ZZZZ: event` |
| `private.md` | Facts that must not be public: names, ids, paths | Free text |
| `private-words.txt` | Words that no long-term file may hold; `pnpm check:memory --local` reads it | One word on each line |
| `owner/` | The owner's orders and answers word for word, with numbers; the owner pages; `decisions.tsv` | One `.md` file for each day or topic, with the owner's words only: the owner-quote check reads each `.md` file (order 109) |
| `handoffs/` | The chief's handoffs and clone prompts | `handoff_vN.md` |
| `leaders/` | The common context for leaders, and their handoffs | One folder for each leader slug |
| `reviews/` | Reviewer reports | One file for each review |
| `audits/` | The reports of the memory audit (rule R-037), and `cron.log` | `YYYY-MM-DD-HH.md` |

The chief writes its notes in its own worktree (git-ignored `tmp/` or `short-term/`), never in the
shared checkout (owner, 2026-11-19, #139 fixes page Q4 A).

The `orders:` numbers of the rule files are the numbers of the order file in `owner/`.
A promotion copies facts from here to `long-term/` in public form (`../README.md`, "Promote").
