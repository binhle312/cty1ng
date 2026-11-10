# Frontend conventions (TypeScript)

How TypeScript code is typed. Since D34 these rules apply to `backend/` and `shared/` too;
rows about React, the generated client or UI state apply to the frontend only. Most rules are enforced by `tsc` and ESLint (§3), so a reviewer
does not have to remember them. Adapted from the MIT-licensed
[typescript-best-practices](https://github.com/cursor/plugins/tree/main/pstack/skills/typescript-best-practices)
skill (Lauren Tan), changed where it conflicts with this project. The skill itself is vendored in
`.agents/skills/typescript-best-practices/`; this file wins where they differ (its `SOURCE.md` lists the differences).

## 1. Rules

| Rule | In this project |
| --- | --- |
| **Discriminated unions** | Variants carry a literal discriminant, never a bag of optional fields. Our discriminants: `type` on SSE events (the SSE `event:` name, `realtime-events.md` §4), `status` on runs and messages, `kind` on messages and UI view state. |
| **Exhaustive switches** | Every switch over a discriminant ends with `const _exhaustive: never = x;` in `default`. A new event type that the reducer does not handle fails to compile. |
| **`unknown` at boundaries** | Anything that did not come through the generated client is `unknown` until a schema parses it: SSE payloads, `localStorage` (theme, view settings), `postMessage`, URL search params. On the backend: request bodies, env vars, `config/models.yaml`, JSON columns read from the database, model tool-call arguments. Parse once where it enters, then trust the type. |
| **Schemas, not hand-written guards** | Validation uses Zod (D33). The TypeScript type is inferred from the schema (`z.infer`), never declared twice. |
| **Types from the API, not copies** | REST types come from `frontend/src/lib/api/generated/`. Use `Pick`, `Omit`, `ReturnType`, `Awaited` on them; never redeclare a shape the backend owns. |
| **No `as`** | No type assertions, except `as const`. Use `satisfies` to check a literal without widening it. A cast is allowed only right after a schema parse, with a comment. |
| **Branded ids** | `BotId`, `MessageId`, `ConversationId`, `RunId`, `SkillId` are branded TypeID strings from `shared/src/ids.ts` (D36: `bot_…`, `msg_…`; the schema checks the prefix), so one cannot be passed where another is expected. Brands come from a schema parse, never from `as`. |
| **Simplest total type** | Keep `T[]` while every use is total. Strengthen (for example to a non-empty tuple) only where the loose type forces `!`, a cast or a "should never happen" throw. |
| **Object arguments** | Functions with more than two parameters, or two of the same type, take one object. Not on hot paths (render loops, the Flow renderer's per-frame code). Lint checks the count (§3); two of the same type is the reviewer's check. |
| **One pure module for a stateful screen** | A screen that saves under a lock, takes live events or gets late answers keeps its state rules in one pure module next to it (`<screen>-state.ts`): a reducer from the state and an event to the next state, with no React, fetch or clock. The component sends events and renders the state; it holds no extra flags or refs that change the rules. The module follows the screen's state table ([planning](workflows/planning.md#state-table-for-stateful-screens)) and has one test per cell (`testing.md` §3). The bot list and the settings sort of every page have one: `features/bots/bot-list-state.ts`; so do the bot page's Profile and Model tabs: `features/bots/bot-edit-state.ts`, the card after a save: `features/skills/after-save-card-state.ts`, and every dialog that sends one request: `features/skills/dialog-request-state.ts`. |
| **Bot-list cache writes** | Write the bot list and its settings sort only through `features/bots/bot-list-store.ts`, never with `setQueryData` (lint checks it). A direct cache write bypasses pending requests and can disappear on the next load or answer. |
| **Answers write only what their request owns** | A request remembers what it was sent from (the `row_version`, the `expected` pin, the tab's base) and which fields it writes. Its answer writes only those fields, and only while the page still shows what the request was sent from. Write the fields as an allowlist typed with `Pick`, so a new field fails to compile until someone decides; never spread the answer and then put back the fields to keep. What the answer checks lives as long as the request, not as long as the component that sent it (a counter in a component stops when the owner leaves the tab), and the answer changes the state as it is now, not a copy from the render that sent it (call the newest callback). Examples: `withSaveAnswer` in `features/bots/bot-edit-form.ts`, the pin answers in `features/bots/bot-list-state.ts`, `useAvatarUpload` in `features/bots/crop-card.tsx`. |
| **Real tests** | Test with the real store, router and reducer; mock only the network and the clock. Matches `testing.md`. |
| **Comments with no counts** | A comment says why the code does something. It states a count, or "each", "every" or "all", only when it names the check that holds it, as `secrets.test.ts` does for its operations (decided by the builder at the owner's request, 2026-11-09, DQ-151). A count with no check gets out of date with no sign. |
| **No `console`** | Use the small logger in `frontend/src/lib/log.ts`; it is silent in production builds and never logs message or file contents (`security.md` §2.10). The backend logs through Pino (`architecture.md` §9). |

**Not adopted:** the source suggests modelling a time range as start plus duration.
The frontend and URL keep the unresolved `{ from, to }` expressions, such as `now-7d` to `now`.
The frontend resolves them to absolute ISO-8601 instants before each API call
([time range contract](requirements/time-range-picker.md#contract-with-the-backend-and-the-url)).

## 2. Examples

SSE events use the shared schema in [stream-event.ts](../shared/src/events/stream-event.ts).
Persisted events carry `{ type, seq, data }`; control events carry `{ type, data }`.
[parseFrame](../frontend/src/lib/realtime/sse.ts) parses the frame at the boundary.
The [reducer](../frontend/src/lib/realtime/reducer.ts) handles the parsed union with an exhaustive switch.
Use these implementations as the example; do not define a second event schema in the frontend.

UI state as a union instead of flags:

```ts
// Don't: { loading: boolean; error?: string; data?: Stats }
type StatsView =
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "error"; error: ApiError }
  | { kind: "ready"; data: Stats };
```

This also gives every list and detail view its four required states
(`requirements/README.md`); `loading` renders the shared `Skeleton`, never an inline spinner.

## 3. Enforcement (set up in M0)

`tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`noImplicitOverride`, `noFallthroughCasesInSwitch`.

ESLint (typescript-eslint, type-aware):

| Rule | Setting |
| --- | --- |
| `@typescript-eslint/no-explicit-any` | error |
| `@typescript-eslint/consistent-type-assertions` | `{ assertionStyle: "never" }`, with a reviewed inline disable after a schema parse |
| `@typescript-eslint/switch-exhaustiveness-check` | error |
| `@typescript-eslint/no-non-null-assertion` | error |
| `@typescript-eslint/no-unsafe-*` (assignment, member-access, call, return, argument) | error |
| `no-console` | error |
| `@typescript-eslint/max-params` | `{ max: 2 }` (owner, 2026-11-03). The functions that broke it before are in `eslint-suppressions.json`; new code may not add to it. After you fix one, run `pnpm exec eslint . --prune-suppressions` |

A new rule exception needs a comment saying why, and shows up in review.

## 4. Loading and performance

What the owner sees while things load is in `requirements/README.md` (skeletons). This section
says how the code keeps first load small and long lists fast.

| Rule | In this project |
| --- | --- |
| **Lazy routes** | Heavy views are split into their own chunk with TanStack Router's lazy route files and load on first visit: Statistics (charts), the Flow pane and its maps (the Timeline library chosen in the M8 plan, D27), the skill editor, the Bots pages and the header roster. The rest of the shell (left bar, header frame, conversation) is in the first chunk. While a chunk loads, the route shows its skeleton. |
| **Prefetch on intent** | Links to a lazy route preload its chunk on hover or focus (TanStack Router `preload="intent"`), so the skeleton is rarely seen. |
| **Virtualised long lists** | The message list is virtualised: only the messages near the viewport are in the DOM. It loads older messages on scroll (UI-3.10), keeps the scroll position when they arrive, and still supports "New messages", the "New" divider and jumping to a message. The same applies to the Flow timeline (`flow-view.md` §5) and to any other list that can pass about 200 rows. Library: TanStack Virtual (new dependency, approved with M0's list). |
| **Bundle budget** | CI fails when the first-load JavaScript of the app shell grows past its budget: **250 KB gzipped** to start, measured on the production build. Raising it needs a line in the PR saying why. Lazy chunks get a warning above 300 KB each. |


## 5. Known pitfalls

Things a slice learned the hard way. Check this list during the risk probes ([planning](workflows/planning.md#risk-probes-first)), and add to it when a build finds a new one.

| Area | Pitfall | What to do |
| --- | --- | --- |
| CSP (`security.md` §2.1) | No inline script or style is allowed, and no `eval`. | Put scripts in files. Keep Zod jitless: `frontend/public/zod-init.js` sets it before any module runs, because a chunk can build a schema (`Settings.keyof()`) before `src/lib/zod-config.ts` runs. Do not use Base UI's Select or ScrollArea: they add inline styles; its Popover and Slider are fine. Images from `blob:` URLs are blocked: read a file into a `data:` URL. Colour picker and crop libraries that add a `<style>` element are out (M2 plan, P6). Before using a new library, check it in the production build with `watchCsp` (`testing.md` §3). |
| Drag and drop (`@dnd-kit`) | Moving items while the drag is on makes the list jump and fights the drop line. A sortable's own `onKeyDown` takes Enter, which should open the item. | Move items only in `onDragEnd`, with a strategy that returns `null` (the old place stays as a gap). Let only Space start and end a keyboard drag, and wrap the listener's `onKeyDown` to add Alt+←/→ (`features/bots/pinned-sort.tsx`, `features/shell/header-roster.tsx`). |
| `cn()` and our utilities | tailwind-merge reads a class it does not know by its prefix: `border-dashed-slot` looked like a border colour and was dropped before `border-outline-strong`. | Add every new token to the theme lists in `src/lib/cn.ts`, and every new `@utility` to its `classGroups`. |
| Sticky buttons in a scrolling box | A sticky box stops inside its scroll container's padding, so `bottom-0` lifts it by that padding and it covers the content above. | Offset it by the padding (`-bottom-5` in `components/ui/dialog.tsx`). |
| A nullable enum in an API schema | `z.literal("x").nullable()` becomes an OpenAPI enum without `null`; the generated client then refuses every `null` answer, and the page waits for ever. | Use `z.enum([...]).nullable()`. `backend/test/api/api-docs.test.ts` checks the whole document. |
| Base UI tooltip | A tooltip has no `tooltip` role. | In tests, find the tooltip by its text, not with `getByRole("tooltip")`. |
| Base UI Switch | A disabled Switch has `data-disabled`, not a `disabled` attribute, so `hasAttribute("disabled")` is always false. | In tests, check `data-disabled` (lesson `check-every-order-before-the-push.md`). |
| Base UI menu | A link item stays open after a click. | Give `Menu.LinkItem` `closeOnClick` (see `frontend/src/components/ui/menu.tsx`). |
| Tests: a key press after a click | `click()` can return before a menu opens, and `keyboard.press` waits for nothing. Under load the key arrives first, then the menu opens and stays open. | Wait for the target before the key press: `await expect(menu).toBeFocused()` (`frontend/test/e2e/csp.spec.ts`). |
| Tests: `act()` | When the callback returns a value (for example `act(() => fireEvent.click(x))`), `act()` returns a promise, and `no-floating-promises` fails. | Give the callback braces so it returns nothing, and call `act()` as a statement: `act(() => { fireEvent.click(x); });`. Use `await act(() => promise)` only for async work. |
| Arrow functions | `no-confusing-void-expression` fails when an arrow function returns the value of a call that returns nothing. | Put the body in braces: `() => { doIt(); }`. |
| TanStack Query | `fetchQuery` is deprecated, and `no-deprecated` fails. | Use `queryClient.query({ … })`. |
| Code that waits for a list while live events start newer loads | TanStack Query gives a cut load's promise to the newer load only once. After a second cut, `queryClient.query()` fails with a `CancelledError`, and `invalidateQueries()` ends with the old list still in place. A card then shows as its toast, and a row's actions turn on too early | A read that acts on its answer, and a refresh that ends a row's lock, use `readNewest` and `refreshQueries` (`lib/api/query-reads.ts`). A refresh before a page opens stays plain: the page shows its skeleton while the list loads, and it must open even if live events keep the list loading. A test of a cut load runs the real library, with two cuts, not one |
| "Read all data again" and a first read on its way | `invalidateQueries()` starts a new read only for a query that has data. TanStack Query reuses a first read that is on its way, so its answer can be from before the call. After a `reset`, or after the `ready` of a new stream, no event brings the missed change, and the page stays old with a good status (DQ-197). | Use `readAll` in `lib/realtime/read-all.ts`: it cuts the first reads of the active queries, then calls `invalidateQueries()`. Test such code with a read that has no answer yet, not only with data in the cache. A query whose observers are all turned off (`enabled: false`, a closed dialog) is not active: `readAll` cuts its read with a revert, with or without data, so the query reads when it is turned on again (DQ-198, DQ-199). Known gap: a read with no observer is not cut (DQ-200). Code that asks the query client directly uses `readNewest`, so a cut does not give it an error. |
| A page that finds its item in a list | The skill page finds its skill in the cached list. Opened right after a Create, the list is still old, the page throws `notFound()`, and the router keeps Page not found. | Refetch the list (`await queryClient.invalidateQueries(…)`) before you navigate to the new item. |
| Base UI toast | `Toast.Title` renders an `<h2>`, so a toast adds a heading to the page. | In tests, look for page headings inside `main`. |
| Base UI tabs | `onValueChange` gives the value as `any`, and `no-unsafe-argument` fails. | Map it to a literal: `value === "bots" ? "bots" : "skill"`. |
| An editor of server data | A React `key` made from the server's version resets the form whenever the data changes, also on a save in another tab, and the owner's unsaved edit is lost. | Key the editor by the item's id. Keep the version the edit started from; take new data only when there is no unsaved change, and show a conflict otherwise (`features/skills/skill-page.tsx`). |
| A read that answers "nothing" | A read that maps a missing item to `null` gives a good answer, so TanStack Query replaces the data, and a page that shows Page not found for `null` closes an open editor with its text. A failed read does not do this: it keeps the old data. The Clone page lost a draft in this way when its source went to Trash (DQ-180). | The page instance keeps what its editor opened with (`ClonePage` in `features/skills/new-skill-page.tsx`). Do not keep that value in the query cache: the value must live as long as the open editor, and the cache does not (DQ-185, DQ-191; the next row). Test a full read (`invalidateQueries()`) with the item gone, not only a failed read. |
| A failed refetch | TanStack Query sets `isError` also when a background refetch fails and the old `data` is still there. A page that checks `isError` first replaces its content, and an unsaved edit is lost. | Show the error state only when `data` is `undefined`; keep the page on the data it has (`features/skills/skill-page.tsx`). |
| A save that is still pending | Marking the whole form as saved in `onSuccess` also marks the text typed while the request was pending, and the next refresh replaces that text. | Keep the text the request sent, and mark only that as saved (`markSaved` in `features/skills/skill-form.ts`). |
| Settings in a query key | A query key that holds a setting starts a new query when the setting changes; the page shows its skeleton again and the editor under it, with its draft, is thrown away. | Keep settings out of the keys of queries that hold an editor's source; apply the setting when the editor opens (`features/skills/new-skill-page.tsx`). |
| Waiting on a query that keeps failing | A query with no data goes back to `isPending` on every new try. A page that shows a skeleton while `isPending` unmounts its content, the content's own observer starts a new try on mount, and the page loops. Any wait that can come back also unmounts the content and loses its state (DQ-104). | Wait only for the first answer (keep a "settled" flag, or use `isFetchedAfterMount`), then show the content or the error state (`features/skills/new-skill-page.tsx`, `features/bots/create-bot-page.tsx`). |
| One mutation hook for many rows | In TanStack Query v5 a second `mutate` on a hook drops the `onSuccess`/`onError` passed to the first call, and `isPending`/`variables` follow only the newest call. A failure of the first request goes unseen, and its row looks done while it is still on its way. | Handle each request's result through its own `mutateAsync` promise, and keep the pending state per row or per dialog in local state (`features/skills/skill-bots-tab.tsx`, `removeFromBots` in `features/skills/skill-page.tsx`). |
| A dialog request that ends after its dialog closed | The owner can close a dialog (Skip, Cancel, Esc) while its request is on its way. A late result then closes or writes its error into the dialog opened since. | Send it through `useDialogRequests` (`features/skills/dialog-requests.ts`): each open makes a new dialog object, and the rules are in one pure module (`dialog-request-state.ts`). While that dialog is open the result goes there; after, a success does nothing more and a failure shows as a toast, also after the page went. |
| A mutation that ends after its page closed | The `onSuccess` set on `useMutation` still runs after the component unmounts, so a late `navigate` moves the page the owner went to. | Turn the way out off while the request is pending, and skip the navigation when the component has closed (`features/skills/new-skill-page.tsx`). |
| A form that fills once | A form copies its first values into `useState` and keeps them. If these values come from the cache, the form keeps old data, and the refetch comes too late. A test with a reload hides this, because a reload empties the cache. DQ-003, DQ-085, DQ-086, DQ-096 and DQ-101 have this cause. | Give the form a read of this visit. Use `gcTime: 0` when only this page reads the data and a failed read must stop the form (the template in `features/bots/create-bot-page.tsx`). `gcTime: 0` has a gap: TanStack Query does not remove a query while a read of it is on its way, so a visit that returns before that answer still gets the old data (DQ-191). The Clone of a skill closes the gap: it opens only from a good answer of this visit, `isFetchedAfterMount` with a good status, and it keeps that answer in the page at once, because the status goes back to an error when a later read fails (`ClonePage` in `features/skills/new-skill-page.tsx`, DQ-194). The bot template still has the gap (a follow-up in `status.md`). Wait for `isFetchedAfterMount` when other pages share the query and the last values can stay (the four lists in `create-bot-page.tsx`). It counts per mount and it cannot go back to false, so the wait ends once. Do not use `failureCount` to end a wait: a new read sets it to 0, the wait comes back, and the open form loses its text (DQ-104). If one route serves two forms, put a key on the component that holds the reads (DQ-106). Put the wait in one rule for all the reads that the form fills from: a wait for each value lets the next value escape (DQ-101). `render-app.tsx` turns retries off, so a test of this wait sets its own retries. Test a second visit with no reload, and test that a new read keeps the text of an open form. |
| A browser that says it is offline | TanStack Query pauses reads and saves after an `offline` event, until the browser is online again. The app runs on 127.0.0.1, so the backend still answers, but a first visit stays loading and a save stays pending (DQ-087, DQ-088). | Make the query client with `createQueryClient` (`lib/api/query-client.ts`): reads and saves run in each network state. It also keeps the refetch when the browser is online again, which `"always"` turns off when the option is not set. The app and `test/render-app.tsx` both use it. Lint refuses a value import of `QueryClient`, `new QueryClient`, a `networkMode` and `setDefaultOptions` in each non-test file of `frontend/src` except `query-client.ts` (`eslint.config.js`, owner 2026-11-08); `scripts/lint-rules.test.ts` checks the rules on each file. `test/e2e/offline.spec.ts` tests a sample of first visits and saves after an `offline` event. |
| A key press that opens a dialog | Base UI closes a dialog on an Esc that reaches `document`. If a React `keydown` handler opens the dialog, its effects run before the event reaches `document`, so the same press closes it. `fireEvent` and a bare `dispatchEvent` hide this. | Call `event.stopPropagation()` in the handler that opens the dialog. Leave a key repeat and an Esc that ends an IME composition alone (`features/bots/bot-page.tsx`). Test with `pressKey` (`testing.md` §3) and a real key press in Playwright. |
| Read-only fields | A `disabled` input takes no focus, so its text cannot be selected or copied from the keyboard. | A field the owner may not change but may read uses `readOnly` (`features/skills/skill-fields.tsx`); keep `disabled` for controls that do nothing. |
| Layers (z-index) | Base UI sets no z-index on tooltips and menus, so a page part with `relative z-10` (a check box, a History time, the user panel) shows through them. | The scale: page parts that must sit above a covering click area use `z-10`; dialog backdrops `z-40`; dialogs, toasts, tooltips and menus `z-50` (`components/ui/`). A new popup gets `z-50`. |
| Tooltips on text | A tooltip on a `<time>` or a `<span>` cannot open from the keyboard, because the element takes no focus. | Use `TimeText` (`components/ui/time-text.tsx`), or give the element `tabIndex={0}`. Keep it out of buttons and labels: one control inside another is not allowed. |
| Disabled buttons | A `disabled` button gets no hover or focus, so its "why" tooltip (`ui-rules.md` B5) never shows. | Use `aria-disabled` and ignore the click, as `SaveButton` in `features/skills/save-bar.tsx` does. |
