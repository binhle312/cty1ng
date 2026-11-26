# Leader: guide for people

This file shows a person how the skill works. The rules are in `SKILL.md`; this file adds no rule.

## How to start it

Start a new conversation in Claude Code, and type `/leader` with the task: the context, the goal,
and what "done" means. From that message, the conversation is your lead agent. No agent loads this
skill by itself. To continue in a new conversation, type `/leader` with the folder path that the
lead agent gives in each report.

## Who talks with whom

```
                       ┌──────────────────────────────┐
                       │ Human                        │
                       │ approves, decides, merges    │
                       └──────────────────────────────┘
     task, answers, OK of the plan   ▼    ▲   questions, plan, report
                       ┌──────────────────────────────┐       ┌──────────────────────────┐
 ┌──────────────┐ asks │ Lead agent                   │ asks  │ Explorer (The lead       │
 │ Advisor tool │ ◀─── │ the Claude Code conversation │ ────▶ │ agent's own work): Claude│
 │ built into   │ ───▶ │ carries each result from one │ ◀──── │ Code `Explore` on Haiku, │
 │ Claude Code  │advice│ session to the next          │ facts │ facts for the plan       │
 └──────────────┘      └──────────────────────────────┘       └──────────────────────────┘
      briefs, answers, findings   ▼    ▲   plans,     review briefs   ▼    ▲   findings
                                           reports
 ╔══════════════════════════════════════════╗     ┌──────────────────────────────────────┐
 ║ Teams: one Codex worker session per task ║     │ Outside reviewers, at each checkpoint│
 ║ (at most 2 teams at the same time)       ║     │ and final report, at the same time:  │
 ║                                          ║     │                                      │
 ║ Implementer: the session itself; plan    ║     │ From Anthropic: Claude Opus, high,   │
 ║   first, builds, tests, commits, fixes   ║     │   the `reviewer` role                │
 ║   └─ its own subagents, at the same time:║     │ From OpenAI: Codex gpt-6.2-astra,    │
 ║      ├─ test-verifier                    ║     │   high, read-only                    │
 ║      └─ reviewer                         ║     │                                      │
 ║ A task that is not code: a default       ║     │ Neither built the work; neither      │
 ║ worker, with the reviewer subagent only  ║     │ changes a file                       │
 ╚══════════════════════════════════════════╝     └──────────────────────────────────────┘
  The sessions do not talk with each other. If Codex fails because of its account, Claude
  Code subagents take each Codex place (When Codex cannot run).
```

## The stages of a task

```
 /leader <task>
      │
      ▼
 1 route ──▶ 2 read the project's rules ──▶ 3 questions ══▶ HUMAN answers
                                              (again, until the lead agent knows
                                               exactly what must be done)
                                                  │
                                                  ▼
 4 plan: the tasks, the worker team of each,
         the reviewers, the model and effort ══▶ HUMAN reviews it and gives the OK
      │
      ▼
 5 worker: plan in its own words ──▶ lead agent accepts ──▶ worker builds, and its
   test-verifier and reviewer subagents check
      │
      ▼
 6 lead agent checks each report ──▶ 7 two outside reviewers ──▶ fixes ──▶ the same two
                                                                        check the fixes
      │
      ▼
 8 report ══▶ the merge, only when the HUMAN asks for it
```

`══▶` is a gate: the work that depends on it waits for the human.

## One task, turn by turn

```
 Human            Lead agent                   Worker team              Outside reviewers
   │                  │                        (one Codex session)      (Claude Opus and
   │                  │                              │                   Codex Astra, new)
   │── task ─────────▶│                              │                         │
   │◀─ questions ─────│ all the open questions; again while one is open        │
   │── answers ──────▶│                              │                         │
   │                  │ the explorer (Explore on Haiku) gathers facts          │
   │◀─ the plan ──────│ tasks, worker teams, reviewers, models and efforts     │
   │── OK ───────────▶│                              │                         │
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
   │                  │◀─ report (each checkpoint) ──│ commits, push, checks,  │
   │                  │                              │ its subagents' results  │
   │                  │ compares each claim with the diff, the test results,   │
   │                  │ and the remote checks if the worker pushed             │
   │                  │── review briefs ──────────────────────────────────────▶│ both at
   │                  │◀─ findings ────────────────────────────────────────────│ the same
   │                  │ checks each finding                                    │ time
   │                  │── the findings ─────────────▶│ fixes them              │
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
