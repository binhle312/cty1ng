# Lessons learned

What the owner saw go wrong in how the project is built, why it happened, and what changed
because of it. Newest first. One entry per review.

This file keeps the story. The rules themselves live in the owning documents, and each lesson
links to them ("One fact, one place", `README.md`). When a lesson changes a rule, change the
owning document in the same PR and link it here.

**Who adds an entry:** the agent that the owner asks to fix the process, in the same PR as the
fix. Write what was observed, the cause, and what changed.

## 2026-10-30: the M0c build took more than an hour (PR #49)

The owner watched Claude Code build M0c (the frontend shell, PR #49). The build took more than
an hour.

| # | Observed | Cause | What changed | Rule now in |
| --- | --- | --- | --- | --- |
| 1 | Each end-to-end run lost about 4 minutes before the first test. | In the agent's sandbox, a connection to a closed local port hangs for about 2 minutes. Playwright first checks if each of its two test servers already runs, and every run started new servers. | Locally, `pnpm e2e` reuses the servers that `pnpm e2e:serve` keeps running; CI still starts fresh ones. While fixing, run only the affected tests; run the full suite once at the end. | `testing.md` §3 "Fast loop while building"; `workflow.md` §2 steps 3–4 |
| 2 | The build hit problems that a short check would have found before the plan: Zod's `new Function` and Base UI's inline styles under the CSP, type errors in the Hey API client, Base UI behaviour (no tooltip role, link items that stay open). | The plan was written from the docs only. Libraries new to the repository were first tried during the build. | Before the plan, the builder runs short risk probes on new parts and puts the results in the plan. | `workflow.md` §2 step 2 "Risk probes first" |
| 3 | The owner answered questions in two rounds: the pasted review, then the Hey API and docs page questions. | Questions were raised when the build found them, not collected in the plan. | The plan ends with one "Open questions" list. | `workflow.md` §2 step 2 "One round of questions" |
| 4 | Several spec gaps were settled during the build: the page URLs, the HD1 pin pill conflict, whether a hidden bar 2 is remembered, Ctrl+B in text boxes, the first-run controls. | Nobody asked what the slice needed that the specs did not say until the code needed it. | A spec gap pass before each slice; the answers go into the docs in a docs-only PR. | `workflow.md` §2 step 1 "Spec gap pass" |
| 5 | M0c was large: the shell UI together with static serving, the API docs page, `gen:api`, four CI jobs and the one-command launch. | The slice mixed UI and infrastructure. | UI and infrastructure go in separate slices or PRs. | `workflow.md` §2 step 1 "Slice size", §8 |
| 6 | The same library and lint problems could be learned again in the next slice. | What the build learned was only in the PR conversation. | The pitfalls and the test helpers are written down, and each PR adds what it learned. | `frontend-conventions.md` §5; `testing.md` §3 "Test helpers"; `workflow.md` §2 step 4 |

**Still open:** the 2-minute hang itself (row 1). It is a setting of the sandbox or firewall on
the owner's machine, not of the repository. If connections to closed local ports are refused
at once, the delay goes away even without `pnpm e2e:serve`.
