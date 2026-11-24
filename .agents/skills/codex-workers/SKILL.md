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

   - Do a focused task with a clear result yourself, and start no worker for it: written steps,
     a small edit, an extraction, a summary. The table has no row for such a task.
   - A reviewer is never a weaker model than the worker.
   - Use the cheapest row that fits. For the same tokens, Terra uses about half the credits of
     Sol, and Astra uses about 4 times the credits of Sol.
   - Raise the effort one level when a task has more steps or more trade-offs. Most tasks do not
     need `max`. With `ultra`, Codex starts agents of its own.
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
   Write its session id, worktree, model and effort on one line of a session list file.

4. **Get the plan first.** The first turn of each build task gives back the plan in the worker's
   own words, and changes no file. Accept the plan only when all of these are true:
   - each point of the goal has a step;
   - each step is in the scope;
   - each claim has a check.

   Then send the message to build. Your OK is not the owner's approval.

5. **Talk with the worker** with the [send command](#send-a-message): answer its question, accept
   its plan, or send the findings of a review. If a run goes in a wrong direction,
   [stop it](#stop-a-run) and send the correction.
   Each message sends the full session again, so send a message for a reason.

6. **Check each report.** After each turn, read the report file. Compare each claim with the diff,
   the test results and the remote checks of the pushed head.

7. **Review with a different agent.** The reviewer is a new session that did not build the code.
   A worker does not review its own work, so do not send the review to the session of the builder.
   The reviewer makes no commits. Send its findings to the session that built the code.

The work is complete when each claim of the last report agrees with the pushed head, and the owner
has the result with each open issue.

## Rules for the worker

Put these rules in each brief:

- In your first turn, write your plan in your own words: the goal, each step with its check, and
  your questions. Change no file before the lead agent accepts the plan.
- If a fact is missing, stop and write the question in the report. Do not guess.
- In the report, name each obstacle, such as a missing file or a tool that did not work.
- Work only in the worktree and on the branch that the brief names.
- At each checkpoint of the plan, push the committed work. Push only to the branch of the brief,
  and with no force.
- In the report, give the pushed commit and the result of the remote checks for it.
- For each claim in the report, give the command and its result.

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
  -c sandbox_mode="workspace-write" --json -o <report file> - \
  < <message file> > <events file> 2> <log file>
```

A resumed session keeps its conversation, and nothing more. It takes its folder from the folder
where you start it. It takes its model, its effort and its sandbox from the Codex configuration.
So start it in the worktree, and give each option of the start command again.
`resume` has no `-s` and no `-C`: use `cd` and `-c sandbox_mode=...`.

Use the session id from the session list file. With `--last`, a message can go to another worker.

Outside a Git repository, add `--skip-git-repo-check` to the start command and to each `resume`.

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
