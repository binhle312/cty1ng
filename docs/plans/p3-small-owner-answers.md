# Small fixes from the owner's answers of 2026-11-18

Brief: the owner's answers of 2026-11-18 to DQ-442, DQ-500, DQ-485, DQ-411 (UI-1), item 61 (UI-2), #123 (UI-3) and DQ-426; no task brief exists
Checkpoint: none (seven small changes; the owner gave each answer and each text)
Approval: UI texts and scope: the owner's answers of 2026-11-18. The plan itself waits for the chief agent's "plan OK" (the chief checks it against the owner's answers).

Code read at `origin/main` = `aa85cb9` (#124 merged). I read each place; I have not run the wrong
behaviour yet. The red runs are in the build step.

Nothing outside this scope enters the PR. A finding outside it gets a ledger row, not a fix.

## 1. Items

All UI texts below are approved by the owner, 2026-11-18 (the id and letter of each answer are in
the table).

| # | Answer | Today (file:line) | Change | Files |
| --- | --- | --- | --- | --- |
| 1 | DQ-442 B | `skill-history.tsx:91` and `:312`: a `<p>` with the load error, no **Try again**, no `role="alert"` | Use `LoadError` (the pattern of the skill dialogs and the bot cards) with `versions.refetch()` and `diff.refetch()`. The texts stay: "The app could not load the versions." and "The app could not load the changes." | `skill-history.tsx` |
| 2 | DQ-500 C | `top-header.tsx:34`: `errorComponent={() => <RosterStandIn bots={all} failed />}` is a new function type on each header render, so React mounts the stand-in again each time | A module-level `RosterFailed` component that reads the bots with `useBots()` (the query is shared; `errorComponent` gets only `error` and `reset`) | `top-header.tsx` |
| 3 | DQ-485 C | `routes/bots.tsx:30` cites "bot-page.md §1"; `bot-tabs.ts:1` cites "§1". The URL table is in the unnumbered intro of `bot-page.md`; the tab list is §3 | Comments only. Cite the headings by name: "the URL table in the intro of bot-page.md" and "bot-page.md, Tabs". The cite in `routes/bots.tsx:7` ("bot-page.md §1, create-bot-page.md §7") is the same wrong cite for the URLs, so I correct that line too (the chief decides in "plan OK" if not) | `routes/bots.tsx`, `features/bots/bot-tabs.ts` |
| 4 | DQ-411 / UI-1 A | `create-bot-steps.tsx:463`: "... Deprecated skills are not in the list." | The last sentence becomes "You cannot add deprecated skills." `create-bot-page.md` step 3 states the fact (`:61-64`) and does not quote the note; I do not change it unless the build finds a quote (then I change the quote) | `create-bot-steps.tsx` |
| 5 | Item 61 / UI-2 B | `skill-dialogs.tsx:63`: "The bots did not load. Try again first." | The reason becomes "The app must know which bots use this skill. Try again first." The error text "The app could not load the bots." stays. `skills-page.md:574` gives the old reason for the Deprecate, Remove from bots and Delete dialogs: update it | `skill-dialogs.tsx`, `skills-page.md` |
| 6 | #123 / UI-3 A | `error-page.tsx` and `not-found-page.tsx` have an `h1`. Inside the Skills page they show beside the list column with its `h1` "Skills": two `h1` | Both components take `level?: 1 \| 2` (default 1). The Skills page uses `2`: `skill-page.tsx:106` and `new-skill-page.tsx:94` (Page not found), and the four lazy child routes of `skills.lazy.tsx` get an `errorComponent` that renders `<ErrorPage level={2} />`. Texts and buttons stay. Remove the Follow-ups row of #123 from `status.md` (the row that says "Two `h1` headings on the Skills page") | `error-page.tsx`, `not-found-page.tsx`, `skill-page.tsx`, `new-skill-page.tsx`, `routes/skills.lazy.tsx`, `docs/status.md` |
| 7 | DQ-426 A | The Guide line "A deprecated skill is read-only; "Make active again" in its banner ..." does not name "Remove from bots" | The Guide names "Make active again", "Remove from bots" (hidden when no bot uses the skill; `skills-page.md` §10.2) and "Show deprecated" | `seed/skills/using-the-app/SKILL.md` |

Not claimed, and not in this PR:

- The after-save cards (`after-save-cards.tsx:223`, `skills-page.md:210`) use the same old reason
  "The bots did not load. Try again first.". The owner's answer 5 names the dialogs of
  `skill-dialogs.tsx` only. I keep the cards as they are and write a ledger row (a question for
  the owner: same text for the cards?).
- Error screens outside the Skills page keep their `h1`.
- A route-level `notFoundComponent` for an unknown address below `/skills` (for example
  `/skills/a/b`) is not changed.

## 2. Test strategy (one red test for each behaviour change)

Rules: each test is written first and shown red on `aa85cb9`, then green after the fix. I record
each red run. No test is disabled or deleted. The two existing tests that read an old text change
their expected text in the same commit as the code (they are the red tests of items 5).

| Item | Test (file) | Case | Red before the fix because |
| --- | --- | --- | --- |
| 1 | `skill-history.test.tsx`, two new tests | Versions fail: `role="alert"` holds "The app could not load the versions."; **Try again** loads them again and the list shows. The same for the changes (diff). Edge case: **Try again** while the answer is slow does not show the error twice; a failed background refresh with data still shows the list (existing tests stay green) | No alert, no button |
| 2 | `roster-load-failed.test.tsx`, one new test | The roster chunk fails; take the first avatar element; a new bot list arrives (focus refetch with a third bot); the first avatar element is still in the document (`isConnected`) and no second log line | The inline component is a new type, so React mounts the avatars again and the old node is detached |
| 3 | none | Comments only. Proof: `rg` for the old cites returns nothing; a reading of `bot-page.md` headings | n/a |
| 4 | `create-bot-page.test.tsx`, one new test | Step 3 shows "You cannot add deprecated skills." and does not show "Deprecated skills are not in the list." | The old sentence is shown |
| 5 | `skill-dialogs.test.tsx:117`, expected text changed | The Deprecate dialog with a bot list that did not load: the alert says "The app could not load the bots." and the focused confirm button gives the new reason. I add the Remove from bots and the Delete dialogs to the same test if they use `botsReason` (check in the build) | The old reason is shown |
| 6 | `error-page.test.tsx`, one new test; `not-found-page.test.tsx` (new, small); `skill-page.test.tsx` and `new-skill-page.test.tsx`, one assertion each | (a) At `/skills`, the index page throws: one `h1` ("Skills") and the error screen is an `h2` with the same text and buttons. (b) `/skills/unknown`: one `h1`, "Page not found" is an `h2`. (c) The Clone page with no source: the same. (d) Outside the Skills page (a throw at `/`) the heading stays an `h1` (default). (e) The component test: `level={2}` gives an `h2`, no level gives an `h1` | Two `h1` today |
| 7 | none (a Guide sentence) | The Guide text is read by `check:index`/lint only. Proof: the seed file diff and a reading against `skills-page.md` §10.2 | n/a |

Order and timing cases: only item 2 and item 1 have any. Item 2: the node identity test is the
order case (a list change after the failure). Item 1: Try again then a second failure keeps one
alert (the `LoadError` replaces the text).

## 3. Break list (`scripts/breaks/pr-<n>.json`)

A claim for each new or changed test, each with one break that changes a value (the runner rule:
a break changes a value, it does not throw; owner, 2026-11-09). Only the late, security and
order/race tests need a break list by `AGENTS.md` and the break-list scope rule; I add a claim for
each test of the table above where a value change is clear, and write the red run for the rest.

| Claim | Test | Break (value change) |
| --- | --- | --- |
| S1 | item 2 node identity | `top-header.tsx`: use the inline `errorComponent` again |
| S2 | item 1 versions alert + Try again | `skill-history.tsx`: `onRetry` calls `versions.refetch` of another query (a no-op) |
| S3 | item 1 changes alert + Try again | same for `diff.refetch` |
| S4 | item 5 reason text | `skill-dialogs.tsx`: the old text |
| S5 | item 6 Skills page one `h1` | `skill-page.tsx`: `level={1}` |
| S6 | item 6 error screen in the Skills page | `skills.lazy.tsx`: remove the `errorComponent` |
| S7 | item 4 note text | `create-bot-steps.tsx`: the old sentence |

The full `pnpm check:breaks scripts/breaks/pr-<n>.json` runs before the push with the TMPDIR line
of the chief (outside every git repository). 0 problems is the bar. No test change is pushed
before the runner checked it.

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
  which bots use this skill. Try again first."; #123 UI-3 A: heading level).
- Scope: the owner's answers of 2026-11-18 (DQ-500 C, DQ-485 C, DQ-426 A).
- No migration, no dependency, no public API change, no security code.

## 6. Open questions

None for the owner. Question for the chief: the after-save cards keep the old reason text (see
section 1, "Not claimed"). I plan a ledger row, not a fix.
