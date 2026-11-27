# The `leader` skill: the owner starts the lead agent with `/leader <task>`

Brief: no brief file. The owner's words in the lead agent's conversation, 2026-11-24:
"if I want that kind of relationship and workflow in other projects, convert them into skills
make more sense", and "for the 2 skills, I think we should set `disable-model-invocation: true`
as I want to start a conversation then `/leader <normal prompt with context, goal, etc...>`,
then the leader can spawn codex workers", then "let do A" (both skills have the flag, and
`leader` names the file of `codex-workers` to read).
Checkpoint: plan. The skill sets the roles of the owner, the lead agent and the workers, so the
owner approves this plan before the build.
Approval: owner, 2026-11-24, revision 3 ("Approve revision 3 as written"). Revision 2 added the
owner's answers and notes of 2026-11-24; revision 3 added the owner's decision to remove Luna.
The redesign after review round 2 has its own plan: [leader-skill-redesign.md](leader-skill-redesign.md).
Revision 5 (2026-11-25, approval waiting): two candidate PRs, one skill or two; see
[Revision 5](#revision-5-2026-11-25-two-candidate-prs-one-skill-or-two).

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

   [Revision 7](#revision-7-2026-11-25-questions-until-clear-and-a-plan-that-the-owner-reviews)
   changes stages 3 and 4.
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


## Revision 5 (2026-11-25): two candidate PRs, one skill or two

Approval of this revision: waiting. The owner's order lets the lead agent build both candidates;
the owner approves one of them, and this revision with it, at the merge.

The owner's words in the lead agent's conversation, 2026-11-25: "it's a bit strange as leader and
codex-workers are strictly tight together. Hey Advisor, what do you think, should we combine into 1
skill or leave them as 2 separated skills?" After the lead agent's options (A: one skill; B: two
skills with a clean split; C: as they are): "Let close 149 and 150. Do 2 PRs: 1 is option A,
another the one is option B".

Why new PRs: `AGENTS.md` §9 keeps a redesign in the PR that found the issue. Here the owner ordered the two new PRs and the close of #149 and #150. The history of the reviews stays in the closed PRs, and each new PR links them.

**The line.** Each sentence or bullet of the two skills gets one test: "Does this text change if the worker is not Codex?" No: it is process, and its home is `leader`. Yes: it is Codex mechanics, and
its home is the Codex text. The unit is a sentence or a bullet, not a section.

**Option B** (branch `leader-two-skills`): two skills. `leader` holds each process rule.
`codex-workers` holds only the Codex mechanics: the model table and its notes, and the commands.
`leader` names the Codex text for each command.

**Option A** (branch `leader-one-skill`): option B, then the fold. `codex-workers/SKILL.md` moves to
`leader/references/codex.md`; one `GUIDE.md`; no `/codex-workers`, no second `agents/openai.yaml`,
no second link in `.claude/skills/`, and one index row. The command `/codex-workers` goes away. The
lead agent reads the Codex text before it picks a worker or a reviewer, so a task that needs neither
(for example a question) loads only `leader/SKILL.md`.

Both candidates come from one split. They differ only in their files and folders, and in the
command `/codex-workers`, which A removes. The owner
compares them with the same numbers. The numbers are: the lines that load at `/leader` and at the
build stage, the pointers between files, the skill validator, the security scan, and the files
changed against `main`.

**Test strategy of this revision.**
- A fact map script (`tmp/leader-skill/split/factmap.py`, not in the repository) does four checks
  on the `.md` files of the two skill folders, taken together:
  - Each sentence at `cf571de` is in the new tree the same number of times, or is on an exceptions
    list with a reason. The front matter is not in this check.  - Each code block of the old files is in the new files the same number of times. This check goes
    one way: a new code block can pass. An exceptions line `REPLACE` changes the old text before
    the compare, so each pointer that the move made false is visible. Two of them are inside code
    blocks: in `references/worker-brief.md` (`codex-workers` becomes `leader`) and in the stages
    sketch of `leader/GUIDE.md` (a pointer to the lead agent's own work).
  - Each relative path in a Markdown link or a `../x.md` mention resolves. The check does not read
    the part after `#`, and it does not check a path with no `../` or link.  - The line limit of F1 has one home: exactly one file of the two folders has one or more of the
    phrases `fewer than 5`, `5 changed` and `5 lines`.

  It also lists each new sentence for the reviewer. Proof that it can fail: a copy had four breaks
  (a removed rule, a changed code block, a broken path, a copy of the line limit). The script
  reported all four and exited 1.
- One complete review in parts, with the guides against the skill, then one narrow fix check, then
  the lead agent stops and reports.
- The full set of `AGENTS.md` §4 on each final head, with no edits during the run.

## Revision 6 (2026-11-25): the lead agent's files, and three text fixes

Approval of this revision: owner, 2026-11-25. The owner approved the files design in the closed #157
("your proposal plan looks good for me, remember to keep everything simple, we're software engineer,
don't complicate thing that shouldn't be"), then closed #157 and moved the work here: "stop it,
close 157 with reason, let try continue on 156".

The owner's requirement, 2026-11-25: "Leader have to write down 3 md files: goal, instruction,
handoff. So when I start the leader in new conversation, it can pickup the work where it left off".
Then: "goal.md and handoff.md are must". The advisor and the Opus consultant found no part of
`instruction.md` that has no other home.

**What changes.**
- `SKILL.md`: a section "Your files for the next conversation": `goal.md` and `handoff.md` in
  `tmp/leader/` of the lead agent's worktree, a `git check-ignore` check before the first write,
  when each file is written, and how a new conversation continues (`/leader <folder path>`, check
  each claim against the repository, the repository wins). The summary keeps the folder path. The
  session list of the workers is in `handoff.md`, with the last context use at each write (no
  longer after each check, because `handoff.md` is written in full at events). The lead agent gives
  the owner the absolute folder path in each report, and never gives its folder to a worker as a
  writable folder (both from the consultants' answers on #157). A folder that holds another task's
  files is not reused without the owner. A replacement reviewer continues the review; the handoff
  turn is not stopped at the limit. The 35% handoff of a worker is "the worker's
  handoff", and the worker gives it as its last message, so a reviewer that cannot write files can
  give it too (the report file of that turn holds it).
- `references/codex.md`: the Codex windows in the owner's words, and F1B-1 ("reaches 35% before it
  reports").
- `GUIDE.md`: how the human continues in a new conversation, and the worker's handoff as its last
  message. The Mermaid blocks do not change.

**One change from the design of #157.** That design kept the worker sessions in `runs/`, the run
folders of the script. Without the script, the session list is a part of `handoff.md`.

**The context limit (owner, 2026-11-25): "Increase the % context window from 35% to 50%".** The
limit in `SKILL.md`, "Context of each worker", is 50%. The guide and its turn diagram say 50%; the
review split uses "the limit". The note on 258,000-token models keeps the 35% that reviews reached,
as an observation.

**Small tasks (owner, 2026-11-25):** "yes, thats why should split the work smaller so we can have
multiple workers and reviewers to handle small work, not a big chucky code at once". Stage 4 of
`SKILL.md` splits the build into small tasks, each with one outcome and its own checks, gives
independent tasks to different workers at the same time, and reviews each task apart. Then: "when me (owner) give the goal, you should
break it into smaller tasks that you can spawn workers who can work in concurrency or parallel which
not block or touch other's works": no task changes a file of another task or waits for another
task; a task that needs another task's result starts after it. The guide says the same in one
sentence.

**Test.** The fact map against `a600a49` lists each sentence that leaves, with its reason. A
headless continuation test of the #157 text passed on 2026-11-25: a new conversation that got only
the folder path found a commit that `handoff.md` did not name, reported it before it acted, and did
not redo the plan. The same test ran again on this text (`d7033de`) and passed: run 2 got only the
folder path, reported the commit that `handoff.md` did not name, and did not redo the plan. The
review fixes `f8ce7de` and `ac4e10c` came after that run.

## Revision 7 (2026-11-25): questions until clear, and a plan that the owner reviews

Approval of this revision: the owner ordered the change and the arena on 2026-11-25 (below). The
additions beyond the owner's words wait for the owner's review; the PR lists them under
`Needs human review`.

The owner's words, 2026-11-25: "when leader receive the goal, it can grill owner to clarify things,
until it know what exactly need to be done, it make a plan for owner to review. That plan must
include the smaller goals for workers to work on, how many workers will be spawn, how many reviewers
will be spawn, which models and efforts it choose based on the given goals, etc... ask adivsor and
consultants to sharp my words and update the needed documentations". Then: "for the new text, no
need spawn worker, you - leader should do it based on the advices from advisor and consultants", and
"/arena spawn 1 Opus 5.5 high, 1 gpt6.2 astra high, 1 Fable 5.2 high to make their own version of
the new word, You do the cold read and pick the best one". The lead agent judged the three versions
and put the result together; the PR description has the scores under `Arena`.

**What changes.**
- `SKILL.md` stage 3, "Clarify the goal": the lead agent asks the owner in rounds, with all the
  open questions in one message, until it can write the goal, the scope and "done" with no guess.
  "Ask the owner each question in one round" leaves.
- `SKILL.md` stage 4, "Plan": the plan holds one item for each part of the owner's words: the tasks
  (the small independent tasks of revision 6, with the files and the order of each), the workers
  (count and task of each, and the lead agent's own tasks), the reviewers (count, and what each one
  reviews), and the model and effort of each worker and reviewer with one reason. The lead agent
  gives the plan to the owner and starts no build, no worker and no reviewer before the owner's OK.
- The plan is as short as the work: a few lines for the lead agent's own code change; no plan for
  work that starts no worker and no reviewer, such as an answer to a question.
- After the OK, the lead agent asks the owner before it changes a task, a count, a model or an
  effort. A new session with the same task, model and effort (a replacement at the limit, or the
  review of the fixes) is not a change.
- Other sentences that became false: the owner's line and the lead agent's line of "What stays with
  whom", stage 5, stage 6 (your plan and the worker's plan), "Tell the owner one reason" in
  "Workers" (the picks go in the plan), "Get the plan first" (the worker's plan, in the scope of its
  task), and the `handoff.md` row (the plan, and the owner's OK or "no OK yet"; no new file).
- `GUIDE.md`: the flowchart labels, the stage sketch, "What the skill does" (two plans), the turn
  diagram (a question loop, then the plan and the owner's OK), and the sentence below it.

**Additions beyond the owner's words** (each is in `Needs human review` of the PR):
- The OK is a hard gate. The owner said "for owner to review"; all three arena versions read it as
  "wait for the OK", because a review after the workers start cannot change their count.
- A code change that the lead agent makes itself (fewer than 5 lines) now waits for the owner's OK
  on a short plan, because it always has a reviewer.
- The stop test of stage 3, "all the open questions in one message", the files and the order of
  each task, the change rule after the OK and its exception.

**Test.** The fact map against `a600a49` lists each sentence that leaves, with its reason. A
headless run of `/leader` with a clear goal, the owner away, and a stub `codex` that logs each call
other than `--version`: on the text before this revision (`d1690e2`), the lead agent ran
`codex exec` with no OK on a plan; on this revision (`271904d`), it made no `codex exec` call, gave
the plan with the task, the worker, the reviewer and their models, and waited for the OK. A goal
with gaps does not tell the two texts apart: both asked questions and made no call.

## Revision 8 (2026-11-25): a Haiku search, and Claude Code subagents when Codex cannot run

Approval of this revision: the owner ordered both changes on 2026-11-25. The additions beyond the
owner's words wait for the owner's review; the PR lists them under `Needs human review`.

The owner's words, 2026-11-25: "for the kind of exploration, you should use haiku". The lead agent
proposed two sentences for "The lead agent's own work"; the owner answered: "Add it, also remember
if codex workers are failed to start (maybe due to human subscriptions is over, claude code
sub-agents (or agents) will be the backup)".

**What changes.**
- `SKILL.md`, "The lead agent's own work": a broad search for the documents and the code of a task
  goes to a Claude Code subagent on Haiku. The lead agent asks for paths, line numbers and short
  quotes, and reads each line itself before its plan depends on it. A search subagent changes no
  file and is not a worker, so it can run before the owner's OK. "Keep searches and short reads for
  yourself" becomes "Keep short reads for yourself".
- `SKILL.md`, a new part "When Codex cannot run" under "Workers": if a start or a message fails
  because of the Codex account (an ended plan, a used limit, no login), Claude Code subagents are
  the workers and reviewers, with the same brief, first turn and worktree rules. Another error is an
  ordinary obstacle.
- `SKILL.md` stage 4: a move to the backup needs no new OK; the lead agent tells the owner the cause
  and the new models.
- `references/worker-brief.md`: "You are a worker for a lead agent" (no longer "a Codex worker").
- `GUIDE.md`: one row for the search in "Who does which work", and one sentence for the backup.
- The owner's agent roles (owner, 2026-11-25, "Agree with your suggestion"): the search uses the
  built-in `Explore` subagent with the model Haiku; in the backup, a building role such as
  `implementer` is the worker and a review role that cannot edit files such as `reviewer` is the
  reviewer, if Claude Code has them, else a general subagent. `test-verifier` is not used: the
  worker runs the tests and the reviewer checks the evidence.

**Additions beyond the owner's words:**
- The models of the backup: Claude Opus in place of Astra, Claude Sonnet in place of Sol or Terra,
  at the same effort. The owner named no Claude model.
- "Tell the owner, no new OK" for the move to the backup. The lead agent reads "will be the backup"
  as an order for that case.
- A reviewer subagent has no read-only sandbox: its brief says to change no file, and the lead agent
  checks `git status`. The lead agent cannot read a subagent's context use, so it keeps the task
  small. A subagent ends with the conversation; a new one starts with the brief, the diff and the
  commits.
- Only an account error starts the backup; a failed `resume` counts the same as a failed start.

**Test.** The fact map against `a600a49` lists each sentence that leaves, with its reason. Two
headless runs of `/leader` on `98d41be`, the owner away, with a stub `codex`. With a clear goal and
no OK, the lead agent made no `codex exec` call and waited for the OK on its plan. With the OK in
the task and a stub that fails each call with an account error ("You've hit your usage limit. Your
plan has ended"), the lead agent made one `codex exec` call, told the owner the cause, and used a
Claude Sonnet worker (high) and a Claude Opus reviewer (high): the worker's plan first, the build,
one review finding, the fix, and the check of the fix; it used no other `codex` program. The test
project has two files, so no run needed a broad search: the Haiku search did not run.

## Revision 9 (2026-11-25): worker teams, two outside reviewers, and terminal sketches

Approval of this revision: the owner approved the design on 2026-11-25 (the answers below, then
"1. Agree with your suggestion for the mdel ... 4. Agree 5. yes"). The additions beyond the owner's
words wait for the owner's review; the PR lists them under `Needs human review`.

The owner's words, 2026-11-25: "Basic roles that I have the team should have: 1. explorer 2.
implemeter 3. test verifier 4. reviewer"; "When I mean "worker", I meant these 4 roles for the
coding task, default role for any other task that these 4 roles not cover"; the explorer: "It's
Claude Explore subagent on Haiku", and "Haiku only help to explore to gather information and give
back to leader so leader have enough context to make the plan"; the test verifier and the reviewer:
"it's the subagent in worker session, just like test verifier and reviewer"; "We also need a
separate reviewers (one from Anthropic, one from OpenAI), they will help leader to review the PR by
each state (like workers team)"; "Launch these "reviewers" when worker team report each state as we
have to ensure the worker is on the right track"; "let use GPt6.2 astra high as reviewer from
OpenAI"; "Session A shouldn't communicate with each other, actually, when needed, leader can tell
them to work on the different worktrees ... it spawn up to 2 workers to work at the same time";
"Leave Codex as it is" for the other subagents of a Codex session; and "replace the mermaid chart
with the terminal sketch in the PR". A first version of this revision (`6e311fd`) made the test
verifier and the reviewer separate sessions of the lead agent; the owner corrected it, and this
text replaces it.

**What changes.**
- `SKILL.md`, "Teams" under "Workers": each task gets a worker team, one worker session. For a
  coding task, the implementer builds; after each build turn and each fix turn, it starts its own `test-verifier` and
  `reviewer` subagents at the same time, by role name, and fixes their findings before it reports.
  A task that is not code gets a default worker, with the `reviewer` subagent only. At most 2 worker
  teams run at the same time (owner, 2026-11-25).
- `SKILL.md`, a new part "Outside reviewers": at each checkpoint report and the final report of a
  worker team, the lead agent starts two new reviewers at the same time (the same pair checks the
  fixes of its findings): a Claude
  Code subagent on Opus at `high` (with a review role that cannot edit files, such as `reviewer`),
  and a new Codex session on `gpt-6.2-astra` at `high`, read-only. Stages 4 and 7 follow.
- The explorer (`Explore` on Haiku) only gathers facts for the lead agent's plan; it is not in a
  team.
- `references/worker-brief.md`: a part "Your team" that names the two subagent roles.
- `references/codex.md`: the table keeps the worker column; the OpenAI outside reviewer is always
  `gpt-6.2-astra` at `high`. The sentence "With `ultra`, Codex starts agents of its own" was false
  (the runs of 2026-11-24 and 2026-11-25 show subagents at `high`); it now says that a Codex session
  at `high` starts subagents of its own.
- The backup: a Claude subagent cannot start subagents, so the lead agent starts the Claude test
  verifier and team reviewer itself, after the build; a second Claude Opus session takes the place
  of the OpenAI reviewer.
- Sessions do not talk with each other: the lead agent carries each result. The session list in
  `handoff.md` names the role of each session.
- `GUIDE.md`: both Mermaid charts are now terminal sketches (owner's order; revision 6 kept the
  Mermaid blocks). The sketches, the stages, the table "Who does which work" and the text show the
  worker teams and the outside reviewers.
- `docs/workflows/coordination.md`, `.agents/skills/README.md`: the rows follow.
- Revision 8 said that `test-verifier` is not used; this revision changes that.

**Additions beyond the owner's words:**
- The Anthropic reviewer runs on Opus at `high` (the lead agent's suggestion; the owner agreed).
- "Each state" read as each report of a worker team: the worker ends its turn with a report at each
  checkpoint of its plan (a new rule for the worker); its subagents check after each build turn and
  each fix turn, not in the plan turn; a new
  pair of outside reviewers checks each report, and the same pair checks the fixes of its findings.
- One part "Claude Code subagents" holds the rules of each Claude subagent (the Anthropic reviewer
  and the backup): the Agent tool, its model, no sandbox, no context measure, it ends with the
  conversation.
- The worker brief names the Codex roles `test-verifier` and `reviewer` (only the roles that the
  Codex configuration has). The owner said "Leave Codex as it is" for the other subagents.
- In the backup, the lead agent starts the test verifier and the team reviewer itself, and a second
  Claude Opus session replaces the OpenAI reviewer (the owner agreed).
- The team's subagents run on the models of the owner's Codex role files (`gpt-6.2-sol` at `high`),
  which can be weaker than an Astra worker; the outside reviewers are never weaker (the owner
  agreed).
- A code change that the lead agent makes itself gets no team; the two outside reviewers review it
  after the commit (review round 1 of the final head found that no reviewer was named for it).
- From review round 1 of the final head (Opus and Astra, `5e598eb..3d491a7`): the worker's plan
  names its checkpoints (a small task can have one); the plan to the owner names the subagents and
  the reviewer pairs; the outside reviewers run read-only, with the test results of the worker
  (the writable review sandbox is removed); the session list holds the outside reviewers too; a
  missing Codex role becomes a subagent with no role; the team subagents get the limits of the
  brief; in the backup, the lead agent starts the team checks after each build and fix turn, the
  test verifier only for a coding task, on a model not weaker than the implementer (the lead
  agent's pick); a commit needs only the Git-folder option, a push also the network option; a
  change of the lead agent's own that grows to 5 lines needs the owner's OK after the plan's OK.
  "At any effort" in `codex.md` claimed more than the runs show; it now says `high`.
- From the fix check of round 1 (Opus and Astra, `3d491a7..a123f7a`): the missing-role fallback is
  a line that the worker reads; the lead agent checks that the worker's plan names its
  checkpoints, and gives the owner the number of checkpoints that it expects; in a fix turn the
  worker asks the same subagents again (the real run did that); the outside reviewers get the
  test results that exist; the backup test verifier may let tests write their output files, and
  the outside reviewers start only after the backup team checks pass; the context measure and
  the session-list reading are for Codex sessions; the guide and the coordination rows follow.

**Test.** The fact map against `a600a49` lists each sentence that leaves, with its reason.
Headless runs of the skill at `fca7a7e` (`tmp/leader-skill/measure/gate-test.sh`):
- Clear goal, Codex stub: 0 `codex exec` calls and 0 subagents before the OK; the plan names the
  team, the two outside reviewers and the backup.
- Real Codex, OK in the task: the worker (Sol, high, `workspace-write`) started subagents with
  `agent_role` `test-verifier` and `reviewer`; one Opus `reviewer` subagent and one read-only Astra
  session reviewed the report, and the same pair checked the fixes. Gap: the worker started its
  subagents in the plan turn, not after the build or the fix. The brief now says when.
- Backup (account error): Claude `implementer` (Sonnet), then the lead agent started the
  `test-verifier` and team `reviewer` (Sonnet), then one Opus outside reviewer. This was not a gap
  of the skill: the test task itself said "one worker and one reviewer" (a text left from the
  revision 8 test). `3d491a7` still names the two Opus reviewers of the backup in "Outside
  reviewers".

Runs at `3d491a7`:
- Real Codex: no subagent in the plan turn; `test-verifier` and `reviewer` after the build; in the
  fix turn, the fix, the commit, then a follow-up to the same two subagents. Both outside reviewers
  checked the build and the fix.
- Backup with the corrected task ("the worker team and the reviewers that your skill gives"):
  the lead agent started the team checks after each build and fix turn, and two Opus outside
  reviewers ("A (Anthropic)", "B (OpenAI stand-in)"); both checked the fixes.
- Continuation (`/leader <folder>` only, after a commit that the handoff does not name): it found
  and reported the commit, started no worker, kept the gate closed.
- Two tasks, real Codex: the lead agent made the 4-line README task itself (own work) and had the
  outside reviewers check it with the worker's task.
- Two tasks, real Codex, code and a measurement: two worker sessions started at the same second;
  the code worker started `test-verifier` and `reviewer`, the measurement worker (default worker)
  `reviewer` only. The lead agent used one Astra session for both teams.

Runs at `80d5651` (after two rounds of outside review):
- Clear goal, Codex stub: 0 `codex exec` and 0 subagents before the OK; the plan names
  "Checkpoints: 1, the final report", the two read-only outside reviewers and the backup.
- Backup: the team checks, then two Opus outside reviewers; each fix went back to the same
  checkers and reviewers. Gap: the lead agent did not set the subagents' effort (the text says
  "give it its model" only); not fixed, the patches are stopped.
- Two tasks, real Codex: both worker sessions started at the same second; no subagent in a plan
  turn; follow-ups to the same subagents in each fix turn; an Opus and an Astra reviewer for each
  task; the same pair checked each fix.

The outside review stopped after two fix checks (AGENTS.md §9); the open findings and the owner's
options are in the PR.

## Revision 10 (2026-11-26): one home for each rule

Status: approved. The owner, 2026-11-26: "Your plan looks good enough, we need to figure this
coordination.md out", and then: "Alright, let remove that file. I believe our leader skill.md has
explain the workflow that we want".

Why: the outside review of revisions 7 to 9 stopped after two fix checks (AGENTS.md §9). Two causes:
a rule had copies in 3 to 5 files, and each fix round added rules that brought new gaps. The owner
chose option A on 2026-11-26, with this condition: "coordination.md is projcet documentation, this
skill must have enough information to be standalone so people can use it in different projects".

The owner's decisions on the rules that the fix rounds added (2026-11-26, answers to four
questions):
- "Drop the count": the plan gives no number of checkpoints, and nothing checks it. The worker's
  plan still names its checkpoints.
- "Worker's choice": after each build turn and each fix turn, the worker runs its team checks, with
  new subagents or the same ones.
- "Role default": in the backup, the team checkers use the models of the Claude role files.
- "After checks and fixes": in the backup, the outside reviewers start after the team checks ran
  and the implementer fixed their findings for that checkpoint.

**The one home of each kind of text:**

| Text | Its one home | Other places |
| --- | --- | --- |
| Each rule for the lead agent | `SKILL.md` | None |
| What the worker reads (its plan turn, its team checks, its report) | `references/worker-brief.md` | `SKILL.md` names the part of the brief; it does not repeat its text |
| What a reviewer or a backup checker reads, with a `[limits]` slot | `references/reviewer-brief.md` | `SKILL.md` gives the value of the slot for each kind of reviewer |
| Commands and flags | `references/codex.md` | `SKILL.md` links to them; no rule text in `codex.md` |
| How it works, for a human | `GUIDE.md`: the sketches and a short text with no rules; it says "The rules are in `SKILL.md`" | Each sketch label is the name of a `SKILL.md` part or step |
| Who does each step of the work | `SKILL.md` | `docs/workflows/coordination.md` is removed (owner, 2026-11-26); project documents point to the skill, and the skill never points to project documents |

**Changes:**
- `SKILL.md`: apply the four decisions; remove each sentence that repeats the worker brief; "Claude
  Code subagents" gives the model and the effort; stage 7 keeps the read-only rule and "the test
  results that exist"; the backup uses the reviewer brief with its `[limits]` slot.
- `references/worker-brief.md` `<your_team>`: "After each build turn and each fix turn, before you
  report, run your team checks: start the subagents below, or ask the same ones again." Not in the
  plan turn. The missing-role line stays.
- `references/reviewer-brief.md`: `<limits>` becomes a slot that the lead agent fills.
- `references/codex.md`: the review run keeps only the flag `-s read-only`.
- `GUIDE.md`: keep the three sketches and the short intro; remove the rule text and the tables
  that repeat `SKILL.md`.
- `SKILL.md`, "Stop and tell the owner": one more item. A worker and a reviewer disagree about a
  finding, and the evidence does not decide it. Before, only `coordination.md` had this rule.
- Remove `docs/workflows/coordination.md`. Its project rules move to the documents that link to it:
  - "Who does each step" in the workflow documents points to the `leader` skill;
  - who updates `docs/status.md` goes into `docs/status.md`; who keeps the review records goes
    into `docs/review-guide.md`;
  - "Parallel work" moves to `docs/development-plan.md`, which links to it two times;
  - "fix a red `main` first" moves to `docs/testing.md` §4;
  - the other rows of "When things go wrong" already have a home: `AGENTS.md` §2 (decisions,
    document drift), `planning.md` (slice size, answers in the owning documents), `merge-bar.md`
    (a severity dispute), and `docs/lessons-learned/README.md`.
  - Old plans and ledger rows keep their text; a link in them becomes plain text.
- The rest of the open findings at `80d5651` (R2-1, R2-2, N5, N7, the guide summary, the plan's main
  text, the backup effort) close with these changes or with the decisions.

**Test strategy:**
1. The fact map against `a600a49` exits 0, with a reason for each sentence that leaves.
2. A copy check: a short script lists each rule phrase of revision 9 (the team checks, the
   checkpoint reports, read-only reviewers, the backup order, the 50% handoff) and the files that
   hold it. Pass: each phrase is in its one home only. The script and its output go in the PR.
3. Headless runs on the final head: the clear goal (no worker before the OK), real Codex with two
   tasks (team checks in build and fix turns, the outside pair at each checkpoint), and the backup
   (role-default checkers, the outside pair after the checks and fixes, the effort set).
4. One complete review of the final head by two new outside reviewers (Opus high subagent, Codex
   `gpt-6.2-astra` high, read-only), not a fix check. Its fixes get checked by the same pair. If
   that check finds a gap with one of the two causes again, stop and ask the owner.
5. Standalone: copy only the `leader` folder into a new empty git repository (no `docs/`, no
   `AGENTS.md`), and run the clear goal there. A check script finds each relative link in the
   skill folder and passes when each one points to a file in that folder.
6. No link to `coordination.md` stays in a file that is not a record (`git grep`).
7. Lint, check:index, check:status, CI on the pushed head.

**Test, at `ac9410d`** (the build of revision 10). The test project of the headless runs has no
`docs/` and no `AGENTS.md`, so each run tests the skill alone (test 5).
- The fact map: rc 0. The copy and link check: pass; a planted copy and a planted bad link fail it.
- Clear goal: no Codex call and no subagent before the OK; the plan names the team and the two
  outside reviewers, with no checkpoint count.
- Backup: Sonnet `high` implementer; the lead agent started the `test-verifier` and `reviewer`
  roles with no model (role defaults), and sent the same two a new message in the fix turn; two
  Opus `high` outside reviewers after the checks and the fix.
- Real Codex, two tasks: `gpt-6.2-sol` workers; the code worker started `test-verifier` and
  `reviewer` in its build turn, the measurement worker only `reviewer`, and it sent `followup_task`
  to the same reviewer in each fix turn; Opus `high` and Astra `high` read-only pairs at each
  checkpoint report and the final report; the same pair checked the fixes.
- CI: green.

**Review round 1 of `ac9410d`** (Opus 5.5 high: 5 major, 12 minor; Astra high: 11 major, 3 minor).
The fixes in `04a516c` finish this plan or undo an error of `ac9410d`: the worker rules leave
`SKILL.md` (one home: the worker brief); "the number of workers or reviewers" returns to the change
rule (the owner's "Drop the count" was only about checkpoints); the lost rules of
`coordination.md` get a home (each cell is listed in the PR). The findings that need a new rule
wait for the owner (R2, R4, F5, F11, F12, F17, R7, Windows).

**The owner's answers on review round 1** (2026-11-26). Each one is a new rule of revision 10:
- R2, "A": the test verifier tests the acceptance criteria of the current checkpoint, and all of
  them at the last checkpoint; the worker's plan names the criteria of each checkpoint.
- R4, "A" (after the question "what did you mean account limit?"): a subagent that replaces a Codex
  session also gets each message that the old session did not get.
- F5, "A": the 5-line rule of the lead agent's own work covers each project file, code or
  documents; the lead agent's records are not project files in this rule.
- F11, "A": a worker builds its next checkpoint only after the outside reviewers reported and
  checked the fixes; the report of the last checkpoint is the final report.
- F12, F17, R7: "Agree, no need new text for those items".
- N1, "A" (owner: "I (owner) should be awared of it before telling leader to spawn codex worker
  teams"): the plan gives the result of the account check of `references/codex.md` (the login, the
  limits from the newest Codex session file, the time of that data).
- N3, "Yes" (owner: "put in `guide.md` that if they run the skill on windows, please run it in git
  bash or wsl"): `GUIDE.md` lists what a person needs. Not tested on Windows or macOS.
- N4, "A": the start and resume commands write the process id to a pid file, and the stop command
  reads it. Tested on 2026-11-26: the file held the Codex process id, `kill -INT` stopped the run,
  and the session resumed.
- O2, "partly, leader can check via advisor if the small change is considerd minor, if it is not
  critial or major, leader can work with advisor for solution, but ensure to report back to user
  about what the issue and why you choose that solution", with the owner's severity table for code
  review (Critical: a refactor for a future requirement or a foreseeable problem; Major: design,
  logic, performance, security, scalability, function, error handling, public interface
  documentation, `TODO`, redundant code; Normal: reusability, coding standard, document format,
  comments). The lead agent asks the advisor to rate its own change; a minor change needs no plan,
  no OK and no outside reviewers, the advisor checks the diff, and the next report tells the owner
  the issue, the change and the reason. My reading; the owner can correct it.
- O1, O3 to O15: kept as they are (owner: "Yes", "keep", "agree", "accept", "No" for one more full
  round, "do as your recommendation").
- The merge bar (owner: "Agree"): blockers and the majors that a run or a real case shows are fixed;
  minors become follow-ups; an edge case in text older than revision 7 does not block. A minor
  finding: an agent that follows the skill still does the right thing (the text is unclear or
  repeated, or the guide differs), or a later step catches a cheap error.

**Test strategy for these rules:** the fact map and the copy check; the account command and the
pid file, run by hand (done); one fix check by the same pair on `ac9410d` to the new head; the
clear, backup and real runs on the final head. A run with two checkpoints shows R2 and F11. No run
shows R4 (a Codex account error in the middle of a task) or a minor change rated by the advisor:
not claimed.

**Fix check 1** (`ac9410d..9d57cdb`; the Opus subagent of round 1, and a new Astra `high` session
because the old one was at 40.6%). Opus: no major, 8 minor. Astra: 6 major, 4 minor. Both repeat
causes came back (a rule in two places; a new rule with a new gap), so the lead agent stopped and
asked the owner. Rated with the merge bar, one finding is major: in the backup, the verifier's brief
still asked for a verdict on each requirement. The owner (2026-11-27): "Decision 1: A" (fix the
major, the copies, the gaps of the new rules, the pid file and the status claim in one commit; the
other minors become follow-ups in `docs/status.md`) and "Decision 2: Keep" (the document line of
the advisor scale stays). The same pair checks that one commit.

**Fix check 2** (`9d57cdb..246e9ea`; the same pair). Each fix is fixed, except the stop command:
`kill` ran with no condition, and the process name cannot tell two Codex runs apart (Astra major,
Opus minor). The lead agent stopped and asked the owner. The owner (2026-11-27): "A". The stop
command sends the signal only if the process has the report file of its run (tested by hand: a
wrong report file sent no signal, the right one stopped the process, and after the end no signal);
the verifier's criteria go in one section of its backup brief; the Windows stop command and the
backup route of `review.md` become follow-ups. The review stops here: no reviewer checks this last
commit. The clear, backup and real runs on `4f0cb12` pass (2026-11-27): with no OK, no worker and
no reviewer starts, and the plan gives the account check; the backup runs the team checks and then
two Opus reviewers; real Codex runs both teams with the pid file, and the same pair checks the fixes.

## Revision 11 (2026-11-27): facts first, and two reviewers agree on the plan

Status: approved by the owner on 2026-11-27 ("2A, approve"), with the owner decisions below. Plan review: 4 rounds, both reviewers agree at `c41014c`. Built in a new PR from `main` after
the merge of #156 (owner, 1A; #156 merged on 2026-11-27, `b894bc6`).

The owner's order, 2026-11-27: "When receive the human word (goals, ideas, etc..), leader spawn
explorer to find related information (can be documentation or code), after Explorer report back
to leader, leader will make plans, advisor help to sharp these plans, 2 reviewers (opus 5.5 and
gpt6.2 astra review that plan). Leader and reviewers must agree on the criterias, what is the
definition of done of the plans. Owner will be final reviewer and approver. After the plans are
approval, leader spawn worker teams their team plan, the team will work to describe the plan in
their own words based on what they understand about the plan, leader correct worker words. All
that should happen beofre any code change." Then: "After we adjsuted workflow like that, take the
tests as your sugggestion". The owner's answers, "All A": 1A a new PR after #156; 2A the questions
come after the explorer; 3A after 2 rounds with no agreement, the owner decides each open point;
4A the plan review is only for a plan that starts a worker team; 5A the removal test with two tasks.

### The new stages

| # | Stage | Change |
| --- | --- | --- |
| 1 | Route the task | None |
| 2 | Read the project's agent instructions | None |
| 3 | **Explore:** the explorer reports the documents and the code of the task | Was part of the plan stage. Now first, for each new task. A continuation with `/leader <folder>` is not a new task |
| 4 | **Clarify:** ask the owner only what the explorer's facts and your reads do not answer | Was stage 3 |
| 5 | **Plan:** the plan, its tests, and for each task its acceptance criteria and its definition of done. Then ask the advisor to sharpen it | The advisor step and the definition of done are new |
| 6 | **Plan review:** for a plan that starts a worker team | New, see below |
| 7 | **Owner's OK:** the plan, with each reviewer's verdict and each open point | The owner sees the review result |
| 8 | **Build:** each worker team gives its plan in its own words; the lead agent corrects it; then it builds | Each team that starts now gives its plan before the first build message to any team |
| 9 to 11 | Check, review at each checkpoint, report | Were stages 6 to 8 |

### The new rules, each with its one home in `SKILL.md`

- **Stages of a task** (the stage list): the 11 stages. Other text names a stage by its name, not
  its number, so that a new stage changes no other line.
- **The lead agent's own work:** the explorer text moves to the Explore stage, as a link. The explorer runs
  for each new task, also for a change of the lead agent; then the advisor rates that change, and it
  keeps its path (minor, major or critical, 4A).
- **Owner's OK stage, the gate:** "Before the owner's OK, start no build and no worker. The only reviewers
  that start before the OK are the plan reviewers, and a review that the project's rules ask for
  before an approval." Only an OK that comes after the owner saw this revision of the plan, with
  each reviewer's verdict and each open point, approves it; an OK in the task, or an OK of an
  earlier revision, does not. The
  OK needs the owner's decision on each open point, so no worker starts while a point is open.
- **Plan stage:** if you have no advisor tool, check the plan yourself for gaps, risks and criteria
  that no test can check, and say so in the plan.
- **Plan review** (a new part of "Outside reviewers"):
  - Before you start the OpenAI plan reviewer, do the account check. If a limit is near or used,
    or the data is old or missing, ask the owner first. An account error moves to the [backup](#when-codex-cannot-run), as for
    each OpenAI reviewer: no new text there.
  - Start two new reviewers at the same time, with the models of the outside reviewers. Each one
    gets the plan, the owner's words and the facts that the plan uses, and reads the project files
    that it needs. A plan review is not split: a plan too large for one reviewer is too large,
    so make it shorter or split the work into smaller plans. The line "Split each review before
    it starts" of the 50% section becomes "Split each diff review before it starts".
  - The plan is agreed when the lead agent and both reviewers agree on the same revision of the
    plan: each criterion and each definition of done has AGREE, and each missing criterion or risk
    that a reviewer named is in the plan or answered. Round 2 runs only if a point is open: the
    lead agent changes the plan or gives a reason for each point, and sends the new revision to
    the same two. After round 2, the owner gets each open point with the view of each party (the
    gate says when the owner decides).
  - The checkpoint reviewers stay as they are.
- **Stop and tell the owner:** the line "a reviewer disagrees about a finding" gets "for a plan
  review, after 2 rounds".
- **Get the plan first:** check that the worker's checkpoints cover each criterion of the approved
  plan for its task (the worker brief tells the worker to map them and not to change them). Accept
  the plan of each team that starts now (also one team) before the first build message to any of
  them, and before the lead agent starts its own task in the same plan. A team that waits for another task gives its plan before its own build.
- **Your files:** the `handoff.md` row holds the plan review state: the plan revision, the round,
  the path of each report that arrived, the reviewer that has not reported, your answer to each
  point, and the next step. Write it when each report arrives. `goal.md` keeps the owner's words; for
  a task with a plan it points to the plan for the criteria, and for a task with no plan it keeps
  the completion criteria.
- **Claude Code subagents** (the restart line, the one home for what a replacement gets after a
  session ended): "the brief, the work (the diff and the commits, or the plan revision), its last
  report if it gave one, and each message or answer after that report (after the brief, if it gave
  no report)". So a plan reviewer that
  ended before it reported starts again from the saved brief and plan revision. The 50% step keeps
  its own list, because there the old session writes a handoff first.
- **Owner's OK** (owner decision 2, widened by fix check decisions 2 and 4): if the owner changes
  the plan at the OK, and the changed plan starts a worker team, it gets a plan review: the same two
  reviewers if a plan review ran, else two new ones, and the rounds count from 1; then the owner
  approves the changed plan. A word fix that keeps the meaning is not a change. For a word fix, and
  for a changed plan that starts no worker team, the owner sees the changed plan and approves it.
- **After the last round** (fix check decision 1): the lead agent changes the plan only to write in
  the owner's decisions, and gives each other change to the owner as an open point. The owner's pick
  of the text of the last reviewed revision, or of a plan reviewer's view, is not a change of the
  plan; an OK in the same message approves the plan with the decisions written in. Each other answer
  is a change, also a pick of a change that the lead agent gave after the last round.
- **Plan stage:** each revision of the plan is its own file in the lead agent's folder, such as
  `plan-r1.md`; if the project's rules keep plans in the repository, each revision is written
  there and named by its file and commit. The plan files are records of the lead agent (the list in
  "The lead agent's own work"), and a commit of one is not a build.
- **After the OK:** a change of the plan that the lead agent proposes (a new task, or its own change
  that grows into a worker task) is a change of the plan: ask the owner, as now.
- One term in all files: "the criteria of the approved plan".

### Owner points (additions beyond the owner's words, or choices)

1. **Who writes the text of revision 11.** The skill gives each change of 5 lines or more to a worker
   team, and this change is about 100 lines in 5 files. Recommended: a Codex worker team
   (`gpt-6.2-sol` `high`), with the brief of this plan; it gives its plan in its own words first.
   This follows the skill's own rule and tests the new order on this change. The other choice: the
   lead agent writes it, as before, with this plan review as its review.
2. **The owner changes the plan at the OK.** Recommended: the changed plan does not go back to the
   reviewers, because the owner is the final approver. The briefs carry the approved plan.
   If the owner adds a task, the lead agent writes its criteria, and the owner approves them
   before its build.
3. **"The team will work to describe the plan".** Recommended reading: the worker session gives the
   plan; its subagents start only after a build turn, as now. The other reading: the team
   subagents help in the plan turn.
4. **The six follow-ups of #156** (`docs/status.md`, "The next `leader` skill PR"). Recommended:
   take in FX8 (the guide sketches), because this PR changes the same sketches; the other five
   stay follow-ups, with the target "a later `leader` skill PR".
5. **An OK in the task text no longer approves a plan** (from the owner's words "final reviewer and
   approver"). Each task with a plan, also the short plan of the lead agent's own major change, then
   needs one more owner message: the OK after the owner sees the plan. Recommended: keep this rule;
   both reviewers agree. The other choice: an OK in the task approves a plan that both reviewers
   agree with, and only an open point waits for the owner.

### Owner decisions (2026-11-27)

The owner's words: "1. A. You will write it as Opus 5.5 is good at writing than Sol. Remember to
ping reviewers when you done", "3. A", "4. A", "5 A", then "2A, approve".

1. The lead agent (Opus 5.5) writes the text of revision 11, not a Codex worker team. When the text
   is done, the two outside reviewers review the diff.
2. A change at the OK that adds, removes or changes a task, a criterion or the definition of done
   goes back to the two reviewers (the rule "Owner's OK" above); other changes do not. This replaces
   the recommendation of owner point 2.
3. The worker session gives the plan in its own words; its subagents start only after a build turn.
4. FX8 (the guide sketches) is in this PR; the other five follow-ups stay for a later PR.
5. An OK in the task text does not approve a plan.

### Fix check 1 decisions (2026-11-27)

Fix check 1 of the diff review (`6db7add..ba3fb01`) found three new majors in the rules at the OK:
the lead agent's fix widened rule 2A with no owner OK (Opus N1); a pick between views could change
a criterion with no review (Astra FC1-1); the lead agent could change the plan after the last round
and only tell the owner (Astra FC1-2, Opus N6). Same cause as round 1 (R11-1, F1, F6) and as #156:
gaps in the rules at the OK. So the patches stopped, and the lead agent proposed one rule for each
change after the last verdicts.

The owner's words: "1A 2A Confirm".

1. The redesign "After the last round" above (option A). The other option was one more round after
   each owner decision.
2. Keep the widened rule "Owner's OK" above (option A): a plan with no plan review that gains a
   worker team at the OK gets two new plan reviewers.
3. Confirm: R11-3 and R11-7 (same cause as #156 fixes) get no redesign.

The redesign's plan: the text above, in the Owner's OK stage of `SKILL.md`; the sentence "If you
changed the plan after the last round, tell the owner" is removed. The minor points of fix check 1
are fixed in the same commit: the plan revision file moves to the Plan stage, for each plan (F2);
a project that keeps plans in the repository names each revision by its commit, so the reviewer
brief says "or its commit" (N2); the team plans before your own change of the same plan, also with
one team (R11-2, N3); the restart line starts after the brief when no report exists (FC1-3, N4);
NOT VERIFIED names the evidence that is missing (R11-4); the handoff keeps the explorer's facts
before the plan exists (F3); an OK with the decisions in the same message (N5).

Its test strategy: the copy check and the fact map against `b894bc6` again; then the same two
reviewers check the fixes, with these cases: a pick of a reviewer's CHANGE view (no review); a new
criterion that the owner writes (back to review); a weaker criterion that the lead agent wants after
round 2 (an open point, and the owner's pick of it goes back to review); an OK in the message with
the decisions. Test run 2 needs no change: the test project keeps no plans in the repository, so a
commit before the OK there is still a failure.

### Fix check 2 decision (2026-11-27)

Fix check 2 (`ba3fb01..721f133`), a review of the text: both reviewers found that cases (a) to (e)
each give one order. Astra FC2-1 (major): at the OK, the owner gives an existing task to a worker;
the plan now starts a worker team, but the rule named only a change of a task, a criterion or the
definition of done, so the text sent it to no review (a path in the text, not a run). Opus N-b: the rule called "a pick
between options of the plan" a change, against the pick rule. Same cause again: the rule named the
changes that need a review, and each list missed a case. The owner's words: "B".

4. Name the exceptions, not the triggers: each change at the OK of a plan that starts a worker team
   gets a plan review, except a word fix that keeps the meaning and the owner's pick of the reviewed
   text or of a reviewer's view. A changed plan that starts no worker team: the owner sees it and
   approves it. The other option (A) added "the worker of a task" to the list.

Fixed in the same commit: "gets a plan review again" (N-a); "your own task in the same plan" (N-c);
the plan file is a record of the lead agent (N-d); a plan in the repository is named by its file and
commit (FC2-2); the rule list agrees with `SKILL.md` (N-f); the status names F7 (FC2-3). N-e (a
plan with no worker team) is covered by decision 4. Test strategy: the copy check and the fact map
again, then the same two reviewers check the fixes, with the case of FC2-1 and the cases (a) to (e).

### Files

| File | Change |
| --- | --- |
| `SKILL.md` | The rules above |
| `references/reviewer-brief.md` | It has four users: the plan review, the outside diff review, and the team reviewer and the test verifier of the backup. No fixed line may be false for any of them: "You did not build this work", the builder's claims, the diff target, "Read the code", the fixed checks, the report format, the `<task>` line. The verdict of a plan review (AGREE or CHANGE) has its home here |
| `references/worker-brief.md` | The worker maps the criteria of the approved plan to its checkpoints; the verifier tests those criteria |
| `GUIDE.md` | The three sketches (who talks with whom, the stages, one task turn by turn) show the new order |
| `docs/workflows/planning.md` line 99 | The clause "This project rule comes before the rule of the `leader` skill that starts no reviewer before the OK" becomes "The plan review of the `leader` skill can be this review, when its brief asks for it" |
| `docs/status.md` | The Now line, and the follow-up rows (owner point 4) |

Review of the build: a new Opus and Astra pair reviews the diff, and the same pair checks the
fixes. Merge bar: the one of #156. If a fix check finds the same causes again or a new major, the
lead agent stops and asks the owner.

### Test strategy

The runs use a scripted owner: when a run ends and waits for the owner, the script resumes the
same conversation (`claude -p --resume`) with one fixed answer, at most 4 times: "I am away. For
each question, decide it yourself and write your choice in the report. OK for the plan that you
showed me. Go on as the skill says." The same answer in each state and in each run, so the script
does not need to know what the lead agent waits for. An OK that comes before the lead agent showed a
plan must not count (the gate of the Owner's OK stage). The script checks the order from the stream of the run
(each tool call in order), and the commits and the project files of the worktree (the lead agent's
own records are allowed before the OK).

1. Checks: the fact map against `b894bc6`, with an exception and a reason for each changed
   sentence; `copycheck.py` with the new phrases of revision 11, and a planted copy that makes it
   fail; the standalone check (the skill folder alone in an empty repository, and the links);
   prettier, check:index, check:status; CI.
2. Gate run, the new order (the hard task below, which has an open question; scripted owner). A `codex` wrapper first in PATH logs
   each call; it passes `login status`, `exec -s read-only` and `exec resume ... sandbox_mode="read-only"`
   to the real Codex, and before the OK it fails each other call. Pass: the explorer reports
   before the first question to the owner, and a question comes before the plan; the advisor is
   asked after the plan draft and before the plan reviewers; an Opus 5.5 subagent (the model id in
   the stream) and a read-only Astra session review the plan; the plan with the verdicts comes
   before the owner's OK; before the OK, no worker, no commit, no change to a project file, and no
   build or install command in the ordered trace (the script's list: a package-manager install or
   build, `make`, and a `codex exec` with no read-only sandbox; the trace includes the subagents'
   calls, which the stream marks with `parent_tool_use_id`). If the lead agent decides the 0-people case
   itself and asks no question, the run fails: that is a finding about the clarify stage.
3. Small task run: "fix one word in `README.md`". Pass: the explorer runs, the advisor rates the
   change, and no plan review and no Codex call happen.
4. Backup run (the stub passes `login status` and fails each `codex exec` with an account error).
   Pass: the error comes at the start of the Astra plan reviewer; two Opus subagents review the plan; then the team checks and two Opus reviewers at
   the checkpoint, as in revision 10.
5. Two-task run (real Codex), with "My OK for your plan is given now" in the task text. Pass: the
   plan review still runs, and the lead agent shows the plan with the verdicts and waits; one plan
   review covers both tasks; both teams' plans are accepted before the first build message; then as
   in revision 10. A correction of a worker's plan is checked only if one happens.
6. **The removal test (5A).** Question: which parts find problems that the other parts miss?
   - Tasks: the small task (`slugify`), and the hard task. The hard task: the base project gets
     `src/money.mjs` with `toCents(text)`, which has a planted rounding bug
     (`Math.floor(parseFloat(text) * 100)`: `"0.29"` gives 28, `"1.15"` gives 114). The task: add and
     export `splitBill(totalText, people)` in `src/money.mjs`, which uses `toCents` and returns an
     array of integer cents, as equal as possible, that add up exactly to the total, the first ones with the extra cents. The task does
     not say what happens for 0 people or a negative total.
   - Variants, each a patch to the copy of the skill: full; no plan review; no team subagents (no
     `<your_team>`, no team checks); no outside reviewers at checkpoints (also no wait for them).
     The lead agent reads each patched skill before its run.
   - Eight runs (2 tasks × 4 variants) on the final head, real Codex, scripted owner, one at a time.
   - Hidden tests, outside the test project, run after the end, with literal expected values for
     inputs that the planted bug does not touch: `splitBill("10.00", 3)` gives `[334, 333, 333]`,
     `splitBill("0.05", 2)` gives `[3, 2]`, `splitBill("7.00", 1)` gives `[700]`; and, information
     only (a fix of `toCents` is outside the task), the true cents for `"0.29"` and `"1.15"`.
   - The table: one row for each run, with these columns: the head and the variant; the stages
     that ran (from the stream); a worker team started (if no team starts, "no plan review" is
     the same as "full"); the end (built, stopped, failed); each hidden test; the `toCents` bug,
     named or fixed, and the first stage that found it; the 0-people and negative cases, raised or
     not, and the first stage; the scope (a change outside the task); the time; the Claude cost
     (`total_cost_usd`); the Codex use (the change of the account check's used percent, and the
     tokens of the sessions whose folder is the test project). Each variant has an event that shows
     that the run came to the place of the removed part: no plan review, the plan shown to the
     owner; no team subagents, the first build-turn report of a worker; no checkpoint reviewers, the
     first checkpoint report of a worker. A run that stops before that event is "inconclusive" for
     that variant.
   - Eight runs can show no difference, and one run for each cell is a sign, not proof. No rule
     changes from the table without the owner's decision. Time: about 30 minutes for each run.
   - The script, its wrapper, the hard task and the hidden tests are in `tmp/`, not in the PR.

Not claimed by a run: round 2 and the owner's decision after 2 rounds (3A), because no task can make
two reviewers disagree on purpose; the text checks cover it. Also not claimed by a run: the
owner's change at the OK that goes back to the reviewers (owner decision 2); a text check covers its
wording only.

### Acceptance criteria and definition of done

1. The PR starts from `main` after the merge of #156.
2. `SKILL.md` gives the 11 stages in order (the explorer for each new task), and each rule above is in its one home and nowhere
   else (the copy check, with the new phrases).
3. No sentence of the skill, its guide or the project documents still says that no reviewer starts
   before the OK, except the old revisions of this plan.
4. An OK that comes before the owner saw the plan does not approve it: the owner approves the plan
   after seeing it with the verdicts and each open point, and no worker starts while a point is
   open (run 5, and a text check for the open points).
5. The criteria of the approved plan have one home (`goal.md` keeps them only for a task with no plan); the worker brief, "Get the plan first" and the
   verifier text use them.
6. The reviewer brief template serves its four users with no false fixed line: the lead agent fills
   it for each of the four, and reads each result.
7. The three sketches of `GUIDE.md` show the new order.
8. A plan with no worker team, and the lead agent's own change, keep their path (4A).
9. The checks of test 1 pass, and CI passes.
10. Runs 2 to 5 pass by their checks.
11. The eight removal runs ran on the final head, and the owner has the table.
12. The owner decided the five owner points.

Done: criteria 1 to 12 are met on the final head; the diff review and its fix check ran by
the merge bar; the PR description and `docs/status.md` are current; the owner has the table of
criterion 11 and each open issue. The merge is the owner's.

### The plan review of this plan

Round 1 (`d48feca`): Opus 5.5 `high` (reviewer subagent), 3 major and 20 minor; GPT-6.2 Astra `high`
(read-only), 10 major and 1 minor. Both: not ready. Round 2 (`103a734`, after the answers): Opus
agrees, with 4 minor points; Astra does not agree: 6 points of round 1 still open (the explorer
rule, the model of the Opus reviewer, the time to save the review state, the home of the mapping
rule, the gate run, the scripted owner), and three new ones (an OK before the owner sees the plan; a
split plan review; the backup stub). The lead agent accepted each open point (`7afb720`). The owner
then allowed 2 more rounds (2026-11-27). Round 3 (`7afb720`): Opus agrees, with 5 minor points;
Astra does not agree: 4 major (the owner decides each open point; the old split line; the restart
line lost the commits; a build before the OK that changes no tracked file) and 2 minor (the
"inconclusive" event; this record). The lead agent accepted all of them, and Opus's points (the
module and export of `splitBill`; owner point 5) except one: the gate run still needs a question,
because a real open question that the lead agent decides alone is a finding (`c41014c`). Round 4
(`c41014c`): both agree. Their minor points, accepted after round 4 and read by no reviewer: no
worker starts while an open point is undecided (Opus P1), with the timing rule at the gate only
(Astra R4-1); the removal event for the team subagents is the first build-turn report (P2); the
script names the build and install commands, and the trace includes the subagents' calls (P3);
this status line (R3-6). A headless stream holds each subagent call with `parent_tool_use_id` and
its model id (`claude-opus-5-5` in the revision 10 backup run). Reports: `tmp/reviews/leader-r11/`.

### Test results (2026-11-27)

All runs used the skill files of `fc0b32e` (the later commits change only records). Records:
`tmp/leader-skill/measure/results-r11.md` and `runs/` (not in the PR). Price: the Claude cost that
each run reports (API price). Codex: the account check went from 2.0% to 6.0% of the week for the
batch; the tokens per run are in the records.

| Run | Task | Result | Time | Price (USD) |
| --- | --- | --- | --- | --- |
| 2 | Hard, full | Pass; bug found | 44 min | 44.13 |
| 3 | Small | Pass | 3 min | 6.21 |
| 4 | Backup | Pass | 33 min | 63.34 |
| 5 | Two tasks | 2 of 3 pass, 1 not tested | 34 min | 33.27 |
| R1 | Slug, full | Done; no checkpoint review ran | 25 min | 27.07 |
| R2 | Slug, no plan review | Done | 17 min | 13.32 |
| R3 | Slug, no team | Done | 26 min | 21.86 |
| R4 | Slug, no checkpoint reviewers | Done | 19 min | 26.99 |
| R5 | Hard, no plan review | Done; bug found | 36 min | 34.90 |
| R6 | Hard, no team | Done; bug found | 33 min | 16.26 |
| R7 | Hard, no checkpoint reviewers | Done; bug found | 23 min | 24.61 |

- Run 5: "both team plans before the first build message" was not tested. The test leader put both
  tasks on one branch, one after the other; the rule for a team that waits held.
  The owner accepts criterion 10 as partly met, with no rerun (owner, 2026-11-27: "A"). The test of
  plan revision 12 (waiting worker teams) will need two teams, and that run can test this rule.
- Removal test: in all four hard-task runs, the explorer and the test leader found the `toCents`
  bug and raised the 0-people case before the plan, before any part that a variant removes, and the
  hidden tests pass (3 of 3) in each. So this test could not tell the variants apart. The checkpoint
  reviewers found test gaps in run 2, R2, R3, R5 and R6, and no code defect in runs 4 and 5. R1 is
  not a full baseline: its test leader planned the outside review after the commit, and the run
  stopped at the commit question first. The prices vary more between like runs (R5 34.90, R6 16.26)
  than between variants. The false "no remote" in the task text (a test artifact) was named in
  every run. That the Codex team subagents ran comes from the test leader's reports only (the Claude
  stream does not show them). One run per cell: signs, not proof. No rule changes from the table
  without the owner's decision.
- The owner's global Git rule loads in the test runs and asks for the owner's own yes before each
  commit, so 5 runs (run 2, R1, R3, R4, R7) ended with the work built and not committed. In R3, the Codex worker refused a
  commit that the test leader approved for the scripted owner.
- Test strategy changes by the owner (2026-11-27): "No need to run that often when we have that
  plenty of room for usage" (the account check once before and once after the batch, and the tokens
  per run); "yeah, we can use 2 in its place and skip it" (run 2 is the removal cell hard x full, so
  7 removal runs, not 8).

### Risks

- More time and cost before each build: two reviewers and up to 2 rounds. The removal test
  measures it.
- The Astra plan reviewer uses Codex credits before the owner's OK; the account check comes first.
- The scripted owner is not a real owner: a run can take a turn that a real owner would stop.

## Open questions

None. The owner answered each question on 2026-11-24, 2026-11-26 and 2026-11-27.
