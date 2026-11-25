# A script for the Codex commands of the `leader` skill

Brief: no brief file. The owner's words in the lead agent's conversation, 2026-11-25, about the
start and resume commands of `references/codex.md`: "Should we make tools to do these commands?
Will that reduce the token consumption and still keep the quality of the communication?", then
"let ask our consultants about the scripts, the tools, the pros and cons that we can learn", then
"Yes, i want that script, the sooner we have the better".
Checkpoint: plan. The script is a new tool, and it starts billed models (`AGENTS.md` §7), so the
owner approves this plan and its code design before the build.
Approval: waiting.

Base: this branch starts from the head of #156 (`a600a49`), because the script changes files that
only #156 adds. It merges after #156.

## Why

The consultants (Opus 5.5 and GPT-6.2 Astra, effort high) agreed: a script saves few tokens, and no
one measured the saving; it does not change the messages, because the brief, the messages and the
report stay files; its real gain is reliability. Their reports and the lead agent's answers are in
`tmp/leader-skill/consult-scripts/` (not in the repository).

The lead agent's tool outside the repository (`tmp/leader-skill/tools/run-codex.sh`, 25 turns in
one session) showed the bugs that a script must not have:
- it always exits 0, so a failed run looks like success;
- the stop at 35% never ran;
- after a resume it reads the count of the old turn, so it can stop the handoff turn;
- it skips the check with no message when it cannot read the context;
- a relative path breaks after its `cd`;
- the limit and a one-hour timeout are fixed in the code (`AGENTS.md` §10).

It also fixes two gaps of #156 in `references/codex.md`:
1. "Stop a run" uses `$!`, which the lead agent does not have: it starts each run as a background
   command of Claude Code, with no `&`.
2. The windows. Line 24 has OpenAI's numbers (Sol and Terra 500,000, Astra 272,000). The owner,
   2026-11-25: "astra is 258k like you said, sol is 475l as I checked directly in codex session",
   and Terra "they reduce it to 475k only". Codex reports Sol 475,000 and Astra 258,400 in its
   session files.

## Risk probes

Results: `tmp/leader-skill/probes/RESULTS.md` (codex-cli 0.172.0; the owner allowed the stop
probes).
- `codex queue` does not reach a running `exec`. The message joins the next `resume`.
- SIGINT during a turn: exit code 1, an empty report file, no `turn.completed` event, no child left;
  the session resumes and remembers the turn.
- A stop of the Claude Code background command ended codex and each child, when codex ran in the
  shell's process group. Not tested under GNU `timeout`, which makes a new process group.
- `resume` takes `--strict-config` and `--ignore-user-config`, not `-p`, `-s` or `-C`.

## Code design

**Options.**

| Option | Gain | Cost |
| --- | --- | --- |
| A. One script in the skill that starts, resumes, watches and stops | One home for the commands; the 35% check runs by itself; the same options on each resume | A script to keep and test; a Codex change breaks it in one place |
| B. No script; fix the text only | Nothing new to keep | The lead agent polls the context, types each option again, and can forget the stop |
| C. Codex profiles (`-p`) | Codex reads the options | `resume` has no `-p`; profiles live outside the skill; no watch |

Pick: **A** (both consultants).

**Language.** Node, one file `.mjs` with no packages, as the scripts of the `decision-pages` skill.
Node is on each machine that runs Claude Code. It has no GNU `timeout`, so the script does not
depend on one.

**Files.** `.agents/skills/leader/scripts/codex-run.mjs` and `scripts/selftest.mjs` (a fake `codex`
and a fake session folder). No repository path in either file.

**Commands.**
- `start`: required `--prefix`, `--workdir`, `--brief`, `--model`, `--effort`, `--sandbox`,
  `--limit`; optional `--writable-root` (one or more), `--network`, `--image`, `--skip-git-check`.
  It makes each path absolute, refuses a prefix whose files exist, writes `<prefix>-args.json`,
  and runs `codex exec`.
- `send`: `--prefix`, `--message`, and `--handoff` for the handoff turn. It reads
  `<prefix>-args.json`, so each resume has the same model, effort, sandbox, roots and network. It
  runs `codex exec resume <thread>` in the work folder. Each turn gets its own files
  (`<prefix>-t<n>-events.jsonl`, `-report.md`, `-log.txt`).
- `context`: `--prefix` or `--thread`. It prints the context use from the session file.
- `stop`: `--prefix`. It sends SIGINT to the codex process in `<prefix>-pid`, and checks that it
  ended.

**The watch.** While a turn runs, the script reads the last `token_count` of the session file
(`$CODEX_HOME/sessions/**/rollout-*-<thread>.jsonl`). It compares raw numbers:
`used × 100 ≥ limit × window`, with the window that Codex reports. In a handoff turn, it does not
stop the run at the limit, and it reads only counts that came after the turn started.

**Ends.** The script prints one last line:
`state=<state> thread=<id> context=<percent> window=<tokens> report=<file> exit=<code>`.

| State | Exit code | Meaning | The lead agent's next step |
| --- | --- | --- | --- |
| `done` | 0 | The turn ended, and the report file is not empty | Read the report |
| `limit` | 3 | The context use reached the limit; the script stopped the turn | The handoff steps of `SKILL.md` |
| `watch-error` | 4 | The script could not read the context for 3 checks after the thread started; it stopped the turn | Run `context`; tell the owner if it fails again |
| `codex-error` | 5 | Codex exited with a code that is not 0, or the report is empty | Read the log |
| `stopped` | 6 | A `stop` command or a signal to the script ended the turn | As the lead agent decided |
| usage error | 2 | A missing or bad option | Fix the command |

**Signals.** The script starts codex in the script's process group (no new group), so a stop of the
Claude Code command reaches codex too, as in probe 2. A new group could leave codex running when the
script itself is killed. On SIGINT or SIGTERM, the script sends SIGINT to codex, waits for it to
end, writes `stopped`, and exits.

**Logs.** `<prefix>-run.log` gets `codex --version`, the exact command (with no secret), each
context reading, and the end. The script refuses `--ephemeral`, because a session with no file has
no watch.

**One home for each value** (`AGENTS.md` §10, F1).
- The limit (35%) stays in `SKILL.md`, "Context of each worker". The script has no default:
  `--limit` is required, and the lead agent passes the number from `SKILL.md`.
- No timeout by default. A turn with the full checks can take more than one hour.
- The check interval (20 s) is part of the watch, not a limit that the owner sets. It is a constant
  in the script.
- The model table stays in `references/codex.md`. The script has no presets.

**What changes in the skill.**
- `references/codex.md`: "Start", "Send a message", "Context use" and "Stop a run" become the
  script's use, with the end table. "Commit and push" names the script options. The window line
  becomes the windows that Codex reports, with the date and the owner's words. "The sandbox is not
  a hard limit" and "Review run" stay.
- `SKILL.md`: "Context of each worker" and "Stop a worker's run" point to the script. The 35% rule
  and the handoff steps do not change.
- `GUIDE.md`, `references/worker-brief.md`, `.agents/skills/README.md`: only the pointers and the
  index row.

## Test strategy

`scripts/selftest.mjs` puts a fake `codex` (a Node file) first on `PATH`, and a fake `CODEX_HOME`.
The fake writes `thread.started`, a session file with `token_count` lines at set times, a report,
and an exit code that each case chooses. Cases:

1. A normal turn: `done`, exit 0, the report path.
2. The count crosses the limit: `limit`, exit 3, the fake got SIGINT.
3. The count is just under the limit (34.96%): no stop.
4. A resume when the old count is already over the limit, with `--handoff`: no stop.
5. A resume without `--handoff`: the old count does not stop the new turn before a new count comes.
6. No session file, or no `token_count`: `watch-error` after 3 checks, exit 4.
7. A partial last line in the session file: the script skips it.
8. Codex exits with 1, or the report is empty: `codex-error`, exit 5.
9. Codex ends before it writes `thread.started`: `codex-error`, no wait for ever.
10. Relative paths for the prefix, the brief and the work folder: they work after the `cd`.
11. A prefix whose files exist: usage error, exit 2, codex does not start.
12. `send` uses the options of `<prefix>-args.json` (the fake records its arguments).
13. `stop` during a turn: `stopped`, exit 6, no fake process left.
14. SIGTERM to the script during a turn: the fake gets SIGINT, no process left.
15. Two runs at the same time with two prefixes: each has its own files and its own end.
16. `--ephemeral` in the options: usage error.
17. The proof that the self-test can fail: each case runs once against a broken copy of the
    script (for example, the compare with `>` in place of `≥`), and the case fails.

Also: the fact map (`tmp/leader-skill/split/factmap.py`) against `a600a49` lists each sentence that
leaves `references/codex.md` and `SKILL.md`, with a reason, so that no other rule changes. One real
run with Sol at low effort checks `start`, `send`, `context` and `stop` end to end. The full set of
`AGENTS.md` §4 on the final head.

Review: one complete review of the final head by a new Codex `gpt-6.2-astra` session (high,
read-only), in parts if it would pass 35%, then one narrow fix check, then the lead agent stops and
reports to the owner.

## Open questions

1. Do you approve the design above (option A, Node, the commands, the ends, the one-home rules)?
2. When the script cannot read the context, should it stop the turn (`watch-error`, as above)? The
   other choice is to let the turn run and report the error at the end. I recommend the stop: the
   35% rule then never fails in silence.
3. Should CI run `scripts/selftest.mjs`? That is one new step in the CI workflow. The `decision-pages`
   self-test runs by hand. I recommend the CI step, because the script starts billed models.
4. Should I measure the tokens of the lead agent on one small task with the script and one without
   it? Each run costs credits. I recommend no: the consultants and the lead agent agree that the
   saving is small, and the reason for the script is reliability.
5. F1B-1 of #156 (the sentence "a full review of a large change reaches 35% first" lost "before it
   reports") is in the same file. Should I fix it here? I recommend yes.
