---
id: R-002
title: The chief may merge a PR that a standing permission of the owner covers, at the merge bar.
status: active
scope: chief
said: 2026-11-19
orders: [54, 78, 80, 99, 108]
ends: never
supersedes: [R-001]
amends: []
check-first: true
permission-rule: true
---
Rule: Merge a PR when the owner's message asks for it. Also merge a PR that a standing permission covers, when it meets the merge bar below; a memory PR goes by R-005. No permission covers a PR that changes `AGENTS.md`, `docs/decisions/`, the public API shape, security-sensitive code, a migration, a dependency, the memory check, or a rule about merges, approvals or permissions outside `.agents/chief/memories/`: only the owner's own request covers it (`AGENTS.md` §7).
Owner said: "you have my permission to merge the PRs that you think they are good to merge" (2026-11-15)
Owner said: "Standing: each chief merge, except memory PRs" (2026-11-19)
Owner said: "Q2: A Your own request covers any PR" (2026-11-19)
Owner said: "Q3: A Add the API shape to the sentence" (2026-11-19)
How to apply:
Check first: ask these questions in this order. The first "yes" decides; if no answer is "yes", do not merge.
1. Did the owner say that they merge this PR, or that nothing merges now? Then wait. Stop.
2. Is it a memory PR, or a PR with files in `.agents/chief/memories/` and in other folders? Run `pnpm merge:check <PR>` from a clean checkout of `origin/main`. A memory PR goes by R-005. Do not merge a PR of the second kind, also when the owner asks: ask for a split. Stop.
3. Does the owner's own message ask you to merge this PR (R-004)? Then use path 1, also for a PR that question 4 lists.
4. Does the PR change `AGENTS.md`, `docs/decisions/`, the public API shape, security-sensitive code, a migration, a dependency, the memory check, or a rule about merges, approvals or permissions outside `.agents/chief/memories/`? Then no permission covers it. Stop: only the owner's own request (question 3) covers it. `pnpm merge:check <PR>` answers this question only by path: a listed path gives exit 1. It does not check content: for each list item that no path shows, it exits 0 and prints a "Not checked" line next to the merge line. Before path 2, read the whole diff for each "Not checked" item. If one matches, no permission covers the PR: the owner merges it. Stop.
5. Does a standing permission of the owner cover this PR? Then use path 2.
- Path 1, the owner asks: two consultants find no blocker first (R-003). The owner marks it Ready, or the owner's message names the Ready step and you mark it Ready right before the merge. Then merge it with `gh pr merge https://github.com/<owner>/<repo>/pull/<PR> --merge --match-head-commit <the head that the consultants read>` (the form of the merge line; `pnpm merge:check` prints no merge line for a listed PR), and verify the merge (`environment.md`, "GitHub CLI").
- Path 2, a standing permission covers the PR: do these steps in order.
  1. The merge bar: the reviews ended by the written rule (R-007); the records are written; each required CI check is green; `check:breaks static` is green (not required, so check it); a new `gh pr view` shows MERGEABLE and CLEAN; no owner decision on the PR is open.
  2. Two consultants find no blocker first (R-003). Until #107 merges, also do the hand check of R-035.
  3. Mark it Ready right before the merge (`AGENTS.md` §10), merge only with the merge line that `pnpm merge:check` printed, after the diff read of question 4, and verify the merge (`environment.md`, "GitHub CLI").
