# P3 PR E: Bots pages, small fixes, and the bot page Esc

Brief: items 40 to 46 of the owner's P3 list of 2026-11-12 (list PR 12 "Bots pages, small fixes" and list PR 13 "Bot page Esc"); DQ-089 and DQ-095 in [delivery-quality.md](../delivery-quality.md)
Checkpoint: none (no new screen, no code design); the Esc rule is a behaviour change, flagged for the owner
Approval: chief agent, 2026-11-15, under the owner's order of 2026-11-14 (P3 questions to consultants); owner review pending. Q13 A (Esc on the whole bot page) was decided by arena 1, not by the owner. Revision 1.

The code was read at `origin/main` = `97221d3`. "Read" means from reading the code; each item
gets a test that fails before its fix.

## 1. Item check on `origin/main` (97221d3), from reading the code (not run yet)

| Item | State | Where (file:line) | Cause I found |
| --- | --- | --- | --- |
| 40 late Delete answer moves the owner | still there | `bot-page.tsx:258-263` (`onDeleted` navigates to `/bots`), `delete-bot-dialog.tsx:33-37` (`done` calls `onDeleted` after any wait) | `useDialogRequests` keeps the request alive after the page goes (by design, for the toast). `done` then calls `onDeleted`, and the bot page's `onDeleted` navigates to `/bots` with `replace`, also when the owner is on another bot or page now |
| 41 focus the first error | still there | `create-bot-page.tsx:332-336`, `bot-page.tsx:177-180` look for `[aria-invalid='true']`; only `TextField`/`MarkdownField` (`skills/skill-fields.tsx:166,240`) and the model select (`create-bot-steps.tsx:502`) set it | No `aria-invalid` on: `NumberBox` (request limit, longest reply, history share), the effort select, the avatar style group (`avatar_id`: Upload with no image), the pin check boxes (`pins[i]`: skill in Trash). These are the fields with page-side problems that block Next, Create or Save |
| 42 Try again never shows sending | still there | `create-bot-page.tsx:380` with `:502` | `sendRequest(send)` gets the `send` object `{kind:"unknown",…}`, and `setSend({ kind: "sending", ...request })` spreads it AFTER `kind`, so `kind` stays `"unknown"`. The banner stays, Create never says "Creating" |
| 43 server error on `cloned_from_bot_id` | still there | `create-bot-form.ts:111-124` (`FIELD_STEP` has no entry), `create-bot-page.tsx:413-421` | The server sends 422 `validation_error` "The bot to copy does not exist." with `field: "cloned_from_bot_id"` (`bots.service.ts:338-345`; `byId` includes Trash, so only a purged source). `stepOfField` falls back to `basics`: step 1 gets "!", no field shows the text, and `anyServer` turns Create off until any edit |
| 44 deprecated tick shows "A skill in Trash" | still there | `create-bot-page.tsx:605-606` (rows drop deprecated skills unless copied), `:619-635` (a ticked skill with no row is called "A skill in Trash") | The list query has `include_deprecated: "true"`, so the skill is still in the list; only the row filter drops it |
| 45 Esc outside the edit form | still there | `bot-page.tsx:279-286`, handler only on `#bot-edit` (`:350`, `:391`) | A blank click focuses the tab panel or `body`, outside `#bot-edit` |
| 46 / DQ-095 | still open (`partial`) | `bot-page.tsx:281-282`, `create-bot-page.tsx:86` | Ledger row: key break and the two weak tests are recorded as fixed; `contains`, `defaultPrevented`, `retry: false` open. `render-app.tsx:20` turns retries off for every test, so no test can see the template's `retry: false` |

Probes (read in `node_modules`, not run): Base UI 1.9.0 `useDismiss` handles Esc on `document` and calls
`preventDefault()` and (for a top-level popup) `stopPropagation()`. dnd-kit `KeyboardSensor` listens on
`document`; Esc calls `preventDefault()` only (no stop). The side list Search clears on Esc with no
`preventDefault` (`bot-side-list.tsx:69`). No shell component handles Esc.

## 2. Design per item

**45 (Q13 A), the Esc design.** Replace the React `onKeyDown` on `#bot-edit` with one native `keydown`
listener on `window`, set while the Profile or Model tab is on screen (the same pattern as Ctrl+S,
`bot-page.tsx:233-245`). It asks when the tab on screen has unsaved changes, wherever the focus is
(body, tab list, save bar, side list, page top). Window is the last stop of a key press, so a dialog
that the press opens cannot see the same press: `stopPropagation()` goes away. Skips: `defaultPrevented`
(a control used the Esc: Base UI dialogs/menus/popovers/tooltips, a dnd-kit keyboard drag, the side list
Search with text), `isComposing`, `repeat`. A Base UI dialog or menu also stops the press at `document`.
`contains` goes away: the whole page is the scope now (DQ-095 part answered by removal, with this reason).

**40.** `onDeleted` in `bot-page.tsx` navigates only while this bot page is still mounted (a `mounted`
ref, the pattern of `create-bot-page.tsx:263-269`). The toast and the list refresh stay as they are.

**41.** Set `aria-invalid` on the controls of the fields above: `NumberBox` input, effort select, the
avatar style `radiogroup`, the pin check box. A small helper focuses the first `[aria-invalid='true']`
in the form, or the first focusable element inside it when it is a group (the radiogroup). Both pages
use the helper. The pin check box needs one optional prop `invalid` on the shared
`components/ui/checkbox.tsx` (passes `aria-invalid` to `BaseCheckbox.Root`): a minimal shared change (Q1).

**42.** `setSend({ kind: "sending", key: request.key, body: request.body })` (the same for the
`unknown` set in the catch).

**43.** (Q2) A 422 on `cloned_from_bot_id` shows like an error with no field: the
server's text in the line next to Create; no step "!", Create stays on. No `FIELD_STEP` entry, no
change to `fieldHead`/`stepOfField`.

**44.** The row filter keeps a deprecated skill that is ticked: its row shows its real name, version
and the existing Deprecated pill. Unticked, its row goes (as a skill in Trash does). Create still
gets the server's 422 `skill_deprecated` under the row (E3, existing; Q3).

**46 / DQ-095.** `defaultPrevented`: tests that fail without it (dnd-kit drag cancel, Search with
text). `contains`: removed by the design (reason above). `retry: false`: a test that turns the app's
retries on (`queryClient.setDefaultOptions` after `renderApp("/bots")`, then navigates to the Clone)
and checks that a template 404 shows "The app could not find the bot to copy." after exactly one
read. The parts recorded as fixed (key break, "caller left", "waits for the settings"): I add break
claims for them to the break list, so the row closes with proof of every part.

## 3. State tables

**40, Delete answer** (rows: the answer; columns: where the owner is when it comes)

| Answer | Dialog open, on this bot | Dialog closed (Cancel), on this bot (any tab) | On another bot | On another page |
| --- | --- | --- | --- | --- |
| Success | toast; go to `/bots` (unchanged) | toast; go to `/bots` (unchanged) | toast; **stays** (fix) | toast; **stays** (fix) |
| Failure | error in the dialog (unchanged) | toast with late text (unchanged) | toast (unchanged) | toast (unchanged) |

**42, Create send** (`send.kind`)

| State | Try again click | Answer 201 | Answer 422 field | Answer 5xx / network | Second click |
| --- | --- | --- | --- | --- | --- |
| unknown | → sending, same key/body (fix: today stays unknown) | — | — | — | — |
| sending | ignored (`inFlight`) | toast, open bot page | idle, form unlocks, error under field | → unknown, banner back | ignored |

**45, Esc** (Profile or Model tab on screen; columns: does the tab on screen have unsaved changes)

| Where the press is | Unsaved | No changes |
| --- | --- | --- |
| A field of the form | asks (unchanged) | nothing, the key goes on (unchanged) |
| Body (blank click), tab list, Discard, side list row, page top | asks (fix) | nothing |
| Side list Search with text | clears the search only (new: Search calls `preventDefault`) | clears |
| Side list Search empty | asks | nothing |
| Custom colour card, ⋯ menu, Delete dialog, crop card, leave question | the popup closes, no question | the popup closes |
| A keyboard drag of a pinned bot (side list) | the drag cancels, no question | cancels |
| IME composition end | nothing (unchanged) | nothing |
| Key repeat | nothing (unchanged) | nothing |
| Skills, Activity, Usage tab on screen | nothing (no save bar there; see Q4) | nothing |

## 4. Test strategy (test first; red run on `97221d3` recorded for each)

Component tests (`bot-page.test.tsx`, `create-bot-page.test.tsx`), Esc with `pressKey`:

- 40: Delete with a held answer, go to another bot in the side list, answer → still on the other bot, toast shown (red). Same with `/skills` (red). Guard: Cancel while waiting, stay, answer → `/bots` (passes on old; break claim).
- 41: Create Model step, request limit 0, Next/Create → focus on that input (red). Effort: a model with efforts and none picked → focus on Effort (red). Basics Upload with no image → focus in the style group (red). Skills step with a Trash pin → focus on its check box (red). Bot page Model tab, limit 0, Save → focus on the input (red).
- 42: unknown → Try again with a held answer → "Creating" button busy and the banner gone (red); then 5xx → banner back; then Try again → 201 opens the bot page.
- 43: Clone, Create answers 422 `cloned_from_bot_id` → the text shows, no step "!", Create on (red).
- 44: new bot, tick S, the list comes again with S deprecated → row named S with Deprecated, not "A skill in Trash" (red); untick → the row goes.
- 45: Esc on body, on the Profile tab button, on Discard, on a side list row → asks (each red, one test each). Esc on the Skills tab with Profile changes → nothing. Search with text clears only; empty Search asks (red). Keyboard drag cancel → no question (guard). ⋯ menu Esc and Delete dialog Esc close only the popup (guard). The existing IME, repeat, Custom card, "question stays", "no changes, key goes on" tests stay and must pass.
- 46: template 404 with retries on → one GET and "could not find" (guard; break = remove `retry: false`).
- e2e (`bot-page.spec.ts`, real key press): blank click then Esc asks; Esc in the ⋯ menu closes only the menu.

Break list `scripts/breaks/pr-<n>.json` (owner rule: late, security, order/race): claims for 40 (break: drop the mounted check), each Esc guard (breaks: drop `defaultPrevented`; listen in the capture phase; Search without `preventDefault`; drop `repeat`, drop `isComposing`), 42 order cases, DQ-095 (`retry: false`; `key={from ?? "new"}`; the two weak tests' breaks). Other new tests: red run recorded.

## 5. Files

`frontend/src/features/bots/`: `bot-page.tsx`, `bot-side-list.tsx`, `create-bot-page.tsx`, `create-bot-steps.tsx`, `bot-page.test.tsx`, `create-bot-page.test.tsx`, `README.md` (if a purpose line changes). `frontend/src/components/ui/checkbox.tsx` (one prop, Q1). `frontend/test/e2e/bot-page.spec.ts`. `docs/design/components/bot-page.md` (Esc lines only, line 147). `seed/skills/using-the-app/SKILL.md:72` ("Discard, or Esc in a field, asks first" becomes false). `docs/plans/p3-bots-pages.md` + its row in `docs/plans/README.md`. `scripts/breaks/pr-<n>.json`. No backend, no migration, no API change.

## 6. Risks

1. A window listener sees Esc from places that used it silently before. Mitigation: the `defaultPrevented` guard and one test per place (table §3).
2. jsdom runs no microtasks between listeners, a browser does. The "question stays" behaviour is checked in e2e with a real key press too.
3. A Base UI tooltip open on hover takes the first Esc (it calls `preventDefault`): Esc then closes only the tooltip. I treat it like a menu; not claimed in a test.
4. Overlap with PR C (item 32) in `create-bot-page.tsx` catch block: my change is two lines there, `create-bot-form.ts` unchanged.
5. `docs/frontend-conventions.md` §5 row "A key press that opens a dialog" names `bot-page.tsx` as the example of `stopPropagation`. After the change bot-page.tsx is no longer that example. The row stays true for React handlers; it does not change here (Q6).

## 7. Decisions (chief agent, 2026-11-15, revision 1; owner review pending)

- **Q13 A (arena 1):** Esc works on the whole bot page: with unsaved changes it asks to discard,
  wherever the focus is. An open dialog or menu keeps its own Esc.
- **Q1 A:** one optional prop `invalid` on `components/ui/checkbox.tsx` (to `aria-invalid`), so the
  focus can reach a pin with a problem.
- **Q2 A:** a 422 on `cloned_from_bot_id` shows the server's text in the line next to Create, as an
  error with no field. No `FIELD_STEP` entry; `fieldHead` and `stepOfField` do not change (item 32
  is in another PR).
- **Q3 A:** a ticked skill that becomes deprecated shows its name and the Deprecated pill; the
  server's 422 `skill_deprecated` shows under its row on Create. No new text.
- **Q4 A:** Esc is the Discard of the tab on screen. On the Skills, Activity and Usage tabs it does
  nothing.
- **Q5 A:** in the side list Search with text, the first Esc clears the search only.
- **Q6 A:** `docs/frontend-conventions.md` does not change in this PR; a Follow-ups line notes that
  its example (`bot-page.tsx`) no longer calls `stopPropagation()`.
