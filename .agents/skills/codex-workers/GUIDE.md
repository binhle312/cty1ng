# Codex workers: guide for people

This file is for a person who wants to see how the skill works. An agent reads `SKILL.md`, which
holds the rules and the commands. This file adds no rule.

## What the skill does

The skill keeps a human in the loop.

The human talks with one agent: the lead agent. It is the Claude Code conversation that the human
starts. The lead agent gives build work and review work to Codex workers, and it talks with them
when that is needed. The human approves, decides, and merges.

The lead agent's OK on a plan is not the human's approval. When the rules of the repository ask for
the human's approval, the lead agent stops and asks the human.

## One task, turn by turn

```mermaid
sequenceDiagram
  participant H as Human
  participant L as Lead agent
  participant W as Codex worker
  participant R as Codex reviewer (a new session)

  H->>L: task
  L->>H: the models, with one reason
  L->>W: brief
  Note over W: reads, changes no file
  W->>L: the plan in its own words, with its questions
  L->>W: answers, or "plan OK, build"
  Note over W: builds and commits.<br/>Pushes to its branch if the brief names a remote branch.
  opt the work goes in a wrong direction
    L->>W: stops the running turn, sends the correction
    Note over W: same session, context kept
  end
  W->>L: report of the turn: the commits, the push if any, and the checks
  opt the context use reaches 35%
    L->>W: stops the turn if one runs, asks for a handoff
    W->>L: the handoff
    Note over L: checks and corrects the handoff
    Note over W: a new worker session gets the brief and the handoff,<br/>and sends its plan for the rest of the work
  end
  W->>L: final report: each claim with its command and result
  Note over L: compares each claim with the diff and the test results
  L->>R: review brief
  R->>L: findings
  L->>W: review findings
  Note over W: the builder's session fixes them
  W->>L: report of the fixes
  Note over L: compares each claim with the diff and the test results
  L->>H: the result, with each open issue
  Note over H: decides the merge
```

After each report, the lead agent compares each claim with the diff and the test results.

The diagram does not show the points where the human approves, because each repository has its own
rules. At each of these points, the lead agent stops and asks the human.

A worker and a reviewer send no messages to each other or to the human. Each message passes through
the lead agent. The review is a new session that did not build the code. Its findings go to the
lead agent, and the lead agent sends them to the builder's session. After a handoff, that is the new
session.

## Where the worker works

- The lead agent starts each worker in its own Git worktree and branch, which the brief names.
- A checkpoint is a point that the worker's plan names.
- A turn is one run of the worker: from a message of the lead agent to the report of the worker.
- If the brief names a remote branch, the worker pushes its commits to that branch at each
  checkpoint. It pushes to no other branch, and it does not force a push.
- A reviewer makes no commits.
- The lead agent can run more than one worker at the same time, each on its own task, in its own
  worktree and branch. The turn diagram shows one of them. For a command that only one agent can
  run at a time, such as a heavy build, the lead agent tells them the order, or sends the second
  message after the first worker is done with that command.

## The 35% limit

The context window is the text that a model can hold at one time: the brief, the messages, and the
files that it read. The lead agent watches how full the context window of each Codex session is.
When 35% of the model's window is used, the worker writes a handoff. The lead agent checks and
corrects it, and a new worker continues from it.

The limit applies to a reviewer too. Before each review starts, the lead agent splits it into parts,
by files or by checks, so that each part ends under 35%.

35% is the human's limit, and the human can change it.

## How to start it

Before the first start, the human does these steps:

1. Install the Codex CLI (`codex`) and sign in.
2. Put the folder of this file, with its `SKILL.md`, where Claude Code finds skills.

Each start comes from the human. The lead agent does not start this skill on its own. The human
starts it in one of these ways:

- Type `/codex-workers` in a conversation.
- Name the skill `codex-workers` in a message.
- Start another skill that tells the lead agent to read the `SKILL.md` of this skill. Read that
  skill to see if it does this.

`SKILL.md` has the commands, the models, and the full rules. The human can read it too.
