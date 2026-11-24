# Codex workers: guide for people

This file is for a person who wants to see how the skill works. An agent reads `SKILL.md`, which
holds the rules and the commands. This file adds no rule.

## What the skill does

You talk with one agent: the lead agent. It is the Claude Code conversation that you start.
The lead agent gives build work and review work to Codex workers, and it talks with them when that
is needed. You approve, you decide, and you merge.

## Who talks with whom

```
              YOU  approve, decide, merge
               │  ▲
          task │  │ answer, report, questions
               ▼  │
           LEAD AGENT ◀── advice ── advisor tool
            │  ▲   │  ▲
      brief │  │   │  │ findings
            │  │   │  │
            │  │ plan, then report
            │  │   │ review brief
            ▼  │   ▼  │
          WORKER   REVIEWER
          builds   did not build the code
```

A worker and a reviewer send no messages to each other or to you. Each message passes through the
lead agent.

## One task, turn by turn

```
 LEAD AGENT                                   CODEX WORKER (one session)
 ──────────                                   ──────────────────────────
 brief ─────────────────────────────────────▶ reads, plans
       ◀───────────────────── plan, or a question ("a fact is missing")
 answer, or "plan OK, build" ───────────────▶ same session, context kept
       ◀───────────────────── pushes a checkpoint, reports the checks
 a wrong direction:
 stop the run, send the correction ─────────▶ same session, context kept
       ◀───────────────────── report with evidence
 review findings ───────────────────────────▶ same session fixes them
```

The review is a new session that did not build the code. Its findings go to the lead agent, and the
lead agent sends them to the session of the builder.

## How to start it

- Type `/codex-workers` in a conversation, or name the skill in your message.
- A skill that you started can also tell the lead agent to read `SKILL.md`.

No agent loads this skill by itself.
