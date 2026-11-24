# A CI check that each merged PR has its Done row in `docs/status.md` (DQ-571)

Brief: the owner's answer of 2026-11-18 (q2 Q2, choice "A"): "Redesign: a CI script
(check:status) that fails when a PR merged to main since a start date has no Done row in
docs/status.md. Built in its own small PR with a plan. #127's DQ-571 stays open with this home
until it merges."
Checkpoint: none beyond the owner's design answer q2 Q2 A (a new check script; no shared state,
module boundary or screen flow)
Approval: plan OK by the lead agent, 2026-11-18, against the owner's answer q2 Q2 A (revision 1); owner review pending

## The cause

A PR cannot record its own merge, so the next PR adds the Done row of the PR before it
([pull-request.md, step 6](../workflows/pull-request.md#before-each-push-check-the-records)).
Only a person checks it, and three times a hand-written Done row was wrong or missing (DQ-207,
DQ-212, DQ-565; DQ-571 names the same cause; DQ-565 and DQ-571 are on #127's branch). Example: #125 merged on 2026-11-18 at 08:47 (+07:00), and on `main` today
(`6a43404`) the Done table still has no row for it (#127 adds one). The same check finds 15 more
gaps (probe 3).

## Probes (git 2.53.0, `origin/main` at `6a43404`, 2026-11-18)

1. **Git history names every merged PR, with no network call.** The PR numbers in the
   first-parent subjects of `main`, `Merge pull request #N from …` (merge commit) or `… (#N)` at the
   end (squash merge), against `gh pr list --state merged` with base `main`: 121 and 121, and
   `diff` prints nothing. The merges are commits on the first-parent line of `main`. Two merged PRs
   have another base (#95 into #94's branch, #112 into #109's branch): they are not on that line,
   and `gh` does not list them with base `main` either.
2. **How the repo merges.** Merge commits since #45 (2026-10-30); squash merges for #37 to #44 and
   earlier. The repository settings allow all three kinds (`allow_merge_commit`,
   `allow_squash_merge` and `allow_rebase_merge` are true). A rebase merge puts the PR's commits on
   `main` with no PR number, so the check cannot see it (Not claimed).
3. **The Done table today.** `## Done` holds a table `| Date | What |`. A row names its PRs as
   links `[#N](https://github.com/binhle312/cty1ng/pull/N)`; a row can link several PRs (the M0
   row links four). The check uses this format as it is; no row changes form. Merged PRs with no
   link in a Done row, by merge date:
   - before 2026-10-30: 33 PRs (#2 to #41, the specification work, recorded in grouped rows);
   - from 2026-10-30: 16 PRs: #47, #53, #60, #62, #67, #72, #73, #75, #76, #77, #81, #114, #115,
     #124, #125, #130.
4. **The PR merge in CI.** On `pull_request`, the checkout is GitHub's test merge, and its first
   parent is the base commit of `main` (fetched `refs/pull/129/merge`: parents `1dd7a01` and the
   PR head). On `push` to `main` after a merge, `HEAD` is the merge commit of the PR, and its first
   parent is `main` before that merge. So `HEAD^1` is the right history in both events. #128 uses
   the same `HEAD^1` for its CI job.

## The design

The rule: each PR merged into `main` on or after the start date, in the history of a given
commit, has a link in a row of the Done table.

- `scripts/lib/check-status.ts` (pure, no git, no file reads):
  - `mergedPrs(log)`: reads lines of `git log --first-parent --format=%H%x09%cI%x09%s` and returns
    `{ pr, date, sha }` for each merge-commit or squash subject. `date` is the date part of the
    committer date as the commit records it (the merger's time zone, `+07:00` today), so the result
    is the same on every machine.
  - `doneRows(statusMd)`: finds `## Done` up to the next `## `, and returns the linked PR numbers of
    its table rows and a problem for each data row that is not `| YYYY-MM-DD | … |` (a broken row
    counts no link). No `## Done` is a problem.
  - `checkStatus({ merged, statusMd, since })`: one problem for each merged PR with `date >= since`
    and no link, with the row to paste:
    `#125 (merged 2026-11-18, dcf619b) has no Done row in docs/status.md. Add: | 2026-11-18 | [#125](…/pull/125) merged. |`.
  - `SINCE = "2026-10-30"`: the start date, with its reason in a comment. Its one home is this
    constant; the docs name the file, not the date.
- `scripts/lib/check-status-git.ts`: `readHistory(repo, rev)` runs
  `git rev-parse --is-shallow-repository` (a shallow clone is a problem: it would hide merges) and
  `git log --first-parent --format=… <rev>` with `execFileSync` (no shell).
- `scripts/check-status.ts` (CLI): `--history <rev>`, default `origin/main` (what a PR needs after
  a `git fetch`); reads `docs/status.md`; prints with `report("check:status", …)`.
- `package.json`: `"check:status": "tsx scripts/check-status.ts"`.
- `.github/workflows/ci.yml`: a job `check:status` (`fetch-depth: 0`, install, then
  `pnpm check:status --history HEAD^1`), on `pull_request` and on `push` to `main` (the workflow's
  triggers). A PR that is not merged is not in `HEAD^1`, so it never needs its own row. On `push`,
  the new merge is not in `HEAD^1` either; the merge after it is red if its PR did not add the row.
  Whether the job is a required check is the owner's setting (ruleset "Protected main").
- **Start date 2026-10-30.** The code work starts that day (M0, #45), and from #45 each PR merges
  with a merge commit. The options, by the rows this PR must add (probe 3): 2026-10-21, 49 rows;
  2026-10-30, 16 rows; 2026-11-10, 5 rows. 2026-10-30 covers all the code PRs for 16 rows; the
  33 older specification PRs stay grouped as they are.
- **The 16 missing rows**, in this PR, in date order, in the short form of today's rows:
  `| <merge date> | [#N](…/pull/N) merged. |` (date from the merge commit, probe 1).
- Docs: one sentence in the Done intro of `docs/status.md`; `docs/testing.md` §4 (the CI gates,
  not among the nine required checks); `docs/workflows/pull-request.md` step 6 (the check runs it);
  the scripts line of `docs/architecture.md`; a row in `docs/plans/README.md`. `AGENTS.md` §4 is not
  changed (it needs the owner): Needs human review.

### Options compared

| Option | Gain | Cost or risk |
| --- | --- | --- |
| A. Git history in CI (chosen, the owner's "A") | No network, no token; the same command local and in CI; probe 1 shows it equals GitHub's list | Needs full history in its job (`fetch-depth: 0`, a few seconds); a rebase merge is not seen |
| B. The PR register in `docs/delivery-quality.md` (DQ-571's first idea) | No git history needed | The register is a hand copy too, and a PR with no milestone has no entry (`AGENTS.md` §9), so gaps stay |
| C. `gh api` in CI | Sees rebase merges | Network and a token in the job; a GitHub outage makes the check red |
| D. As if the rule always existed: no hand-written merge rows; `status.md` points to `git log` for merges | One home for the merge fact | Changes the owner's Done table rule (owner, 2026-11-10) and is not the owner's choice A |

### Failure paths

A shallow clone, an unknown `--history` revision, a missing `## Done` or a broken row each make
the check fail with a message; none passes in silence.

## Test strategy (test first; `scripts/check-status.test.ts`)

| Behaviour | Test | Red run |
| --- | --- | --- |
| A merged PR with no Done row fails, and the message has the row to paste | Fixture log with #7 (merge commit) and a status text with no link | Before the code: the module does not exist (recorded) |
| A merged PR with a link in a Done row passes, also in a row with several links | Fixture with the link | Same |
| A squash merge `… (#9)` is a merged PR | Fixture | Same |
| A PR merged before the start date is ignored; a PR merged on the start date counts | Two fixture merges, `since` between and on them | Same |
| A link outside the Done table does not count | A dated row with the link in a section after the Done table (a `## Slices` row has no date, so it is a broken row and counts no link even without the section bounds) | Same |
| A broken Done row is a problem and counts no link; no `## Done` is a problem | Fixtures | Same |
| A PR that is not merged into `main` is ignored: a `Merge pull request` on a side branch, and the PR of the commit itself | A temporary git repo: `main` with a `--no-ff` merge of #1, a branch that merges #2 into it before it merges as #3, and a merge of #4 on top; `readHistory(repo, "HEAD")` returns #4, #3 and #1, not #2; `readHistory(repo, "HEAD^1")` returns #3 and #1. No test reads the `--history HEAD^1` line of `ci.yml` | Same |
| A shallow clone is a problem | `git clone --depth 1` of the temporary repo | Same |

The real red run: `pnpm check:status` on the status.md of `main` must list the 16 PRs of probe 3
(before the rows are added). Then it prints `check:status: ok`.

A break list `scripts/breaks/pr-<n>.json` for the new tests (as the lead agent asked): breaks such as
the squash pattern removed, `--first-parent` removed, the start date filter removed, and links
counted outside `## Done`.

## Interplay with open PRs

- #127 adds the row of #125 too. The same added line on both sides merges with no conflict or a
  one-line conflict; the PR that merges second solves it in its records turn.
- After this PR merges, the next CI run of each open PR (#107, #127, #128, #129) needs a merge of
  `main` and the rows of the PRs merged before it, this PR included. That is the rule working.

## Not claimed

- A rebase merge is not seen (probe 2); the setting allows it. The owner can turn rebase merges
  off (Needs human review).
- The check reads only the links of the Done rows, not their dates or words.
- The 33 PRs before 2026-10-30 keep their state (no linked row for each).
- A PR merged into another PR's branch (#95, #112) is not a PR merged into `main`, and the check
  does not ask for its row.
- The job does not stop a merge unless the owner makes it a required check.

## Open questions

None for the owner; the start date is chosen above with its options.
