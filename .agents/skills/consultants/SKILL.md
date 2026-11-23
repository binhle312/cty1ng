---
name: consultants
description: Use when the owner runs /consultants or names the skill. Ask two or more strong models to grill a recommendation on open decisions before the owner decides.
disable-model-invocation: true
metadata:
  author: cty1ng maintainers
  tags: [decisions, review, multi-agent]
---

# Consultants

Run this skill only when the owner starts it or names it.

Use consultants when the owner needs a decision with real trade-offs. Each consultant reads the
same open questions alone and grills your recommendation. You answer each point. The owner decides.
The repository's approval rules still apply: a consultant's view is advice, not an approval.

## Who asks whom

When an agent is not sure about a decision, it asks up the chain. It does not start consultants alone.

1. An agent that works for a lead agent asks the lead agent.
2. A lead agent asks the owner, when the owner is available.
3. In an unattended run (for example, overnight while the owner sleeps), the lead agent asks the
   built-in `advisor` tool. The tool runs the model that the owner set in the `advisorModel` setting.
   That setting is the owner's choice, so it can be Fable 5.2 without a new owner word.
   If the session has no advisor tool, the lead agent asks one Claude Opus 5.5 at effort `high`, read-only.
   It records the question, the advice and its decision for the owner's morning report.
4. The lead agent runs this skill only when the owner asks for it: with `/consultants`, or in the
   owner's instructions for the current unattended run. That permission ends with that run.

```
agent not sure ──► lead agent not sure ──► owner available? ── yes ──► ask the owner
                                              │
                                              no (unattended run)
                                              │
                         owner allowed consultants for this run? ── yes ──► this skill
                                              │
                                              no ──► the advisor tool (advisorModel)
```

## Models

Every consultant uses a model from this table, at effort `high` and standard speed.
Use only the models in the table. Do not use `xhigh`, a lower effort, or fast mode.

| Model            | From Claude Code                                                                       | From Codex                                         |
| ---------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Claude Opus 5.5  | `Agent` tool with `model: "opus"` and `effort: "high"`                                 | `claude -p --model claude-opus-5-5 --effort high`  |
| Claude Fable 5.2 | `Agent` tool with `model: "fable"` and `effort: "high"`                                | `claude -p --model claude-fable-5-2 --effort high` |
| GPT-6.2 Astra    | `codex exec -m gpt-6.2-astra -c model_reasoning_effort="high" -c service_tier="default"` | The same `codex exec` command                    |

From Codex, `claude -p` needs network access. If it fails in the sandbox, ask the owner for network access.

No consultant is a weaker model than the model whose work it reads.
A consultant reads the work of a frontier model, so only the models in this table are consultants.
A cheaper model (Sonnet 5.5, Haiku 5.5, GPT-6.2 Sol) is never a consultant.

### Add a model

The owner may add a model later. Candidates that the owner named: a Gemini model, and
Anthropic Mythos 5.2. Neither has a row yet, because no command for it is tested.

To add a row:

1. The owner names the model.
2. Find its exact model id and the command that starts it from Claude Code and from Codex.
3. Find the setting for its reasoning effort, and set it to high. If the model has no effort
   setting, write "no effort setting" in its row.
4. Run one short probe task with the command, and check that the answer comes from that model.
5. Add the row to the table, and record the probe result in the change that adds it.

### Choose the consultants

The default is two consultants from two model families: one Opus 5.5 and one GPT-6.2 Astra.
Two families catch different errors.

- Add Fable 5.2 only when the owner names it for this decision.
- The owner can name other models from the table.
- If only one model family is available, tell the owner before you start, and use two
  consultants of that family.

## Steps

1. Write one list file of the open decisions. For each decision, give:
   - the decision in one sentence, and the facts with their sources;
   - the options, with the gain, the cost and the risk of each;
   - your recommendation, how sure you are, and what would change it.
2. In one message, start each consultant read-only and in the background, at effort `high`.
   Each consultant reads the same list file and answers alone. It does not see the other answers.
3. Tell each consultant to grill your recommendation, and to return:
   - the hardest questions for you, with why each one matters;
   - its own pick for each decision, how sure it is, and the fact that would change its pick;
   - each claim in the list that is wrong or bigger than its proof;
   - any option that the list misses.
4. Save each answer in a file next to the list file.
5. Answer each question and each claim in writing. Accept it and change the decision, or reject
   it with a reason.
6. Give the owner each decision with your final recommendation, where the consultants agree,
   where they disagree, and the points that you rejected with your reasons.

The work is complete when each consultant answered, each of its points has your written answer,
and the owner has the decisions.
