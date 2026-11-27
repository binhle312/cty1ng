# Codex workers

A **worker** is a Codex session that the lead agent starts with `codex exec`.

See the [stages of a task in `leader`](../SKILL.md#stages-of-a-task) for the process.

## Pick the models

Pick the models from the table.

| Task                                                                                      | Worker                      |
| ----------------------------------------------------------------------------------------- | --------------------------- |
| Screens and images: compare a screenshot with a design, read a chart                      | `gpt-6.1-terra` at `medium` |
| Everyday code and judgment: a bug fix, a feature, a proof, a fix after a review, security | `gpt-6.2-sol` at `high`     |
| The cause or the design is not known at the start: a bug across modules, open trade-offs  | `gpt-6.2-astra` at `high`   |

The table has no row for the tasks that you do yourself. The reviewer model: the OpenAI outside
reviewer is always a new `gpt-6.2-astra` session at `high` (owner, 2026-11-25).

- For the same tokens, Terra uses about half the credits of Sol, and Astra uses about 4 times the
  credits of Sol.
- Most tasks do not need `max`. A Codex session at `high` starts subagents of its own; it does not
  need `ultra`.
- On 2026-11-25, Codex reported windows of 475,000 tokens for Sol and 258,400 for Astra (owner:
  "astra is 258k like you said, sol is 475l as I checked directly in codex session"). Terra: 475,000
  (owner, 2026-11-25: "they reduce it to 475k only"; not measured in a run).
- On a model with a window of about 258,000 tokens, full reviews of large changes reached 35% before
  they reported (2026-11-24 and 2026-11-25).
- The table is from 2026-11-24.

## Commands

### Start

A worker with no branch name makes its own branch.

```bash
sh -c 'echo $$ > "$0" && exec "$@"' <pid file> \
  codex exec -m <model> -c model_reasoning_effort="<effort>" -c service_tier="default" \
  -s workspace-write -C <worktree> --json -o <report file> - \
  < <brief file> > <events file> 2> <log file>
```

The first line writes the process id of the run to the pid file, and then starts Codex in the same
process. If the write fails, Codex does not start. Use a new pid file for each run.

The session id is in the first line of the events file:
`{"type":"thread.started","thread_id":"<session id>"}`.

`-o` writes only the last message of that turn.

#### Image flag

Add `-i <image file>` before `-s`.

### Send a message

```bash
cd <worktree> && sh -c 'echo $$ > "$0" && exec "$@"' <pid file> \
  codex exec resume <session id> -m <model> -c model_reasoning_effort="<effort>" -c service_tier="default" \
  -c sandbox_mode="<sandbox mode>" --json -o <report file> - \
  < <message file> > <events file> 2> <log file>
```

A resumed session keeps its conversation, and nothing more. It takes its folder from the folder
where you start it. It takes its model, its effort and its sandbox from the Codex configuration.
So start it in the worktree, and give each option of the start command again. Use the sandbox
mode of the session list: `workspace-write` for a worker, `read-only` for a reviewer that only
reads. `resume` has no `-s` and no `-C`: use `cd` and `-c sandbox_mode=...`.

With `--last`, a message can go to another worker.

Outside a Git repository, add `--skip-git-repo-check` to the start command and to each `resume`.

Each message sends the full session again.

### Context use

```bash
python3 - <session id> <<'EOF'
import glob, json, os, sys
home = os.environ.get("CODEX_HOME", os.path.expanduser("~/.codex"))
path = glob.glob(f"{home}/sessions/*/*/*/rollout-*-{sys.argv[1]}.jsonl")[0]
info = None
for line in open(path):
    payload = json.loads(line).get("payload", {})
    if payload.get("type") == "token_count" and payload.get("info"):
        info = payload["info"]
used = info["last_token_usage"]["total_tokens"]
window = info["model_context_window"]
print(f"{100 * used / window:.1f}% of {window} tokens")
EOF
```

The `usage` of `turn.completed` in the `--json` events adds all model calls of a turn, so it is
not the context use.

Codex writes each session to a file under `~/.codex/sessions/`, and its `token_count` events hold
the usage of the last model call and the context window of the model. If the command finds no file
or no `token_count` event, tell the person: this Codex version may write another format.

### Account limit

Codex writes the limits of the account into each session file. This command reads them from the
newest session file that has them, so the values are from the last Codex call, not from now.

```bash
codex login status
python3 - <<'EOF'
import glob, json, os, time
home = os.environ.get("CODEX_HOME", os.path.expanduser("~/.codex"))
files = sorted(glob.glob(f"{home}/sessions/*/*/*/rollout-*.jsonl"), key=os.path.getmtime)
limits = when = None
for path in reversed(files):
    for line in open(path):
        event = json.loads(line)
        payload = event.get("payload", {})
        if payload.get("type") == "token_count" and payload.get("rate_limits"):
            limits, when = payload["rate_limits"], event.get("timestamp")
    if limits:
        break
if not limits:
    raise SystemExit("No limit data: no Codex session file holds it.")
print(f"Data from {when} (UTC)")
for name in ("primary", "secondary"):
    window = limits.get(name)
    if not window:
        continue
    reset = window.get("resets_at")
    if reset and reset < time.time():
        state = "the reset time has passed, so this value is old"
    elif reset:
        state = "resets " + time.strftime("%a %d %b %H:%M", time.localtime(reset))
    else:
        state = "no reset time"
    print(f"{name}: {window.get('used_percent')}% used of {window.get('window_minutes')} minutes; {state}")
credits = limits.get("credits") or {}
print(f"Credits: {credits.get('balance')}; limit reached: {limits.get('rate_limit_reached_type')}")
EOF
```

If the command finds no data, or a reset time has passed, the values are not known.

### Stop a run

```bash
pid="$(cat <pid file of that run>)"
ps -p "$pid" -o args= | grep -qF -- "<report file of that run>" && kill -INT "$pid"
```

A pid file stays after its run ends, and the system can give its number to another process. So
the command sends the signal only if the process still has the report file of that run.

The session stays usable: send it the next message with `resume`.

### Commit and push

In `workspace-write`, Codex keeps the Git folder read-only and the network closed. For a worker
that commits, add the first option to the start command and to each `resume`. For a worker that
also pushes, add the second option too:

```bash
-c 'sandbox_workspace_write.writable_roots=["<repository>/.git","<repository>/.git/worktrees/<admin name>"]' \
-c sandbox_workspace_write.network_access=true
```

The admin name is the result of `basename "$(git rev-parse --git-dir)"` in the worktree.
The network opens for each command of the worker.
If the worker installs packages, add the store folder of the package manager to the roots.

### The sandbox is not a hard limit

Codex can send a command that the sandbox refuses to an approval step. If the Codex configuration
has an automatic reviewer for approvals (`approvals_reviewer`), that reviewer can approve the
command, and it then runs outside the sandbox.

### Review run

Start an outside reviewer with `-s read-only`.
