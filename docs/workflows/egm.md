# Use EGM for a part

Read this workflow when you start an M3 or later part, or when the owner mentions EGM.

EGM (the Elephant-Goldfish Model plugin) is on trial (owner, 2026-11-09). The owner wants to know
if it makes delivery faster or better. EGM adds one design step before the plan. It does not
change the specs, the plan, the approvals or the review.

## Rules

- `docs/` stays the source of truth. An EGM brief or design document is input to the plan, not a
  spec. If it disagrees with a spec, stop and report it ([AGENTS.md §2](../../AGENTS.md#2-source-of-truth)).
- EGM does not replace an approval. Schema, UI, security, dependency and code design approvals
  stay in the plan ([planning.md](planning.md), [AGENTS.md §7](../../AGENTS.md#7-what-needs-the-humans-approval-stop-and-ask-or-flag-it-clearly-in-the-pr)).
- Keep all EGM files of a part in `docs/egm/<part>/`, for example `docs/egm/m3a/`. Do not use
  `docs/design/`: it holds the agreed UI designs.
- Do not run `egm-bootstrap` on this repository. Its README format conflicts with the folder
  indexes ([architecture.md §4.2](../architecture.md#42-folder-indexes-for-agents)) and `pnpm check:index`.
- Do not convert the existing documents to an EGM format.
- The owner starts each EGM skill with `/egm:<skill>`. In Claude Code the `Skill` tool refuses
  EGM skills. An agent that must run one reads its `SKILL.md` and follows it.

## Steps for each part

Start when the part brief `docs/tasks/<part>.md` exists and its
[spec gap pass](planning.md#spec-gap-pass) is done.

1. **Brainstorm.** The owner runs:

   ```text
   /egm:egm-brainstorm EGM artifact directory: docs/egm/<part>. Concept: docs/tasks/<part>.md
   ```

   The result is `docs/egm/<part>/concepts_brief.md`. At the last question, choose
   "Proceed to egm-draft".

2. **Draft.** The owner runs:

   ```text
   /egm:egm-draft EGM artifact directory: docs/egm/<part>. Context file: docs/egm/<part>/concepts_brief.md
   ```

   When it asks where to save the design, choose `docs/egm/<part>/`. The result is
   `docs/egm/<part>/<feature>.md`. Then delete `design_draft.md`.

3. **Review (optional).** The owner runs `/egm:egm-review docs/egm/<part>/<feature>.md`.
   Keep its report in the same folder.

4. **Plan.** Write the part plan as [planning.md](planning.md#plan) says. In its code design
   section, link the EGM design document. Write only what the design does not cover and the
   decisions that the owner must approve.

5. **Build, review and merge** as usual. In the PR description, add the line
   `EGM: docs/egm/<part>/`.

6. **Record.** Fill the row of the part in the [trial record](#trial-record).

## What to suggest next

An agent that works on an M3 or later part checks this table and tells the owner the next step.

| What you see | Suggest |
| --- | --- |
| No part brief in `docs/tasks/` | Write the brief and do the spec gap pass first. EGM waits |
| A brief, but no `docs/egm/<part>/` folder | Step 1, brainstorm |
| `concepts_brief.md`, but no design document | Step 2, draft |
| `design_draft.md` still in the folder | Finish step 2: run `/egm:egm-draft` again |
| A design document, but no plan in `docs/plans/` | Step 4, plan (step 3 first if the owner wants a review) |
| The part PR merged, but its trial row is empty | Step 6, record |
| Three parts in the trial record have merged | Ask the owner to keep, change or stop EGM |

## Trial record

For each part, compare these values with the M2 parts (M2a, M2b, M2c):

- Days from the start of step 1 to the merge.
- Review rounds and unique issues, from [delivery-quality.md §3](../delivery-quality.md#3-pr-register).
- Problems that the EGM design found before the plan.
- The owner's time, as the owner estimates it.

The M2 counts have gaps: some rows are `partial` or `unknown` (delivery-quality.md §3). Fewer
issues can also mean less review ([delivery-quality.md §7](../delivery-quality.md#7-update-and-assess)).

| Part | Step 1 start | Merge date | PR | Owner note |
| --- | --- | --- | --- | --- |
| M3a | | | | |
| M3b | | | | |
| M3c | | | | |

After M3a, M3b and M3c merge, the owner decides if EGM stays, changes or stops.
