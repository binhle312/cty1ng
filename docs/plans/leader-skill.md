# The `leader` skill: the owner starts the lead agent with `/leader <task>`

Brief: no brief file. The owner's words in the lead agent's conversation, 2026-11-24:
"if I want that kind of relationship and workflow in other projects, convert them into skills
make more sense", and "for the 2 skills, I think we should set `disable-model-invocation: true`
as I want to start a conversation then `/leader <normal prompt with context, goal, etc...>`,
then the leader can spawn codex workers", then "let do A" (both skills have the flag, and
`leader` names the file of `codex-workers` to read).
Checkpoint: plan. The skill sets the roles of the owner, the lead agent and the workers, so the
owner approves this plan before the build.
Approval: owner, 2026-11-24, revision 4 (the redesign after review round 2: "Approve the plan as
written" and "One home: the Roles table"). Revision 3 ("Approve revision 3 as written") holds
items 1 to 10; revision 2 added the owner's answers and notes of 2026-11-24; revision 3 added the
owner's decision to remove Luna.

## Goal

The owner types `/leader <task>` at the start of a conversation. From that message, the
conversation is the lead agent: it knows who talks with whom, what stays with the owner, the
stages of a task, and where it stops. The skill works when it is copied to another project.

## What the skill holds

The scope is the two sketches that the owner agreed on 2026-11-24, in generic words. The plan
gives the parts; the build writes the text.

1. **Start.** The owner-only line, as `arena` and `consultants` have. Then the task from the
   owner: the text after `/leader`.
2. **Who talks with whom.** A short list for the owner, the lead agent, the advisor tool, the
   worker and the reviewer. It moves here from `codex-workers`, so that it has one home.
   `SKILL.md` holds no sketch (owner's review of #149, 2026-11-24).
3. **What stays with whom.** With the owner: each approval that the project asks for, each
   decision, and the merge. With the lead agent: each message to the owner, the plan, the briefs,
   and the check of each report.
4. **The stages of a task, with the owner's gates.**
   1. Route the task: a question, a change, a bug, or a review.
   2. Read the project's agent instructions and the documents that they name for the task.
   3. Find what the task needs and the documents do not say. Ask each question in one round.
   4. Write the plan and its tests. Wait for the owner where the project asks for an approval.
   5. Give the build to a worker.
   6. Check the result against the plan and the project's checks.
   7. Give the review to a different agent. Send the findings to the builder.
   8. Report to the owner. Merge only when the owner asks for it.
5. **Stop exits.** The documents and the code disagree. A bug does not reproduce. A fix has the
   same cause as an earlier fix. An approval is missing.
6. **The lead agent's own work** (owner, Q1 A with a note, and the Luna decision). The lead agent
   writes the plans, the briefs and the records. It also does each focused task with a clear
   result itself: written steps, an extraction, a summary. `codex-workers` has no worker for such
   a task. A worker writes the code. Exception: the lead agent makes a code change of fewer than
   5 changed lines itself. The count is the larger of the added and the removed
   lines in `git diff --numstat`, summed over the code files of that change. The change still
   goes to the different reviewer, in the next review round of the PR.
   Redesign after review round 1 (owner, answer 7): this rule, with its count, has one home,
   step 1 of `codex-workers`. `leader`, its `GUIDE.md` and `docs/workflows/coordination.md`
   point to that step and do not repeat the limit. The count marks new files with
   `git add -N` and runs `git diff --numstat HEAD`, so that new and staged files count.
7. **Briefs.** The lead agent writes each brief from a template in `references/`: one for a
   worker, one for a reviewer. The templates follow Anthropic's public prompt advice
   ([research](../research/worker-prompts.md)). The list of what a brief holds keeps its one home
   in step 2 of `codex-workers`; a template gives that list its form, with one section for each
   item.
8. **The worker's plan first** (owner, Q1 note 3). A worker's first turn gives back the plan in
   its own words, and changes no file. The lead agent checks the plan with the three tests of
   step 4 of `codex-workers` and accepts it, or sends its corrections. Then the worker builds. The
   lead agent's OK is not the owner's approval. The cost: one more worker turn, about 23,000 input
   tokens before its first action (a measured turn of #149). A reviewer has no plan turn, because
   it changes no file.
9. **Workers.** Before the first worker, read `../codex-workers/SKILL.md`, relative to the base
   directory of this skill. If the file is missing, stop and tell the owner.
10. **The project wins.** Where the project's agent instructions differ from this skill, the
   project's instructions apply.

Not in the first version: the rules for reports and questions from the lead agent's memory (owner,
Q3 A), the rules of this repository (commands, file paths, the merge bar, the records), and
the consultants (they have their own skill).

## Files

| File | Change |
| --- | --- |
| `.agents/skills/leader/SKILL.md` | New. `disable-model-invocation: true`; the trigger first in the description |
| `.agents/skills/leader/references/worker-brief.md` | New. The brief template for a worker: context and goal, facts, scope, limits, done and checks, the first turn (plan only), the report form, the immediate task |
| `.agents/skills/leader/references/reviewer-brief.md` | New. The brief template for a reviewer: a different agent, the diff and the plan to check, the checks it runs, no commits, findings with evidence |
| `.agents/skills/leader/agents/openai.yaml` | New. `allow_implicit_invocation: false` |
| `.claude/skills/leader` | New relative link |
| `.agents/skills/README.md` | One row |
| `.agents/skills/leader/GUIDE.md` | New. A file for people: the sketch of who talks with whom and the sketch of the stages with the owner's gates. `SKILL.md` has no link to it |
| `.agents/skills/codex-workers/SKILL.md` | The list "Who talks with whom" moves out. Its two definitions (lead agent, worker) stay, because `/codex-workers` can run alone. Step 4 changes from "when the work has a design choice" to each build task: the first turn is a plan in the worker's own words |
| `.agents/skills/codex-workers/GUIDE.md` | The sketch of who talks with whom moves to the guide of `leader`. The sketch of one task, turn by turn, stays |
| `docs/workflows/coordination.md` | Changes in this PR (owner, Q2 A): the three roles, the builder is a Codex worker, the reviewer is a different agent, a row for the lead agent, the new reason for two agents, the builder asks the lead agent, one pointer to the skill |
| `docs/research/worker-prompts.md` | New. The evidence for the two templates |
| `docs/README.md` | One link to the research note, in the row of research |
| `docs/status.md` | The line of this PR |

The branch starts from `codex-workers` (#149), because the build changes that skill's file.

## Risk probes

Both ran on 2026-11-24 in a scratch project with two probe skills, both with
`disable-model-invocation: true`, linked as this repository links its skills.
Command: `claude -p "/probe-lead Fix the flaky test. Done: 100 runs pass." --model haiku`.

| Unknown | Result |
| --- | --- |
| Does an owner-only skill get the text after its command? | Yes. `$ARGUMENTS` in the skill text became the full text, word for word |
| Can it read the file of a sibling skill by a relative path? | Yes. It read `../probe-work/SKILL.md` from its base directory (the link in `.claude/skills/`) and gave back the code word |

The probes show how the tool passes the text and the path. They do not show how a lead agent
acts on the real skill text.

## Test strategy

The skill is text, so the tests are checks of the files and one run of the skill.

| Behaviour | Check |
| --- | --- |
| The skill is valid and the index is current | The skill validator, `pnpm check:index`, `pnpm lint`, the STE checker at 80% or more |
| No session loads it by itself | The frontmatter has the flag, and `openai.yaml` has `allow_implicit_invocation: false` |
| The task arrives | A run of `claude -p "/leader <task>"` in a scratch project with both skills. The answer gives the task back |
| The lead agent reads the worker file before a worker | In the same run, the task needs a build. The answer has the start command in the form of `codex-workers`, printed and not run |
| The lead agent stops at an owner gate | The scratch project's instructions ask for a plan approval. The run ends with the plan and a wait, and with no build |
| The sibling file is missing | A second scratch project has only `leader`. The run stops and tells the owner |
| `SKILL.md` is for the agent only | It holds no sketch and no link to `GUIDE.md` |
| The skill is portable | A search of the skill folder, `references/` included, for `docs/`, `AGENTS.md`, `pnpm` and `principle-`: no result |
| The lead agent briefs from the templates | In the scratch run, the brief file has one section for each item of step 2 of `codex-workers`, and the plan-first section |
| Each brief item has a template section | A script compares the items of step 2 of `codex-workers` with the sections of `worker-brief.md`: no item is missing |
| A worker's first turn is a plan only | One `gpt-6.2-sol` run at `high` in a scratch Git repository, with a brief from the template. The report is a plan, and `git status` shows no change |
| The 5-line exception | In the scratch run, a task that needs a 2-line code change: the lead agent makes it and names the review. A task that needs a 20-line change: the answer has a worker start command |

The run uses Claude Opus 5.5. A run with Fable 5.2 needs the owner's word.

## Risks and limits

- **A context reset.** A long conversation gets a summary in place of its first messages. No test
  shows that the skill text stays after that. The skill tells the lead agent to keep its role and
  its open gates in each summary. If the role is lost, the owner types `/leader` again.
- **Other tools.** Codex and some other tools do not read `disable-model-invocation`. The first
  line of the text and `openai.yaml` cover them.
- **Size.** The skill stays below about 120 lines. A longer text weakens each line.

## The owner's answers (2026-11-24)

The owner's words, from the question page of revision 1:

1. Q1 A, "Lead writes plans and records; workers write code", with these notes: "1. Leader should
   make a small code change like under 5 lines of code change 2. Leader make a brief about what to
   do, what not to do with a good prompt (based on anthropic public courses and demonstration),
   remember to store the reference template for prompt for worker and the prompt for reviewer in
   the leader skill `references/*` 3. The worker first thing to do when receive a brief from
   leader: it has to describe the plan in it own words, leader is in charged to review and
   approve that plan".
2. Q2 A, "Change it in the leader PR".
3. Q3 A, "Not now: roles, stages, gates and exits only", with the note "List the rules that you
   mentioned here".
4. Q4 A, "One Codex review of both skills".
5. After revision 2: "remove luna from the selection, if the task is luna level simple, leader
   should do it by itself".

6. On the page of revision 3: Q1 A, "Approve revision 3 as written"; Q2 A, "Yes, in the next
   review round" (a different agent reviews the lead agent's small change); Q3 A, "A worker: keep
   the 5-line rule" (a simple code change of 5 lines or more goes to a worker); Q4 A, "Accept both
   changes" (the model table of #149); Q5 A, "high, as the table has it" (a Sol reviewer).
7. After review round 1: "#1 fix them in 150" (F7: the documents that gave the builder the
   plan and the records now give them to the lead agent); "#2 fix it as redesign" (F1: the
   one home of item 6); "#3 let do as your recommendation" (F11: record the hit in the
   prevention action, and change nothing more).
8. After review round 2: Q1 A, "Approve the plan as written" (R1 of revision 4); Q2 A, "One
   home: the Roles table" (R2); Q3 A, "Record the flags in #149" (the security scan of
   `codex-workers`).

## Revision 4: the redesign after review round 2

`AGENTS.md` §9: review rounds 1 and 2 found fixes with the same cause as earlier fixes. The owner
approved this redesign on 2026-11-24 (answer 8). Its commits get their own review rounds 1 and 2
(`docs/workflows/merge-bar.md`, step 2).

**R1. The lead agent's own work (item 6).** The rule, its limit and its count have one home: step
1 of `codex-workers`. `leader`, its `GUIDE.md` and `docs/workflows/coordination.md` point to it.
The rule gets these cases:

- **Clean start.** Before its own code change, the lead agent checks that the worktree has no
  other change (`git status --porcelain` gives nothing). If it has one, the change goes to a
  worker. Then the count (`git add -N` for new files, then `git diff --numstat HEAD`) counts only
  the lead agent's change. If the change grows to 5 lines or more, it goes to a worker.
- **Order of one-at-a-time commands.** Before each message that lets a worker build or run checks
  (a start or a resume), the lead agent compares it with the work of each other worker that has
  not ended. If two need a command that only one agent can run at a time, it gives the order.
- **The review route.** Before the lead agent decides who builds or who reviews, it reads
  `codex-workers`. So a review-only task also reads the models, the sandbox and the stop rule.
- **The report of a push.** The worker template asks for the pushed commit only if the worker
  pushed (kept from `32199f4`).

**R2. Who does each kind of work (one home).** The Roles table of
`docs/workflows/coordination.md` names who does each kind of work: the plan, the risk probes,
the test strategy, the briefs, the build, the checks, the fixes, the records and the PR
description. The other workflow documents (`planning.md`, `implementation.md`, `merge-bar.md`,
`review.md`, `pull-request.md`, `review-guide.md`, `development-plan.md`, `status.md`) say what
to do, give no role a duty by name, and point to the Roles table. The lead agent prompt in
`planning.md` builds as `codex-workers` says, and leaves the records to the Roles table.

### Test strategy of revision 4

| Behaviour | Check |
| --- | --- |
| The limit has one home | `grep -rn -E 'fewer than 5\|5 changed\|5 lines' .agents/skills docs/workflows`: only step 1 of `codex-workers` |
| The lead agent makes a small change on a clean tree | A `claude -p "/leader <task>"` run with `git` allowed: a 2-line task on a clean worktree. The lead agent makes the change, runs the count, and names the review |
| A worktree with other changes | The same task with an unrelated change that is not committed: the change goes to a worker |
| A review-only task | A run with `/leader review <change>`: the answer follows `codex-workers` (the reviewer row, a `read-only` sandbox). With only `leader`, the run stops and names the missing file |
| Two workers and one fixed port | A run where two workers need the same test on fixed ports, and one of them has ended its plan turn: the answer gives the order before the build messages |
| No workflow document gives a role a duty | `grep -n -i -E 'builder\|lead agent'` over the documents of R2: only the name and the text of the lead agent prompt, and the line of `development-plan.md` that says how to start it |
| The links work | `pnpm lint` and `pnpm check:index` |

The runs use Claude Opus 5.5, in scratch Git projects outside the repository.

## Open questions

None. The owner answered each question on 2026-11-24.
