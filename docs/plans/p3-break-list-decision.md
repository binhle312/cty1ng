# CI checks the break-list decision of each PR

Brief: the owner's answer of 2026-11-18 (q5 Q1 A) to the repeated cause that round 1 of #136 found
(DQ-782; `AGENTS.md` §9: the redesign is built in the PR that found the issue, with its own plan,
test strategy and review rounds). The PR: #136, after the plan
[p3-breaks-static-test-time.md](p3-breaks-static-test-time.md).
Checkpoint: none (a CI script and its doc rule; no UI, no migration, no public API, no new module)
Approval: Owner, 2026-11-18, q5 Q1 A (the design); plan review: chief agent; owner review pending

## The problem (DQ-782)

The rule (`docs/testing.md` §5, the owner's words of 2026-11-09): a late test, a security test, or
an order or race test needs breaks; any other test records its red run. Each PR decides this in
its description, and nothing checks the decision: the job `check:breaks static` passes a PR with
no list. The decision was wrong three times: DQ-348 (#110), DQ-289 (#111), and round 1 of #136
(DQ-782). `AGENTS.md` §9 asked the owner for a redesign.

## The owner's decision (2026-11-18, q5 Q1 A, the option text)

"CI checks the decision: a PR that adds or changes a test has scripts/breaks/pr-<n>.json; each
changed test is a claim with breaks, or an exemption with a reason, for example {"file":
"backend/test/api/bots.test.ts", "name": "names one unknown key in field and message", "reason":
"test first: red run in the PR"}. Built in #136 (plan revision, tests, docs/testing.md §5)."

## The design

1. **The list.** The same file `scripts/breaks/pr-<n>.json` and the same schema. `claims` do not
   change. `exempt` holds entries `{ "file", "name", "reason" }`: `name` is the test name as
   written (with `%s` for `it.each`), as today. A PR whose tests all have a red run writes only
   exemptions:

   ```json
   {
     "claims": [],
     "exempt": [
       {
         "file": "backend/test/api/bots.test.ts",
         "name": "names one unknown key in field and message",
         "reason": "test first: red run in the PR"
       }
     ]
   }
   ```

2. **What CI checks** (`pnpm check:breaks:static`, the job `check:breaks static`):
   - A PR that adds or changes no test passes with no list, as today. The job says that the
     list is missing and that the PR changes no test.
   - A PR that adds or changes a test and has no list fails. The job reads the missing list as
     an empty list and applies the coverage rule of step 3 of §5 (the same code as the runner,
     `prProblems`). So it names each test with the same line as today,
     `<file>:<line>: the test "<name>" has no claim`, after one line that says that the list is
     missing and that each such test needs a claim or an exemption (`docs/testing.md` §5).
   - A PR with a list: no change. Each changed test needs a claim or an exemption, an exemption
     that names no changed test fails, and the links and the compile check run.
   - An exemption needs a reason with at least one character that is not a space: in the schema
     of `scripts/lib/breaks.ts`, `reason` changes from `min(1)` to a pattern `\S` with the
     message "an exemption needs a reason". An empty or blank reason makes the list "not a valid
     break list", with that message. The runner (`pnpm check:breaks`) uses the same schema.
3. **What CI cannot check:** that a reason is true. An exemption is the author's decision, and
   the reviewer reads each exemption line. A test of the three cases (late, security, order or
   race) needs a claim with breaks; its exemption is wrong, whatever its reason.
4. **"Changed test"** is found by the code that the job runs already (step 3 of §5): each test call
   (`it`, `test`, with the modifiers of `testCalls`, `it.each(rows)(...)`) of a `*.test.*` or
   `*.spec.*` file with a line that the PR adds or changes since its base (`git diff --unified=0`
   from the merge base of HEAD and `--base`; in CI the merge commit of the PR and `HEAD^1`), and
   each test of a new file that git does not track (only on a laptop). No new detection code.
5. **Files.** `scripts/check-breaks-static.ts` (the case with no list: an empty list in place of
   the exit 0), `scripts/lib/breaks.ts` (the reason rule), `.github/workflows/ci.yml` (the
   comment of the job only), `docs/testing.md` §5 (the text below), `scripts/breaks/pr-136.json`
   (a line for each test that this PR adds or changes). No change to the PR template or to
   `docs/workflows/pull-request.md`: neither has a break-list rule, and §5 stays the one home;
   the job output names §5.
6. **The time of the job.** With a list, nothing changes. With no list, the job now parses the
   changed test files (the step that it ran already for each list) and compiles nothing.
7. **Rollout.** The job runs on the merge commit of each PR with `main`. After this PR merges,
   each open PR that changes a test fails the job until it has a list. The job is not a required
   check (owner, q4 Q2 B); the chief checks it before each merge, so the chief tells the leaders
   of the open PRs. Probe (2026-11-18, the code of this branch before this plan, a script that
   runs `prProblems` with an empty list on a merge commit): #130 (`6a43404`) would need 9 lines,
   #134 (`74a1ff2`) 7 lines.

## The text of `docs/testing.md` §5

In "Break lists", after "...the owner, 2026-11-09)" the title gets "; a list for each PR that
changes a test: owner, 2026-11-18, q5 Q1 A". The first sentence becomes "A break list makes break
evidence repeatable. Breaks are needed only for these tests:" (the three cases stay). After the
paragraph "For other work, test first: ...", a new paragraph:

> Each PR that adds or changes a test has `scripts/breaks/pr-<n>.json`. Each such test (step 3
> below says how the tools find them) is a claim with breaks, or an entry of `exempt` with its
> reason, for example the list above [the example of point 1]. The reason is not empty. An
> exemption is the author's decision, and the reviewer reads each one: a test of the three cases
> above needs a claim with breaks, and its exemption is wrong whatever its reason.

In the paragraph of the CI job, "A PR with no list passes: the list is needed only for the tests
above, and the job cannot tell them." becomes: "A PR with no list passes only when it adds or
changes no test; else the job reads the missing list as empty and names each test that has no
claim and no exemption. The job checks that each test has a line and that each reason is not
empty; it cannot tell if a reason is true."

## Test strategy

Test first: each new test runs red on the code before the change, and the PR description
records the red run (`docs/testing.md` §5). The CLI tests use the small git repository of
`scripts/check-breaks-static.test.ts`.

| Behaviour | Test | Red run, or proof |
| --- | --- | --- |
| A PR that adds a test and has no list fails, and the job names the test | New CLI test "fails a PR with no list when the PR adds a test" (it also checks the line that names the test) | Red: the old code exits 0 with "no break list". It takes the place of the test "passes a PR with no list, and says that the list is missing", whose rule the owner changed |
| A PR that changes a line of an existing test and has no list fails | New CLI test "fails a PR with no list when the PR changes a line of an existing test" (the test is in the base commit; the PR commit changes one line; `--base` names the base) | Red: the old code exits 0 |
| A PR that adds or changes no test passes with no list | New CLI test "passes a PR with no list when the PR adds or changes no test" (the PR changes only `app/a.ts`) | Its exit 0 is kept behaviour (a test after the code): a claim with a break in `pr-136.json`, for example the case with no list always fails. Its red run on the old code shows only its new message text |
| An exemption with an empty or blank reason fails | New CLI test "fails a list with an exemption that has no reason" (the reasons `""` and `"  "`) | Red at `"  "`: the old schema (`min(1)`) takes a blank reason |
| A claim still works | The CLI test "passes a list whose claims link, cover the PR's tests and compile" and the unit test "takes an exemption in place of a claim", unchanged | They run in the full suite |
| #136 passes the new check | `pnpm check:breaks:static scripts/breaks/pr-136.json` on the laptop and the job on the pushed head | 0 problems |
| Real PRs | The new CLI, from this branch, in a detached worktree of the merge commit of #134, with `--base HEAD^1` | Before (old code): exit 0. After: exit 1, its 7 tests named |

No order or race case: the job is one synchronous run on one checkout.

## Not claimed

- The job cannot tell if an exemption is right: a late, security, or order or race test can still
  get an exemption with a false reason. The reviewer reads each one.
- A change only outside the test calls (a `beforeEach`, a fixture, a helper in a `test/` folder
  that is not a `*.test.*` file) marks no test as changed, as in step 3 today. A test file with
  another name is not read.
- GitHub does not block a merge when the job is red: it stays optional (owner, q4 Q2 B), and the
  chief checks it before each merge.
- The job checks only the list of the open PR, not the lists of merged PRs.
- The reader of the changed tests keeps two gaps (round 1 of the redesign, R1-1 and R1-2; DQ-161:
  the plan of #107 changes this reader for the runner, not yet for the CI job): lines that the PR
  only removes mark the line before them, so a test just above a removed test counts too; and a
  test whose name is not a plain string (a template with `${…}`, a variable) is not read.
- The time of the job in CI after this change comes from the job run of this PR; it was not
  measured before.
