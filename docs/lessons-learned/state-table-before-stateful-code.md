# Write the state table before the code of a stateful screen

Date: 2026-11-03 · Source: M2c, PR #59 · Status: open (the bot page's state module)

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

**Change.**
- A screen with saves under a lock, live events or late answers gets a state table in the
  plan, approved with it, and moved into the spec (`../workflow.md` §2 step 2). The plan, the
  table and the test strategy run at `xhigh` effort.
- Its rules live in one pure state module with one test per cell, and a test runs every order
  of a few events (`../frontend-conventions.md` §1, `../testing.md` §3).
- Answers write only what their request owns, as an allowlist (`../frontend-conventions.md`
  §1). `withSaveAnswer` replaced a list of fields to keep that grew after every review.
- Such a screen is its own part of a slice; a plan over about 30 files is a sign to split
  (`../workflow.md` §2 step 1).
- Lint now checks the object-argument rule (`max-params`), which the reviews found by hand.

**Still open.** The bot page's edit state (Profile and Model) does not have a state module yet.
The follow-up in `../status.md` moves the rules of the table in `design/components/bot-page.md`
§4.2 out of `BotView`. The bot list's own state is in one pure module now
(`frontend/src/features/bots/bot-list-state.ts`, 2026-11-04).

**Rule now in.** `../workflow.md` §2 steps 1, 2 and 4; `../frontend-conventions.md` §1, §3;
`../testing.md` §3, §5; `../review-guide.md` §3.
