# Leader: guide for people

This file shows a person how the skill works. The rules are in `SKILL.md`; this file adds no rule.

## How to start it

Start a new conversation in Claude Code, and type `/leader` with the task: the context, the goal,
and what "done" means. From that message, the conversation is your lead agent. No agent loads this
skill by itself. To continue in a new conversation, type `/leader` with the folder path that the
lead agent gives in each report.

## What you need

- Claude Code.
- The Codex CLI, logged in: `codex login status` shows the login.
- Git, and Python 3 as `python3`.
- A POSIX shell. On Linux and macOS, use the normal terminal. On Windows, start Claude Code in Git
  Bash or WSL: the commands of the skill do not run in PowerShell or cmd.

The skill was tested on Linux (WSL2) only.

## Who talks with whom

```
                       ┌──────────────────────────────┐
                       │ Human                        │
                       │ approves, decides, merges    │
                       └──────────────────────────────┘
     task, answers, OK of the plan   ▼    ▲   questions, plan and verdicts, report
                       ┌──────────────────────────────┐       ┌──────────────────────────┐
 ┌──────────────┐ asks │ Lead agent                   │ asks  │ Explorer (the Explore    │
 │ Advisor tool │ ◀─── │ the Claude Code conversation │ ────▶ │ stage): Claude Code      │
 │ built into   │ ───▶ │ carries each result from one │ ◀──── │ `Explore` on Haiku, the  │
 │ Claude Code  │advice│ session to the next          │ facts │ facts of each new task   │
 └──────────────┘      └──────────────────────────────┘       └──────────────────────────┘
      briefs, answers, findings   ▼    ▲   plans,     review briefs   ▼    ▲   findings
                                           reports
 ╔══════════════════════════════════════════╗     ┌──────────────────────────────────────┐
 ║ Teams: one Codex worker session per task ║     │ Two outside reviewers at a time; the │
 ║ (at most 2 teams at the same time)       ║     │ same two check round 2 and fixes:    │
 ║                                          ║     │ - new plan reviewers: before the OK, │
 ║ Implementer: the session itself; plan    ║     │   for a plan with a worker team      │
 ║   first, builds, tests, commits, fixes   ║     │ - new checkpoint reviewers: at each  │
 ║   └─ its own subagents, at the same time:║     │   checkpoint report                  │
 ║      ├─ test-verifier                    ║     │                                      │
 ║      └─ reviewer                         ║     │ From Anthropic: Claude Opus, high,   │
 ║ A task that is not code: a default       ║     │   the `reviewer` role                │
 ║ worker, with the reviewer subagent only  ║     │ From OpenAI: Codex gpt-6.2-astra,    │
 ║                                          ║     │   high, read-only                    │
 ║                                          ║     │ Neither built the work; neither      │
 ║                                          ║     │ changes a file                       │
 ╚══════════════════════════════════════════╝     └──────────────────────────────────────┘
  The sessions do not talk with each other. If Codex fails because of its account, Claude
  Code subagents take each Codex place (When Codex cannot run).
```

## The stages of a task

```
 /leader <task>
      │
      ▼
 1 route ──▶ 2 read the project's rules ──▶ 3 explore: the explorer gathers the facts
                                                  │
                                                  ▼
 4 questions ══▶ HUMAN answers (again, until the lead agent knows exactly what must be done)
      │
      ▼
 5 plan: the tasks, each with its criteria and its definition of done, the worker team
         of each, the reviewers, the model and effort; the advisor sharpens it
      │
      ▼
 6 plan review, for a plan that starts a worker team: two new reviewers, up to 2 rounds,
   until the lead agent and both agree on the criteria and the definition of done
      │
      ▼
 7 the plan, the verdicts and each open point ══▶ HUMAN decides each open point and
                                                  gives the OK; a change of a task, a
      │                                           criterion or the definition of done
      │                                           goes back to the plan review
      ▼
 8 worker: plan in its own words ──▶ lead agent accepts ──▶ worker builds, and its
   test-verifier and reviewer subagents check, after each build and each fix
      │
      ▼
 9 lead agent checks each report ──▶ 10 two outside reviewers ──▶ fixes ──▶ the same two
                                                                         check the fixes
      │
      ▼
 11 report ══▶ the merge, only when the HUMAN asks for it

 The lead agent's own change, after the explorer: the advisor rates it. A minor change needs
 no plan, no OK and no reviewers: the advisor agrees on the solution and checks the diff, and
 the next report tells the HUMAN. A major or critical change gets a short plan, the HUMAN's OK
 and the two outside reviewers, with no plan review. With no advisor tool, each own change
 takes that path.
```

`══▶` is a gate: the work that depends on it waits for the human.

## One task, turn by turn

```
 Human            Lead agent                   Worker team              Reviewers (new:
   │                  │                        (one Codex session)      Claude Opus and
   │                  │                              │                   Codex Astra)
   │── task ─────────▶│                              │                         │
   │                  │ the explorer (Explore on Haiku) gathers the facts      │
   │◀─ questions ─────│                              │                         │
   │                  │ all the open questions; again while one is open        │
   │── answers ──────▶│                              │                         │
   │                  │ writes the plan; the advisor sharpens it               │
   │                  │── the plan to review (for a worker team) ─────────────▶│ plan
   │                  │◀─ AGREE or CHANGE for each criterion ──────────────────│ reviewers,
   │                  │ round 2 if a point is open; then the open points       │ both at
   │                  │                              │                         │ the same time
   │◀─ plan, verdicts │                              │                         │
   │── decisions, OK ▶│                              │                         │
   │                  │── brief ────────────────────▶│ reads, changes no file  │
   │                  │◀─ its plan, with questions ──│                         │
   │                  │── answers or corrections ───▶│ (while the plan needs   │
   │                  │◀─ the new plan ──────────────│  them)                  │
   │                  │── "plan OK, build" ─────────▶│ builds and commits;     │
   │                  │                              │ its test-verifier and   │
   │                  │                              │ reviewer subagents      │
   │                  │                              │ check; it fixes         │
   │                  │── stop + correction ────────▶│ (if the work goes in a  │
   │                  │                              │  wrong direction; same  │
   │                  │                              │  session, context kept) │
   │                  │── at 50%: stop, ask for ────▶│                         │
   │                  │   the handoff                │                         │
   │                  │◀─ the handoff ───────────────│                         │
   │                  │ checks and corrects it; a new worker session gets the  │
   │                  │ brief and the handoff, and sends its plan for the rest │
   │                  │◀─ report (each checkpoint) ──│ commits, checks; push   │
   │                  │                              │ if the brief names a    │
   │                  │                              │ remote branch; its      │
   │                  │                              │ subagents' results      │
   │                  │ compares each claim with the diff, the test results,   │
   │                  │ and the remote checks if the worker pushed             │
   │                  │── review briefs ──────────────────────────────────────▶│ both at
   │                  │◀─ findings ────────────────────────────────────────────│ the same
   │                  │ checks each finding                                    │ time
   │                  │── the findings ─────────────▶│ fixes them; its         │
   │                  │                              │ subagents check again   │
   │                  │◀─ report of the fixes ───────│                         │
   │                  │── the fixes to check ─────────────────────────────────▶│
   │                  │◀─ the checks of the fixes ─────────────────────────────│
   │◀─ the result ────│ with each open issue         │                         │
   │ decides the merge│                              │                         │
```

The sketch shows one worker team. The human's other approvals depend on the rules of each
repository, so the sketch does not show them.

## Words

- **Checkpoint:** a step of the worker's plan after which the worker reports.
- **Turn:** one run of a worker, from a message of the lead agent to the report of the worker.
- **Context window:** the text that a model can hold at one time: the brief, the messages, and the
  files that it read. At the limit of `SKILL.md`, the lead agent replaces the session.
