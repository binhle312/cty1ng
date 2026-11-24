# P3 list PR 16: errors that keep the shell

Brief: none. The source is items 65 ("Fix before M3") and 66 of the P3 list (the audit of
2026-11-05, "A, Skills"), with the M0 plan's promise of a route error boundary
(`M0-skeleton.md:120`).
Checkpoint: plan (`AGENTS.md` §7: the UI design of a new screen and its texts; the roster fallback).
Approval: accepted by the owner, 2026-11-15 ("P-16: approve"; revision 2, in the owner's answers
of 2026-11-15 12:15). The answers to Q1 to Q3 are the plan's recommendations, by the lead agent's
reading of that approval (part 7); the PR lists this under "Needs human review".


Code read at `origin/main` = `97221d3` (revision 2), and again at `109d20c` before the build. I read TanStack Router 1.170.46 (the lock file version)
in `node_modules`. I ran nothing. An independent reviewer checked the facts.

## 1. What I found

| # | Today | State |
| --- | --- | --- |
| 65 | No `errorComponent`, `defaultErrorComponent` or `ErrorBoundary` in `frontend/src`; `router.ts:8-13` sets none. The router's own global boundary (`Matches.js:38-44`) catches a render error or a failed lazy chunk. It replaces the whole window, the shell too, with its built-in English screen "Something went wrong!" and a "Show Error" button that shows `error.message` (open by default in a development build). The header roster is a `React.lazy` chunk in the shell (`top-header.tsx:11`); if it fails, the same thing happens | still there |
| 66 | `skill-page.tsx:115` throws `notFound()` in a component. The router catches it only on a route that has a `notFoundComponent` (`Match.js`, `matchView`). Only the root route has one (`routes/root.tsx:12`), and that boundary wraps the root component, the `AppShell`. So Page not found replaces the shell. The spec says "the not-found state of the shell" (`skills-page.md` §1). An unknown URL and `/c/bad-id` (`beforeLoad`) keep the shell: the router marks the root match `_notFound` and renders the page in the root `Outlet` | still there (read; not run) |

The M0 plan promised "a route error boundary with 'Something went wrong' and a Retry button"
(`docs/plans/M0-skeleton.md:120`). No PR built it.

## 2. UI design (proposal)

The shell stays: rail, bar 2, user panel, header. Only the part that failed shows the error
screen. It has the layout and classes of Page not found (`not-found-page.tsx`): `px-8 py-6`,
a heading, a muted line, buttons under it.

```
┌──────┬────────┬──────────────── header: bot roster ─────────────────┐
│ rail │ bar 2  │                                                     │
│      │        │  Something went wrong                               │
│      │        │  The app could not show this page. Try again, or    │
│      │        │  go to Home.                                        │
│      │        │                                                     │
│      │        │  [ Try again ]  [ Go to Home ]                      │
└──────┴────────┴─────────────────────────────────────────────────────┘
```

On the Skills page, an error in the skill page keeps the list column:

```
│ rail │ + Create  Search    │ Something went wrong                  │
│      │ Write user stories  │ The app could not show this page. ... │
│      │ Review a design     │ [ Try again ]  [ Go to Home ]         │
```

| Part | Text | Source |
| --- | --- | --- |
| Heading (`h1`, `text-xl font-semibold`) | "Something went wrong" | new text: needs the owner (in the M0 plan, but no screen used it) |
| Line (`text-on-surface-muted`) | "The app could not show this page. Try again, or go to Home." | new text: needs the owner |
| Button (secondary, `size: "page"`) | "Try again" | existing text (`load-error.tsx`) |
| Link button (secondary, `size: "page"`) | "Go to Home" | existing text and style (`not-found-page.tsx`) |
| Error details | none: no `error.message`, no stack | `AGENTS.md` §8 |

- The box has `role="alert"`, as `LoadError` has.
- Both buttons are secondary, so there is no primary button (ui-rules B1 to B3).
- The error goes to `lib/log.ts` (silent in production) through the router's `defaultOnCatch`.
- **Unsaved text is lost.** An error in a page with an unsaved edit (the skill editor, the bot
  page) removes the editor. No leave question shows, because the guard goes with the page. The
  rule goes into `requirements/app-shell.md` "Errors".
- **The shell itself fails** (the rail or the header throws): the error screen fills the window,
  with no shell, because the shell is the part that failed. The texts are the same.
- **The roster chunk fails**: the header shows the avatars in their places, with no drag, no
  pin and no text. It is `RosterStandIn` with a new prop `failed`. That prop drops
  `aria-busy="true"` (`top-header.tsx:72`) and the slot "Drag a bot here to pin it" (`:77`),
  because neither is true after a failure. `React.lazy` keeps the rejection, so the roster
  loads again only after a browser reload. The rest of the app works. A small boundary
  catches the error, and its `onCatch` writes it to `lib/log.ts`.

How the owner recovers:
- **Try again**: `router.invalidate()`. The router makes new matches, so the boundary resets
  and the page renders again; a failed lazy page chunk loads again (risk probe 2). If the page
  throws again, the error screen shows again, once for each click, with no loop.
- **Go to Home**: a link to `/`.
- Any link in the shell or in the Skills list also resets the boundary, because the router
  resets it when the match changes.

## 3. Where the boundary sits

| Option | Result |
| --- | --- |
| A (recommended). `defaultErrorComponent: ErrorPage` and `defaultOnCatch` in `createAppRouter` (`router.ts`) | Each route match gets its own boundary. A page error shows in the `Outlet` of its parent, so the shell and the Skills list column stay. The root route gets one too, for an error in the shell |
| B. `errorComponent` on the root route only (`root.tsx`) | Its boundary wraps the `AppShell`, so each page error replaces the shell. Not enough |
| C. Our own React boundary around `{children}` in `app-shell.tsx`, plus B | Works, but we write the reset on navigation that the router already has |

The roster boundary uses TanStack's exported `CatchBoundary` around the `Suspense` in
`top-header.tsx`.

Item 66:

| Option | Result |
| --- | --- |
| A (recommended). `SkillPage` returns `<NotFoundPage />`, as `new-skill-page.tsx:93` does for a Clone with no source | The shell and the list column stay; a later list that has the skill shows it. Simplest |
| B. Keep the throw; add `notFoundComponent: NotFoundPage` to `skillsRoute` | The shell stays; the list column goes, as the comment at `skill-page.tsx:113` says |

With A, no component in `frontend/src` throws `notFound()`. I add a row to
`frontend-conventions.md` §5 ("a `notFound()` thrown in a component replaces the shell; return
`<NotFoundPage />`"). I also correct the row "A page that finds its item in a list".

Files: `router.ts`, a new `features/placeholder/error-page.tsx` (and its `README.md`, whose
first line becomes "what a page shows when it has no content"), `top-header.tsx`,
`skill-page.tsx`, `frontend-conventions.md` §5, an "Errors" rule in `requirements/app-shell.md`
(the error screen, recovery, unsaved text lost), `skills-page.md` §1, `docs/status.md`,
`docs/delivery-quality.md`, and the Guide skill (a visible change).

## 4. Risk probes (before the plan is final)

1. A route boundary must pass on the `notFound()` of `/c/bad-id` and of an unknown URL, so Page
   not found shows, not the error screen (`Match.js:52-62` rethrows it; prove it in a test).
2. A failed lazy page chunk, then Try again: does `router.invalidate()` load the chunk again,
   and does Chromium try a failed `import()` again or keep the failure? If it keeps it, Try
   again calls `location.reload()` for a chunk error. Probe in Playwright with a blocked chunk.
3. React 19 logs a caught error with `console.error`. Check that the test setup accepts it, or
   silence it only in those tests.

## 5. Test strategy (before code)

Red first; the PR records each red run. The security claim (no error text on screen) also gets
a break list entry (`testing.md` §5).

**Exception to "Real tests"** (`frontend-conventions.md` §1: mock only the network and the
clock). No real page throws on purpose, so the tests use `vi.mock` to make one page component
throw. The router, the shell and the query client stay real. The other option is a test-only
route, but `createAppRouter` would then need a parameter that only tests use. The PR lists the
exception under "Needs human review".

| Behaviour | Level | Cases |
| --- | --- | --- |
| An unknown skill slug shows Page not found with the rail, the header and the list column | component, `renderApp("/skills/nothing")` | also when a refresh removes the open skill; the existing Delete row 3 tests stay green |
| A page that throws shows the error screen inside the shell | component, a page mocked to throw | heading, line, both buttons; rail and header there |
| The screen never shows the error message | component | the thrown text is not in the document |
| Try again renders the page again | component | the mock stops throwing |
| Try again when the page throws again | component | the error screen shows again; one render for each click |
| A shell link and Go to Home leave the error screen | component | the boundary resets on the new match |
| An error in the skill page keeps the Skills list column | component | a mocked `SkillHistory` throws on the History tab |
| Unsaved text is lost on an error, with no leave question | component | type in the editor, the page throws, click a shell link: no question |
| An error in the shell fills the window | component | the header throws |
| A failed roster chunk shows the avatars, with no busy flag and no drag text | component, the import rejects | `aria-busy` absent; the slot text absent; the log gets the error; links work |
| Page not found still works with route boundaries | component | `/nothing`, `/c/bad-id` |
| A failed lazy page chunk, then Try again | e2e (Playwright, fake model) | block the skills chunk; error screen in the shell; unblock; Try again |
| No axe problem on the error screen | e2e | light and dark |

## 6. Open questions

**Q1. The two new texts.** Example: the bot page throws while you edit. Proposal: "Something went
wrong" and "The app could not show this page. Try again, or go to Home."

| Heading | Gain | Cost |
| --- | --- | --- |
| "Something went wrong" (recommended) | It is the M0 plan's text; people know it | It does not say what went wrong |
| "This page stopped working" | It says which part failed: the page, not the app | A new phrase; it is not right for the full-window case, where the shell failed |

UI texts can wait for your UI review after M3. Then the PR ships the proposal and marks the
texts as waiting for review.

**Q2. Item 66: A (return `<NotFoundPage />`, the list column stays) or B (keep the throw, the
list column goes)?** I recommend A: simplest, and the Clone page does the same.

**Q3. The roster fallback.**

| Option | Gain | Cost |
| --- | --- | --- |
| A (recommended). `RosterStandIn` with `failed`: avatars only, no busy flag, no drag text | The header keeps its look; the rest of the app works | No drag and no pin in the header until a browser reload (`React.lazy` keeps the rejection) |
| B. No roster boundary | No code | A failed roster chunk shows the error screen in the whole window, with no shell |
| C. A lazy loader that tries again on the next page move | The roster can come back with no reload | More code and its tests, for a chunk on `127.0.0.1` that rarely fails |

## 7. Approval and answers (2026-11-15)

The owner approved this plan, revision 2, on 2026-11-15 ("P-16: approve"). The owner's note says
that the plan's own recommended answers count as approved with the plan; this is the lead agent
agent's reading, so the PR lists it under "Needs human review".

- Q1: the two texts ship as proposed ("Something went wrong"; "The app could not show this page.
  Try again, or go to Home."). They wait for the owner's UI review after M3.
- Q2: A. `SkillPage` returns `<NotFoundPage />`; the list column stays.
- Q3: A. `RosterStandIn` with `failed`.

## 8. Risk probe results (before the build, at `109d20c`)

The probes ran in a scratch folder outside the repository, with the real route tree and shell.

| Probe | Result |
| --- | --- |
| Item 66 today, `/skills/nothing` | Page not found with no rail, no header and no list column: the shell is lost (now run) |
| A page that throws today | The router's built-in screen, with no shell, shows the thrown text |
| 1. `/nothing` and `/c/bad-id` with route boundaries | Page not found inside the shell; no error screen |
| 1. `/skills/nothing` with route boundaries and the throw kept | No Page not found: the `notFound()` passes every route boundary and reaches the router's global boundary, which shows its built-in screen with no shell. So Q2 option A is required with this design, not only simpler |
| A page that throws, with route boundaries | The error screen in the shell; the Skills list column stays; the thrown text is not on the page |
| Try again while the page still throws | The error screen again. React renders the page two times for each attempt (its own retry), then stops: no loop. The test checks "no loop", not "one render for each click" |
| 2. Chromium 156 (Playwright 1.64.1) and a failed `import()` | The browser fetches the module again on the next `import()` (two requests, the second good), for an aborted request and for a 500. TanStack resets the lazy route after a failed load. So Try again is `router.invalidate()` only, with no `location.reload()` |
| 3. React 19 and a caught error | One `console.error` call; the test setup accepts it. Tests that throw on purpose silence it |
| Roster: `CatchBoundary` around `Suspense` with a rejected `React.lazy` | The boundary catches it. `React.lazy` keeps the rejection (one load), so a reset only throws again: the roster boundary has a constant reset key |

Build details that follow from the probes:

- `router.ts` exports one object with the error options. `createAppRouter` and the component
  test helper `test/render-app.tsx` both use it, so the component tests run the real
  configuration.
- The log line has the event name and the error name only, never the message
  (`security.md` §2.10).

## 9. Build changes (2026-11-15, the lead agent's approval)

- Part 5, the row "Try again when the page throws again": "one render for each click" becomes
  "no loop (the render count stops growing)". React renders a throwing component two times for
  each attempt (part 8). The behaviour does not change. The PR names this under "Needs human
  review".
- The test helper `test/render-app.tsx` takes the error options from `router.ts`; it does not
  switch to `createAppRouter`, because `defaultPreload: "intent"` could change other tests.
- After review round 1 (2026-11-15), part 10 matches the build: T6 has no late answer (the late
  answer is in T11); T8 recovers before the clicks; T8 and T10 are exempt from the break list
  ("Not claimed" in the PR); T7, T13 and E1 have their breaks. The e2e tests came after the code,
  so they have breaks. The app has dark colours only (`themes/command.css`), so the light axe run
  checks the dark colours.

## 10. Test strategy as built

The exception to "Real tests" (part 5): `vi.mock` makes one component throw; the router, the
shell, the query client and the fake network stay real. A test that throws on purpose silences
`console.error` and `console.warn`.

| # | Test | Red on `109d20c` | Break list |
| --- | --- | --- | --- |
| T1 | An unknown skill slug shows Page not found with the rail, the header and the list column | yes | no |
| T2 | A skill that a refresh removes shows Page not found in the Skills page, list column there | yes | no |
| T3 | A page that throws shows the error screen inside the shell | yes | no |
| T4 | The error screen never shows the error message | yes | yes (security) |
| T5 | The error goes to the log with its name, without its message | yes | yes (security) |
| T6 | Try again renders the page again | yes | no |
| T7 | Try again while the page still throws shows the error screen again, with no loop | yes | yes (order): two claims, "again" and "no loop" |
| T8 | A double click on Try again ends on the page (the page recovers before the clicks) | yes | exempt: an order case of the router itself; "Not claimed" in the PR |
| T9 | Go to Home leaves the error screen | yes | no |
| T10 | A rail link leaves the error screen; coming back renders the page again | yes | exempt: an order case of the router itself; "Not claimed" in the PR |
| T11 | A list answer that comes late, while the error screen shows, keeps it, with no new render | yes | yes (order) |
| T12 | An error in the skill page keeps the Skills list column | yes | no |
| T13 | An error removes unsaved text with no leave question | yes | yes (state) |
| T14 | An error in the shell fills the window with the error screen | yes | no |
| T15 | A failed roster chunk shows the avatars with no busy flag and no drag text | yes | no |
| T16 | A failed roster chunk writes one log line, and the rail links still work | yes | no |
| T17 | A failed roster chunk follows a new bot list, with no second log line | yes | yes (order) |
| T18 | Guard: Page not found still shows inside the shell for an unknown URL and `/c/bad-id` | no (a guard) | exempt: the router's own behaviour |
| E1 | A failed Skills chunk shows the error screen in the shell; after the chunk comes back, Try again shows the Skills page | yes (late test) | yes: claims E1 (the app's screen), E1b (the shell) and E2 (Try again) of the break list |
| E2 | The error screen has no axe violation, light and dark | yes (late test) | yes: claims A-light and A-dark of the break list, a contrast break in each mode |
