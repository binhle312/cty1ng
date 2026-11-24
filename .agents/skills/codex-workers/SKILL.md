---
name: codex-workers
description: Use when the owner runs /codex-workers or names the skill. How a lead agent starts Codex workers, talks with them and stops them.
disable-model-invocation: true
metadata:
  author: binhle312
  tags: [multi-agent, codex, delegation]
---

# Codex workers

Run this skill only when the owner starts it or names it, or when a skill that the owner started
tells you to read it.

A **worker** is a Codex session that the lead agent starts with `codex exec`.

See the [stages of a task in `leader`](../leader/SKILL.md#stages-of-a-task) for the process.

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
- Sol and Terra read 500,000 tokens by default; Astra reads 272,000.
- On a model with a window of about 258,000 tokens, a full review of a large change reaches 35%
  first.
- The table is from 2026-11-24. If Codex lists a newer model, tell the owner before you use it.

## Commands

### Start

A worker with no branch name makes its own branch.

```bash
codex exec -m <model> -c model_reasoning_effort="<effort>" -c service_tier="default" \
  -s workspace-write -C <worktree> --json -o <report file> - \
  < <brief file> > <events file> 2> <log file>
```

The session id is in the first line of the events file:
`{"type":"thread.started","thread_id":"<session id>"}`.

`-o` writes only the last message of that turn.

#### Image flag

Add `-i <image file>` before `-s`.

### Send a message

```bash
cd <worktree> && codex exec resume <session id> \
  -m <model> -c model_reasoning_effort="<effort>" -c service_tier="default" \
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

### Stop a run

```bash
kill -INT <process id of that codex exec>
```

The process id is `$!` immediately after you start a run in the background. Write it to a file.
The session stays usable.

### Commit and push

In `workspace-write`, Codex keeps the Git folder read-only and the network closed. For a worker
that commits and pushes, add these options to the start command and to each `resume`:

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

Start a review with `-s read-only` when the reviewer only reads. A test tool that writes files
does not run in that sandbox. To run it in the [reviewer's own worktree](../leader/SKILL.md#stages-of-a-task),
use `-s workspace-write`.
