# Codex workers: guide for people

This file is for a person who wants to see how the skill works. An agent reads `SKILL.md`, which
holds the rules and the commands. This file adds no rule.

## What the skill does

You talk with one agent: the lead agent. It is the Claude Code conversation that you start.
The lead agent gives build work and review work to Codex workers, and it talks with them when that
is needed. You approve, you decide, and you merge.

## Who talks with whom

```mermaid
flowchart TB
  you(["You<br/>approve, decide, merge"])
  lead["Lead agent<br/>the Claude Code conversation"]
  advisor["Advisor tool"]
  worker["Codex worker<br/>builds"]
  reviewer["Codex reviewer<br/>did not build the code"]

  you -- "task" --> lead
  lead -- "answer, report, questions" --> you
  advisor -- "advice" --> lead
  lead -- "brief" --> worker
  worker -- "plan, then report" --> lead
  lead -- "review brief" --> reviewer
  reviewer -- "findings" --> lead
```

A worker and a reviewer send no messages to each other or to you. Each message passes through the
lead agent.

## One task, turn by turn

```mermaid
sequenceDiagram
  participant L as Lead agent
  participant W as Codex worker (one session)
  participant R as Codex reviewer (a new session)

  L->>W: brief
  Note over W: reads, plans
  W->>L: plan, or a question ("a fact is missing")
  L->>W: answer, or "plan OK, build"
  Note over W: same session, context kept
  W->>L: pushes a checkpoint, reports the checks
  opt a wrong direction
    L->>W: stop the run, send the correction
    Note over W: same session, context kept
  end
  W->>L: report with evidence
  L->>R: review brief
  R->>L: findings
  L->>W: review findings
  Note over W: same session fixes them
```

The review is a new session that did not build the code. Its findings go to the lead agent, and the
lead agent sends them to the session of the builder.

The lead agent also watches how full each worker's context window is. At 35% of the model's window,
the worker writes a handoff, the lead agent checks and corrects it, and a new worker continues from
it.

## How to start it

- Type `/codex-workers` in a conversation, or name the skill in your message.
- A skill that you started can also tell the lead agent to read `SKILL.md`.

No agent loads this skill by itself.
