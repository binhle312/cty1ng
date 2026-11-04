# M2c state complexity caused repeated review findings

Date: 2026-11-03 · Source: M2c, PR #59 · Status: applied (2026-11-04)

**Observed.** Seven review rounds of #59 found about 32 problems. About 18 were order and
timing cases: a late pin answer replaced a newer pin, a Save answer after a Discard brought the
dropped edit back, a late `name_taken` blocked text the owner had already corrected. Most
rounds found new cases, some of them made by the fixes of the round before. Five more findings
were spec lines that the code did the opposite of, for example fields read-only while Save
waits. Brief items were also missing (the side-list reorder, the chained journey), and the PR
grew to 59 files.

**Cause.** The bot page has two save bars, a `row_version` lock, pins outside that lock, live
events, Discard, dialogs and leaving. Nobody wrote down which state meets which event before
the code. The builder wrote the normal path straight into the component (568 lines in one
commit, no test strategy yet), and then added a flag or a ref for each case a review found:
`BotView` ended with 10 `useState`, 7 `useRef` and a Discard counter. With no table, each
review found a new combination, and nothing showed when the cases were complete. The slice also
held four parts (edit and lock, Skills tab dialogs, save cards, side list), so the review and
the spec walk were spread thin.

**Project response.** The project added state tables, pure state modules, cell tests, and sequence tests to its workflow and conventions.
`withSaveAnswer` uses an allowlist. The `max-params` lint rule checks the object-argument convention.
The local workflow keeps the `xhigh` planning effort and the approximate 30-file split signal; these are project choices.

**Closed (2026-11-04).** Both screens of #59 have their state module now: the bot list
(`frontend/src/features/bots/bot-list-state.ts`) and the Profile and Model edit state
(`frontend/src/features/bots/bot-edit-state.ts`), which follows the table in
`../design/components/bot-page.md` §4.2. `BotView` keeps no edit flags or refs that change the
rules.

**Reusable principles.** [Model state and event order before implementation](../../.agents/skills/principle-model-state-and-order/SKILL.md), [Keep each change independently reviewable](../../.agents/skills/principle-bound-change-scope/SKILL.md), [Encode repeatable checks and keep one source of guidance](../../.agents/skills/principle-encode-repeatable-checks/SKILL.md).

**Project guidance.** [workflow §2](../workflow.md#2-lifecycle-of-a-slice), [frontend conventions](../frontend-conventions.md), [testing](../testing.md), [review guide](../review-guide.md).
