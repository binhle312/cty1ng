# Research: how a lead agent writes a brief for a worker and for a reviewer

Status: research notes, not a spec. Nothing here is a decision. The `leader` skill holds the two
brief templates (`references/worker-brief.md`, `references/reviewer-brief.md`); this note holds the
evidence for them.

Date: 2026-11-24. Method: the owner asked for templates "based on anthropic public courses and
demonstration" (2026-11-24). The lead agent read the pages below itself, with a web fetch and
`gh api`. This note quotes them. The workers are Codex models, so the brief advice of OpenAI is
also important: [codex-models.md](codex-models.md) holds it (its source S10).

Limit: Anthropic wrote this advice for Claude models. The workers are OpenAI models, so each rule
here is a good default, not a measured result for a Codex worker.

## Sources

| Id | Source | What it holds |
| --- | --- | --- |
| A1 | <https://github.com/anthropics/courses>, `prompt_engineering_interactive_tutorial/Anthropic 1P/09_Complex_Prompts_from_Scratch.ipynb` | The course's structure for a complex prompt: 10 elements in a recommended order |
| A2 | The same course, `08_Avoiding_Hallucinations.ipynb` | Give the model an "out"; gather evidence before the answer |
| A3 | <https://www.anthropic.com/engineering/multi-agent-research-system> | How Anthropic's lead agent briefs its subagents |
| A4 | <https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices> | Prompting best practices for current Claude models |
| A5 | <https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-2> | Prompting patterns for Claude Fable 5.2: finish the task, approvals, ownership, reports |

## What the sources say

**The parts of a brief.**
- "Each subagent needs an objective, an output format, guidance on the tools and sources to use,
  and clear task boundaries." (A3)
- "Without detailed task descriptions, agents duplicate work, leave gaps, or fail to find
  necessary information." (A3)
- A1 gives this order: task context, tone, "detailed task description and rules", examples, input
  data "within relevant XML tags", the immediate task, "thinking step by step", output format.
  "It's best to put context early", and the immediate task goes "toward the end of a long prompt".
- A1: "Not all prompts need every element", and "use many prompt elements to get your prompt
  working first, then refine and slim down your prompt afterward".

**Clear words and the reason for each rule.**
- "Think of Claude as a brilliant but new employee who lacks context on your norms and workflows."
  The key test: "Show your prompt to a colleague with minimal context on the task" (A4).
- "Providing context or motivation behind your instructions … can give Claude more information
  about your goals" (A4). "Claude can generalize from the explanation." (A4)
- "Provide instructions as sequential steps using numbered lists … when the order or completeness
  of steps matters." (A4)
- "Wrapping each type of content in its own tag (for example, `<instructions>`, `<context>`,
  `<input>`) reduces misinterpretation." (A4)
- "The model treats an instruction that contains 'never' as absolute." Write the scope and the
  reason: "ask for approval before deleting files" in place of "never delete files" (A5).

**Scope and quality of the work.**
- "Only make changes that are directly requested or clearly necessary." (A4)
- "Implement a solution that works correctly for all valid inputs, not just the test cases." "If
  … any of the tests are incorrect, please inform me rather than working around them." (A4)
- "Never speculate about code you have not opened." (A4)
- Ownership: "You are the owner and long-term maintainer of this codebase" made the model
  consolidate code in about 75 percent of runs, and it "made changes nobody had asked for". "Leave
  the ownership sentence out where the user owns the code and wants it changed as little as
  possible." (A5)

**Finish, stop and ask.**
- Ordinary obstacles ("errors, timeouts, locked files, empty results or failing tools"): "Diagnose
  them first". A deliberate blocker: "leave it alone, say plainly what you found" (A5).
- An "out": tell the model "that it's OK for it to decline to answer" (A2). Evidence first:
  "extract relevant quotes, then base its answer on those quotes" (A2).
- Approvals: "be specific about the actions you want double-checked" (A5).

**The report.**
- "Write for an intelligent but low-context reader. The person reading has not seen your tool
  calls, your reasoning or the files you opened." "Put the key points in the first few sentences."
  (A5)
- "A closing PR summary … often left out small changes, so review the reported diff and the
  summary." (A5)

**A plan before the build.** No source above asks a worker to restate its plan before it builds.
That step is the owner's rule (2026-11-24). The nearest advice is in A1 and A4. A1 tells the
model to think step by step before the answer. A4 gives a chain of three calls: a draft, a review
against criteria, and a better result.

## How the templates use this

| Template part | Source |
| --- | --- |
| Context and the goal first, with the reason | A1 (task context early), A4 (context and motivation) |
| Facts, scope, limits and paths in separate XML tags | A1 (input data in tags), A3 (task boundaries), A4 (XML tags) |
| Each rule with its scope and reason, no bare "never" | A4, A5 |
| What "done" means, and the checks | A3 (output format), OpenAI S10 in [codex-models.md](codex-models.md) |
| First turn: the plan in the worker's own words, no edits | The owner's rule; A1 (think first), A4 (self-correction chain) |
| Obstacles, the "out", and evidence for each claim | A2, A5 |
| The report for a low-context reader, with each change | A5 |
| The immediate task at the end | A1 |
| Reviewer: a different agent, read before a claim, findings with evidence | A2, A4; the owner's rule of 2026-11-24 |

Not claimed: that these templates give better worker results than the brief list of
`codex-workers` alone. No run compared them.
