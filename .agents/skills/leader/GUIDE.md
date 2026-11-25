# Leader: guide for people

This file is for a person who wants to see how the skill works. An agent reads `SKILL.md`, which
holds the rules. This file adds no rule.

## How to start it

The skill keeps a human in the loop. The human starts a new conversation in Claude Code, and types
`/leader` with the task: the context, the goal, and what "done" means. From that message, the
conversation is the human's lead agent. No agent loads this skill by itself.

The lead agent keeps `goal.md` and `handoff.md` in its folder (default `tmp/leader/` in its
worktree), and gives the human the path in each report. To continue in a new conversation, the human
types `/leader` with that path.

## Who talks with whom

```
                       ┌──────────────────────────────┐
                       │ Human                        │
                       │ approves, decides, merges    │
                       └──────────────────────────────┘
     task, answers, OK of the plan   ▼    ▲   questions, plan, report
                       ┌──────────────────────────────┐       ┌──────────────────────────┐
 ┌──────────────┐ asks │ Lead agent                   │ asks  │ Explorer                 │
 │ Advisor tool │ ◀─── │ the Claude Code conversation │ ────▶ │ Claude Code `Explore`    │
 │ built into   │ ───▶ │ carries each result from one │ ◀──── │ on Haiku, read-only      │
 │ Claude Code  │advice│ session to the next          │ paths,│ search, before the plan  │
 └──────────────┘      └──────────────────────────────┘ lines └──────────────────────────┘
          briefs, answers, findings   ▼    ▲   plans, questions, reports, findings
 ╔═════════════════════════════════════════════╗   ╔═══════════════════════════════════╗
 ║ Team of a coding task (the explorer too)    ║   ║ Team of another task              ║
 ║                                             ║   ║ (documents, research, a measure)  ║
 ║ Implementer    plan first, builds, commits  ║   ║ Default worker   does the task    ║
 ║ Test verifier  tests each criterion         ║   ║ Reviewer         checks the result║
 ║ Reviewer       reviews, changes no file     ║   ║                                   ║
 ║ Codex sessions; Claude roles if Codex fails ║   ║ Codex sessions; Claude if it fails║
 ╚═════════════════════════════════════════════╝   ╚═══════════════════════════════════╝
  At most 2 teams at the same time. The sessions do not talk with each other.
```

The sessions of a team send no messages to each other or to the human. Each message passes through
the lead agent. The lead agent can ask the advisor before it decides.

## The stages of a task, with the human's gates

```
 /leader <task>
      │
      ▼
 1 route ──▶ 2 read the project's rules ──▶ 3 questions ══▶ HUMAN answers
                                              (again, until the lead agent knows
                                               exactly what must be done)
                                                  │
                                                  ▼
 4 plan: the tasks, the team of each,
         the model and the effort of each ══▶ HUMAN reviews it and gives the OK
      │
      ▼
 5 implementer: plan in its own words ──▶ lead agent accepts ──▶ implementer builds
   (see The lead agent's own work)
      │
      ▼
 6 lead agent checks the report ──▶ 7 test verifier + reviewer ──▶ fixes ──▶ lead agent
                                                                         checks the fixes
      │
      ▼
 8 report ══▶ the merge, only when the HUMAN asks for it
```

`══▶` is a gate: the work that depends on it waits for the human.

See [The lead agent's own work](SKILL.md#the-lead-agents-own-work) for step 5.

The lead agent also stops the work that depends on an item, and tells the human, when the documents
and the code disagree, when a bug does not reproduce, when a fix has the same cause as an earlier
fix, or when an approval is missing. Other work goes on.

## Who does which work

| Work | Who |
| --- | --- |
| Plans, briefs, records, messages to the human | The lead agent |
| [The lead agent's own work](SKILL.md#the-lead-agents-own-work) | The lead agent |
| A broad search for the documents and the code of a task | The explorer: the `Explore` subagent of Claude Code on Haiku, before the plan |
| Each other code change, also a simple one | A coding team: the explorer, a Codex implementer, a Codex test verifier and a Codex reviewer |
| A task that is not code: documents, research, a measurement | A default team: a Codex default worker and a Codex reviewer |
| Each test and each review | A new session that did not build the work |

The rules for the worker are in `SKILL.md`. The templates for the briefs are in `references/`.

The [models](references/codex.md#pick-the-models) and the [commands](references/codex.md#commands) are in
`references/codex.md`.

## What the skill does

The human talks with one agent: the lead agent. It is the Claude Code conversation that the human
starts. The lead agent gives each task to a team of Codex sessions, at most 2 teams at the same
time, and it talks with each session when that is needed. If Codex cannot run because of its
account, Claude Code subagents do that work.
The human approves, decides, and merges.

A task has two plans. The lead agent's plan goes to the human, and the human gives the OK before a
team starts. Each implementer or default worker then gives the lead agent a plan for its own task. The lead
agent's OK on a worker's plan is not the human's approval. When the rules of the repository ask for
the human's approval, the lead agent stops and asks the human.

## One task, turn by turn

```
 Human            Lead agent                   Implementer              Test verifier and
   │                  │                        (one session)            reviewer (new sessions)
   │── task ─────────▶│                              │                         │
   │◀─ questions ─────│ all the open questions; again while one is open        │
   │── answers ──────▶│                              │                         │
   │                  │ the explorer (Explore on Haiku) searches; its report   │
   │                  │ names the files of each task                           │
   │◀─ the plan ──────│ tasks, the team of each, model and effort of each      │
   │── OK ───────────▶│                              │                         │
   │                  │── brief ────────────────────▶│ reads, changes no file  │
   │                  │◀─ its plan, with questions ──│                         │
   │                  │── answers or corrections ───▶│ (while the plan needs   │
   │                  │◀─ the new plan ──────────────│  them)                  │
   │                  │── "plan OK, build" ─────────▶│ builds and commits;     │
   │                  │                              │ pushes if the brief     │
   │                  │                              │ names a remote branch   │
   │                  │── stop + correction ────────▶│ (if the work goes in a  │
   │                  │                              │  wrong direction; same  │
   │                  │                              │  session, context kept) │
   │                  │── at 50%: stop, ask for ────▶│                         │
   │                  │   the handoff                │                         │
   │                  │◀─ the handoff ───────────────│                         │
   │                  │ checks and corrects it; a new worker session gets the  │
   │                  │ brief and the handoff, and sends its plan for the rest │
   │                  │◀─ report of each turn ───────│ commits, push, checks   │
   │                  │◀─ final report ──────────────│ each claim, with its    │
   │                  │                              │ command and its result  │
   │                  │ compares each claim with the diff, the test results,   │
   │                  │ and the remote checks if the worker pushed             │
   │                  │── test brief, review brief ───────────────────────────▶│ both check
   │                  │◀─ PASS / FAIL per criterion, findings ─────────────────│ the commit
   │                  │ checks each finding                                    │
   │                  │── the findings ─────────────▶│ the builder's session   │
   │                  │◀─ report of the fixes ───────│ fixes them              │
   │                  │── the fixes to check ─────────────────────────────────▶│
   │                  │◀─ the checks of the fixes ─────────────────────────────│
   │◀─ the result ────│ with each open issue         │                         │
   │ decides the merge│                              │                         │
```

The diagram uses [Talk with the worker](SKILL.md#talk-with-the-worker) for the send command.

After each report, the lead agent compares each claim with the diff, the test results, and the
remote checks if the worker pushed.

The diagram shows the human's OK of the plan. It does not show the other points where the human
approves, because each repository has its own rules. At each of these points, the lead agent stops
and asks the human.

Only the lead agent talks with the human. The test verifier and the reviewer are new sessions that
did not build the code. Their findings go to the lead agent, and the lead agent sends them to the
builder's session. After a
handoff, that is the new session.

## Where the worker works

- The lead agent starts each worker in its own Git worktree and branch. The brief names the branch.
  If the brief has no branch name, a [Codex worker](references/codex.md#start) makes its own.
- A checkpoint is a point that the worker's plan names.
- A turn is one run of the worker: from a message of the lead agent to the report of the worker.
- If the brief names a remote branch, the worker pushes its commits to that branch at each
  checkpoint. It pushes to no other branch, and it does not force a push.
- A test verifier and a reviewer make no commits. The test verifier runs its tests in a worktree
  of its own.
- The lead agent breaks the human's goal into small tasks that do not touch each other's files or
  wait for each other, so that several workers and reviewers work at the same time, each on a small
  piece of work. The plan names these tasks. The lead agent runs at most 2 teams at the same time,
  each on its own task, in its own worktree and branch. The turn diagram shows one of them. For a command that only one agent can
  run at a time, such as a heavy build, the lead agent tells them the order, or sends the second
  message after the first worker is done with that command.

## The 50% limit

The context window is the text that a model can hold at one time: the brief, the messages, and the
files that it read.

The lead agent watches how full the context window of each worker is.
When 50% of the model's window is used, the worker gives its handoff as its last message. The lead agent checks and
corrects it, and a new worker continues from it.

The limit applies to a reviewer too. Before each review starts, the lead agent splits it into parts,
by files or by checks, so that each part ends under 50%.

50% is the human's limit, and the human can change it.
