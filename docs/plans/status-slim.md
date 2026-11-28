# A short docs/status.md

Brief: the owner's answer of 2026-11-28 ("agree") to option A of the lead agent's view. Keep one
short status page. Move the follow-ups out. Drop the Done log, and change `check:status`. The cause:
`docs/status.md` grows with each PR, an agent that reads it whole spends many tokens, and each PR
edits it.
Checkpoint: plan (a change of `AGENTS.md` §9 and of a CI check that the owner approved: `AGENTS.md`
§7)
Approval: owner, 2026-11-28, revision 1: "Approve" (after the full plan was shown). The owner's
decisions in it: Q1 A, Q2 A, Q3 A, Q4 A (section "Owner decisions"). Build after #160 merges.

## Facts (measured at `8d88297`, 2026-11-28)

| Part of `docs/status.md` | Words | Grows? |
| --- | --- | --- |
| Whole file | 9,019 (303 lines) | yes |
| Now | 315 | no: it is replaced |
| Next | 2,946, mostly the story of finished items | yes |
| Waiting on the owner | 844 | slowly |
| Follow-ups | 2,816 (55 rows) | yes |
| Slices | 589 (one row for each milestone) | slowly |
| Done | 1,399 (one row for each merged PR) | yes, always: `check:status` makes CI ask for a row |

- 526 commits changed the file since 2026-10-21.
- The ledger archive has many review findings on stale or missing status lines (for example DQ-207,
  DQ-269, DQ-299, DQ-565, DQ-633, DQ-683).
- `docs/delivery-quality.md` uses `Slices` as its slice register.
- No GitHub issue found (`gh issue list --state all`: 0), and a Codex worker runs with no network,
  so it cannot read an issue.
- `check:status` does two things: each merged PR has a Done row (#131, DQ-571, owner q2 Q2 A), and
  no typed measure (`one-home-status-check.md`). The Done check stopped one failure:
  a hand-written Done row that is wrong or missing (DQ-207, DQ-212, DQ-565). #131 looked at "no
  Done rows; `git log` holds the merges" (its option D). It did not take it, only because it
  changed the owner's Done table rule of 2026-11-10. With no Done rows, that failure cannot occur:
  `git log` and GitHub are the one home of a merge.
- A rough short file (the open Next items, the Waiting rows and Slices as they are, a short Now):
  1,652 words. Waiting on the owner (844) and Slices (589) are most of it.
- D66, an accepted decision, points at `status.md` two times. Its row in Waiting on the owner
  stays. "The gap 'tool results inside one run' in `../status.md`" is a Follow-ups row, which moves.
- `docs/workflows/merge-bar.md` links to "status.md#next, item 2", a list of finished PRs.
- `check:breaks static` runs only the PR's own break list. So the break lists of #131 and #148,
  which name the Done code, do not run again. They stay as records.

## Design

1. **`docs/follow-ups.md`** (new): the Follow-ups table, moved with no change to its rows. Its top
   says what a row is, who adds it, and that a row goes when its work merges. (Q1)
2. **`docs/status.md`** keeps four parts, each with open items only:
   - Now: the current work, in a few lines, with links.
   - Next: one line for each open item, with a link to its plan, brief or PR. The story of finished
     items goes; Git and the PRs keep it.
   - Waiting on the owner: the open rows only.
   - Slices: no change (the slice register).
   - The Done part goes; the merged PRs are in `git log` and on GitHub. (Q2)
3. **`check:status`**:
   - The Done row check goes, with `scripts/lib/check-status-git.ts`, the `--history` option and
     the CI step's history input.
   - The typed measure check stays.
   - New: the file fails above a word limit, so that it cannot grow again. The limit is an
     environment variable, with its default next to the rule in `docs/testing.md` §4. (Q3)
   - The break lists of #131 and #148 do not change.
4. **`AGENTS.md` §9**: the line on `docs/status.md` changes. Update it when the PR changes the
   current work, the next work or what waits on the owner. Put a new follow-up in
   `docs/follow-ups.md`.
5. **The texts that name the Done log, the follow-ups or "Next, item 2" of `docs/status.md`.** The
   search: `git grep -E "status\.md|doneRows|mergedPrs|check-status-git|Done row"`. The texts: `README.md`,
   `docs/README.md`, `docs/development-plan.md`, `docs/testing.md` §4 (also the `audit` rule that
   adds a Follow-ups row), `docs/workflows/pull-request.md` (steps 6 and 7, "One home"),
   `docs/workflows/merge-bar.md`, `docs/workflows/review.md`, `docs/delivery-quality.md` (top),
   `scripts/README.md`, `scripts/lib/README.md`, `scripts/check-status.ts`,
   `scripts/lib/check-status.ts`, `.github/workflows/ci.yml`. Not changed: the archives, the old
   plans and the break lists (records). D66 gets only the link change of Q4.
6. Guide: not changed. The owner gets no new page, command or choice in the app.

## Test strategy

- `scripts/check-status.test.ts`: the Done row tests go with the code. The typed measure tests stay.
- New tests, red first:
  - a file over the limit fails, and the message names the limit and the count;
  - a file at the limit passes;
  - the limit comes from the environment variable, and the default applies with no variable.
- `pnpm check:status` passes on the new `docs/status.md`; the new file is under the default limit.
- `pnpm lint`, `typecheck`, `test`, `check:index`; CI on the pushed head.

## Not in scope

- The content of `docs/delivery-quality.md` and its archive.
- Any rule of the `leader` skill.

## Order

PR #160 adds the Done row of #159. Until #160 merges, `check:status` fails on each branch from
`main`. #160 merges first; this PR starts from `main` after it.

## Owner decisions (2026-11-28)

| Question | Answer |
| --- | --- |
| Q1. The home of the follow-ups (no GitHub issue exists; Codex workers have no network) | A: `docs/follow-ups.md` |
| Q2. The Done log; this reverses the Done table rule of 2026-11-10 and the check of #131 | A: remove it and its CI check |
| Q3. A size check | A: a word limit, default 2,000 words |
| Q4. D66's pointer to the follow-up "tool results inside one run" | A: a link-only change in D66 to `../follow-ups.md`; the decision text does not change |

## Review

The advisor reads the plan. The built PR gets the two outside reviewers (Opus and Astra).

## Risks

- A reader who looked in `docs/status.md` for the merged work now uses `git log` or the merged PR
  list. `README.md` says where.
- A limit that is too low makes a PR fail for one long line; the owner can raise it in one place.
