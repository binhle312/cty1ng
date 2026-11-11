---
name: arena
description: Run two or more candidates on one task, pick a base, and graft the best parts of the others into it. Owner starts it with /arena.
disable-model-invocation: true
---

# Arena

Use an arena when one attempt at a non-trivial artifact can lock in the wrong shape.
The arena gives a better first version. The repository's plan, approval and review rules still apply.

If the session has a task list tool, open one entry for each phase before you start a seat:
Frame, Fan out, Judge, Pick, Graft, Verify.

## Models

Every seat and the judge use one of these three models, at effort `high`:

| Model            | From Claude Code                                                                       | From Codex                                         |
| ---------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Claude Opus 5.5  | `Agent` tool with `model: "opus"` and `effort: "high"`                                 | `claude -p --model claude-opus-5-5 --effort high`  |
| Claude Fable 5.2 | `Agent` tool with `model: "fable"` and `effort: "high"`                                | `claude -p --model claude-fable-5-2 --effort high` |
| GPT-6 Astra      | `codex exec -m gpt-6-astra -c model_reasoning_effort="high" -c service_tier="default"` | The same `codex exec` command                      |

Use only these three models at effort `high` and standard speed. Do not use `xhigh` or fast mode.
From Codex, `claude -p` needs network access. If it fails in the sandbox, ask the owner for network access.

### Fable areas

Opus 5.5 and GPT-6 Astra take the default seats on every task.
Fable 5.2 takes one more seat when the task is in a Fable area.
A Fable area is a subject where Anthropic names Fable 5.2 as its strongest model:

- software engineering: code, architecture, refactors, bug diagnosis, tests and engineering plans;
- the design of an agent system: a lead agent, subagents, or sessions that run for hours;
- deep research, and analysis that ends in a document, a spreadsheet or a slide deck;
- science and quantitative finance;
- data analysis and machine learning experiments;
- work that reads detailed images or PDF files;
- the design of objects for the real world or the screen: 3D, hardware, motion and robotics.

A task in cybersecurity or biology keeps the default seats, because Anthropic's safeguards limit Fable 5.2 there.

## Phase A: Frame

All candidates get the same brief, so the brief is the contract.

1. State the artifact that each candidate makes.
2. Write the rubric: 3 to 6 criteria that you can grade on this task.
   Only you and the judge see the rubric. The candidates see only the task.
3. Check which models you can start. Your own model family is always available.
   From Claude Code, run `command -v codex`. From Codex, run `command -v claude`.
   If the command finds nothing, you have one model family. Tell the owner once, before the fan out.
4. Choose the seats. The default is two: one Opus 5.5 and one GPT-6 Astra.
   If the task is in a Fable area, add one Fable 5.2 seat.
   With one model family, the default seats use that family: Opus 5.5 from Claude Code, GPT-6 Astra from Codex.
   The Fable seat needs the Claude family.
   Add seats when the task has more than one design direction.
   Use one model for all seats when the work is mostly generation, not judgment.
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
   - Opus or Fable seat from Claude Code: `Agent` tool, `run_in_background: true`.
   - Opus or Fable seat from Codex: `claude -p ... --permission-mode acceptEdits < <brief>`, run in `<worktree>`.
   - GPT-6 Astra seat: `codex exec ... -s workspace-write -C <worktree> -o <out>/last-message.md - < <brief>`.
2. If a seat fails to start, run it on another model from the table and tell the owner.
3. If a seat gives no output, continue with the others and record the dropout.

## Phase C: Judge

Start the judge only after all seats finish.

1. Use one read-only judge from the other model family than yours.
   - From Claude Code, the judge is GPT-6 Astra: `codex exec ... -s read-only -C <repo root>`.
   - From Codex, the judge is Opus 5.5: `claude -p ... --permission-mode plan`.
2. If the other family is not available, start a new judge on your own model.
   - From Claude Code: `Agent` tool with `model: "opus"` and `effort: "high"`.
   - From Codex: `codex exec ... -s read-only -C <repo root>`.
   This judge has the same model bias as you. Record it as a same-family judge.
3. Give the judge the rubric and the candidate paths as labels (`candidate-1`, `candidate-2`).
   Do not tell the judge which model made which candidate.
4. Ask for a score on each criterion and a recommended base with reasons.
5. Do Phase D while the judge works.
6. If no judge starts, pick the base alone and tell the owner.

## Phase D: Pick a base

1. Read every candidate from start to end. For code, read `git -C <worktree> diff` and the new files.
2. Score each candidate on each criterion. Do not score on a general feeling.
3. Compare your scores with the judge.
   If you agree on the base, the pick is confirmed.
   If you disagree, the rubric is not clear or one of you is biased. Read both reasons before you decide.
4. Pick the base that a future maintainer can extend most easily without breaking invariants.
   If two candidates tie, pick the one with the cleaner boundary or the smaller API.

## Phase E: Graft

1. Read each other candidate one more time. Find what is worth moving into the base.
   Usually this is one or two items for each candidate.
2. Fold each graft in by hand, as if the base always had it.
   The result must keep one design. Do not paste code without a change to fit it.
3. If all candidates have the same shape, that is strong agreement. Record it and ship that shape
   without grafts.
4. If the candidates differ very much, Phase A did not define the task well.
   Write the frame again and run the arena again. Do not average the differences.

Build the result on the task's own branch, not on an arena branch.

## Phase F: Verify

1. Verify the result as you verify any other work. Run the checks that the repository requires.
2. For each test that you use as evidence, see it fail without the change.
3. If verification finds a problem, find the cause:
   - Phase A was wrong: write the frame again and run the arena again.
   - A candidate found the problem, but you did not graft the fix: go back to Phase E.
4. When the result passes, remove the arena worktrees and their branches.

## Output

1. The result, on the task's own branch.
2. A synthesis note. Put it in the PR description under the heading `Arena`, or in your reply if
   there is no PR. The note gives:
   - the model of each seat, and the Fable area if a Fable seat ran;
   - the base and why you picked it;
   - the judge's verdict and family (other or same), or that there was no judge;
   - each graft and its source candidate;
   - what you rejected and why;
   - what the candidates would build from zero, and each point where two or more of them agree;
   - agreement between candidates and any dropouts;
   - the verification result.
