# Leader: guide for people

This file is for a person who wants to see how the skill works. An agent reads `SKILL.md`, which
holds the rules. This file adds no rule.

## How to start it

The skill keeps a human in the loop. The human starts a new conversation in Claude Code, and types
`/leader` with the task: the context, the goal, and what "done" means. From that message, the
conversation is the human's lead agent. No agent loads this skill by itself.

## Who talks with whom

```mermaid
flowchart TB
  human(["Human<br/>approves, decides, merges"])
  lead["Lead agent<br/>the Claude Code conversation"]
  advisor["Advisor tool<br/>built into Claude Code"]
  worker["Codex workers<br/>one or more, each builds its own task"]
  reviewer["Codex reviewer<br/>reviews code that it did not build"]

  human -- "task, answers" --> lead
  lead -- "questions, report" --> human
  lead -- "asks" --> advisor
  advisor -- "advice" --> lead
  lead -- "brief, answers" --> worker
  worker -- "plan, questions, reports" --> lead
  lead -- "review brief" --> reviewer
  reviewer -- "findings" --> lead
```

A worker and a reviewer send no messages to each other or to the human. Each message passes through
the lead agent. The lead agent can ask the advisor before it decides.

## The stages of a task, with the human's gates

```
 /leader <task>
      │
      ▼
 1 route ──▶ 2 read the project's rules ──▶ 3 questions ══▶ HUMAN answers (one round)
                                                  │
                                                  ▼
 4 plan and tests ══▶ HUMAN approves, if the project asks for it
      │
      ▼
 5 worker: plan in its own words ──▶ lead agent accepts ──▶ worker builds
   (a code change below the line limit: the lead agent makes it)
      │
      ▼
 6 lead agent checks the report ──▶ 7 a different agent reviews ──▶ fixes ──▶ lead agent
                                                                          checks the fixes
      │
      ▼
 8 report ══▶ the merge, only when the HUMAN asks for it
```

`══▶` is a gate: the work that depends on it waits for the human.

The lead agent also stops the work that depends on an item, and tells the human, when the documents
and the code disagree, when a bug does not reproduce, when a fix has the same cause as an earlier
fix, or when an approval is missing. Other work goes on.

## Who does which work

| Work | Who |
| --- | --- |
| Plans, briefs, records, messages to the human | The lead agent |
| Written steps, an extraction, a summary | The lead agent |
| A code change below the line limit of `codex-workers` (step 1) | The lead agent; a different agent reviews it |
| Each other code change, also a simple one | A Codex worker |
| Each review | A different agent: a new session that did not build the code |

The models, the commands and the rules for the worker are in the `codex-workers` skill. The
templates for the briefs are in `references/`.
