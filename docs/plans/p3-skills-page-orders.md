# P3 PR 14: old answers on the skills pages

Brief: P3 list of 2026-11-12, items 51 to 56 (PR 14); the owner asked for a plan and a state table before code (P3 list part 9)
Checkpoint: plan (code design and state table, owner, 2026-11-12)
Approval: accepted by the owner, 2026-11-15 ("P-14: approve"), revision 2 (owner answers of 2026-11-15 12:15). The open questions take the plan's recommendations: Q1 = B (one pure module `skill-edit-state.ts`; the chief agent's reading of "approve", owner review pending), Q2 = A (Discard is off while a Save waits, tooltip "Saving."; approved by the owner, 2026-11-18, "UI-4: A"); the second Restore after a tab change is in scope.

Code read at `origin/main` = `97221d3` (#106 merged). Each defect is still there. The line
numbers moved since the P3 list (`ec41c39`). I read the code; I did not run the wrong behaviour.
An independent reviewer checked each file:line below.

| # | DQ | Today (file:line at `97221d3`) | State |
| --- | --- | --- | --- |
| 51 | DQ-070 | `import-page.tsx:111-115`: `leave()` calls `clearImportFile()` with no check of the file; `skills-layout.tsx:23-25` clears any file | still there |
| 52 | DQ-071 | `skill-page.tsx:212-215`: `changes` compares with `form.saved` only; `:227-230` the leave guard reads it; `save-bar.tsx:70-76` says "All changes are saved." | still there |
| 53 | DQ-072 | `skill-page.tsx:521-527`: Discard uses `saved` (from the `skill` prop) and `setBase(server)`, so the base can go down. `discard()` in `skill-form.ts:82` is not used | still there |
| 54 | DQ-073 | `skill-page.tsx:442`: `pending={undeprecate.isPending}` ends at the answer, not at the refresh; `skill-history.tsx:225`: `restoredTo` is state of `DiffPanel`, and a tab change unmounts the panel | still there |
| 55 | DQ-077 | `skill-history.tsx:228-233`: the answer calls `onRestored()`, which sets the pair to the newest (`:132-134`). `onPage` checks only that the panel is mounted | still there |
| 56 | DQ-081 | `skill-page.tsx:363-395`, `:582`, `:586`: the dialog reads `trash.isPending` of this visit. `:90` already reads the query client (`useIsMutating`) | still there |

Found by this plan, same cause as 54: a Restore on its way, then a tab change and back, gives a
new panel whose `restore.isPending` is false, so a second Restore can go
(`skill-history.tsx:256-259`). Not in the ledger. I put it in this PR.

## 1. Code design

State owners today: `SkillView` holds `form`, `base`, `taken` as React state; the query client
holds the Delete wait (DQ-069); `DiffPanel` holds `restoredTo`. `frontend-conventions.md` §1
says a screen with late answers keeps its rules in one pure `<screen>-state.ts`, and the
component holds no extra flags. The skill editor does not follow that rule today. The bot page
does (`features/bots/bot-edit-state.ts`, `bot-edit-sequences.test.ts`).

**Editor state (items 52, 53): Q1.**

| Option | What | Cost |
| --- | --- | --- |
| A. Targeted | Pure helpers in `skill-form.ts` (`sending`, `discardTo()`); the state stays in `SkillView` | M, about 5 files. **An exception to §1**: one more flag (`sending`) in the component. It needs a ledger row as recorded debt. The every-order tests of §3 cannot run, because the transitions are in React |
| B. Pure editor module (recommended) | New `skill-edit-state.ts`: a reducer of `form`, `base`, `taken`, the sent text and the save error, with the events typed, Save sent, Save answered, Save failed, data came, Discard; `editView()` gives the change count, the conflict and the reason that Save is off. `SkillView` sends events and renders | L. Measured size of the bot page model: 448 lines of module, 595 of cell tests, 545 of sequence tests. The skill editor has one tab and four fields, so I expect about half. The 46 tests in `skill-page-orders.test.tsx` stay and guard the move |
| C. One module for the whole page | B plus the request waits | Rejected: it copies the wait that the query client already holds (DQ-069, the owner's redesign) |

**Request waits (items 51, 54, 55, 56): the same in A and B.** The query client holds them, as
it holds the Delete wait. That is the state owner, not a flag in the component.

- **Make active again: the Delete pattern** (`skill-page.tsx:366-382`). It gets a mutation key
  per skill. Its `onSuccess` awaits `refreshQueries()` of the skill queries, so `useIsMutating`
  covers the request **and** its refresh, also after a leave and a return. `refreshQueries`
  also ends when the refresh fails (`lib/api/query-reads.ts:46-58`).
  - The other option was a cached answer (`useMutationState`) compared by `row_version`. It
    needs a version check, a 5-minute cache timer and a probe. The Delete pattern needs none of
    them, and it cannot keep the button off after a new Deprecate.
- **Restore: the Delete pattern too**, plus one check. The Restore request sends no
  `row_version`, so after a failed refresh a second click would save one more version (the
  DQ-076 case). The panel keeps the rule "no Restore until the data shows the restored
  version". It reads that version from the succeeded Restore answers in the query client
  (`useMutationState`, `latest >= restoredTo`), not from `DiffPanel` state, so the rule
  survives a tab change and a return. Versions only go up, so an old answer cannot hide a newer
  offer. That mutation gets `gcTime: Infinity`: no hidden 5-minute timer (`AGENTS.md` §10).
  This is a rule ("until the data shows it"), not a setting.
- **Restore answer:** it remembers the pair it was sent from. It moves the History tab only if
  the URL still shows that pair, read from the router at the answer, not from the render.
- **Delete:** the dialog reads `useIsMutating` (as `:90` does), not `trash.isPending`.
- **Import:** `clearImportFile(file)` clears only the file it was given.

Same-cause search (`AGENTS.md` §9): I searched `docs/delivery-quality.md` and its archive for
"skill", "Restore", "Discard", "Delete", "Import". The related fixed rows are DQ-069, DQ-074,
DQ-076, DQ-078 and DQ-080 (archive). The request-wait fixes use their designs. DQ-013 (`partial`:
rules in React refs, no pure module) has the same cause as option A's exception. That is a
reason for B.

Failure paths: a failed refresh ends the Make active wait. The button turns on with old data; a
click sends the old `row_version`; the server refuses it (`stale_write`); the toast shows.
After a failed refresh, Restore stays hidden until a read shows the new version or the browser
reloads. The server state wins in both cases.

## 2. State table

Events: **sent**, **answer** (late), **leave** (and come back), **edit** (type or pick again),
**refresh** (the data comes), **refresh fails**. "Must win" is what the page shows and keeps.

**51 Import Apply (DQ-070).** State: Apply of file A on its way.

| Event | Today | Must win |
| --- | --- | --- |
| answer, the preview of A on screen | toast, clear A, go to `/skills` | the same |
| leave, then answer | toast, clear A, stay | the same |
| owner picks file B, then answer of A | B's preview is cleared | toast; B stays |
| owner picks B, then A fails | toast | the same; B stays |
| a second Apply | not possible: Apply is off ("Saving."), a new file makes a new preview | — |

**52 Save, text typed back (DQ-071).** State: Save on its way (sent S, saved O, S ≠ O).

| Event | Today | Must win |
| --- | --- | --- |
| edit: text back to O | "All changes are saved."; leave asks nothing | "1 change not saved"; Save off ("Saving."); leave asks |
| no typing (text is S) | "1 change not saved" | the same |
| refresh with the Save's own version | text stays (row 1a) | the same |
| answer: success | O is a change (row 1a) | the same |
| answer: failure | toast | the same; "All changes are saved." |

**53 Discard (DQ-072).** States: (a) Save on its way; (b) Save answered, refresh not come;
(c) conflict: the server is newer than the base.

| State | Event | Today | Must win |
| --- | --- | --- | --- |
| b | Discard | the older text; the base goes down | the text of this Save; the base stays |
| b | Discard, edit, then refresh | false conflict, Save off | no conflict |
| b | Discard, refresh fails, then Save | sends an old base: `stale_write` | sends the base of this Save |
| c | Discard | the server text; base = server | the same |
| a | Discard | old text; after the answer "1 change not saved" | Q2 |

**54 Make active again (DQ-073, part 1).** States: on its way; answered, refresh on its way.

| State | Event | Today | Must win |
| --- | --- | --- | --- |
| on its way | click | off | off |
| on its way | leave, come back, click | on: a second request | off |
| answered | click | on: a second request, a false toast | off until the refresh ends |
| answered | refresh shows the skill active | the banner goes | the same |
| answered | refresh fails | on | on; a click gets `stale_write` and the toast |
| refreshed | deprecated again (here or in another tab) soon after | on | on: no old answer is read |
| on its way | answer: failure | toast, on | the same |

**54 and 55 Restore (DQ-073 part 2, DQ-077).** States: Restore of vK on its way; answered,
refresh on its way; answered, refresh failed.

| State | Event | Today | Must win |
| --- | --- | --- | --- |
| on its way | tab change and back, click | a second Restore (found by this plan) | off |
| answered | tab change and back | "Restore vK" with old data (DQ-076 again) | off until the refresh ends |
| refresh failed | tab change and back, or leave and come back | the offer is back | no Restore until a read shows the new version |
| on its way | edit: pick another pair, then answer | the pick goes back to the newest | the pick stays; toast |
| on its way | leave, or another tab | no move (existing tests) | the same |
| on its way | answer: failure | toast | the same |

**56 Delete on a return visit (DQ-081).** State: Delete of visit 1 on its way.

| Event | Today | Must win |
| --- | --- | --- |
| visit 2 opens Delete and confirms | a second request; a false "does not exist" toast | Delete skill off, "Deleting the skill." (an existing text); no request |
| answer while the dialog of visit 2 is open | moves to `/skills`, toast | the same |
| visit 1 fails while the dialog of visit 2 is open | toast | toast; the button turns on |
| a live event removes the skill first | wait, then move (row 3) | the same |

## 3. Test strategy (before code)

Red first: each new test fails on `main`, and the PR records the red run. These are order tests,
so the PR has a break list `scripts/breaks/pr-<n>.json` (`testing.md` §5). Each test name makes
one claim, and each claim has one break. Example breaks: remove the file check in
`clearImportFile`; read `trash.isPending` again; end the Make active wait at the answer.

**Every order (`testing.md` §3, "State table cells"), option B only.** A new
`skill-edit-sequences.test.ts` uses the drivers in `test/sequences.ts`, as
`bot-edit-sequences.test.ts` does: every order of a small set of events, and random orders from
a seed. The events are type an edit, type the text back, Save sent, its answer (success or
failure), a refresh with the Save's own version, a refresh with a newer version from another
place, and Discard (not while a Save waits, if Q2 is A). Checks after each step:
1. An edit that the owner dropped (Discard) never comes back.
2. An older answer or older data never replaces a newer value; the base never goes down.
3. Save is off while a conflict shows.
4. "All changes are saved." shows only when the text equals the newest saved text and no Save
   waits.
5. The leave question is on whenever check 4 is false.

After all requests end and a last load comes: the editor shows the server text, or the owner's
edit with the conflict.

| Behaviour | Level | Order and timing cases |
| --- | --- | --- |
| Editor rules, tables 52, 53 | unit: one test per cell (B: `skill-edit-state.test.ts`; A: `skill-form.test.ts`) | text back to O; text equal to S; conflict; own Save not refreshed |
| 51 | component, `skill-page-orders.test.tsx` "Import Apply" | held Apply answer; pick B; answer of A succeeds, then fails |
| 52 | component | held Save; type back; refresh first; answer success and failure; the leave question opens |
| 53 | component | held refresh after a Save: Discard, edit, refresh; refresh fails, then Save sends the newest base |
| 54 | component | held answer: leave and come back; held refresh after the answer: click; refresh fails, then click; Deprecate again after the refresh: on |
| 54, 55 Restore | component | held answer: tab change and back (no second request); held refresh: tab change and back; failed refresh: leave and come back (no offer); pick another pair, then answer |
| 56 | component | held Delete: leave, come back, confirm (one request); answer while the second dialog is open; failure while it is open |
| Two requests on one screen | component | Make active and a Save both wait, both orders (an existing test covers one) |

The table rows cover the six cases of `testing.md` §3 "Request order". All component tests hold
answers with `heldAnswer` and use the real router, store and query client. No e2e test: the
orders need held answers.

Risk probe (`planning.md`, "Risk probes first"): `useMutationState` is not used in
`frontend/src` yet. A scratch test with TanStack Query 5.107.1 checks that the key and status
filter finds the answer, that the answer stays after the component unmounts, and that
`gcTime: Infinity` keeps it for longer than 5 minutes under fake timers.

## 4. Files and records

`skill-page.tsx`, `skill-history.tsx`, `import-page.tsx`, `skills-layout.tsx`,
`skills-context.tsx`, `skill-form.ts`, with option B `skill-edit-state.ts`, and their tests.
After approval, `skills-page.md` gets the rules of §5, §10.2, §11 and §13, and this table.
`frontend-conventions.md` §1 adds the skill editor to its list of modules (B), or records the
exception (A). `docs/delivery-quality.md` gets rows for DQ-070, 071, 072, 073, 077 and 081, and
one for the second Restore. Also `docs/status.md`, and the folder `README.md`. The Guide skill
changes only if Q2 changes Discard.

## 5. Open questions

**Q1. The editor state: A, B or C (§1)?** Example: a Save waits, you type the text back, and a
refresh comes. Today `SkillView` decides this with React state; B moves the rule to one pure
module that every-order tests can check. I recommend **B**. It follows §1 as the bot page does,
and it makes the every-order tests possible. A is smaller, but it adds to the debt of DQ-013.

**Q2. What does Discard do while a Save waits?** Example: you click Save, then Discard before
the answer. The Save writes your text on the server anyway.

| Option | Gain | Cost and risk |
| --- | --- | --- |
| A. Discard is off while a Save waits; tooltip "Saving." (an existing text) | One state less; no wrong text after the answer | A visible change; the test "says when a Save fails after Discard" changes to "Discard is off while a Save waits" |
| B. Discard waits: after the answer the editor shows the saved text (S on success, O on failure) | Discard always ends on the saved text | One more state ("discarded, waiting"); more tests |
| C. Discard acts as "type the text back" (table 52) | No new state | After a success the editor shows O as "1 change not saved", as today |

I recommend A. A Save on `127.0.0.1` takes some milliseconds, so the owner rarely sees it.

## 6. Build record (2026-11-15, before code)

The builder's checks and test list after the approval. The plan above stays the approved design.

### 6.0 Probe and checks on `origin/main` (2026-11-15 15:05 +07)

- Every file:line of the plan table is still there at `94bc286` (same numbers as at `97221d3`):
  `import-page.tsx:111-115`, `skills-layout.tsx:23-25`, `skill-page.tsx:212-215, 227-230, 521-527, 442, 363-395, 582, 586, 90`,
  `skill-history.tsx:225-243, 256-259, 132-134`, `skill-form.ts:82` (`discard()` not used).
- Risk probe (`useMutationState`, TanStack Query 5.107.1, scratch `tmp/worktrees/skills-orders/probe/mutation-state.probe.tsx`): 3 of 3 pass.
  1. A key + `status: "success"` filter finds the answer; it stays after the sender unmounts and after all observers unmount, for 20 fake minutes with `gcTime: Infinity`; a new reader finds it.
  2. Control: with the default `gcTime`, the answer is gone 6 fake minutes after the sender unmounts.
  3. `isMutating` counts a mutation while its `onSuccess` awaits, and ends after it.
  Note: `useMutationState` updates on a notify step, so with fake timers a test must advance one timer step.
- Overlap: #117 and #122 are both MERGED into `origin/main` (heads `06dbf9e`, `568289c` are ancestors), so `git diff origin/main...origin/<branch>` is empty for both. The open PR with the same files is #123 (`fix-shell-error-boundary`): `skill-page.tsx` lines 1-2, 28-31, 110-118 (`SkillPage`, Page not found), `frontend-conventions.md` §5 table, `skills-page.md`, `skill-page.test.tsx`, the Guide. My changes are in `SkillView`, `frontend-conventions.md` §1 and other sections of `skills-page.md`; I keep away from those lines.

### 6.1 Code shape (inside the approved plan)

- `skill-edit-state.ts` (pure): state `{ server, form, base, taken, sending, saveError, changelog, left, toasts }`; events `typed`, `changelogTyped`, `saveSent`, `saveAnswered`, `saveFailed`, `serverData`, `discarded`, `baseMoved` (Deprecate and Make active answers, base only up), `left`. The `takesServerText` rule of `skill-form.ts` runs after each event. `editView()` gives the change count (fields where the text differs from the saved text, plus the fields of a Save on its way), `allSaved`, `leaveAsks`, `conflict`, the Save reason and the Discard reason ("Saving." while a Save waits).
- The store: `createToastStore` of `toast-store.ts` (exists), with a small hook in `skill-page.tsx`. No new store file.
- Make active again and Restore: the Delete pattern (mutation key per skill, `onSuccess` awaits `refreshQueries` of the skill queries, the page reads `useIsMutating`). Restore also reads the succeeded answers (`useMutationState`, `gcTime: Infinity`). The Restore move reads the router at the answer and compares with the search the click was sent from.
- Delete dialog: `useIsMutating` of `trashKey`, not `trash.isPending`.
- Import: `clearImportFile(file)` clears only that file.

### 6.2 Tests, red first

Each test name makes one claim. "Red on main" = run on `94bc286` before the code; a new module's unit tests are red because the module is missing. "Guard" = passes on main (a must-win cell that is not broken today); it still gets a break.

#### 6.2.1 Unit: `skill-edit-state.test.ts` (one test per cell)

| Id | Cell | Test name |
| --- | --- | --- |
| U1 | 52 edit back to O | counts the Save's change while it waits and the text is typed back |
| U2 | 52 edit back to O | keeps Save off with "Saving." while a Save waits |
| U3 | 52 edit back to O | asks before leaving while a Save waits and the text is typed back |
| U4 | 52 no typing | counts one change while a Save waits with its own text |
| U5 | 52 refresh, own version | keeps text typed back when the Save's own data comes first |
| U6 | 52 success | counts text typed back as a change after the Save succeeds |
| U7 | 52 failure | says all is saved after a failed Save with text typed back |
| U8 | 52 failure | asks for a toast when a Save fails with text typed back |
| U9 | 53 b | puts back the text of the answered Save on Discard |
| U10 | 53 b | keeps the base of the answered Save on Discard |
| U11 | 53 b, edit, refresh | shows no conflict after Discard, an edit and the Save's own data |
| U12 | 53 c | takes the server text and base on Discard during a conflict |
| U13 | 53 a (Q2 A) | changes nothing on Discard while a Save waits |
| U14 | 53 a (Q2 A) | gives "Saving." as the Discard reason while a Save waits |
| U15 | base up | keeps the base when a late action answer is older |

#### 6.2.2 Every order: `skill-edit-sequences.test.ts` (`test/sequences.ts` drivers)

Events: type an edit, type the text back, Save sent, its answer (success, failure), data with the Save's own version, data with a newer version from another place, Discard (only when no Save waits), a late older `baseMoved`. Checks after each step: (1) a Discarded edit never comes back; (2) older data or an older answer never replaces a newer value, the base never goes down; (3) Save is off while a conflict shows; (4) "All changes are saved." only when the text equals the newest saved text and no Save waits; (5) the leave question is on whenever (4) is false. Settled: the editor shows the server text, or the owner's edit with the conflict. `everyOrder` to a depth that runs in a few seconds (I measure it), plus `randomOrders` from a seed.
Break list: `exempt` (its invariant throws in the model's check, outside the named test; the runner would call a break INVALID, as for `bot-edit-sequences` in pr-119). The PR records hand breaks of the module, one per invariant, each run with `timeout 120`.

#### 6.2.3 Component: `skill-page-orders.test.tsx` (real router, store, query client; `heldAnswer`)

| Id | Item | Test name | On main |
| --- | --- | --- | --- |
| C1 | 51 | Import Apply: keeps file B when the Apply of file A succeeds after B was picked | red |
| C2 | 51 | Import Apply: keeps file B when the Apply of file A fails after B was picked | guard |
| C3 | 52 | says "1 change not saved" while a Save waits and the text is typed back | red |
| C4 | 52 | asks before leaving while a Save waits and the text is typed back | red |
| C5 | 53 | puts back the text of an answered Save on Discard while its refresh is slow | red |
| C6 | 53 | shows no conflict after Discard, an edit and the slow refresh of a Save | red |
| C7 | 53 | sends the base of the answered Save after Discard when the refresh fails | red |
| C8 | 53, Q2 | keeps Discard off while a Save waits (replaces "says when a Save fails after Discard") | red |
| C9 | 54 | sends no second Make active again after the owner leaves and comes back while it waits | red |
| C10 | 54 | sends no second Make active again while the refresh after its answer is on its way | red |
| C11 | 54 | turns Make active again on when the refresh after its answer fails | guard |
| C12 | 54 | turns Make active again on after a new Deprecate that comes after the refresh | guard |
| C13 | 54 found by plan | sends no second Restore after a tab change and back while the first waits | red |
| C14 | 54 | offers no Restore after a tab change and back while the refresh after the answer is on its way | red |
| C15 | 54 | offers no Restore after a failed refresh, a leave and a return | red |
| C16 | 55 | keeps the pair the owner picked when a Restore answer comes | red |
| C17 | 56 | sends no second Delete from the dialog of a return visit while the first waits | red |
| C18 | 56 | moves to /skills when the first Delete succeeds while the return visit's dialog is open | guard |
| C19 | 56 | turns Delete skill on in the return visit's dialog when the first Delete fails | guard |
| C20 | two requests | shows no conflict when a Save answer comes after a Make active answer (the other order of the existing test; renamed after review round 1: it proves no conflict, not the base) | guard |

The other must-win cells already have tests on main and stay: row 1a, the failure toasts after a leave, no Restore move after a leave or another tab, Restore and Make active failure toasts, the existing Delete rows.
Not tested by a new test: loading, error and empty states (no new query read on these screens); e2e (the orders need held answers).

### 6.3 Break list `scripts/breaks/pr-<n>.json`

One claim per U and C test, each with at least one break in the code (never in a test file). Examples: U1/C3 count only `changedFields(form)`; U13/C8 let `discarded` run while a Save waits; C1 clear any file; C9/C10 read `undeprecate.isPending`; C11 end the wait only after a good read; C12 read a cached success answer; C13 read `restore.isPending`; C14/C15 read `restoredTo` from component state; C16 move on any answer while the panel is mounted; C17 read `trash.isPending`; C19 keep the button off after any finished Delete. Each break that could loop (a render cap) runs by hand first with `timeout 120`.

### 6.4 Commits

1. Plan file `docs/plans/p3-skills-page-orders.md` + row; draft PR.
2. Import (51). 3. Editor module + wiring + Q2 (52, 53). 4. Make active (54). 5. Restore (54, 55, second Restore). 6. Delete (56). 7. Docs: `skills-page.md` rules and the state table, `frontend-conventions.md` §1 list, folder README, break list.
Guide: planned "not changed" (no Guide sentence names these controls; no new page, command, action or choice).
