# Plan a slice

Read this workflow before a new slice or a change that needs a plan. Before a protected action, check [AGENTS.md §7](../../AGENTS.md#7-what-needs-the-humans-approval-stop-and-ask-or-flag-it-clearly-in-the-pr).

## Brief

`docs/tasks/<slice>.md` exists and its open questions are answered.

### Spec gap pass

Before the slice starts, an agent reads the brief and the specs it lists
and asks one question: what does this slice need that the specs do not say? Typical gaps:
page URLs, two rules that conflict, what the app remembers after a reload, keyboard
shortcuts inside text boxes, first-run and empty states. The owner answers them in one
round, and the answers go into the owning documents in a docs-only PR. Decisions made here
are cheap; the same decisions made during the build stop it.

### Slice size

Keep UI work and infrastructure in separate slices or PRs. Static serving,
docs pages, code generation, CI jobs and launch scripts are one PR; the screens that use
them are another. Smaller PRs mean shorter builds, smaller reviews and fewer full gate runs
([coordination](coordination.md#when-things-go-wrong), "Slice too big"). A screen with saves under a lock, live events or requests that can
answer after the owner moved on is its own part, and so is a set of dialogs or cards with
their own requests. A plan that touches more than about 30 files is a sign to split (lesson
`state-table-before-stateful-code.md`).

## Plan

Every slice has a plan before its code, checkpointed or not (owner, 2026-11-04).
The builder reads the brief and the documents it lists, then writes a short plan (files to
touch, migrations, tests to add, risks) in `docs/plans/<slice>-<name>.md`. The file goes in a
draft PR, so the owner reviews it there and the repository keeps it for reference. The rules
for the file are in [plans/README.md](../plans/README.md).
For M3 and later parts, the EGM design step comes before the plan ([egm.md](egm.md)).

### Risk probes first

Before the builder writes the plan, it runs short checks on every
part that it has not used in this repository yet, and puts the results in the plan as
evidence. For example: does the library work under our CSP (no `new Function`, no inline
style; `docs/security.md` §2.1)? Does the generated client type-check with the new endpoints?
Does the component library give the roles and close behaviour that the spec and the tests
expect? A probe is a few minutes in a scratch file, not a build. Check the known pitfalls
in `docs/frontend-conventions.md` §5 first.

### One round of questions

The plan ends with an "Open questions" list that holds every
question for the owner, so the owner answers them all at once. A question found later in
the build is a sign that a probe or the spec gap pass missed something; note it in the PR.
For slices marked *checkpoint* in `docs/development-plan.md`, the owner approves the plan before
building. This is the cheapest place to catch a wrong direction.

### UI design checkpoint

If the slice adds or changes a screen, the plan has a "UI design"
section: proposed layout, components and states, based on (not copied from) the sketches in
`docs/design/`. The owner discusses and approves it before any UI code, in every slice,
checkpointed or not. The approved design then replaces the sketch (`docs/design/README.md`).

### Design skills

The builder may use the vendored `ui-ux-pro-max` skill
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

### Test strategy before code

After the plan, and before any code, the builder writes the
test strategy as a section of the plan file (owner, 2026-11-03). For each acceptance
criterion it lists the behaviour, the test level (unit, component, API, contract, end to
end) and the cases beyond the normal path: the edge cases in `docs/testing.md` §3, and above all
the order and timing cases (an answer that comes late, a change in another tab, a Discard
while a request waits, a value that changes and changes back). Most review findings are
these cases; a test planned before the code finds them before the review does.

### Code design checkpoint

If the slice adds shared state, a new module boundary, a flow
across several screens or a new requirement that changes an existing design, the plan has a
one-page code design before any code (owner, 2026-11-04; `principle-design-first`). The design
names the state owner, the modules, the data flow and the failure paths, and it compares at
least two options with their costs. For a new requirement in an existing design, one option
builds as if the requirement always existed. A reviewer who did not write it tries to break
it. The owner approves it in every such slice, checkpointed or not, from a short form (see
[human review](human-review.md)). The state table below is part of this design. A slice that
stays inside one module skips this step, unless a new requirement changes its design.

### State table for stateful screens

If a screen saves under a lock, takes live events or
gets late answers, apply the [state and order principle](../../.agents/skills/principle-state-and-order/SKILL.md)
before code. Use the [failure scope](merge-bar.md#failure-scope). Resolve unspecified cells with the owner.
After approval, put the table in the screen's spec. Follow `docs/frontend-conventions.md` §1 for
its state owner and `docs/testing.md` §3 for cell and sequence tests.
Write the plan, table and test strategy at `xhigh` effort; the build can run at `high`
(owner, 2026-11-03; lesson `state-table-before-stateful-code.md`).

For parallel work or role assignment, read [coordination](coordination.md).

## Builder prompt

Start a **fresh session per slice** so context is not polluted by earlier work. Paste:

```
You are the builder for slice <M#> of this repository.
1. Read AGENTS.md, docs/README.md, and docs/tasks/<M#>-<name>.md, then every document the
   brief lists under "Read first", using its section references.
2. Write a plan as described in docs/workflows/planning.md: run the risk probes first, and
   end the plan with every open question in one list. Then write the test strategy
   (planning.md, "Test strategy before code"). Commit both to docs/plans/<slice>-<name>.md, and
   open a draft PR with that file.
   Stop and wait for my approval if the brief says "checkpoint: plan".
   If a screen has saves under a lock, live events or late answers, the plan has its state
   table (planning.md, "State table for stateful screens").
3. Follow docs/workflows/implementation.md. Build the slice on branch <m#-name>, test first. Keep to the brief's scope; list anything else you
   notice under "Follow-ups" in the PR instead of doing it.
4. Run every check in AGENTS.md §4 and fill the PR description per docs/workflows/pull-request.md.
If the docs and the code disagree, or the brief is ambiguous, stop and ask.
```
