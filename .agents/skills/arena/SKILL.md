---
name: arena
description: Run two or more seats on one task. Build mode makes candidates and grafts the best parts into a base; consult mode answers open decisions and grills the agent's recommendation. Owner starts it with /arena.
disable-model-invocation: true
---

# Arena

Use an arena when one attempt can lock in the wrong shape: a non-trivial artifact, or a decision
with real trade-offs. The repository's plan, approval and review rules still apply.

The arena has two modes:

- **Build**: each seat makes a candidate artifact. Follow Phases A to F.
- **Consult**: each seat answers a list of open decisions and grills your recommendation.
  Follow [Consult mode](#consult-mode).

If the session has a task list tool, open one entry for each phase before you start a seat.

## Models

Every seat, consultant and judge uses a model from this table, at effort `high` and standard speed.
Use only the models in the table. Do not use `xhigh`, a lower effort, or fast mode.

| Model            | From Claude Code                                                                       | From Codex                                         |
| ---------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Claude Opus 5.5  | `Agent` tool with `model: "opus"` and `effort: "high"`                                 | `claude -p --model claude-opus-5-5 --effort high`  |
| Claude Fable 5.2 | `Agent` tool with `model: "fable"` and `effort: "high"`                                | `claude -p --model claude-fable-5-2 --effort high` |
| GPT-6 Astra      | `codex exec -m gpt-6-astra -c model_reasoning_effort="high" -c service_tier="default"` | The same `codex exec` command                      |

From Codex, `claude -p` needs network access. If it fails in the sandbox, ask the owner for network access.

No seat, consultant or judge is a weaker model than the model whose work it reads.
A small or fast model (for example a Sonnet or Haiku model) never takes a seat.

### Add a model

The owner may add a model later. Candidates that the owner named: a Gemini model, and
Anthropic Mythos 5.2. Neither has a row yet, because no command for it is tested.

To add a row:

1. The owner names the model for the arena.
2. Find its exact model id and the command that starts it from Claude Code and from Codex.
3. Find the setting for its reasoning effort, and set it to high. If the model has no effort
   setting, write "no effort setting" in its row.
4. Run one short probe task with the command, and check that the answer comes from that model.
5. Add the row to the table, and record the probe result in the change that adds it.

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

The owner starts each arena, so a Fable seat in a Fable area runs on the owner's word.
Outside an arena, use Fable 5.2 only when the owner names it for the task.

## Consult mode

Use consult mode when the owner asks the arena to advise on decisions, not to build an artifact.
The consultants sharpen your recommendation before it reaches the owner. The owner decides.

1. Write one list file of the open decisions. For each decision, give:
   - the decision in one sentence, and the facts with their sources;
   - the options, with the gain, the cost and the risk of each;
   - your recommendation, how sure you are, and what would change it.
2. Choose the consultants. The default is two: one Opus 5.5 and one GPT-6 Astra.
   Add a Fable 5.2 consultant when the decision is in a Fable area.
   The owner can name other models from the table.
3. In one message, start each consultant read-only and in the background, at effort `high`.
   Each consultant reads the same list file and answers alone. It does not see the other answers.
4. Tell each consultant to grill your recommendation, and to return:
   - the hardest questions for you, with why each one matters;
   - its own pick for each decision, how sure it is, and the fact that would change its pick;
   - each claim in the list that is wrong or bigger than its proof;
   - any option that the list misses.
5. Answer each question and each claim in writing. Accept it and change the decision, or reject
   it with a reason.
6. Give the owner each decision with your final recommendation, where the consultants agree,
   where they disagree, and the points that you rejected with your reasons.

The step is complete when each consultant answered and each of its points has your written
answer.

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
