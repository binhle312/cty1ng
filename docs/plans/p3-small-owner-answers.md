# Small fixes from the owner's answers of 2026-11-18

Brief: the owner's answers of 2026-11-18 to DQ-442, DQ-500, DQ-485, DQ-411 (UI-1), item 61 (UI-2), #123 (UI-3), DQ-426 and the after-save cards (Q2 A); no task brief exists
Checkpoint: none (eight small changes; the owner gave each answer and each text)
Approval: UI texts and scope: the owner's answers of 2026-11-18. Plan OK by the lead agent, 2026-11-18, against the owner's answers (DQ-442 B, DQ-500 C, DQ-485 C, DQ-426 A, UI-1 A, UI-2 B, UI-3 A). Item 8 approved by the owner, 2026-11-18 (after-save cards, Q2 A).

Code read at `origin/main` = `aa85cb9` (#124 merged). I read each place; The red runs are in the PR
description. Revision 2 (2026-11-18, after round 1) replaces sections 2 and 3 with what was built.

Nothing outside this scope enters the PR. A finding outside it gets a ledger row, not a fix.

## 1. Items

All UI texts below are approved by the owner, 2026-11-18 (the id and letter of each answer are in
the table).

| # | Answer | Today (file:line) | Change | Files |
| --- | --- | --- | --- | --- |
| 1 | DQ-442 B | `skill-history.tsx:91` and `:312`: a `<p>` with the load error, no **Try again**, no `role="alert"` | Use `LoadError` (the pattern of the skill dialogs and the bot cards) with `versions.refetch()` and `diff.refetch()`. The texts stay: "The app could not load the versions." and "The app could not load the changes." | `skill-history.tsx` |
| 2 | DQ-500 C | `top-header.tsx:34`: `errorComponent={() => <RosterStandIn bots={all} failed />}` is a new function type on each header render, so React mounts the stand-in again each time | A module-level `RosterFailed` component that reads the bots with `useBots()` (the query is shared; `errorComponent` gets only `error` and `reset`) | `top-header.tsx` |
| 3 | DQ-485 C | `routes/bots.tsx:30` cites "bot-page.md §1"; `bot-tabs.ts:1` cites "§1". The URL table is in the unnumbered intro of `bot-page.md`; the tab list is §3 | Comments only. Cite the headings by name: "the URL table in the intro of bot-page.md" and "bot-page.md, Tabs". The cite in `routes/bots.tsx:7` ("bot-page.md §1, create-bot-page.md §7") is the same wrong cite for the URLs, so I correct that line too (the lead agent said yes, 2026-11-18) | `routes/bots.tsx`, `features/bots/bot-tabs.ts`, and (round 1, same wrong cite) `features/bots/bot-page-top.tsx`, `test/e2e/bot-page.spec.ts` |
| 4 | DQ-411 / UI-1 A | `create-bot-steps.tsx:463`: "... Deprecated skills are not in the list." | The last sentence becomes "You cannot add deprecated skills." `create-bot-page.md` step 3 states the fact (`:61-64`) and does not quote the note; I do not change it unless the build finds a quote (then I change the quote) | `create-bot-steps.tsx` |
| 5 | Item 61 / UI-2 B | `skill-dialogs.tsx:63`: "The bots did not load. Try again first." | The reason becomes "The app must know which bots use this skill. Try again first." The error text "The app could not load the bots." stays. `skills-page.md:574` gives the old reason for the Deprecate, Remove from bots and Delete dialogs: update it | `skill-dialogs.tsx`, `skills-page.md` |
| 6 | #123 / UI-3 A | `error-page.tsx` and `not-found-page.tsx` have an `h1`. Inside the Skills page they show beside the list column with its `h1` "Skills": two `h1` | Both components take `level?: 1 \| 2` (default 1). The Skills page uses `2`: `skill-page.tsx:106` and `new-skill-page.tsx:94` (Page not found), and the four lazy child routes of `skills.lazy.tsx` get an `errorComponent` that renders `<ErrorPage level={2} />`. Texts and buttons stay. Remove the Follow-ups row of #123 from `status.md` (the row that says "Two `h1` headings on the Skills page") | `error-page.tsx`, `not-found-page.tsx`, `skill-page.tsx`, `new-skill-page.tsx`, `routes/skills.lazy.tsx`, `routes/root.tsx` (a wrapper, for the types), `test/e2e/shell.spec.ts`, `test/e2e/skills.spec.ts`, `docs/status.md` |
| 7 | DQ-426 A | The Guide line "A deprecated skill is read-only; "Make active again" in its banner ..." does not name "Remove from bots" | The Guide names "Make active again", "Remove from bots" (hidden when no bot uses the skill; `skills-page.md` §10.2) and "Show deprecated" | `seed/skills/using-the-app/SKILL.md` |
| 8 | After-save cards, Q2 A | `after-save-cards.tsx` `botsOffReason`: "The bots did not load. Try again first." for both cards | Upgrade card: "The app must know which bots use this skill. Try again first." Assign card: "The app must know which bots can get this skill. Try again first." "Loading the bots." stays. `skills-page.md` "The bot list of a card" gives both texts. No ledger row: the owner's decision | `after-save-cards.tsx`, `skills-page.md` |

Not claimed, and not in this PR:

- Error screens outside the Skills page keep their `h1`.
- A route-level `notFoundComponent` for an unknown address below `/skills` (for example
  `/skills/a/b`) is not changed.

### Item 6: where the screens show (lead agent's condition, 2026-11-18)

Today: a child route of `/skills` that throws has its own match, so its error boundary is the
child's. The router's `defaultErrorComponent` renders in that match, in the `Outlet` of
`SkillsLayout` (`skills-layout.tsx:44`, a `section` beside `SkillList`). So the list column stays
and the error screen shows beside it. `errorComponent` on a lazy child route sets the component of
the same boundary of the same match: the place does not change, only the component and so the
heading level. `NotFoundPage` is returned by the page itself, so its place does not change at all.
An error of the layout itself (or of the chunk) still goes to the default `ErrorPage` with `h1`:
there is no list column then, so one `h1` is right.
Proof, not a reading: the tests of item 6 check that the list column (the "Skills" `h1`, the
search box) is still in the document when a child route fails, and that the screen has exactly
one `h1`. If the test shows any change beyond the heading level, I stop and tell the lead agent.

## 2. Test strategy, as built (revision 2)

Rules: each test except S15 to S17 was written first and was red on `aa85cb9`, then green after
the fix. The tests of S15 to S17 (the three more child routes) were added in round 1, after the
code; they are also red on `aa85cb9`. No test is disabled or deleted. The break runner wants one
claim for each test name and the assertion on one line inside the test, so the tests are small
and each has one claim.

| Item | Tests (file) | Case | Red before the fix because |
| --- | --- | --- | --- |
| 1 | `skill-history.test.tsx`: "gives the load error of the versions an alert", "loads the versions again from Try again", and the same two for the changes | The first read fails: the error is an alert; Try again loads the data and the error goes | A plain `<p>`, no button |
| 2 | `roster-load-failed.test.tsx`: "keeps the avatars that it shows when a new bot list comes" | The roster chunk fails; a new bot list arrives; the first avatar element is still in the document | The inline component is a new type, so React mounts the avatars again |
| 3, 7 | none | Comments and Guide text | n/a |
| 4 | `create-bot-page.test.tsx`: "says on step 3 that deprecated skills cannot be added" | The note shows the new sentence | The old sentence |
| 5 | `skill-dialogs.test.tsx`: "says when the bots did not load" (Deprecate), "... Remove from bots dialog", "... Delete dialog" | The focused confirm button gives the new reason | The old reason |
| 6 | `error-page.test.tsx`, describe "the headings of the error screen and Page not found": the error screen of the index, of a skill, of the new skill page and of the import page; Page not found of an unknown skill and of a Clone with no source; two guards of the default level 1 (the unknown address and a header that throws) | Each is an h2 beside the list column (the column stays, one h1 "Skills", the screen is not inside the column); the guards keep h1. e2e: `shell.spec.ts` and `skills.spec.ts` expect h2 for the unknown skill | Two h1; the guards pass on the old code |
| 8 | `after-save-cards.test.tsx`: "... the Upgrade card needs to know the bots", "... the Assign card needs to know the bots" | The focused button gives its own reason. The Assign test mounts the card with a failed read of its own: Create reads the bots before the card opens, so the error state has no normal path | The old reason |

## 3. Break list, as built (`scripts/breaks/pr-129.json`)

17 claims, S1 to S17, one for each new or changed test with a clear value change, and each with
one break that changes a value (the runner rule: a break changes a value, it does not throw).
S1 to S4: the History alert (the `role` of `LoadError`) and Try again (`onRetry` does nothing).
S5: the inline `errorComponent`. S6: the old sentence. S7 to S9: the old reason (one break for the
three dialogs, because they share `botsReason`). S10 to S12 and S15 to S17: no `errorComponent`
for one child route, or no `level={2}` for Page not found. S13 and S14: the other card's reason.
The two guards of the default level are exempt, because they pass on the old code. The full
`pnpm check:breaks scripts/breaks/pr-129.json` runs before each push of a test change, with the
TMPDIR line of the lead agent (outside every git repository). 0 problems is the bar.

## 4. Docs and records

- `docs/design/components/skills-page.md:574`: the new reason.
- `docs/status.md`: delete the #123 Follow-ups row about two `h1`; the PR row at the end.
- `seed/skills/using-the-app/SKILL.md`: item 7 (this PR changes what the owner sees in the Guide's
  text only; the other items change UI texts that the Guide does not quote. I check the Guide for
  the old texts with `rg` and change any sentence that becomes false).
- `docs/delivery-quality.md`: rows DQ-442, DQ-500, DQ-485, DQ-411 and DQ-426 get `fixed` with the
  owner's words; new findings start at DQ-571 (after `grep` of `main` and the origin branches);
  the register row, one round row for each review, §2 Audit row counted with
  `count-audit.sh`.
- `docs/plans/README.md`: one row for this file.
- `docs/README.md`/folder indexes: `pnpm check:index` after adding the plan and the new test file.

## 5. Needs human review

- UI texts: approved by the owner, 2026-11-18 (DQ-442 B: Try again and `role="alert"`, no new
  text; DQ-411 UI-1 A: "You cannot add deprecated skills."; item 61 UI-2 B: "The app must know
  which bots use this skill. Try again first."; #123 UI-3 A: heading level; after-save cards, Q2 A: the Upgrade and Assign reasons).
- Scope: the owner's answers of 2026-11-18 (DQ-500 C, DQ-485 C, DQ-426 A).
- No migration, no dependency, no public API change, no security code.

## 6. Open questions

None.
