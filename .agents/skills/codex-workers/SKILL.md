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

The **lead agent** is the Claude Code conversation that the owner starts. Only the lead agent talks
with the owner. It can ask the built-in `advisor` tool before it decides.

A **worker** is a Codex session that the lead agent starts with `codex exec`. A worker is a
conversation: the lead agent keeps its session id and sends it more messages when that is needed.
Give build work and review work to a worker. Keep searches and short reads for yourself.

The repository's approval rules still apply. A worker's message is a report, not an approval.

## Steps

1. **Pick the models** from the table, and tell the owner one reason. Pick the worker by the
   task. Pick the reviewer by the worker and by the difficulty.
   Keep the model of a session until its task ends.

   | Task                                                                                      | Worker                      | Reviewer                                |
   | ----------------------------------------------------------------------------------------- | --------------------------- | --------------------------------------- |
   | Screens and images: compare a screenshot with a design, read a chart                      | `gpt-6.1-terra` at `medium` | `gpt-6.2-sol` at `high`                 |
   | Everyday code and judgment: a bug fix, a feature, a proof, a fix after a review, security | `gpt-6.2-sol` at `high`     | `gpt-6.2-astra` at `high`               |
   | The cause or the design is not known at the start: a bug across modules, open trade-offs  | `gpt-6.2-astra` at `high`   | A new `gpt-6.2-astra` session at `high` |

   - Do these tasks yourself, and start no worker for them:
     - a focused task with a clear result: written steps, an extraction, a summary;
     - a code change of fewer than 5 changed lines.

     Give each other code change to a worker, also a simple one. The table has no row for the
     tasks that you do yourself.
   - Start your own code change only on a worktree with no other change: `git status --porcelain`
     gives nothing. If it gives a line, give the change to a worker.
   - To count the changed lines, mark each new file of the change with `git add -N <file>`, then
     run `git diff --numstat HEAD`. Add the larger of the added and the removed lines of each code
     file. If your change grows to 5 lines or more, stop, and give it to a worker.
   - A reviewer is never a weaker model than the worker.
   - Use the cheapest row that fits. For the same tokens, Terra uses about half the credits of
     Sol, and Astra uses about 4 times the credits of Sol.
   - Raise the effort of a worker one level when a task has more steps or more trade-offs. A
     reviewer keeps the effort of the table. Most tasks do not need `max`. With `ultra`, Codex
     starts agents of its own.
   - Sol and Terra read 500,000 tokens by default; Astra reads 272,000.
   - The table is from 2026-11-24. If Codex lists a newer model, tell the owner before you use it.

2. **Write the brief** as a file. The worker has no part of your conversation, so the brief has
   these parts:
   - **Goal and done:** the goal in the owner's words, its reason, and what "done" means.
   - **Facts:** each fact that the job needs: decisions, rules, ids, exact words, commands.
   - **Paths:** the paths that it can read, and the paths that it must not read.
   - **Worktree and branch:** a worker with no branch name makes its own.
   - **Scope:** what to change, and what to leave as it is.
   - **Limits:** the limits of the machine and of parallel work that the worker must keep.
   - **Checks:** the commands that show that the work is done.
   - **Report:** the form of the report.
   - **Rules for the worker:** the [rules for the worker](#rules-for-the-worker).
   - **First turn:** the request for the plan in the worker's own words (step 4).

3. **Start the worker** in its own worktree and branch with the [start command](#start).
   Start each run in the background.
   Write its session id, worktree, model, effort and sandbox mode on one line of a session list
   file. Add its last [context use](#context-of-each-worker) to that line after each check.
   **Order check.** Before each message that lets a worker build or run checks (a start or a
   resume), compare its work with the work of each other worker whose task has not ended. If two
   need a command that only one agent can run at a time, such as a heavy build or a test on fixed
   ports, tell each worker the order, or send the second message after the first worker is done
   with that command.

4. **Get the plan first.** The first turn of each build task gives back the plan in the worker's
   own words, and changes no file. Accept the plan only when all of these are true:
   - each point of the goal has a step;
   - each step is in the scope;
   - each claim has a check.

   Then do the order check of step 3, and send the message to build. Your OK is not the owner's
   approval.

5. **Talk with the worker** with the [send command](#send-a-message): answer its question, accept
   its plan, or send the findings of a review. Before a message that lets it build or run checks,
   do the order check of step 3. If a run goes in a wrong direction,
   [stop it](#stop-a-run) and send the correction.
   Each message sends the full session again, so send a message for a reason.

6. **Check each report and the context use.** After each turn, read the report file. Compare each
   claim with the diff, the test results and, for pushed work, the remote checks of the pushed
   head. Read the worker's [context use](#context-of-each-worker) after each turn, and about each
   minute while a turn runs.

7. **Review with a different agent.** The reviewer is a new session that did not build the code.
   A worker does not review its own work, so do not send the review to the session of the builder.
   The reviewer makes no commits. Send its findings to the session that built the code.
   A different agent also reviews each code change that you made yourself, in the next review
   round.

The work is complete when each claim of the last report agrees with the final head (the pushed
head, if the brief names a remote branch), and the owner has the result with each open issue.

## Context of each worker

A worker with a full context window works worse, and each message costs more. Know the context use
of each worker at each moment.

- The context use is the token count of the last model call, as a percent of the model's context
  window. Get it with the [context command](#context-use). The `usage` of `turn.completed` in the
  `--json` events adds all model calls of a turn, so it is not the context use.
- At 35% or more (the owner's limit; the owner can change it), replace the worker:
  1. If a turn runs, [stop the run](#stop-a-run).
  2. Send the worker a message: write the handoff to a file that you name, and do no other work.
  3. Read the handoff. Compare each claim with the diff, the commits and the test results. Correct
     it, and add each fact that it misses.
  4. Start a new worker with the same model, effort and sandbox, in the same worktree. Give it the
     brief and the handoff. Its first turn returns its plan for the rest of the work.
  5. Mark the old session as ended in the session list, and send it no more messages.
- The handoff has:
  - the goal, and what "done" means;
  - the work that is done, with each commit;
  - the state of the worktree: the changed files that are not committed;
  - each check that ran, with its result;
  - the open problems and questions;
  - the next steps, in order;
  - what the new worker must not do again, with the reason.
- Split each review before it starts, by files or by checks, so that each part ends under 35%
  (owner, 2026-11-24). A handoff does not save a review that is too big: the new reviewer reads
  the brief, the handoff and the files again, and stops at the limit before it reports. On a model
  with a window of about 258,000 tokens, a full review of a large change reaches 35% first.

## Rules for the worker

Put these rules in each build brief. In a review brief, leave out the rules about the first turn
and the push.

- In your first turn, write your plan in your own words: the goal, each step with its check, and
  your questions. Change no file before the lead agent accepts the plan.
- If a fact is missing, stop and write the question in the report. Do not guess.
- In the report, name each obstacle, such as a missing file or a tool that did not work.
- Work only in the worktree and on the branch that the brief names.
- If the brief names a remote branch: at each checkpoint of the plan, push the committed work.
  Push only to the branch of the brief, and with no force.
- If you pushed: in the report, give the pushed commit and the result of the remote checks for it.
- For each claim in the report, give the command and its result.
- When the lead agent asks for a handoff, write it to the file that the message names, and do no
  other work.

## Commands

### Start

```bash
codex exec -m <model> -c model_reasoning_effort="<effort>" -c service_tier="default" \
  -s workspace-write -C <worktree> --json -o <report file> - \
  < <brief file> > <events file> 2> <log file>
```

The session id is in the first line of the events file:
`{"type":"thread.started","thread_id":"<session id>"}`.

Use a new report file for each turn. `-o` writes only the last message of that turn.

For a task with an image, add `-i <image file>` before `-s`, or name the path of the file in the
brief.

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

Use the session id from the session list file. With `--last`, a message can go to another worker.

Outside a Git repository, add `--skip-git-repo-check` to the start command and to each `resume`.

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

Codex writes each session to a file under `~/.codex/sessions/`, and its `token_count` events hold
the usage of the last model call and the context window of the model. If the command finds no file
or no `token_count` event, tell the person: this Codex version may write another format.

### Stop a run

```bash
kill -INT <process id of that codex exec>
```

The process id is `$!` immediately after you start a run in the background. Write it to a file.
After the stop, check that no command of the worker still runs.
The session stays usable. Send the correction with the send command.

### Commit and push

In `workspace-write`, Codex keeps the Git folder read-only and the network closed. For a worker
that commits and pushes, add these options to the start command and to each `resume`:

```bash
-c 'sandbox_workspace_write.writable_roots=["<repository>/.git","<repository>/.git/worktrees/<admin name>"]' \
-c sandbox_workspace_write.network_access=true
```

The admin name is the result of `basename "$(git rev-parse --git-dir)"` in the worktree.
The network opens for each command of the worker. In the brief, permit the network only for Git
and the Git host.
If the worker installs packages, add the store folder of the package manager to the roots.

### The sandbox is not a hard limit

Codex can send a command that the sandbox refuses to an approval step. If the Codex configuration
has an automatic reviewer for approvals (`approvals_reviewer`), that reviewer can approve the
command, and it then runs outside the sandbox.
So the brief carries each limit as a rule, and you check the diff and the folders after each turn.

### Review run

Start a review with `-s read-only` when the reviewer only reads. A test tool that writes files
does not run in that sandbox. Then give the reviewer the test results of the builder, or start it
in a worktree of its own with `-s workspace-write`.
