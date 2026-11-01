# Workflow: building with Claude Code and Codex

This document describes how the owner and two coding agents build the app together. The aim is
the simplest process that keeps quality high: one agent builds, a different agent reviews, the
owner approves the decisions that matter.

## 1. Roles

| Who | Does | Does not |
| --- | --- | --- |
| **Owner (human)** | Chooses the next slice; approves plans for checkpointed slices; reviews `Needs human review` items; merges; accepts or rejects proposed decisions | Write most of the code |
| **Builder agent** (Claude Code or Codex) | Plans the slice, implements, runs every check, writes the PR description with evidence, updates docs | Merge; change accepted decisions; widen scope |
| **Reviewer agent** (the *other* one) | Reviews the PR against the brief and the docs; checks evidence; tries to break it | Push to the builder's branch (it comments; the builder fixes) |

**Why two different agents.** Different models make different mistakes, so cross-review catches
more than self-review, and it is cheap. Alternate who builds (for example Claude Code builds
M1, Codex reviews; Codex builds M2, Claude Code reviews) so both learn the codebase and you
can compare them.

**Why not more agents.** Parallel builders on one small codebase mostly create merge conflicts
and inconsistent patterns. Use parallelism only for clearly independent work (§5).

## 2. Lifecycle of a slice

```
brief ready ──▶ plan ──(owner approves, if checkpointed)──▶ build ──▶ self-check ──▶ PR
   ▲                                                                                 │
   │                                         merge ◀── owner review ◀── cross-review ◀┘
   └──────────── next slice ◀────────────────┘
```

1. **Brief.** `docs/tasks/<slice>.md` exists and its open questions are answered.
   **Spec gap pass.** Before the slice starts, an agent reads the brief and the specs it lists
   and asks one question: what does this slice need that the specs do not say? Typical gaps:
   page URLs, two rules that conflict, what the app remembers after a reload, keyboard
   shortcuts inside text boxes, first-run and empty states. The owner answers them in one
   round, and the answers go into the owning documents in a docs-only PR. Decisions made here
   are cheap; the same decisions made during the build stop it.
   **Slice size.** Keep UI work and infrastructure in separate slices or PRs. Static serving,
   docs pages, code generation, CI jobs and launch scripts are one PR; the screens that use
   them are another. Smaller PRs mean shorter builds, smaller reviews and fewer full gate runs
   (§8, "Slice too big").
2. **Plan.** The builder reads the brief and the documents it lists, then writes a short plan
   (files to touch, migrations, tests to add, risks) as the first comment of a draft PR.
   **Risk probes first.** Before the builder writes the plan, it runs short checks on every
   part that it has not used in this repository yet, and puts the results in the plan as
   evidence. For example: does the library work under our CSP (no `new Function`, no inline
   style; `security.md` §2.1)? Does the generated client type-check with the new endpoints?
   Does the component library give the roles and close behaviour that the spec and the tests
   expect? A probe is a few minutes in a scratch file, not a build. Check the known pitfalls
   in `frontend-conventions.md` §5 first.
   **One round of questions.** The plan ends with an "Open questions" list that holds every
   question for the owner, so the owner answers them all at once. A question found later in
   the build is a sign that a probe or the spec gap pass missed something; note it in the PR.
   For slices marked *checkpoint* in `development-plan.md`, the owner approves the plan before
   building. This is the cheapest place to catch a wrong direction.
   **UI design checkpoint.** If the slice adds or changes a screen, the plan has a "UI design"
   section: proposed layout, components and states, based on (not copied from) the sketches in
   `docs/design/`. The owner discusses and approves it before any UI code, in every slice,
   checkpointed or not. The approved design then replaces the sketch (`docs/design/README.md`).
   **Design skills.** The builder may use the vendored `ui-ux-pro-max` skill
   (`.agents/skills/`, linked into `.claude/skills/`) to generate options and check
   accessibility for that section. Its output is input to the proposal, never a decision:
   `docs/design/themes.md`, the D-decisions and the approved plan win where they disagree, and
   recommendations that conflict with them (another component library, other fonts or
   palettes) are listed as alternatives for the owner, not applied. Results are written into the
   plan or `docs/design/`, never with `--persist`.
   The builder may also use the `impeccable` skill. It reads `PRODUCT.md`, `DESIGN.md` and
   `.impeccable/design.json` at the repository root: a short snapshot of the product brief and
   of the Command dark theme, so the skill keeps the agreed look. The snapshot is not a spec;
   `docs/` wins where they differ, and whoever changes the owning document updates the
   snapshot. `pnpm check:index` fails when a snapshot colour differs from
   `frontend/src/themes/command.css` (owner, 2026-10-30).
3. **Build.** Small commits. Tests alongside code, not at the end. While fixing, run only the
   affected tests (`testing.md` §3, "Fast loop while building"); keep the end-to-end servers
   running with `pnpm e2e:serve`. A bug fix's test is written first and seen to fail; if it was
   written after the fix, run it against the old code in an isolated checkout (a `git
   worktree` of the commit before the fix, with the new test copied in), not by stashing the
   fix (owner, 2026-10-31). Stop every other end-to-end server first: Playwright reuses a
   server that runs on its port, which would test the other checkout (`testing.md` §3). See
   it fail there (lesson `prove-the-test-fails-first.md`).
4. **Self-check.** Every command in `AGENTS.md` §4 passes, run once in full at the end:
   after the last code change, before the push, and with the full `pnpm e2e`. A report names
   each check and its result and says which checks did not run; nobody reports a run that has
   not finished (lesson `full-gate-before-the-report.md`).
   **Spec walk.** Before the PR, the builder reads each section of the slice's spec against the
   code, not only the acceptance criteria, and tests the edge cases in `testing.md` §3 ("Edge
   cases each slice tests"). The PR lists the sections checked (lesson
   `self-review-against-the-spec.md`). The builder fills the PR template (§6). Anything new that the build taught (a library pitfall,
   a lint pattern, a test helper) goes into `frontend-conventions.md` §5 or `testing.md` in
   the same PR, so the next slice does not learn it again.
   **The guide stays current.** A slice that changes something the owner can see updates
   `seed/skills/using-the-app/SKILL.md` (the Guide bot's knowledge) in the same PR: what works
   now, what is not built yet, and the names on the screen (M2 plan, decision 14).
5. **Cross-review.** The other agent follows [review-guide.md](review-guide.md) (prompt in §4).
   Findings become PR comments; the builder fixes or answers each. A finding says what is wrong, not which text or layout to
   use: when a fix needs a new text, state, flow or layout, the PR lists it under `Needs human
   review` (`AGENTS.md` §7; lesson `flag-ui-choices-in-review-fixes.md`).
6. **Owner review.** Focus on `Needs human review` items, migrations, the evidence table, and
   one run of the app. Merge when satisfied.
7. **Docs.** If something diverged from the docs, the PR already updated them. If a decision
   changed, `decisions/` has a new file the owner accepts or rejects.

### Human review: visual first

The documents in `docs/` are written for agents. They are long and exact. The owner must not
have to read them to understand or approve a proposal. So an agent shows each proposal to the
owner in a short, visual form first. This applies to plans, design rounds, decisions and
review items, in the project threads and in local sessions.

1. **Sketch first.** For a new flow, screen, data model, architecture change or other
   structural decision, show a short text sketch, table or outline before a detailed artifact.
2. **Explain the decision.** With the sketch, say what changes, why, the trade-offs, and which
   choices need the owner's approval.
3. **Draw when it helps.** Make a rendered diagram or mockup when the owner asks for it or
   approves the sketch. If the owner asks for a finished visual at once, skip the sketch.
4. **Keep the source.** A diagram has a text source that an agent can edit: Mermaid in the
   Markdown for flows, states, sequences and data models. A screen has its spec in
   `design/components/` and its preview in `design/previews/` (`design/README.md`).
5. **Update the docs together.** After the owner approves, one docs-only PR updates the
   owning specs, decisions, acceptance criteria and visuals together.
6. **Each approval is separate.** Approval of a sketch lets the agent draw. It does not let the
   agent build. The checkpoints are, in order:

   ```
   text sketch ──▶ rendered visual ──▶ approved spec (docs PR) ──▶ implementation plan ──▶ code
          approve to draw     approve the design      approve the plan (§2 step 2)
   ```

   A migration and a decision change are their own checkpoints (§7).
7. **Keep it small.** A small change gets a short explanation or a table. Do not draw a
   diagram that adds no information.

A diagram or mockup from an agent is a proposal, not a decision, until the owner accepts it.
This does not change the rule that `docs/design/` wins over design-skill output.

Which form to use:

| Subject | First sketch | After approval, if useful |
| --- | --- | --- |
| Page layout | Text wireframe | Preview in `design/previews/`, spec in `design/components/` |
| Bot or run states | List of states and transitions | Mermaid state diagram |
| Bots and the owner in a conversation | Numbered steps | Mermaid sequence diagram |
| Tables and relations | List of entities and links | Mermaid ER diagram |
| API and provider calls | Arrows between parts | Mermaid flowchart |
| Repository structure | Folder tree | Module map, only if the tree is not clear |
| A user journey | Numbered steps | Mermaid flowchart |
| Alternatives | Comparison table | Side-by-side mockups, for screens only |
| A small rule change | Before and after table | Nothing more |

## 3. Starting a session (builder prompt)

Start a **fresh session per slice** so context is not polluted by earlier work. Paste:

```
You are the builder for slice <M#> of this repository.
1. Read AGENTS.md, docs/README.md, and docs/tasks/<M#>-<name>.md, then every document the
   brief lists under "Read first".
2. Write a plan as described in docs/workflow.md §2 step 2: run the risk probes first, and
   end the plan with every open question in one list. Open a draft PR with the plan.
   Stop and wait for my approval if the brief says "checkpoint: plan".
3. Build the slice on branch <m#-name>. Keep to the brief's scope; list anything else you
   notice under "Follow-ups" in the PR instead of doing it.
4. Run every check in AGENTS.md §4 and fill the PR description per docs/workflow.md §6.
If the docs and the code disagree, or the brief is ambiguous, stop and ask.
```

## 4. Review prompt (reviewer agent)

For every local code review, PR review or review of fixes, follow [review-guide.md](review-guide.md).
Keep its evidence table with the review record. Use this prompt for a slice PR:

```
You are reviewing PR <url> for slice <M#>. You did not write it.
Read AGENTS.md, docs/review-guide.md, docs/tasks/<M#>-<name>.md, and the documents it lists.
Read the approved plan revision. Follow the guide's evidence table and completion checks.
Check, in order:
1. Every acceptance criterion: is it implemented, and does the cited test really prove it?
   Run the tests yourself.
2. Architecture rules in AGENTS.md §5 (domain purity, events in the same transaction,
   generated client only, immutability rules, sandbox use, Markdown rendering).
3. Security: anything touching docs/security.md controls.
4. Invariants in docs/domain-model.md §12 that this slice touches.
5. Docs: does the PR update the owning document for every behaviour change? For a changed
   rule, does it still agree in meaning with each decision in its "Changed by" column
   (`decisions/README.md`) and with every summary table that cites it?
6. Simplicity: code that could be removed or made plainer.
Report findings as PR comments, most severe first, each with the file, line, and why it
matters. Do not push commits. Say explicitly if you found nothing serious.
```

## 5. Parallel work (only when independent)

Allowed in parallel, in separate git worktrees and branches:

- Frontend and backend of the same slice **after** the API shape for that slice is merged or
  agreed in the plan (the generated client is the contract).
- Documentation-only changes.

Not in parallel: two slices that touch the same tables or migrations (drizzle-kit migrations
would conflict), or anything in the same `*.rules.ts` file at the same time.

## 6. PR description template

```markdown
## What
One paragraph.

## Why
Link to the brief and decisions.

## Acceptance criteria
| AC | Evidence |
| --- | --- |
| UI-2.4 | `e2e/header-drag.spec.ts` "drop adds bot" + screenshot |
| conversation-rules §1 table | `decide-runs.rules.test.ts` "human message: …" rows |

## Needs human review
- Migration `0003_skill_versions` (new tables, no data change)
- (or "none")

## Docs updated
- docs/domain-model.md §3 (added changelog column)

## Folder indexes
- README.md tables updated for every added, removed, renamed or repurposed file, and the
  descriptions still match what the files do (or "no file changes")

## Follow-ups (not done here)
- ...
```

## 7. Human checkpoints (summary)

The owner approves, in every slice:

- the plan, for slices marked *checkpoint: plan*;
- the UI design, for any slice that adds or changes a screen;
- every database migration;
- security-sensitive code (`security.md` areas);
- new dependencies;
- new or changed decisions;
- the merge.

The agents may, without asking: implement inside the brief, write and run tests, refactor
inside a module, update docs to match code, and fix review findings.

## 8. When things go wrong

| Situation | What to do |
| --- | --- |
| Agent wants to change a decision | It adds a `proposed` file in `decisions/` and stops for the owner |
| Brief is ambiguous | Builder asks; owner answers in the brief (so the answer is kept) |
| CI red on main | Fix main first; no slice merges onto a red main |
| Agents disagree in review | Owner decides; if it is a design question, record it in `decisions/` |
| Owner sees a problem in how a slice was built (slow, too many questions, surprises) | Change the owning rule and add a lesson to `lessons-learned/`, in one PR |
| Slice too big | Split the brief into parts (M3a, M3b), each mergeable; UI and infrastructure go in different parts (§2 step 1) |
| Docs drift found later | Fix the doc or code in a small PR; note it in the next slice's plan |
