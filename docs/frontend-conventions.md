# Frontend conventions (TypeScript)

How TypeScript code is typed. Since D34 these rules apply to `backend/` and `shared/` too;
rows about React, the generated client or UI state apply to the frontend only. Most rules are enforced by `tsc` and ESLint (§3), so a reviewer
does not have to remember them. Adapted from the MIT-licensed
[typescript-best-practices](https://github.com/cursor/plugins/tree/main/pstack/skills/typescript-best-practices)
skill (Lauren Tan), changed where it conflicts with this project.

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
| **Object arguments** | Functions with more than two parameters, or two of the same type, take one object. Not on hot paths (render loops, the Flow renderer's per-frame code). |
| **Real tests** | Test with the real store, router and reducer; mock only the network and the clock. Matches `testing.md`. |
| **No `console`** | Use the small logger in `frontend/src/lib/log.ts`; it is silent in production builds and never logs message or file contents (`security.md` §2.10). The backend logs through Pino (`architecture.md` §9). |

**Not adopted:** the source suggests modelling a time range as start plus duration. Our time
ranges are relative expressions (`now-7d` to `now`) shared with the backend
(`requirements/time-range-picker.md`), so they stay `{ from, to }`.

## 2. Examples

SSE event handling, parsed at the boundary and switched exhaustively:

```ts
const RunStartedEvent = z.object({ type: z.literal("run.started"), run: RunSchema });
const MessageDeltaEvent = z.object({
  type: z.literal("message.delta"),
  message_id: MessageId,
  offset: z.number().int().nonnegative(),
  text: z.string(),
});
const StreamEvent = z.discriminatedUnion("type", [RunStartedEvent, MessageDeltaEvent /* … */]);
type StreamEvent = z.infer<typeof StreamEvent>;

function apply(event: StreamEvent): void {
  switch (event.type) {
    case "run.started":
      /* … */
      break;
    case "message.delta":
      /* … */
      break;
    default: {
      const _exhaustive: never = event;
      void _exhaustive;
    }
  }
}

// at the boundary only: the SSE event name becomes the discriminant
const parsed = StreamEvent.safeParse({ type: raw.type, ...JSON.parse(raw.data) });
if (!parsed.success) return log.warn("stream.unknown_event", { seq: raw.lastEventId });
apply(parsed.data);
```

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

A new rule exception needs a comment saying why, and shows up in review.

## 4. Loading and performance

What the owner sees while things load is in `requirements/README.md` (skeletons). This section
says how the code keeps first load small and long lists fast.

| Rule | In this project |
| --- | --- |
| **Lazy routes** | Heavy views are split into their own chunk with TanStack Router's lazy route files and load on first visit: Statistics (charts), the Flow pane and its maps (the Timeline library chosen in the M8 plan, D27), and the skill editor. The rest of the shell (rail, header, conversation) is in the first chunk. While a chunk loads, the route shows its skeleton. |
| **Prefetch on intent** | Links to a lazy route preload its chunk on hover or focus (TanStack Router `preload="intent"`), so the skeleton is rarely seen. |
| **Virtualised long lists** | The message list is virtualised: only the messages near the viewport are in the DOM. It loads older messages on scroll (UI-3.10), keeps the scroll position when they arrive, and still supports "New messages", the "New" divider and jumping to a message. The same applies to the Flow timeline (`flow-view.md` §5) and to any other list that can pass about 200 rows. Library: TanStack Virtual (new dependency, approved with M0's list). |
| **Bundle budget** | CI fails when the first-load JavaScript of the app shell grows past its budget: **250 KB gzipped** to start, measured on the production build. Raising it needs a line in the PR saying why. Lazy chunks get a warning above 300 KB each. |


## 5. Known pitfalls

Things a slice learned the hard way. Check this list during the risk probes (`workflow.md` §2
step 2), and add to it when a build finds a new one.

| Area | Pitfall | What to do |
| --- | --- | --- |
| CSP (`security.md` §2.1) | No inline script or style is allowed, and no `eval`. | Put scripts in files. Keep Zod jitless (`frontend/src/lib/zod-config.ts`), so it does not use `new Function`. Do not use Base UI's Select or ScrollArea: they add inline styles. Before using a new library, check it in the production build with `watchCsp` (`testing.md` §3). |
| Base UI tooltip | A tooltip has no `tooltip` role. | In tests, find the tooltip by its text, not with `getByRole("tooltip")`. |
| Base UI menu | A link item stays open after a click. | Give `Menu.LinkItem` `closeOnClick` (see `frontend/src/components/ui/menu.tsx`). |
| Tests: `act()` | When the callback returns a value (for example `act(() => fireEvent.click(x))`), `act()` returns a promise, and `no-floating-promises` fails. | Give the callback braces so it returns nothing, and call `act()` as a statement: `act(() => { fireEvent.click(x); });`. Use `await act(() => promise)` only for async work. |
| Arrow functions | `no-confusing-void-expression` fails when an arrow function returns the value of a call that returns nothing. | Put the body in braces: `() => { doIt(); }`. |
| TanStack Query | `fetchQuery` is deprecated, and `no-deprecated` fails. | Use `queryClient.query({ … })`. |
| A page that finds its item in a list | The skill page finds its skill in the cached list. Opened right after a Create, the list is still old, the page throws `notFound()`, and the router keeps Page not found. | Refetch the list (`await queryClient.invalidateQueries(…)`) before you navigate to the new item. |
| Base UI toast | `Toast.Title` renders an `<h2>`, so a toast adds a heading to the page. | In tests, look for page headings inside `main`. |
| Base UI tabs | `onValueChange` gives the value as `any`, and `no-unsafe-argument` fails. | Map it to a literal: `value === "bots" ? "bots" : "skill"`. |
| An editor of server data | A React `key` made from the server's version resets the form whenever the data changes, also on a save in another tab, and the owner's unsaved edit is lost. | Key the editor by the item's id. Keep the version the edit started from; take new data only when there is no unsaved change, and show a conflict otherwise (`features/skills/skill-page.tsx`). |
| A failed refetch | TanStack Query sets `isError` also when a background refetch fails and the old `data` is still there. A page that checks `isError` first replaces its content, and an unsaved edit is lost. | Show the error state only when `data` is `undefined`; keep the page on the data it has (`features/skills/skill-page.tsx`). |
| A save that is still pending | Marking the whole form as saved in `onSuccess` also marks the text typed while the request was pending, and the next refresh replaces that text. | Keep the text the request sent, and mark only that as saved (`markSaved` in `features/skills/skill-form.ts`). |
| Settings in a query key | A query key that holds a setting starts a new query when the setting changes; the page shows its skeleton again and the editor under it, with its draft, is thrown away. | Keep settings out of the keys of queries that hold an editor's source; apply the setting when the editor opens (`features/skills/new-skill-page.tsx`). |
| Waiting on a query that keeps failing | A query with no data goes back to `isPending` on every new try. A page that shows a skeleton while `isPending` unmounts its content, the content's own observer starts a new try on mount, and the page loops. | Wait only for the first answer (keep a "settled" flag), then show the content or the error state (`features/skills/new-skill-page.tsx`). |
| A mutation that ends after its page closed | The `onSuccess` set on `useMutation` still runs after the component unmounts, so a late `navigate` moves the page the owner went to. | Turn the way out off while the request is pending, and skip the navigation when the component has closed (`features/skills/new-skill-page.tsx`). |
| Tooltips on text | A tooltip on a `<time>` or a `<span>` cannot open from the keyboard, because the element takes no focus. | Use `TimeText` (`components/ui/time-text.tsx`), or give the element `tabIndex={0}`. Keep it out of buttons and labels: one control inside another is not allowed. |
| Disabled buttons | A `disabled` button gets no hover or focus, so its "why" tooltip (`ui-rules.md` B5) never shows. | Use `aria-disabled` and ignore the click, as `SaveButton` in `features/skills/save-bar.tsx` does. |
