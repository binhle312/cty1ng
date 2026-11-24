# P3 PR K: frontend cleanup with the same texts and screens

Brief: p3 list item 68 (list PR 21), `docs/status.md:94` on `origin/main` (`97221d3`): "Frontend
cleanup with the same texts and screens" (repository review of 2026-11-10, #94).
Checkpoint: none (a refactor inside existing modules; no shared state, no new module boundary, no
new screen or text).
Approval: lead agent, 2026-11-15, under the owner's order of 2026-11-14 (P3 questions to consultants); accepted by the owner, 2026-11-15. Revision 1. Decisions: Q1 B, Q2 A, Q3 A (§7)

## 1. The item, checked on `origin/main` (`97221d3`)

| # | Part | Place on `origin/main` | State |
| --- | --- | --- | --- |
| 1 | `changesLine` has no caller | `frontend/src/features/skills/skill-form.ts:108`; the same text inline in `skills/save-bar.tsx:83` and `bots/bot-save-bar.tsx:51-53` | still there (`grep -rn changesLine frontend/src`: one hit, the definition) |
| 2 | The skill tab list is written three times | `skills/skill-page.tsx:76` (`TabName`), `skill-page.tsx:457` (the `onValueChange` chain), `routes/skills.tsx:41` (`z.enum([...])`) and `:46` (`SkillTab`, no user) | still there |
| 3 | Two `plural` helpers | `skills/import-page.tsx:217` `plural(n, word)`, `bots/bot-lines.ts:86` `plural(n, one, many)` (only caller `countText`) | still there |
| 4 | `bar-two.tsx` copies the style of `MenuItem` | `features/shell/bar-two.tsx:39-48`: `BaseMenu.Item` with the class string of `ITEM` (`components/ui/menu.tsx:42`) less `relative` | still there |
| 5 | Two links use `?tab=profile` | `bots/create-bot-page.tsx:398`, `shell/header-bot-card.tsx:40` | still there. The spec (`docs/design/components/bot-page.md` §URLs, line 19) and the route (`routes/bots.tsx:30`, "Profile has no `tab`") say Profile is `/bots/{slug}` with no `tab`; the bot page's own `setTab` writes no `tab` for Profile (`bot-page.tsx:248`). An e2e line asserts the old URL: `frontend/test/e2e/journey-first-use.spec.ts:60` (`\?tab=profile$`) |
| 6 | About 50 exports with no user outside their file | measured: 51 with no user in another file, 11 more with users only in tests (script below) | still there |

Count script (no new dependency, a word match, so the counts are a lower bound):
`python3 -I /home/binh/projects/personal/cty1ng/tmp/worktrees/frontend-cleanup/scratch/unused-exports.py --list`
on `97221d3` printed `no user in another file: 51`, `users only in test files: 11`. The script stays
out of the repository (no new script to own); its command and list go into the Follow-ups line.

## 2. What each part does

| # | Change | Files |
| --- | --- | --- |
| 1 | Option B (recommended, Q1): move `changesLine` from `skill-form.ts` to `skills/save-bar.tsx` next to `SaveBarFrame` (the bot bar already imports `SaveBarFrame` and `SaveButton` from that file); both save bars call it. Option A: delete it; the two inline copies stay | `skills/skill-form.ts`, `skills/save-bar.tsx`, `bots/bot-save-bar.tsx`, `skills/README.md` row of `save-bar.tsx` if its "for" text changes |
| 2 | New `features/skills/skill-tabs.ts` with `SKILL_TABS` and `SkillTab`, the same shape as `bots/bot-tabs.ts`. `routes/skills.tsx` uses `z.enum(SKILL_TABS)` and drops its `SkillTab` export; `skill-page.tsx` uses `SkillTab` and `SKILL_TABS.find((name) => name === value) ?? "skill"` (the form of `bot-page.tsx:313`) | `skills/skill-tabs.ts` (new), `skills/skill-page.tsx`, `routes/skills.tsx`, `skills/README.md` (one row) |
| 3 | New `frontend/src/lib/plural.ts`: `plural(n, one, many = \`${one}s\`)`. `import-page.tsx` and `bot-lines.ts` (`countText`) import it; both local copies go. The ~10 inline copies (`export-card.tsx:30,79`, `skill-dialogs.tsx:23`, `skill-history.tsx:202`, `import-page.tsx:125,205`, …) stay: Follow-ups line | `lib/plural.ts` (new), `lib/plural.test.ts` (new), `lib/README.md` (one row), `skills/import-page.tsx`, `bots/bot-lines.ts` |
| 4 | `bar-two.tsx` uses `MenuItem` from `components/ui/menu.tsx`; the import of `@base-ui/react/menu` goes | `shell/bar-two.tsx` |
| 5 | Option A (recommended, Q2): remove `search: { tab: "profile" }` from both links, so the URL is `/bots/{slug}` as the spec says; change the e2e line to `/bots/ba-${tag}$`. Option B: leave both links; Follow-ups line | `bots/create-bot-page.tsx`, `shell/header-bot-card.tsx`, `test/e2e/journey-first-use.spec.ts` |
| 6 | Not built: a Follow-ups line with the count, the script command and the list. Reason: 51 names in about 35 files, two of them in files that #116/#117 change (`skill-history.tsx:25` `comparePair`), and a removed `export` can make a now-unused local (tsc `noUnusedLocals`) that needs a delete, so it is not a trivial change. `changesLine`, `SkillSearch`, `SkillTab` leave the list through parts 1 and 2 | none (Follow-ups line in the PR description; `docs/status.md` only in the records turn) |

## 3. Overlap with #116 (`fix-bots-pages`) and #117 (`fix-skills-pages-small`)

`git diff --stat origin/main...origin/fix-bots-pages` and `...origin/fix-skills-pages-small` on
2026-11-15. Files that this PR and an open page PR both change:

| File | Other PR | Lines of the other PR | This PR | Conflict |
| --- | --- | --- | --- | --- |
| `frontend/src/features/bots/create-bot-page.tsx` | #116 | hunks at 377-383 and 405-416 (and 583, 602) | line 398 only (part 5) | none expected: 398 is outside both hunks and their 3-line context |
| `docs/plans/README.md` | #116, #117 | one table row each | one table row | yes, trivial (three rows at the table end); solved at this PR's rebase, its own work |

No other file of this PR is in #116 or #117 (`skill-page.tsx`, `save-bar.tsx`, `skill-form.ts`,
`import-page.tsx`, `skills/README.md`, `bot-save-bar.tsx`, `bot-lines.ts`, `routes/skills.tsx`,
`bar-two.tsx`, `header-bot-card.tsx`, `lib/*`, the e2e journey spec: none in either diff).
#117 changes `skill-page.test.tsx`: the new skill-tab test goes into a new file
(`skills/skill-tabs.test.tsx`) so that it does not touch that file. No part is cut for overlap.

## 4. Test strategy (a refactor: tests that prove "same behaviour")

No break list (a refactor, not a late test, a security or an order test; `docs/testing.md` §5).
New tests are written first and run green on `origin/main` before the change (they pin today's
behaviour), then stay green after it. Part 5 option A is the one behaviour change: its tests go red
first on the old code (recorded red run).

| # | Existing tests that cover it | New test (only where none covers it) |
| --- | --- | --- |
| 1 | `skill-page-orders.test.tsx:98,239,255` ("1 change not saved", skill bar), `bot-page.test.tsx:347…` ("1 change not saved") and `:1720` ("2 changes not saved", bot bar) | none for the bars. With option B, the many-branch of the skill bar has no test today; the bot test at `:1720` covers the shared function. No new test |
| 2 | `skill-page-orders.test.tsx:990` (`search` = `{ tab: "history" }`), `skill-page.test.tsx:277,319` (open on `?tab=bots`), e2e `skills.spec.ts:119,439,470` | `skills/skill-tabs.test.tsx`: on the skill page, a click on each tab writes the URL (`Skill` → no `tab`, `Bots` → `tab: "bots"`, `History` → `tab: "history"`), and `?tab=nope` opens the Skill tab. Green on `origin/main` first |
| 3 | e2e `skills.spec.ts:438` and `offline.spec.ts:261` ("0 new skills, 1 new version") | `lib/plural.test.ts`: 0, 1, 2 with the default plural, and an explicit `many`. `countText` (not covered today) stays in `bot-lines.ts`: a new `bots/bot-lines.test.ts` checks 0, 1, 2. `bot-lines.test.ts` runs green on `origin/main` first; `plural.test.ts` comes with the new file (the import page's words stay pinned by the two e2e lines) |
| 4 | `bar-two-state.test.tsx:40` (the menu item "Hide bar" hides the bar) | none |
| 5 | e2e `journey-first-use.spec.ts:60` (after Create; its line changes with option A) | `shell/header-bot-card.test.tsx` (or a case in `header-bot-list.test.tsx`, which renders the card): the settings link's `href` is `/bots/{slug}` and it opens in a new tab. Red on `origin/main` (it has `?tab=profile`) with option A |

Each part commit runs its target test files only (the heavy slot rule); the full commands run once
at the end in the lead agent's heavy slot; `pnpm e2e` once with the e2e slot.

## 5. Risks

- Part 4: `MenuItem` adds the class `relative` to the "Hide bar" item. It has no `absolute` child,
  so the look should be the same; not proved by a screenshot. `Not claimed` line: "no UI change"
  is not exact for that one class.
- Part 5 option A changes the URL that the owner sees after Create and in the header link (to the
  spec's URL). The screen is the same (Profile tab). It goes under `Needs human review`.
- Part 2: `routes/skills.tsx` imports a feature file, as `routes/bots.tsx` does with `bot-tabs.ts`
  (same pattern; `pnpm lint:imports` checks it).
- Rebase after #116/#117: only `docs/plans/README.md` is expected to conflict.

## 6. Guide

Guide: not changed (no owner-visible page, text or action changes; the Guide has no `?tab=` text:
`grep -n "tab=" seed/skills/using-the-app/SKILL.md` prints nothing).

## 7. Questions and answers (lead agent, 2026-11-15)

Q1, part 1. A: delete `changesLine` (one line less; the text stays in two places, so the review's
"same text written twice" stays). B: move it next to `SaveBarFrame` and call it from both bars (one
home for "N changes not saved"; three files). Recommend B: it is the point of the item. **Answer: B.**

Q2, part 5. A: drop `tab: "profile"` from both links (URL as the spec; one e2e line changes; a URL
change under `Needs human review`). B: leave it, Follow-ups line (zero risk; the code keeps two URLs
for one tab). Recommend A: the spec and the route comment already say "no `tab`", so the code moves
to the doc, and a draft PR keeps the owner's decision. **Answer: A**; the URL change goes under
`Needs human review`, and the header-bot-card test gets its red run on `origin/main`.
The owner approved the URL change on 2026-11-15 ("122-A: A (approve)").

Q3, part 6. A: Follow-ups line with the list (recommended, reasons in §2). B: remove `export` from
the 51 names in this PR. **Answer: A** (the Follow-ups line has the counts 51 and 11 and the list).

## 8. Build notes (2026-11-15)

- Part 3: the helper is `plural(n, word)`, not `plural(n, one, many)`. The lint limit is two
  parameters (`@typescript-eslint/max-params`), and both callers only add an "s". The old
  `max-params` suppression of `bot-lines.ts` in `eslint-suppressions.json` goes with its copy.
  So `lib/plural.test.ts` has no case for an explicit plural word.
- Part 1: the `save-bar.tsx` row of `features/skills/README.md` names the new line.
