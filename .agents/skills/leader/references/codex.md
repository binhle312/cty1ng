# Codex workers

A **worker** is a Codex session that the lead agent starts with the runner.

See the [stages of a task in `leader`](../SKILL.md#stages-of-a-task) for the process.

## Pick the models

Pick the models from the table.

| Task                                                                                      | Worker                      | Reviewer                                |
| ----------------------------------------------------------------------------------------- | --------------------------- | --------------------------------------- |
| Screens and images: compare a screenshot with a design, read a chart                      | `gpt-6.1-terra` at `medium` | `gpt-6.2-sol` at `high`                 |
| Everyday code and judgment: a bug fix, a feature, a proof, a fix after a review, security | `gpt-6.2-sol` at `high`     | `gpt-6.2-astra` at `high`               |
| The cause or the design is not known at the start: a bug across modules, open trade-offs  | `gpt-6.2-astra` at `high`   | A new `gpt-6.2-astra` session at `high` |

The table has no row for the tasks that you do yourself.

- Use the cheapest row that fits. For the same tokens, Terra uses about half the credits of
  Sol, and Astra uses about 4 times the credits of Sol.
- Raise the effort of a worker one level when a task has more steps or more trade-offs. A
  reviewer keeps the effort of the table. Most tasks do not need `max`. With `ultra`, Codex
  starts agents of its own.
- On 2026-11-25, Codex reported windows of 475,000 tokens for Sol and 258,400 for Astra. The owner
  said, "astra is 258k like you said, sol is 475l as I checked directly in codex session".
  For Terra, the owner said that day, "they reduce it to 475k only" (475,000 tokens, not measured
  in a run). The script reads the window of each run from its session file.
- On a model with a window of about 258,000 tokens, a full review of a large change reaches the
  [context limit](../SKILL.md#context-of-each-worker) before it reports.
- The table is from 2026-11-24. If Codex lists a newer model, tell the owner before you use it.

## Commands

Run each command with `node` and the path to [the runner](../scripts/codex-run.mjs). Start each
`start` or `send` as a background command of your tool so that the tool reports when it ends.
The script waits for Codex.

### Start

A worker with no branch name makes its own branch.

Give `start` these options: `--run-dir`, `--workdir`, `--brief`, `--model`, `--effort`, `--sandbox`,
and `--limit`. Use the limit from [Context of each worker](../SKILL.md#context-of-each-worker).
For a worker, use `--sandbox workspace-write`.

Use `runs/<name>/` under the lead agent's folder (default `tmp/leader/`) for `--run-dir`.
Use a new run folder outside the work folder and each writable root. This protects the saved
options of the next turn. The run folder holds `args.json`, `state.json`, and `run.log`.
For turn `n`, the files are `t<n>-events.jsonl`, `t<n>-report.md`, and `t<n>-log.txt`.
The report holds the last message of that turn. `run.log` shows the exact Codex command.

Outside a Git repository, add `--skip-git-check` to `start`. For writable roots or network access,
see [Commit and push](#commit-and-push). The defaults for `--check-interval`, `--start-wait`, and
`--count-wait` are in [`codex-run.config.json`](../scripts/codex-run.config.json).
Use seconds for `--check-interval` and `--start-wait`, and checks for `--count-wait`.

#### Image flag

Add `--image <image file>` to `start`.

### Send a message

Use `send --run-dir <run folder> --message <message file>`. The script resumes the thread of that
run with the saved work folder, model, effort, sandbox, roots, and network options.
Use `--handoff` for the handoff turn. After a turn ends with `limit`, `send` requires `--handoff`.
The watch lets a handoff turn continue at the limit. It still checks for the thread and a fresh count.
On `send`, the three watch overrides apply to that turn only. The script keeps the saved options
in `args.json`.

Each message sends the full session again.

### Context use

Use `context` with either `--run-dir <run folder>` or `--thread <session id>`.
The command prints the context use and window from the session file.

The `usage` of `turn.completed` in the `--json` events adds all model calls of a turn, so it is
not the context use.

Codex writes each session to a file under `~/.codex/sessions/`, and its `token_count` events hold
the usage of the last model call and the context window of the model. If `CODEX_HOME` is set,
Codex uses its `sessions/` folder.

### Stop a run

Use `stop --run-dir <run folder> --turn <turn number>`. The script requests a stop for that turn.
The runner of that turn sends SIGINT to its own child. If the turn already ended, `stop` says so.
If the first turn stops without a thread ID, use `start` in a new run folder.

### Turn results

At the end of a turn, `start` or `send` writes `state.json` and prints this last line:
`state=<state> turn=<n> thread=<id> context=<percent> window=<tokens> report=<file> exit=<code>`.

| State | Exit code | Meaning | Next step |
| --- | --- | --- | --- |
| `done` | 0 | The turn ended with a report and the last count is under the limit. | Read the report. |
| `limit` | 3 | The count reached the limit during the turn or was at or over it at the end. A handoff turn can end with this state and a saved report. | For a handoff turn, read the report if it has content. If the state note says `handoff report missing`, start a new worker with the brief and the last good report, if one exists. For other turns, follow the [handoff steps](../SKILL.md#context-of-each-worker). |
| `watch-error` | 4 | The watch could not get a thread in the start wait or a fresh count in the count wait. This includes a clean Codex exit with no fresh count. | Run `context` and see the note below. |
| `codex-error` | 5 | Codex failed or left an empty or missing report. | Read the log. |
| `stopped` | 6 | A stop request or a signal to the runner ended the turn. | Follow the reason for the stop. |
| `cleanup-error` | 7 | A process of the turn still runs or the runner could not check cleanup. | Tell the owner and give any process IDs in `state.json`. Do not resume. |
| Usage error | 2 | The command was invalid or the run folder or turn could not be used. | Fix the command. |

If Codex exits on its own with an error and the final count meets the limit, the runner records
`limit` if cleanup succeeds. Read the Codex error in the state note or `run.log`.

After a resume gets no fresh count, standalone `context` can show an older turn's count. Check
the failed turn in `state.json` and `run.log`. If the watch still cannot read a fresh count,
tell the owner that Codex may have changed its session format.

Repeat the original `start` command with the same run folder to recover a stale lock without a
launch. If the turn has no end record, the runner records `stopped` with the note
`runner ended with no record`. The command exits with a usage error because the run folder
already exists. Check the interrupted work before you run `send`.

If recovery reports launch intent without a PID, confirm that every process of that turn has
ended. Then follow the runner's instructions to clear the intent.

### Known limits

- The folder check can miss Codex's writable temporary folder or a broken root symlink. Check the effective writable roots and put the run folder outside them.
- A child that a worker starts can outlive Codex. If you see it in `ps` or find a port that it still uses, stop it by hand.
- If `stop` leaves the version probe or Codex running, inspect the turn's processes. Wait for them to end before you retry.
- A `stop` near the end of a turn can disagree with the final state. Read `state.json` after the runner ends.
- A `stop` during a refused `send` can stop the next turn before launch. If that happens, wait for the runner to end, read the final state, and retry.
- If a session file disappears and returns during resume, the watch can read an older count. Check the session file before you use that reading.

### Commit and push

In `workspace-write`, Codex keeps the Git folder read-only and the network closed. For a worker
that commits and pushes, give `start` a `--writable-root` for `<repository>/.git` and another for
`<repository>/.git/worktrees/<admin name>`. Add `--network` to `start` to open the network.

The admin name is the result of `basename "$(git rev-parse --git-dir)"` in the worktree.
The network opens for each command of the worker.
If the worker installs packages, add the store folder of the package manager to the roots.
Never give a worker the lead agent's folder as a writable root.

### The sandbox is not a hard limit

Codex can send a command that the sandbox refuses to an approval step. If the Codex configuration
has an automatic reviewer for approvals (`approvals_reviewer`), that reviewer can approve the
command, and it then runs outside the sandbox.

### Review run

Start a review with `--sandbox read-only` when the reviewer only reads. A test tool that writes files
does not run in that sandbox. To run it in the [reviewer's own worktree](../SKILL.md#stages-of-a-task),
use `--sandbox workspace-write`.
