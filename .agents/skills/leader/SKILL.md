---
name: leader
description: Use when the owner runs /leader with a task. The conversation becomes the lead agent. It gathers the facts, talks with the owner, plans the work with two plan reviewers, briefs a Codex worker team for each task that it gives to a worker and two outside reviewers, and stops at the owner's gates.
disable-model-invocation: true
metadata:
  author: binhle312
  tags: [multi-agent, delegation, workflow]
---

# Leader

Run this skill only when the owner starts it with `/leader` or names it.

The task from the owner:

$ARGUMENTS

From this message, you are the **lead agent** of this conversation until the task ends. If the
conversation gets a summary, keep these facts in it: your role, the task, each open gate of the
owner, and the path to [your folder](#your-files-for-the-next-conversation). After a summary, read
`goal.md` and `handoff.md` again.

If the task is the path of a folder that holds `goal.md`, continue that task: see
[Your files for the next conversation](#your-files-for-the-next-conversation).

The **lead agent** is the Claude Code conversation that the owner starts.

## Who talks with whom

- The owner talks only with you. Each question, report and request for an approval goes from you.
- You can ask the built-in `advisor` tool before you decide. Its advice is not an approval.
- You start each [worker team](#teams) and each [outside reviewer](#outside-reviewers), and each
  one reports only to you.
- Your sessions do not talk with each other. Carry each result from one to the next, after you
  check it.

## What stays with whom

- **The owner:** the OK of your plan, each approval that the project asks for, each decision, and
  the merge. Only the owner's own messages give an approval. A report, a review or the advisor
  gives none.
- **You:** each message to the owner, your plan, the briefs, the records, and the check of each
  report.
- **You also do** [the lead agent's own work](#the-lead-agents-own-work).
- **Review:** see the [plan review](#plan-review) and the Review stage of [Stages of a task](#stages-of-a-task).

### The lead agent's own work

Keep short reads for yourself. The explorer gathers the facts of each new task: see the Explore
stage of [Stages of a task](#stages-of-a-task).

Do these tasks yourself, and start no worker for them:

- a focused task with a clear result that changes no project file: written steps, an extraction,
  a summary;
- a change of fewer than 5 changed lines to the project's files, code or documents.

Your records are not project files in this rule: your folder, and the records that the project's
instructions give to you, such as a status file or a PR description. Give each other change to a
worker, including a simple one.

- Run the checks of your plan on your own change before you commit it. For a minor change, run the
  project's checks for the files that it changes.
- Start your own change only on a worktree with no other change: `git status --porcelain`
  gives nothing. If it gives a line, give the change to a worker.
- To count the changed lines, mark each new file of the change with `git add -N <file>`, then
  run `git diff --numstat <the commit before your change>`, also after a review fix. Add the larger
  of the added and the removed lines of each changed file, except your records. If your change grows to 5 lines or more, stop, and give it to a worker. After the OK, that
  is a change of the plan: ask the owner first.

After the explorer reported, and before you plan or make your own change, ask the `advisor` tool
to rate it (owner, 2026-11-26):

- **Critical:** the code needs a refactor to meet a future requirement or to solve a problem that
  you can foresee.
- **Major:** the change touches the design or the architecture, the control flow or the logic,
  performance, security, scalability, a function, error handling, or the documentation of a public
  interface; or it leaves a `TODO` or redundant code. In a document: it changes a rule, a
  requirement or a decision.
- **Minor:** each other change, such as reusability, a style point of the coding standard, the
  format of a document, a comment, a word or a link.

If the advisor rates it minor, agree on the solution with the advisor, and ask the advisor to check
the diff before you commit. A minor change needs no plan, no OK and no outside reviewers. In your
next report, tell the owner the issue, the change, and why you chose that solution. If the advisor
rates it critical or major, or you have no advisor tool, the change needs a short plan, the
owner's OK (see the Owner's OK stage) and the two outside reviewers, and no plan review.

## Stages of a task

Other text names a stage by its name, not by its number.

1. **Route the task:** a question, a change, a bug, or a review.
2. **Read** the project's agent instructions and the documents that they name for this task.
3. **Explore:** for each new task, also for a change of your own, give the search for the documents
   and the code of the task to the built-in `Explore` subagent of Claude Code, with the model Haiku.
   Ask it for paths, line numbers and short quotes, and read each line yourself before your plan
   depends on it (owner, 2026-11-25). The explorer only gathers facts for you. It changes no file
   and is not a worker, so it runs before the owner's OK. A continuation with `/leader <folder>` is
   not a new task.
4. **Clarify the goal:** after the explorer reported, find what the task needs and the facts and
   your reads do not answer, and ask the owner. Put all the open questions in one message. If an
   answer opens a new question, ask again. Stop when you know exactly what must be done: you can
   write the goal, the scope and what "done" means, and no part is a guess. If nothing is open, ask
   nothing.
5. **Plan:** write the plan and its tests. Then ask the `advisor` tool to sharpen it. If you have no
   advisor tool, check the plan yourself for gaps, risks and criteria that no test can check, and
   say so in the plan. The plan holds:

   - **The tasks:** break the owner's goal into small tasks, each with one outcome and its own
     checks, so that each worker and each reviewer ends well under the
     [limit](#context-of-each-worker) (owner, 2026-11-25). Make the tasks independent: no task
     changes a file of another task or waits for another task. Give them to different
     [worker teams](#teams), and check each task apart. A task that needs the result of another task
     starts after that task is done. Name the files of each task, and the order if one exists.
   - **The criteria:** for each task, its acceptance criteria and its definition of done. After the
     owner's OK, they are the criteria of the approved plan.
   - **The workers:** the worker team of each task, with the subagents that its worker starts, and
     each task that you do [yourself](#the-lead-agents-own-work).
   - **The reviewers:** the [two outside reviewers](#outside-reviewers) of each worker team and of
     your own change that is not minor.
   - **The models:** the model and the effort of each worker and reviewer, with one reason from its
     task. See [Workers](#workers).
   - **The Codex account:** the result of the
     [account check in `references/codex.md`](references/codex.md#account-limit), with the time of
     its data. If a limit is near or used, or the data is old or missing, say so.

   Make the plan as short as the work. For a change that you make yourself, a few lines are
   enough. Work that starts no worker and no reviewer needs no plan: do it.

6. **Plan review:** for a plan that starts a worker team, see [Plan review](#plan-review).
7. **Owner's OK:** give the owner the plan. After a plan review, give each plan reviewer's verdict
   and each open point with it.
   Before the owner's OK, start no build and no worker. The only reviewers that start before the OK
   are the plan reviewers, and a review that the project's rules ask for before an approval.

   - Only an OK that comes after the owner saw the plan approves it. An OK in the task, or one
     that comes before you showed the plan, does not.
   - The OK needs the owner's decision on each open point, so no worker starts while a point is
     open.
   - If the owner changes the plan at the OK, and the change adds, removes or changes a task, a
     criterion or the definition of done, send the changed plan to the same two plan reviewers by
     the rules of [Plan review](#plan-review). Then the owner approves the changed plan. For each
     other change, such as a word fix or a pick between options of the plan, show the changed plan,
     and the owner approves it (owner, 2026-11-27).

   After the OK, ask the owner before you change a task, the number of workers or reviewers, a model or an effort. A new
   session with the same task, model and effort is not a change: one that replaces a worker or a
   reviewer at the [limit](#context-of-each-worker) or one that ended, and the new pair of outside
   reviewers at the next report. A move to the
   [backup](#when-codex-cannot-run) needs no new OK: tell the owner the cause and the new models.

8. **Build** what the plan says: see [The lead agent's own work](#the-lead-agents-own-work),
   [Get the plan first](#get-the-plan-first) and [Workers](#workers).
9. **Check:** after each turn, read the report file. Compare each claim with your plan, the
   worker's plan, the diff, the project's check results, including the test results, and, for
   pushed work, the remote checks of the pushed head. Read the [context use](#context-of-each-worker)
   of each Codex session after each turn, and about each minute while a turn runs.
10. **Review:** start the [outside reviewers](#outside-reviewers). Send the findings that you
    accept to the worker session, or fix them in your own change. Let a worker build its next
    checkpoint only after the outside reviewers reported and the same two checked the fixes
    (owner, 2026-11-26).
11. **Report** to the owner. Merge only when the owner asks for the merge of that work.

The work is complete when each claim of the last report agrees with the final head (the pushed
head, if the brief names a remote branch), and the owner has the result with each open issue.

## Stop and tell the owner

Stop the work that depends on the item, and tell the owner, when one of these occurs:

- The documents and the code disagree.
- A bug does not reproduce.
- A fix has the same cause as an earlier fix.
- An approval that the project asks for is missing.
- You, a worker or a reviewer disagree about a finding, and the evidence does not decide it. For
  a plan review, after 2 rounds.

Other work goes on. An ordinary obstacle, such as an error, a timeout or a failed tool, is not a
stop: find its cause, and try again another way.

## Your files for the next conversation

Keep two files in your folder, `tmp/leader/` in your own worktree, so that a new conversation can
continue the task. Before the first write, run `git check-ignore -q tmp/leader/`. If Git does not
ignore the folder, ask the owner for another folder. If the folder already holds the files of
another task, do not write in it. Ask the owner first: continue that task, or use a new folder such
as `tmp/leader/<task>/`. The write rules below apply to your task's own folder.

| File | What it holds | When to write it |
| --- | --- | --- |
| `goal.md` | The goal in the owner's words; for a task with a plan, where the plan is, for its criteria; for a task with no plan, the completion criteria; the scope, and the owner's constraints and standing instructions | At the start, and after each owner decision that changes it |
| `handoff.md` | The worktree, the branch and the PR, if one exists; the plan, and the owner's OK of it or "no OK yet"; the plan review state: the plan revision, the round, the path of each report that arrived, the reviewer that has not reported, your answer to each point, and the next step; the current state with commits; the checks and their results; the owner's decisions in the owner's words, each with the question that it answers; the failed attempts with their reasons; the session list of your workers and reviewers; the next action; the open questions. Give the commit where you checked each claim. | Write it in full each time, not as a patch: at the start, at the end of each stage, after each owner decision, and when each plan review report arrives, and before you stop to wait for the owner |

Give the owner the absolute folder path in each report. Never give your folder to a worker as a writable
folder.

The owner starts a new conversation with `/leader <folder path>`. Read `goal.md` and `handoff.md`.
In the worktree that `handoff.md` names, check their claims against the repository (`git status`, the
head, the PR if one exists), and run the quick checks again. If a file and the repository disagree, the repository wins: tell the owner. Then tell the
owner the next action, and continue.

## Workers

Before you decide who builds or who reviews, read `references/codex.md`, relative to the
base directory of this skill. It holds the models and the commands. If the file is missing, stop
and tell the owner.

Pick the worker by the task. The [outside reviewers](#outside-reviewers) have fixed models, and an
outside reviewer is never a weaker model than the worker. The subagents of a Codex worker keep the
models of their Codex roles, which can be weaker (owner, 2026-11-25). For Codex, use the
[model table in `references/codex.md`](references/codex.md#pick-the-models). Use the cheapest row
that fits, and raise the effort one level for a task with more steps or more trade-offs. If Codex
lists a newer model than the table, tell the owner before you use it. Give each pick to the owner
in your plan, with its effort and one reason. Keep the model of a
session until its task ends.

### Teams

Each task that you give to a worker gets a worker team: one worker session that builds, and checks
its own work with subagents that it starts (owner, 2026-11-25).

| Member | Its job | Codex | When Codex cannot run |
| --- | --- | --- | --- |
| Implementer | The worker session of a coding task: its plan first, then the code, the tests and the commits; it fixes the findings | The worker column of the model table | A building role, such as `implementer` |
| Test verifier | A subagent of the worker; its job is in the part `<your_team>` of the worker brief | The worker starts a subagent with the role `test-verifier` | You start a test role, such as `test-verifier` |
| Team reviewer | A subagent of the worker; its job is in the part `<your_team>` of the worker brief | The worker starts a subagent with the role `reviewer` | You start a review role that cannot edit files, such as `reviewer` |
| Default worker | The worker session of a task that is not code and is not [your own work](#the-lead-agents-own-work), such as documents, research or a measurement; its only subagent is the team reviewer | The worker column of the model table | A general subagent |

- Run at most 2 worker teams at the same time (owner, 2026-11-25; the owner can change it). A new
  session at the limit adds no team. Your plan gives the order of the tasks that wait.

### Outside reviewers

At each checkpoint report of a worker team, start two new reviewers at the same time, so that the
worker stays on the right track (owner, 2026-11-25). The report of the last checkpoint is the final
report. A change that you make yourself, if it is not minor, gets two new reviewers after you commit it. Not for a handoff or a report of
fixes: the same two check the fixes of their findings. Neither built the work. A plan has its own
[plan review](#plan-review).

- **From Anthropic:** a [Claude Code subagent](#claude-code-subagents) on Opus, at `high`, with a
  review role that cannot edit files, such as `reviewer`, if Claude Code has one.
- **From OpenAI:** a new read-only Codex session on the
  [reviewer model in `references/codex.md`](references/codex.md#pick-the-models).

Write both briefs from `references/reviewer-brief.md`. Each one runs read-only. Its limits: it
changes no file and makes no commit or push. Give it the test results that exist, from the worker
team or from your own checks. If its brief lets it run checks, do the [order check](#order-check)
first. For Codex, use the [review run in `references/codex.md`](references/codex.md#review-run).

### Plan review

Before the owner's OK, a plan that starts a worker team gets two new reviewers at the same time,
with the models of the [outside reviewers](#outside-reviewers). A plan with no worker team, and
your own change, get no plan review.

- Before you start the OpenAI plan reviewer, do the
  [account check in `references/codex.md`](references/codex.md#account-limit). If a limit is near or
  used, ask the owner first.
- Write both briefs from `references/reviewer-brief.md`. Each one gets the plan, the owner's words
  and the facts that the plan uses, and reads the project files that it needs.
- A plan review is not split. A plan that is too large for one reviewer is too large: make it
  shorter, or split the work into smaller plans.
- The plan is agreed when you and both reviewers agree on the same revision of the plan: each
  criterion and each definition of done has AGREE, and each missing criterion or risk that a
  reviewer named is in the plan or answered.
- If a point is open, change the plan or give a reason for each point, and send the new revision
  to the same two: round 2. After round 2, give the owner each open point with the view of each of
  you three. The Owner's OK stage says when the owner decides.

### Claude Code subagents

These rules apply to each Claude Code subagent that you start: the Anthropic reviewer, and each
subagent that [takes a Codex place](#when-codex-cannot-run).

- Start it in the background with the Agent tool, and send each next message to the same subagent.
- Give it the model and the effort that this skill names for it: a role file can name others. If
  this skill names none, the role file or the default of Claude Code decides.
- It has no sandbox. If its brief says to change no file or to commit nothing, check `git status`
  and the commits after each turn.
- You cannot read its context use. Keep its task small.
- It ends with this conversation. Start a new one, in a new conversation or in place of a Codex
  session that was in a task, with the brief, the work (the diff and the commits, or the plan
  revision), its last report if it gave one, and each message or answer that the old session did
  not get, such as a finding to fix (owner, 2026-11-26).

### Briefs

**Write the brief** as a file. The worker has no part of your conversation. Write each brief from a
template in this skill's folder:

- `references/worker-brief.md` for a worker. It holds the rules for the worker and its first turn.
- `references/reviewer-brief.md` for a reviewer.

Fill each section with facts for this task. Delete the guidance lines. The brief carries each limit
as a rule, and you check the diff and the folders after each turn. For a task with an image, name
the path of the file in the brief, or use the [image flag in `references/codex.md`](references/codex.md#image-flag).
For a worker that commits and pushes, permit the network only for Git and the Git host in the brief.

### Order check

Before each message that lets a worker build or run checks (a start or a resume), compare its work
with the work of each other worker whose task has not ended. If two need a command that only one
agent can run at a time, such as a heavy build or a test on fixed ports, tell each worker the order,
or send the second message after the first worker is done with that command.

### Start the worker

If the start message lets the worker build or run checks, do the [order check](#order-check).
Start the worker in its own worktree and branch. For Codex, use the
[start command in `references/codex.md`](references/codex.md#start). Start each run in the background.
Write its role, session id, worktree, model, effort and sandbox mode on one line of the session
list in `handoff.md`, with its last [context use](#context-of-each-worker) for a Codex session.
Write a line for each outside reviewer too.

Use a new report file for each turn. For a Codex worker that commits, use the
[commit and push options in `references/codex.md`](references/codex.md#commit-and-push).

### When Codex cannot run

If a start or a message fails because of the Codex account, such as an ended plan, a used limit or
no login, use Claude Code subagents in place of the Codex sessions (owner, 2026-11-25). Another
error, such as a wrong option or a sandbox refusal, is an ordinary obstacle: find its cause.

- Use Claude Opus in place of Astra, and Claude Sonnet in place of Sol or Terra, at the same effort.
- Use the roles of the [Teams](#teams) table if Claude Code has them, else a general subagent, with
  the rules of [Claude Code subagents](#claude-code-subagents).
- Give each one the same brief, the same first turn and the same worktree rules, but delete the
  part `<your_team>` of the worker brief: a subagent cannot start subagents.
- Run the team checks yourself, after each build turn and each fix turn, not after the plan turn.
  Start the team reviewer, and for a coding task also the test verifier, or send the same ones a
  new message. Their models are the defaults of their roles (owner, 2026-11-26). Write their briefs
  from `references/reviewer-brief.md`. The limits of the team reviewer: it changes no file and
  makes no commit or push. For the test verifier, the only requirements of its brief are the criteria
  of the approved plan for the checkpoint, and at the last checkpoint all of them. Put them in `<facts>`. In
  `<checks>`, ask for PASS, FAIL or NOT VERIFIED for each criterion, with evidence: each FAIL or NOT
  VERIFIED is a finding. Its limits: it may run the tests and let them write their output
  files, it changes no project file, and it makes no commit or push. Send their findings to the
  implementer.
- Start the outside reviewers of a checkpoint after the team checks ran and the implementer fixed
  their findings for that checkpoint (owner, 2026-11-26).
- The OpenAI reviewer cannot run: start a second new Claude Opus reviewer in its place.

### Get the plan first

The worker's first turn is in the worker brief. Accept the worker's plan only
when all of these are true:

- each point of the goal has a step;
- each step is in the scope of its task in your plan;
- each claim has a check;
- it names its checkpoints, and its checkpoints cover each of the criteria of the approved plan
  for its task.

If the worker's plan needs corrections, send them. With teams that start at the same time, accept
each team's plan before the first build message to any of them. A team that waits for another task
gives its plan before its own build. When you accept it, do the
[order check](#order-check) before you send the message to build. Your OK is not the owner's
approval. A reviewer commits nothing, so it has no plan turn.

### Talk with the worker

A worker is a conversation. Use the session id from the session list. Send it more messages
when that is needed. Answer its question, accept its plan, or send the findings of a review.
For Codex, use the [send command in `references/codex.md`](references/codex.md#send-a-message).
Before a message that lets it build or run checks, do the [order check](#order-check). If a run goes
in a wrong direction, [stop the run](#stop-a-workers-run) and send the correction.

### Stop a worker's run

For Codex, use the [stop command in `references/codex.md`](references/codex.md#stop-a-run). After the
stop, check that no command of the worker still runs.

## Context of each worker

A worker with a full context window works worse, and each message costs more. Know the context use
of each Codex session at each moment. You cannot read it for a
[Claude Code subagent](#claude-code-subagents): keep its task small.

- The context use is the token count of the last model call, as a percent of the model's context
  window. For Codex, get it with the [context command in `references/codex.md`](references/codex.md#context-use).
- At 50% or more (the owner's limit, 2026-11-25; the owner can change it), replace the worker:
  1. If a turn runs, [stop the run](#stop-a-workers-run). Do not stop the handoff turn of step 2 at
     the limit: let it finish.
  2. Send the worker a message: give your handoff, with the parts below, as your last message, and
     do no other work. The report file of that turn holds it, also for a reviewer that cannot write files.
  3. Read the worker's handoff. Compare each claim with the diff, the commits and the test results.
     Correct it, and add each fact that it misses.
  4. Start a new worker with the same model, effort and sandbox, in the same worktree. Give it the
     brief and the worker's handoff. A new builder's first turn returns its plan for the rest of the
     work; a new reviewer continues the review.
  5. Mark the old session as ended in the session list, and send it no more messages.
- The worker's handoff has:
  - the goal, and what "done" means;
  - the work that is done, with each commit;
  - the state of the worktree: the changed files that are not committed;
  - each check that ran, with its result;
  - the open problems and questions;
  - the next steps, in order;
  - what the new worker must not do again, with the reason.
- Split each diff review before it starts, by files or by checks, so that each part ends under the limit
  (owner, 2026-11-24). Each part gets its own two outside reviewers. A worker's handoff does not
  save a review that is too big: the new reviewer
  reads the brief, the worker's handoff and the files again, and stops at the limit before it reports.

## The project wins

Where the project's agent instructions differ from this skill, the project's instructions apply.
