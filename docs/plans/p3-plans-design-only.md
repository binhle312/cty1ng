# Plans hold the design and the owner's decisions; build facts go only in the PR description

Brief: the owner's answer of 2026-11-18 (q2 Q1, choice "A"): "Redesign: plans hold the design
and the owner's decisions only; build facts go only in the PR description. A small docs PR
changes docs/workflows/planning.md and pull-request.md (and removes the 'What the build changed'
step)."
Checkpoint: none beyond the owner's design answer q2 Q1 A (workflow docs only; no code, no screen)
Approval: chief agent, 2026-11-18, against the owner's answer q2 Q1 A; owner review pending
Revision 2, 2026-11-18: the round 1 findings (`implementation.md`, the review guide, a correction in rule 6, the plans of open PRs); approval: waiting (chief agent)

## The cause

A plan had a second copy of facts that the build makes: red runs, test counts, test names as
built, file paths as built. The builder wrote that copy by hand, and each later commit could make
it false. Reviews found such false sentences again and again: DQ-327, DQ-330 and DQ-334 (#114),
DQ-435 (#117), DQ-496 (#123), DQ-528, DQ-533 and DQ-540 (#125), DQ-541 and DQ-542 (#114), DQ-682,
DQ-686 and DQ-688 (#131). Example (DQ-541): plan row T14
said that the red run was "6 tests"; a later commit merged three tests, so the same red run failed
4 tests.

The PR description already holds the red runs (`docs/testing.md` §5, "the PR records the red run
of each new test") and the other proof (`pull-request.md`, "One home for each fact"). So the plan
copy is a second home for the same facts.

## Where the practice is written now (read on `origin/main` = `384d8f8`)

- No repository document has a step named "What the build changed". The sections with that name
  or a similar name ("Build notes", "Build changes", "Test strategy as built", "Build record") came
  from review fixes. For example, the fix of DQ-327 added plan §7 "What the build changed", and
  the fix of DQ-496 made plan part 10 "match the build".
- `docs/plans/README.md` rule 6: "If the owner approves a change after that, add a dated section to
  the file." The rule does not say what a dated section may hold, and the build sections used it.
- `docs/workflows/implementation.md`, "Build": "Add cases found during the build to the strategy"
  (the strategy is a section of the plan).
- No rule says where a difference between the plan and the build goes.

## The change

Remove first, then add only what the rule needs.

1. `docs/plans/README.md` (the one home of the rule):
   - Replace rule 6 with: after the approval, a change of the design or a new owner decision
     needs its approval. A correction that changes no design and no decision (a typo, a link, a
     claim made smaller) needs none. The builder changes the design text in place (git history keeps the
     old text, rule 4) and adds one dated revision line under `Approval:` that names who
     approved it. A plan holds no build facts: the red runs, the test names and counts as built,
     the proof logs and the commands, and each difference between the plan and the build go only
     in the PR description. A difference that changes the design or an owner decision needs that
     approval and a revision line. The last sentence of rule 6 stays (a new plan in the same slice
     gets its own file).
   - Add one sentence after the rules: plans written before this rule, also the plans of PRs
     that were open then, can have a section of build facts ("What the build changed", "Build notes" and similar). Such a section is history and is
     not kept up to date.
2. `docs/workflows/planning.md`, section "Plan": one sentence that points to rule 6 (the plan holds
   the design and the owner's decisions; build facts go in the PR description). No copy of the rule.
3. `docs/workflows/pull-request.md`:
   - The template gets one short section `## Differences from the plan` (each difference between
     the approved plan and the build, with the reason, or "none").
   - "One home for each fact" gets one bullet: the plan does not repeat build facts; the PR
     description holds or pastes them, as the bullets above say (link to rule 6).
4. `.github/pull_request_template.md`: the same `## Differences from the plan` section, so the two
   templates stay the same.
5. `docs/workflows/implementation.md`, "Build": a case found during the build gets its test
   first; the PR description names it under `Differences from the plan`; a case that changes the
   design is a change of the plan (rule 6).
6. `docs/review-guide.md` §4: one sentence after "gets approval for a documented change": an
   approved design change is a revision of the plan (rule 6); another difference goes under
   `Differences from the plan`.
7. `docs/plans/README.md` table: the row of this plan (rule 8). `docs/status.md`: this PR's line
   (the row of the owner's answer Q1 A names the PR) and the Done rows that `pnpm check:status`
   asks for.

No change to `AGENTS.md`: no sentence there says where build facts go.

The new wording keeps the PR description as the home of the build facts only. It says nothing
about the ledger rows in the description, so the owner's open question q4 Q3 (link to ledger
rows, not copy them) can change that part of `pull-request.md` later with no conflict of rules.

## Records (in the records turn, step E)

- Ledger rows of this PR's review findings, from DQ-701.
- DQ-541 and DQ-542: the cell "Fix and verification" says "The cause (build facts in two places)
  gets the redesign PR of Q1 A". Add that this PR removes the cause (rule 6).
- The PR register row and the round-log rows (§7 steps 1 and 2).
- One prevention action in `docs/delivery-quality.md` §7 for the cause (DQ-327, DQ-330, DQ-334,
  DQ-435, DQ-496, DQ-528, DQ-533, DQ-540, DQ-541, DQ-542, DQ-682, DQ-686, DQ-688; DQ-540 and
  DQ-688 are open, and the action links them to rule 6), as §7 step 7 asks for a recurring cause, in one line
  that names the branch of each row (chief agent, 2026-11-18: yes). Verification: count the
  plan-text findings of this kind in the next three PRs with a plan.

## Test strategy

Docs only, so no test and no break list. Gates: `pnpm lint` (Prettier), `pnpm check:index`,
`pnpm check:events`, `pnpm check:status`.

## Not claimed

- No script checks the rule. A plan with build facts after this PR is found by a reviewer only.
  A pattern check (for example, on a heading "as built") would guess from the shape of text.
- The old merged plans keep their build sections; this PR changes none of them.
- The plans of PRs open before this PR (#107, #128, #129, #132) keep what they have: the
  sentence after the rules covers them.
- That this stops all stale plan sentences: a design text can still go stale if the builder
  changes the design with no revision. The rule makes that a finding against the approval, not a
  fact to copy.

## Open questions

None for the owner. The chief agent accepted the prevention action (Records), 2026-11-18.
