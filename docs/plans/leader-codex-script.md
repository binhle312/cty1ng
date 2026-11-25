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
one measured the saving; its real gain is reliability. The script passes the brief and each
message as files, byte for byte (test cases 1 and 17). That proves the transport, not the quality of
the work: no paired run compared the work with and without the script. Their reports and the lead agent's answers are in
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

**Files.** In the skill: `scripts/codex-run.mjs`, `scripts/codex-run.config.json` (the defaults of
the watch), and `scripts/selftest.mjs` (a fake `codex` and a fake session folder). No repository
path in any of them.

**The run folder.** Each worker or reviewer has a run folder that the lead agent names
(`--run-dir`). It holds the control files: `args.json`, `lock`, `state.json`, the stop requests, and
the files of each turn (`t<n>-events.jsonl`, `t<n>-report.md`, `t<n>-log.txt`), plus `run.log`. The
script refuses a run folder inside the work folder or inside a writable root, so that a worker
cannot change the options of its next turn.

**Commands.**
- `start`: required `--run-dir`, `--workdir`, `--brief`, `--model`, `--effort`, `--sandbox`,
  `--limit`; optional `--writable-root` (one or more), `--network`, `--image`, `--skip-git-check`.
  It makes each path absolute, creates the run folder (it refuses one that exists), writes
  `args.json`, and runs turn 1 with `codex exec`.
- `send`: `--run-dir`, `--message`, and `--handoff` for the handoff turn. It reads `args.json`, so
  each resume has the same model, effort, sandbox, roots and network. It runs
  `codex exec resume <thread>` in the work folder. It refuses to start when the last state is
  `limit` and `--handoff` is missing.
- `context`: `--run-dir` or `--thread`. It prints the context use from the session file.
- `stop`: `--run-dir` and `--turn`. It writes a stop request for that turn. The runner of that turn
  sends SIGINT to its own child. A request for a turn that has ended does nothing, and `stop` says
  so.

**One turn at a time.** Before a turn starts, the script makes the file `lock` with an exclusive
create. It holds the turn number and the script's process id. A second `start` or `send` for the
same run folder fails while the lock is held by a live process. The runner removes the lock when it
has written the end of the turn.

**The watch.** While a turn runs, the script reads the last `token_count` of the session file
(`$CODEX_HOME/sessions/**/rollout-*-<thread>.jsonl`). It uses only counts that Codex wrote after
this turn started. It compares raw numbers: `used × 100 ≥ limit × window`, with the window that
Codex reports. A line that does not parse, or a count with a missing field, counts as "no count".
- The start: if Codex writes no `thread.started` in the start wait, the runner stops the turn
  (`watch-error`).
- The first count: if no count of this turn comes in the count wait, the runner stops the turn
  (`watch-error`).
- After Codex exits, the runner reads the session file one last time. If the last count is at or
  over the limit, the state is `limit`, also when the turn ended and the report is not empty. The
  runner keeps the report.
- In a handoff turn, the runner does not stop at the limit. It still stops at the start wait and
  the count wait.

**Ends.** The runner writes `state.json` and prints one last line:
`state=<state> turn=<n> thread=<id> context=<percent> window=<tokens> report=<file> exit=<code>`.
The runner decides the state from what it did, not from the exit code of Codex alone: SIGINT from
the runner gives exit 1 and an empty report, the same as a Codex error.

| State | Exit code | Meaning | The lead agent's next step |
| --- | --- | --- | --- |
| `done` | 0 | The turn ended, the report is not empty, and the last count is under the limit | Read the report |
| `limit` | 3 | The last count is at or over the limit; the runner stopped the turn, or the turn ended over it | The handoff steps of `SKILL.md` |
| `watch-error` | 4 | No `thread.started` in the start wait, or no count of this turn in the count wait; the runner stopped the turn | Run `context`; tell the owner if it fails again |
| `codex-error` | 5 | Codex exited with a code that is not 0, or the report is empty, and the runner sent no signal | Read the log |
| `stopped` | 6 | A stop request or a signal to the script ended the turn | As the lead agent decided |
| `cleanup-error` | 7 | A process of the turn still runs after Codex ended | Tell the owner, with the process ids; do not resume |
| usage error | 2 | A bad option, a run folder in a bad place, or a turn that holds the lock | Fix the command |

**Signals and cleanup.** The script starts Codex in the script's process group (no new group), so a
stop of the Claude Code command reaches Codex too, as in probe 2. On SIGINT or SIGTERM, the script
writes a stop request for its own turn, sends SIGINT to Codex, waits for it, and writes `stopped`.
Before each signal and after Codex exits, the runner lists the processes under Codex
(`ps -A -o pid=,ppid=`). After the exit, it checks each one again. If one still runs, the state is
`cleanup-error`. The script never kills such a process: the owner decides.

**Logs.** `run.log` gets `codex --version`, the exact command (with no secret), each context
reading, and the end. The script refuses `--ephemeral`, because a session with no file has no
watch.

**One home for each value** (`AGENTS.md` §10, F1).
- The limit (35%) stays in `SKILL.md`, "Context of each worker". The script has no default:
  `--limit` is required, and the lead agent passes the number from `SKILL.md`.
- The check interval, the start wait and the count wait have their defaults in
  `scripts/codex-run.config.json` (20 s, 120 s and 6 checks), written one time. `references/codex.md`
  names the file and gives no numbers. Options override them; the tests use short values.
- No timeout by default. A turn with the full checks can take more than one hour.
- The model table stays in `references/codex.md`. The script has no presets.

**The handoff of a read-only reviewer.** `SKILL.md` step 2 says: "write the handoff to a file that
you name". A reviewer in `read-only` cannot write a file. The plan changes step 2 for each worker:
the handoff turn asks for the handoff as the last message, and the script saves it as the report of
that turn (`-o`). This is a rule change, so it is open question 6.

**What changes in the skill.**
- `references/codex.md`: "Start", "Send a message", "Context use" and "Stop a run" become the
  script's use, with the end table. "Commit and push" names the script options. The window line
  becomes the windows that Codex reports, with the date and the owner's words. "The sandbox is not
  a hard limit" and "Review run" stay.
- `SKILL.md`: "Context of each worker" and "Stop a worker's run" point to the script. The 35% rule
  does not change. Step 2 of the handoff changes only if the owner says yes to question 6.
- `GUIDE.md`, `references/worker-brief.md`, `.agents/skills/README.md`: only the pointers and the
  index row.

## Test strategy

`scripts/selftest.mjs` puts a fake `codex` (a Node file) first on `PATH`, and a fake `CODEX_HOME`.
The fake writes `thread.started`, a session file with `token_count` lines at set times, a report,
and an exit code that each case chooses. It records its arguments and the bytes of its standard
input. The tests set short waits. Cases:

1. A normal turn: `done`, exit 0, the report path. The fake got the brief byte for byte.
2. The count crosses the limit during the turn: `limit`, exit 3, one SIGINT.
3. The count is exactly at the limit (35.00%): `limit`, exit 3, one SIGINT.
4. The count is just under the limit (34.96%): no stop, `done`.
5. The turn ends over the limit between two checks: `limit`, exit 3, the report is kept.
6. Codex exits while the runner reads the session file: one state, no crash.
7. A `send` with `--handoff` when the old count is over the limit: no stop at the limit.
8. A `send` without `--handoff` after a `limit` end: usage error, exit 2, Codex does not start.
9. A resume: an old count under the limit does not count for the new turn; with no new count in the
   count wait, `watch-error`.
10. No `thread.started` in the start wait, while the fake keeps running: `watch-error`, exit 4.
11. A count that comes late but in the count wait: no stop.
12. No session file, or a changed format after valid lines (a missing field, a partial line):
    `watch-error`, exit 4.
13. Codex exits with 1, or the report is empty, with no signal: `codex-error`, exit 5.
14. Relative paths for the run folder, the brief and the work folder: they work after the `cd`.
15. A run folder that exists, or one inside the work folder or a writable root: usage error, Codex
    does not start.
16. Two `start` commands for one run folder at the same time, and a `send` while a turn runs: only
    one Codex starts; the other command gets a usage error.
17. `send` uses the options of `args.json` and passes the message byte for byte and the image
    option.
18. A stop request before Codex starts: the turn does not start Codex, `stopped`.
19. A stop request during a turn: `stopped`, exit 6, not `codex-error`.
20. A late stop request for an ended turn, while the next turn runs: the next turn keeps running.
21. SIGTERM to the script during a turn: the fake gets SIGINT, `stopped`, no process left.
22. The fake starts a child that ignores SIGINT and outlives it: `cleanup-error`, exit 7, the
    script kills nothing.
23. Two run folders at the same time: each has its own files and its own end.
24. `--ephemeral` in the options: usage error.
25. A read-only handoff turn: the last message is in the report file of that turn.
26. The proof that the self-test can fail: each case runs against a broken copy of the script, and
    the case fails. Case 3 fails with `>` in place of `≥`.

Also: the fact map (`tmp/leader-skill/split/factmap.py`) against `a600a49` lists each sentence that
leaves `references/codex.md` and `SKILL.md`, with a reason, so that no other rule changes. One real
run with Sol at low effort checks `start`, `send`, `context` and `stop` end to end. The full set of
`AGENTS.md` §4 on the final head.

Review: one complete review of the final head by a new Codex `gpt-6.2-astra` session (high,
read-only), in parts if it would pass 35%, then one narrow fix check, then the lead agent stops and
reports to the owner.

## Open questions

1. Do you approve the design above (option A, Node, the run folder, the commands, the ends, the
   one-home rules)?
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
6. Should the handoff be the last message of the handoff turn for each worker, in place of a file
   that the worker writes? A reviewer in `read-only` cannot write a file. I recommend yes: one way
   for each worker, and the script saves it.
