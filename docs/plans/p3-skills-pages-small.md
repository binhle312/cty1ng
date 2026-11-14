# P3 PR 15: Skills pages, small fixes

Brief: the P3 list before M3 (`p3-list-2026-11-12.md`, outside the repository), part 2, items 57 to 64; part 5, PR 15
Checkpoint: none (P3 list PR; item 61 reuses an existing UI pattern, see "Fix per item")
Approval: chief agent, 2026-11-15, under the owner's order of 2026-11-14 (P3 questions to consultants); owner review pending. Revision 1. Decisions: Q1 A, Q2 A (test a ZWJ emoji, a flag and a lone-surrogate case), Q3 A

## Items on `origin/main` (`97221d3`)

| # | Item | Place on `97221d3` | State, how I know |
| --- | --- | --- | --- |
| 57 | The skill Clone cuts the name with a cached limit (DQ-090) | `new-skill-page.tsx:69-71` (wait ends on `!settings.isPending`), `:179` (`copyName(…, settings.limits.nameMax)`) | still there. read: with cached settings, `isPending` is false at once, so the editor opens and cuts the name before this visit's settings answer |
| 58 | Skill Clone can split an emoji | `shared/src/skills.ts:144` (`copyName`, `slice`) | still there. ran: `copyName("aaaa😀", 12)` gives `"aaaa\ud83d (copy)"`, not well formed |
| 59 | A failed background refresh replaces the History tab | `skill-history.tsx:80` (versions), `:270` (diff): `isError` is checked before the data | still there. read |
| 60 | The Skills index page shows the load error when a background refresh fails | `skills-index-page.tsx:15` | still there. read: the empty state ("No skills yet") is the only state that stays on screen with data, so it is the case that fails |
| 61 | "Close this card and try again" does not try again | `skill-dialogs.tsx:50`, `:58`; `skill-bot-uses.ts:25` (`retry` exists, no caller in the dialogs) | still there. read: the bot list query stays in its error; closing and opening the card starts no read |
| 62 | The Export card counts a skill that left the list | `export-card.tsx:74` (`picked.size`), `:75` (`allPicked`) | still there. read: a picked id of a skill that left `skills` still counts ("Export 3 skills", "3 of 2") |
| 63 | The open folds of a diff stay open when the pair changes | `skill-history.tsx:279`, `:283` (no `key` on `DiffView`); fold key = line index (`diff-fold.ts`) | still there. read |
| 64 | `aria-label` with no role | `skill-list.tsx:169` (`<span aria-label="Unsaved changes">`), `diff-view.tsx:14` (`<div aria-label>`) | still there. read |

The spec already has the rule of 59 and 60: "A failed background refresh keeps the list and the
editor on the data they have" (`docs/design/components/skills-page.md:492`).

## Fix per item

- **57**: `ClonePage` waits for this visit's settings answer: `settings.isFetchedAfterMount`
  (success or failure; it cannot go back to false, so the wait ends once, as
  `frontend-conventions.md` §5 says) in place of `!settings.isPending`. After a failed read the
  editor opens as now (cached limit or no limit; the form checks against the same value).
- **58**: `copyName` cuts at a grapheme boundary with `Intl.Segmenter` (in lib ES2023; Node and
  the browsers have it): it adds whole graphemes while the UTF-16 `.length` stays
  `<= nameMax - 7`, then `trimEnd`, then " (copy)". So `.length <= nameMax` (the server rule,
  `skills.ts:75`, `skill-import.service.ts:200`) holds, and no surrogate pair, ZWJ sequence or
  flag is split.
- **59**: versions and diff show the error only when there is no data
  (`data === undefined && isError`); a failed refresh keeps the list and the diff. No new text.
- **60**: the same order in `SkillsIndexPage`: data first, then error, then skeleton.
- **61**: the dialogs take the pattern of the bot cards (skills-page.md §2a, line ~204):
  "The app could not load the bots." with **Try again** (`LoadError`, calls `bots.retry`), and the
  "why off" reason "The bots did not load. Try again first.". Both texts exist in the app today
  (`after-save-cards.tsx:205`, `:223`). Change `skills-page.md:529` to that reason. See Open question 1.
- **62**: count only the picked skills that are in `skills`
  (`skills.filter(s => picked.has(s.id)).length`); `allPicked` uses that count.
- **63**: `key={`${from}-${to}`}` on each `DiffView` element in `DiffPanel` (not on `DiffPanel`, so
  the Restore state `restoredTo` and the Restore lines of PR 14 do not change).
- **64**: the dot gets `role="img"` (keeps `aria-label="Unsaved changes"`); the diff `div` gets
  `role="group"`. No class or layout change.

## Files

`frontend/src/features/skills/`: `new-skill-page.tsx`, `skill-history.tsx`,
`skills-index-page.tsx`, `skill-dialogs.tsx`, `export-card.tsx`, `diff-view.tsx`,
`skill-list.tsx`; tests: `new-skill-page.test.tsx`, `skill-dialogs.test.tsx` (`:117` reason
text), new `skill-history.test.tsx`, new `skills-index-page.test.tsx`, new `export-card.test.tsx`,
and `skill-page.test.tsx` (one wiring test for 61, 64 dot) if needed. `shared/src/skills.ts`
(`copyName`) and `skills.test.ts`. `docs/design/components/skills-page.md` (line 529; line 492 names
the History tab and the index page), `seed/skills/using-the-app/SKILL.md` (near lines 41-43),
`docs/plans/p3-skills-pages-small.md` and its row in `docs/plans/README.md`,
`scripts/breaks/pr-<n>.json`. No backend, no API, no migration, no new dependency.

## Test strategy (each test first; red run on `97221d3` code recorded)

| Item | Test (level) | Red on the old code? |
| --- | --- | --- |
| 57 | `new-skill-page.test.tsx`: a first visit caches settings (name limit 64); the server limit is now 20; the settings answer of the Clone visit is held until the source has answered; after it answers, the name field is `<= 20` and ends " (copy)" (component, renderApp, `heldAnswer`) | yes: name cut at 64 |
| 57 | order: while the settings answer waits, the editor is not open (skeleton) | yes |
| 57 | order: the settings refresh fails: the editor opens, name cut and checked with the same limit, no over-limit error | guard (passes on old code; not a claim) |
| 58 | `skills.test.ts`: `copyName("aaaa😀", 12)` has no lone surrogate and `.length <= 12` | yes |
| 58 | `copyName("ab👨‍👩‍👧", 12)` and a flag case: no part of a grapheme stays | yes |
| 58 | each result `.length <= nameMax` for a table of names (ASCII, accents, emoji at the cut) | guard |
| 59 | `skill-history.test.tsx`: versions shown, a refresh of the versions fails: the list stays, no "could not load the versions" (renderApp, `queryClient.refetchQueries`) | yes |
| 59 | the diff shown, a refresh of the diff fails: the diff stays | yes |
| 59 | order: a slow refresh keeps the list (no skeleton) | guard |
| 59 | order: a failed refresh, then a good refresh: the new list shows | guard |
| 59 | the first load fails: the error text shows (no data) | guard |
| 60 | `skills-index-page.test.tsx`: the empty state, a refresh fails: "No skills yet" stays, no alert | yes |
| 60 | order: a slow refresh keeps the empty state; a refresh with a skill opens that skill; a first load that fails shows the alert with Try again | guard |
| 61 | `skill-dialogs.test.tsx`: each of the three dialogs (Deprecate, Remove from bots, Delete) with `bots.kind === "error"` shows Try again; a click calls `retry` | yes (no button) |
| 61 | the reason text is "The bots did not load. Try again first." (`:117` updated) | yes |
| 61 | wiring (`skill-page.test.tsx` or `skill-page-orders.test.tsx` not touched; a new describe in `skill-page.test.tsx`): bots fail, the Delete dialog opens, Try again, the bots answer: the list shows | yes |
| 61 | order: Try again fails again: the error and Try again stay | guard |
| 62 | `export-card.test.tsx`: card open with 3 skills, the list changes to 2: label "Export 2 skills", "2 of 2", Select all ticked, the request sends 2 ids | yes |
| 63 | `skill-history.test.tsx`: a fold opened in the diff of one pair, the pair changes to one whose diff has a fold at the same line: that fold is closed | yes |
| 64 | `getByRole("img", { name: "Unsaved changes" })`; `getByRole("group", { name: "Body changes" })` | yes |

Edge case table (testing.md §3) for the changed screens: "a request fails" and "the refresh after a
change is slow or fails" are the item tests above; "another tab": the Export card test (a skill
leaves the list); the rest do not apply (no save, no unsaved work in these parts), with the reason
in the PR.

Break list (testing.md §5, owner 2026-11-09): only for the order tests (59, 60, 57's held answer).
Each other new test records its red run on the old code; those go to `exempt` with that reason.

## Risks

- `skill-history.tsx`, `skill-dialogs.tsx`, `skill-page.test.tsx` are shared with PR 14 (not built
  tonight). I change only the lines of items 59, 61, 63; no Restore or Delete line.
- 57: a Clone with cached settings now shows the skeleton until the settings answer (one short read).
- 61 adds a button in three dialogs: a UI change from an existing pattern; flagged.

## Open questions and the answers (chief v4, 2026-11-15 02:3x: A, A, A)

1. Item 61. A (recommended): Try again in the card + reason "Try again first." (both texts exist; the
   pattern of the bot cards §2a; one doc line changes; flagged under Needs human review).
   B: no UI change: the card starts a new read when it opens while the bots are in error, so
   "Close this card and try again" becomes true. Gain: no change of text or UI. Cost: the retry is
   hidden; the owner needs two steps. C: owner decides; the other 7 items go on.
2. Item 58. A (recommended): grapheme cut (`Intl.Segmenter`). B: surrogate pair only (smaller; a
   ZWJ emoji or a flag can still change at the cut).
3. Item 64. A (recommended): `role="img"` on the dot, `role="group"` on the diff. B: replace the
   dot's `aria-label` with `sr-only` text.
