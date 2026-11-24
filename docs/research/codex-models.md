# Research: which Codex model for which work

Status: research notes, not a spec. Nothing here is a decision. The `codex-workers` skill holds
the table that a lead agent uses; this note holds the evidence for it.

Date: 2026-11-24. The models change often: OpenAI released GPT-6.2 Astra and Sol on 2026-11-17.
Read the sources again before you trust a number here.

Method: the owner asked for the strengths of the four models and when to use each one. Three
fetch agents (Claude) read 12 pages of OpenAI and gave back quotes; this note cites 10 of them.
The lead agent wrote the note. It also read the model list that Codex keeps on this laptop, and
ran probes with `gpt-6-luna` and `gpt-6.1-terra`.

Limits:

- The lead agent did not read the pages itself. The fetch tool gives quotes of 125 characters or
  less, so a long sentence is cut. The numbers that are only in a chart are missing.
- For S9, the fetch tool gave the first part word for word and a summary of the rest. The quotes
  of S9 in this note are from that summary.
- Each benchmark result is OpenAI's own claim. Nobody measured these models on the work of this
  repository. The recommendation at the end is a start, and real use must correct it.

## Sources

| Id | Page | Note |
| --- | --- | --- |
| S1 | <https://developers.openai.com/codex/models> | The Codex models page. It redirects to `learn.chatgpt.com/docs/models` |
| S2 | <https://developers.openai.com/api/docs/guides/model-selection> | The model selection guide |
| S3 | <https://developers.openai.com/codex/whats-new/gpt-62-astra-sol> | "What's new" for GPT-6.2, dated 2026-11-17 |
| S4 | <https://help.openai.com/en/articles/20001106-codex-rate-card> | The rate card for ChatGPT Work and Codex |
| S5 | <https://developers.openai.com/api/docs/pricing> | The API prices |
| S6 | <https://openai.com/index/introducing-gpt-6-2-astra-sol/> | The announcement of GPT-6.2 Astra and Sol |
| S7 | <https://openai.com/index/introducing-gpt-6-1-terra/> | The announcement of GPT-6.1 Terra |
| S8 | <https://openai.com/index/introducing-gpt-6-sol-and-luna> | The announcement of GPT-6 Sol and Luna |
| S9 | <https://learn.chatgpt.com/codex/agent-configuration/subagents> | The Codex guide for subagents (partly a summary, see Limits) |
| S10 | <https://learn.chatgpt.com/codex/learn/prompting-gpt-6-2-astra> | The prompting guide for GPT-6.2 |
| L1 | `~/.codex/models_cache.json` | The model list that Codex fetched on 2026-11-24 |
| L2 | A probe run | `codex exec -m gpt-6-luna` answered, and the session file shows that model |
| L3 | Two probe runs | `codex exec -m gpt-6.1-terra` read a screenshot: it gave the heading and the number of option cards correctly, with `-i <file>` and with the file path in the brief |

## The four models

| | `gpt-6.2-astra` | `gpt-6.2-sol` | `gpt-6.1-terra` | `gpt-6-luna` |
| --- | --- | --- | --- | --- |
| OpenAI's one line (L1) | "Our most capable model for complex coding and professional work." | "Fast, go-to model for coding and everyday work." | "Efficient model that excels at visual understanding and computer use." | "Fast and affordable model for easier tasks." |
| Credits for 1M tokens in Codex, input and output (S4) | 200 and 1,000 | 50 and 250 | 25 and 125 | 2.5 and 12.5 |
| Cost against Luna | 80 times | 20 times | 10 times | 1 |
| Default context in Codex (L1) | 272,000 | 500,000 | 500,000 | 272,000 |
| Efforts (L1) | `low` to `ultra` | `low` to `ultra` | `low` to `ultra` | `low` to `max` |

S2 has a table of strengths for each kind of work (3D and design, software engineering, data
analysis, deliverables, computer use, research). The fetch agent gave back no rating, only the
order of the models in each row: Astra, Sol, Terra, Luna. That this order is the order of
strength is the fetch agent's reading.

## When to use each model, in OpenAI's words

**GPT-6.2 Astra: the hardest work.**

- "Choose GPT-6.2 Astra for demanding projects, such as diagnosing a bug across services…" (S1)
- "In Codex, try Astra to trace a bug across services, fix it, and test the change." (S1)
- "On coding, GPT-6.2 Astra is better at implementing and testing complex changes in existing
  codebases." (S6)
- Medium effort: "Planning and carrying out complex projects, adjusting the approach as new
  information comes in." (S2)
- Extra high effort: "Solving open-ended problems that require weighing trade-offs and testing
  assumptions." (S2)

**GPT-6.2 Sol: everyday code, and reviews.**

- "Use GPT-6.2 Sol for everyday tasks like editing code, drafting a report, or turning project
  notes into a plan." (S1)
- "Choose Sol to review a pull request or revise code in response to feedback." (S3)
- Medium effort: "Fixing bugs and adding features in an existing codebase, or drafting documents
  for review." (S2)
- Extra high effort: "Working through multistep tasks that need testing and revision along the
  way." (S2)
- On FrontierCode 2.0, Sol "comes within 0.5 points of GPT‑6.2 Astra at about one-fifth the cost
  (both at max)" (S6).

**GPT-6.1 Terra: screens, images and apps.**

- "Choose Terra for clear communication, interpreting images and screens, and completing tasks
  across supported apps." (S1)
- "Choose GPT-6.1 Terra to interpret visual information, such as charts and screenshots." (S2)
- Medium effort: "Navigating desktop apps, updating records, and making focused fixes you can
  verify." (S2)
- "Terra is also much quicker, completing tasks over three times faster than both GPT-6 Astra and
  GPT-6.1 Sol." (S7)
- Its limit: "For the most complex coding tasks, GPT-6.1 Sol and GPT-6 Astra remain the better
  choice." (S7)

**GPT-6 Luna: focused work with a clear result.**

- "Our most efficient model for focused, high-volume tasks, including summarization, extraction,
  and focused coding." (S1)
- "Choose Luna for specific, high-volume tasks when you know what a good result looks like…" (S1)
- "Use GPT-6 Luna for small, repeatable tasks." (S2)
- Low effort: "Making small edits to files and extracting fields when the expected result is
  clear." (S2)
- For a subagent: "Use for fast, narrowly scoped agents handling clear, repeatable, or high-volume
  work." (S9)

## Reasoning effort

- "Low … suits quick, well-scoped tasks." "Medium balances speed and depth for tasks that need
  more planning." "High and Extra High suit difficult work with multiple steps, sources, or
  tradeoffs." (S1)
- "Most tasks do not need Max or Ultra." (S1)
- "For Luna, start with High." (S1; S9 says the same for a subagent)
- "For most API workflows, start with GPT-6.2 Sol at medium reasoning effort." (S2)
- "Higher reasoning effort can help the model stick with a long-running task through the final
  checks…" (S10)
- "With Ultra, Codex decides on its own when to bring in subagents." (S10)
- The reviewer example of the subagents guide uses `gpt-6.2-sol` at `medium` (S9).

## Limits that a lead agent must know

- GPT-6.2 Astra and Sol: "in two tests, they were more likely to omit mentioning obstacles that
  blocked their work, such as a missing file or unavailable search tool." (S6)
- GPT-6.2 Astra and Sol have "tighter safeguards for higher-risk cybersecurity assistance", and
  these "restrict some legitimate vulnerability research" (S6).
- Terra makes more errors at a low effort. On OpenAI's own test with prompts that are made to
  cause errors, its error rate is 16.7% at `low` and 4.3% at the maximum effort (S7).
- "Subagent workflows consume more tokens than comparable single-agent runs" (S9).
- "agents editing code at once can create conflicts and increase coordination overhead" (S9).
- Custom agent instructions "don't create a separate read-only sandbox" (S9).

## What a brief needs, in OpenAI's words

- "Describe what you need the way you'd ask a colleague who knows the project, then tell Codex
  what you'll look for when you review the work." (S10)
- "Tell it what counts as finished and where you want it to be exhaustive." (S10)
- "When several agents share the machine, ask each to consider how many builds or tests it needs
  to run at once…" (S10)
- "have each agent stop the background jobs it started and remove the temporary files it
  created…" (S10)

## Recommendation for the `codex-workers` skill

This is the lead agent's reading of the sources, with the owner's rules of 2026-11-24: a reviewer
is a different agent, it is never a weaker model than the worker, and the reviewer depends on the
worker and on the difficulty.

| Task | Worker | Reviewer |
| --- | --- | --- |
| Screens and images: compare a screenshot with a design, read a chart | `gpt-6.1-terra` at `medium` | `gpt-6.2-sol` at `high` |
| Everyday code and judgment: a bug fix, a feature, a proof, a fix after a review, security | `gpt-6.2-sol` at `high` | `gpt-6.2-astra` at `high` |
| The cause or the design is not known at the start: a bug across modules, open trade-offs | `gpt-6.2-astra` at `high` | A new `gpt-6.2-astra` session at `high` |

No row for Luna (owner, 2026-11-24): "remove luna from the selection, if the task is luna level
simple, leader should do it by itself". The lead agent does a focused task with a clear result
itself. The evidence about Luna above stays, for a later choice.

Where this changes an earlier rule of the owner (the owner accepted both on 2026-11-24, Q4 A,
"Accept both changes"):

1. **Terra.** The owner's rule of 2026-11-23 used Terra for easy tasks with written steps. That
   work now stays with the lead agent. OpenAI gives Terra the work with screens, images and apps.
2. **Astra as a worker.** The owner's rule gave each hard task to Sol. OpenAI gives the hardest
   work to Astra. On one coding benchmark Sol is within 0.5 points of Astra at one fifth of the
   cost, so Sol stays the worker for most code.

The effort of a Sol reviewer: the table keeps `high` (owner, 2026-11-24, Q5 A, "high, as the
table has it"). OpenAI's example of a reviewer agent uses Sol at `medium` (S9).

Not tested: Terra's use of an app (computer use) from `codex exec`. The table leaves it out.

Not claimed: that this table is the best split for this repository. No run compared the models
on its tasks.
