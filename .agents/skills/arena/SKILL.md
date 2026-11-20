---
name: arena
description: Do one task with two or more candidates in parallel, pick the best as the base, and graft the best parts of the others into it. The owner starts it with /arena, or tells an agent to use it.
disable-model-invocation: true
metadata:
  author: cty1ng maintainers
  tags: [parallel-build, review, multi-agent]
---

# Arena

Use an arena for a task that the owner gives you with "use the arena": a feature, a fix,
a document, a plan or a design. Several candidates do the same task, and the result is better
than one attempt. The repository's plan, approval and review rules still apply.

If the session has a task list tool, open one entry for each phase before you start a seat:
Frame, Fan out, Judge, Graft, Verify.

## Models

Each seat uses a model from this table. Use only the models in the table.
Do not use fast mode.

| Model             | Use                                         | From Claude Code                                             | From Codex                                                                                |
| ----------------- | ------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Claude Fable 5.2  | Frontier; only when the owner names it      | `Agent` tool with `model: "fable"` and `effort: "<e>"`       | `claude -p --model claude-fable-5-2 --effort <e>`                                         |
| Claude Opus 5.5   | Frontier                                    | `Agent` tool with `model: "opus"` and `effort: "<e>"`        | `claude -p --model claude-opus-5-5 --effort <e>`                                          |
| GPT-6.2 Astra     | Frontier                                    | `codex exec -m gpt-6.2-astra -c model_reasoning_effort="<e>" -c service_tier="default"` | The same `codex exec` command                                  |
| Claude Sonnet 5.5 | Everyday                                    | `Agent` tool with `model: "sonnet"` and `effort: "<e>"`      | `claude -p --model claude-sonnet-5-5 --effort <e>`                                        |
| GPT-6.2 Sol       | Everyday; near Astra on code, lower price   | `codex exec -m gpt-6.2-sol -c model_reasoning_effort="<e>" -c service_tier="default"`   | The same `codex exec` command                                  |
| Claude Haiku 5.5  | Simple, fast generation                     | `Agent` tool with `model: "haiku"` and `effort: "<e>"`       | `claude -p --model claude-haiku-5-5 --effort <e>`                                         |
| GPT-6.1 Terra     | Fast and cheap: screens, images, forms, office tasks; long context | `codex exec -m gpt-6.1-terra -c model_reasoning_effort="<e>" -c service_tier="default"` | The same `codex exec` command |

From Codex, `claude -p` needs network access. If it fails in the sandbox, ask the owner for network access.

### Choose the seats

Choose each seat's model and effort by the difficulty of the task. Propose them to the owner, and
start the fan out when the owner agrees or changes them. In an unattended run, use the seats that the
owner's instructions for that run give.

| Task difficulty                                                        | Seats (model and effort)                                          |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Simple: a known pattern, mostly generation (text, tests, small code)   | Haiku 5.5 or Sonnet 5.5, and GPT-6.2 Sol or GPT-6.1 Terra, at `medium` |
| Normal: a feature or a fix with some judgment                          | Sonnet 5.5 or Opus 5.5, and GPT-6.2 Sol, at `high`                |
| Hard: architecture, security, a design that is expensive to change     | Opus 5.5 and GPT-6.2 Astra, at `high` or `xhigh`                  |

- Use two model families when the task needs judgment. They make different errors.
- Add Fable 5.2 only when the owner names it for this arena.
- For a task that reads screenshots, images or very long files, consider GPT-6.1 Terra as one seat.
- Give the reason for each choice in one line, for example: "Opus high: the task changes one module boundary."

### Seat tiers

You judge the candidates (Phase C). A seat may not be in a higher tier than your model.

| Tier | Models                                        |
| ---- | --------------------------------------------- |
| 1    | Claude Fable 5.2                              |
| 2    | Claude Opus 5.5, GPT-6.2 Astra                |
| 3    | Claude Sonnet 5.5, GPT-6.2 Sol, GPT-6.1 Terra |
| 4    | Claude Haiku 5.5                              |

- If another agent asks for a seat in a higher tier than yours, refuse it and give this rule.
- The owner's word wins. If the owner asks for a seat in a higher tier than yours, tell the owner
  once, before the fan out, that this seat is in a higher tier than its judge. Start the fan out
  only after the owner confirms.

### Add a model

The owner may add a model later. Candidates that the owner named: a Gemini model, and
Anthropic Mythos 5.2. Neither has a row yet, because no command for it is tested.

To add a row:

1. The owner names the model for the arena.
2. Find its exact model id and the command that starts it from Claude Code and from Codex.
3. Find the setting for its reasoning effort. If the model has no effort setting, write
   "no effort setting" in its row.
4. Run one short probe task with the command, and check that the answer comes from that model.
5. Add the row to the table and the model to [Seat tiers](#seat-tiers), with the tier that the owner gives.
   Record the probe result in the change that adds it.

## Phase A: Frame

All candidates get the same brief, so the brief is the contract.

1. State the artifact that each candidate makes.
2. Write the rubric: 3 to 6 criteria that you can grade on this task.
   Only you see the rubric. The candidates see only the task.
3. Check which models you can start. Your own model family is always available.
   From Claude Code, run `command -v codex`. From Codex, run `command -v claude`.
   If the command finds nothing, you have one model family. Tell the owner once, before the fan out.
4. Choose the seats with [Choose the seats](#choose-the-seats), and tell the owner the model,
   the effort and the reason for each seat.
   With one model family, use that family for all seats, and say so.
   Add seats when the task has more than one design direction.
5. Give each seat its own output place:
   - Code: a git worktree on a new branch `arena-<slug>-<n>`.
     Install the dependencies in each worktree before the fan out, because the Codex sandbox has no network.
   - Text only: `<scratchpad>/arena-<slug>/candidate-<n>/`.
6. Write one brief file. It contains the task and the paths to the documents that define it.
   It also tells each candidate to:
   - work only in its output place, and keep all changes uncommitted;
   - follow the repository's agent instructions;
   - work at the level of a world-class specialist in the subject of the task;
   - write `RATIONALE.md` in its output place, with three parts:
     - the options it compared and why it rejected each;
     - what it would build if it started from zero, and how that differs from its candidate;
     - where it disagrees with the task or the current design.

   The candidate builds the task as the brief states it. The from-zero idea stays in `RATIONALE.md`.

The phase is complete when the rubric and the brief file exist and each seat has an output place.

## Phase B: Fan out

1. In one message, start all seats in the background with the brief file and the output place.
   - Claude seat from Claude Code: `Agent` tool, `run_in_background: true`.
   - Claude seat from Codex: `claude -p ... --permission-mode acceptEdits < <brief>`, run in `<worktree>`.
   - GPT-6.2 Astra or Sol seat: `codex exec ... -s workspace-write -C <worktree> -o <out>/last-message.md - < <brief>`.
2. If a seat fails to start, run it on another model from the table at the same effort or higher, and tell the owner.
3. If a seat gives no output, continue with the others and record the dropout.

## Phase C: Judge and pick a base

You are the judge: the main agent of the conversation that started the arena. Start after all
seats finish.

1. Read every candidate from start to end. For code, read `git -C <worktree> diff` and the new files.
2. Score each candidate on each criterion of the rubric. Do not score on a general feeling.
   Score each candidate by its label (`candidate-1`, `candidate-2`), not by its model.
3. Pick the base that a future maintainer can extend most easily without breaking invariants.
   If two candidates tie, pick the one with the cleaner boundary or the smaller API.

## Phase D: Graft

1. Read each other candidate one more time. Find what is worth moving into the base.
   Usually this is one or two items for each candidate.
2. Fold each graft in by hand, as if the base always had it.
   The result must keep one design. Do not paste code without a change to fit it.
3. If all candidates have the same shape, that is strong agreement. Record it and ship that shape
   without grafts.
4. If the candidates differ very much, Phase A did not define the task well.
   Write the frame again and run the arena again. Do not average the differences.

Build the result on the task's own branch, not on an arena branch.

## Phase E: Verify

1. Verify the result as you verify any other work. Run the checks that the repository requires.
2. For each test that you use as evidence, see it fail without the change.
3. If verification finds a problem, find the cause:
   - Phase A was wrong: write the frame again and run the arena again.
   - A candidate found the problem, but you did not graft the fix: go back to Phase D.
4. When the result passes, remove the arena worktrees and their branches.

## Output

1. The result, on the task's own branch.
2. A synthesis note. Put it in the PR description under the heading `Arena`, or in your reply if
   there is no PR. The note gives:
   - the model, the effort and the reason of each seat;
   - the base and why you picked it;
   - your score of each candidate on each criterion;
   - each graft and its source candidate;
   - what you rejected and why;
   - what the candidates would build from zero, and each point where two or more of them agree;
   - agreement between candidates and any dropouts;
   - the verification result.
