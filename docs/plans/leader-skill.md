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

## Open questions

None. The owner answered each question on 2026-11-24.
